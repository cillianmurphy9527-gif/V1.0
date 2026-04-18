import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminRole } from '@/lib/admin-auth';

export async function POST(req: NextRequest, { params }: { params: { userId: string } }) {
  try {
    // 🛡️ 鉴权：只有管理员可操作
    const auth = await requireAdminRole(['SUPER_ADMIN', 'FINANCE', 'OPS']);
    if (!auth.ok) return auth.response;

    const { userId } = params;
    const body = await req.json();
    const { action, amount } = body;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return NextResponse.json({ error: '用户不存在' }, { status: 404 });

    // 💥 动作 1：强制充值
    if (action === 'gift') {
      if (!amount || amount <= 0) return NextResponse.json({ error: '金额无效' }, { status: 400 });
      
      const newTokens = user.tokenBalance + amount;
      await prisma.$transaction([
        prisma.user.update({
          where: { id: userId },
          data: { tokenBalance: newTokens }
        }),
        prisma.tokenTransaction.create({
          data: {
            userId: userId,
            amount: amount,
            reason: 'ADMIN_GIFT',
            balanceBefore: user.tokenBalance,
            balanceAfter: newTokens,
            status: 'COMPLETED'
          }
        })
      ]);
      return NextResponse.json({ success: true, message: '充值成功' });
    }

    // 💥 动作 2：致命封禁
    if (action === 'ban') {
      await prisma.$transaction([
        // 将账号拉黑并清空所有算力，防止他用接口盗刷
        prisma.user.update({
          where: { id: userId },
          data: { 
            isSendingSuspended: true, // 阻断发信
            tokenBalance: 0 // 资产清零
          }
        }),
        prisma.tokenTransaction.create({
          data: {
            userId: userId,
            amount: -user.tokenBalance,
            reason: 'ADMIN_BAN_CONFISCATE',
            balanceBefore: user.tokenBalance,
            balanceAfter: 0,
            status: 'COMPLETED'
          }
        })
      ]);
      return NextResponse.json({ success: true, message: '已彻底封禁并清空资产' });
    }

    return NextResponse.json({ error: '未知动作' }, { status: 400 });

  } catch (error: any) {
    console.error("❌ 管理员操作失败:", error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}