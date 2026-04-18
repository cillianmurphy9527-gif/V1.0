import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminRole } from '@/lib/admin-auth';

/**
 * GET /api/admin/orders/[orderId]/audit
 * 退款前置审计接口：自动扫描客户的硬性成本和算力消耗
 */
export async function GET(req: NextRequest, { params }: { params: { orderId: string } }) {
  try {
    const auth = await requireAdminRole();
    if (!auth.ok) return auth.response;

    const { orderId } = params;

    // 1. 获取订单及用户信息
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { user: true }
    });

    if (!order) return NextResponse.json({ error: '订单不存在' }, { status: 404 });

    // 2. 🔍 核心查账 A：扫描有没有买过域名（致命硬成本）
    const domainCount = await prisma.domain.count({
      where: { userId: order.userId }
    });

    // 3. 🔍 核心查账 B：计算订单付款以来的算力消耗
    // 找出该用户在这个订单之后，所有类型为 CONSUME（消耗）的负数流水
    const consumeTxs = await prisma.tokenTransaction.findMany({
      where: {
        userId: order.userId,
        amount: { lt: 0 }, // 提取扣减流水的绝对值
        createdAt: { gte: order.createdAt }
      }
    });

    const tokensConsumed = consumeTxs.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
    
    // 计算消耗比例 (如果分配了算力的话)
    let consumeRatio = 0;
    if (order.tokensAllocated && order.tokensAllocated > 0) {
      consumeRatio = (tokensConsumed / order.tokensAllocated) * 100;
    }

    // 4. 🧠 AI 裁判：生成最终的退款建议
    const hasDomainRisk = domainCount > 0;
    const hasTokenRisk = consumeRatio > 5;
    
    let advice = '✅ 安全可退款（未触碰红线）';
    if (hasDomainRisk) advice = '🚨 绝对禁止全额退款！该用户已激活域名，产生高昂硬成本！';
    else if (hasTokenRisk) advice = `⚠️ 警告！算力已消耗 ${consumeRatio.toFixed(1)}%，超过 5% 退款红线！`;

    return NextResponse.json({
      orderId: order.id,
      tradeNo: order.tradeNo,
      amountPaid: order.amount,
      auditResult: {
        domainCount,
        tokensAllocated: order.tokensAllocated,
        tokensConsumed,
        consumeRatio: consumeRatio.toFixed(2) + '%',
        hasDomainRisk,
        hasTokenRisk,
        systemAdvice: advice // 👈 直接把这句话显示给老板看！
      }
    });

  } catch (error: any) {
    console.error("❌ 订单审计崩溃:", error);
    return NextResponse.json({ error: '审计失败' }, { status: 500 });
  }
}