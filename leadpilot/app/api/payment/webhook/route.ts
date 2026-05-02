import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { out_trade_no, transaction_id, trade_status } = body;

    // 1. 只有明确成功的状态才放行
    if (trade_status !== 'TRADE_SUCCESS' && trade_status !== 'SUCCESS') {
      return NextResponse.json({ message: '忽略未成功或进行中的状态' });
    }

    // 2. 查找对应 PENDING 订单
    const order = await prisma.order.findUnique({ where: { tradeNo: out_trade_no } });
    if (!order || order.status === 'PAID') {
      return NextResponse.json({ message: '订单不存在或已被处理，防止重复发货' });
    }

    // 3. 核心事务
    await prisma.$transaction(async (tx) => {
      // A. 更新订单状态
      await tx.order.update({
        where: { id: order.id },
        data: { status: 'PAID', paymentIntentId: transaction_id }
      });

      // B. 算力充值
      const currentUser = await tx.user.findUnique({ where: { id: order.userId } });
      const currentTokens = currentUser?.tokenBalance || 0;
      const newTokens = currentTokens + order.tokensAllocated;

      await tx.user.update({
        where: { id: order.userId },
        data: { tokenBalance: newTokens }
      });

      // C. 算力流水记账
      if (order.tokensAllocated > 0) {
        await tx.tokenTransaction.create({
          data: {
            userId: order.userId,
            amount: order.tokensAllocated,
            reason: 'RECHARGE',
            balanceBefore: currentTokens,
            balanceAfter: newTokens,
            status: 'COMPLETED'
          }
        });
      }

      // 🌟🌟🌟 D. 核心修复：如果是订阅订单，同步 UserQuota 表所有配额！
      if (order.orderType === 'SUBSCRIPTION') {
        const template = await tx.planTemplate.findUnique({
          where: { planCode: order.plan }
        });
        if (template) {
          await tx.userQuota.upsert({
            where: { userId: order.userId },
            update: {
              tier: template.planCode,
              leadsLimit: template.leadsLimit,
              leadsBalance: template.leadsLimit,
              emailAccountsLimit: template.emailAccountsLimit,
              dailySendLimit: template.dailySendLimit,
              exportBalance: { increment: template.exportQuota }
            },
            create: {
              userId: order.userId,
              tier: template.planCode,
              leadsLimit: template.leadsLimit,
              leadsBalance: template.leadsLimit,
              emailAccountsLimit: template.emailAccountsLimit,
              dailySendLimit: template.dailySendLimit,
              exportBalance: template.exportQuota
            }
          });
        }
        // 同时更新 User 表的 subscriptionTier 和 planType
        await tx.user.update({
          where: { id: order.userId },
          data: { subscriptionTier: order.plan, planType: order.plan }
        });
      } else {
        // 非订阅订单（如加购），只更新 subscriptionTier（如果有的话）
        await tx.user.update({
          where: { id: order.userId },
          data: {
            tokenBalance: newTokens,
            ...(order.orderType === 'SUBSCRIPTION' ? { subscriptionTier: order.plan } : {})
          }
        });
      }
    });

    console.log(`✅ [支付回调] 订单 ${out_trade_no} 已全部处理完成。`);
    return NextResponse.json({ success: true, message: '回调处理成功' });
  } catch (error) {
    console.error('❌ [支付回调] 处理失败:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}