import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminRole } from '@/lib/admin-auth';

/**
 * GET /api/admin/users/[userId]/stats
 * 超级管理员专属查账接口：透视任意客户的资产、域名与流水
 */
export async function GET(req: NextRequest, { params }: { params: { userId: string } }) {
  try {
    // 1. 🛡️ 鉴权：仅限老板和财务可查
    const auth = await requireAdminRole(['SUPER_ADMIN', 'FINANCE']);
    if (!auth.ok) return auth.response;

    const { userId } = params;

    // 2. 🔍 核心查账：使用事务并发抓取该客户的全部家底
    const [user, quota, domainCount, recentTxs, campaignCount] = await prisma.$transaction([
      prisma.user.findUnique({ 
        where: { id: userId },
        select: { email: true, companyName: true, subscriptionTier: true, createdAt: true, tokenBalance: true }
      }),
      prisma.userQuota.findUnique({ where: { userId } }),
      prisma.domain.count({ where: { userId } }),
      prisma.tokenTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10 // 提取最近的10笔扣费流水
      }),
      prisma.campaign.count({ where: { userId } })
    ]);

    if (!user) {
      return NextResponse.json({ error: '客户不存在' }, { status: 404 });
    }

    // 3. 📊 返回结构化财务明细
    return NextResponse.json({
      profile: {
        email: user.email,
        company: user.companyName,
        tier: user.subscriptionTier,
        registerDate: user.createdAt
      },
      balances: {
        tokenBalance: user.tokenBalance, // 客户手里剩下的算力
        leadsBalance: quota?.leadsBalance || 0, // 客户手里剩下的线索量
        apiCostTotal: quota?.apiCostTotal || 0, // ⚠️ 该客户总共烧了您多少 API 成本
      },
      assets: {
        domainCount, // 客户名下有几个独立发信域名
        campaignCount // 客户总共跑了多少次拓客任务
      },
      history: recentTxs // 最近的真实账单流水
    });

  } catch (error: any) {
    console.error("❌ 客户深度查账接口崩溃:", error);
    return NextResponse.json({ error: '查账执行失败' }, { status: 500 });
  }
}