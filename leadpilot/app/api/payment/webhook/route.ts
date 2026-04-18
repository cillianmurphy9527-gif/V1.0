import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    // 🚨 预留防线：下周这里将接入微信/支付宝/Stripe的真实验签代码
    // 必须通过官方 SDK 验证签名，确保请求真的是支付网关发来的，而不是黑客伪造的！
    const body = await req.json();
    
    // 提取网关返回的单号和状态 (以通用逻辑为例，具体依下周接入的网关文档为准)
    const { out_trade_no, transaction_id, trade_status } = body;

    // 1. 只有官方返回明确的成功状态，才允许放行
    if (trade_status !== 'TRADE_SUCCESS' && trade_status !== 'SUCCESS') {
      return NextResponse.json({ message: '忽略未成功或进行中的状态' });
    }

    // 2. 查找对应的 PENDING (待支付) 订单，注意这里用的是您真实的 tradeNo 字段
    const order = await prisma.order.findUnique({ 
      where: { tradeNo: out_trade_no } 
    });

    if (!order || order.status === 'PAID') {
      return NextResponse.json({ message: '订单不存在或已被处理，防止重复发货' });
    }

    // 💥 3. 核心事务锁：改状态 -> 加额度 -> 记流水 (三步必须同时成功，否则全部回滚)
    await prisma.$transaction(async (tx) => {
      
      // A. 锁定订单状态，并存入第三方官方流水号（这是未来退款的唯一凭证！）
      await tx.order.update({
        where: { id: order.id },
        data: { 
          status: 'PAID',
          paymentIntentId: transaction_id, // 您真实 schema 中的网关流水号字段
        }
      });

      // B. 获取用户当前算力，准备发货
      const currentUser = await tx.user.findUnique({ where: { id: order.userId } });
      const currentTokens = currentUser?.tokenBalance || 0;
      const newTokens = currentTokens + order.tokensAllocated;

      // C. 极度关键：给买家加上真实的算力额度，并根据订单类型升级 VIP 套餐
      await tx.user.update({
        where: { id: order.userId },
        data: {
          tokenBalance: newTokens,
          ...(order.orderType === 'SUBSCRIPTION' ? { subscriptionTier: order.plan } : {})
        }
      });

      // D. 算力流水记账：生成一条极其严谨的账单，供以后查账对质
      if (order.tokensAllocated > 0) {
        await tx.tokenTransaction.create({
          data: {
            userId: order.userId,
            amount: order.tokensAllocated, // 增加的算力值
            reason: 'RECHARGE',            // 充值原因
            balanceBefore: currentTokens,  // 充值前余额
            balanceAfter: newTokens,       // 充值后余额
            status: 'COMPLETED'
          }
        });
      }
    });

    console.log(`✅ [支付回调] 真金白银入账！订单 ${out_trade_no} 已发货。官方流水号: ${transaction_id}`);
    return NextResponse.json({ success: true, message: '回调处理成功' });

  } catch (error) {
    console.error("❌ [支付回调] 处理发生严重失败:", error);
    // 故意返回 500，这样微信/支付宝的服务器如果没收到成功信号，会在几分钟后重试，确保绝不漏单！
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}