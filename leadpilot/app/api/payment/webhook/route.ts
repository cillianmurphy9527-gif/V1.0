import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

// 🌟 验证支付宝签名
function verifyAlipaySignature(params: Record<string, string>): boolean {
  const sign = params.sign;
  if (!sign) return false;
  
  const signType = params.sign_type || 'RSA2';
  const publicKey = process.env.ALIPAY_PUBLIC_KEY;
  if (!publicKey) {
    console.error('[支付验签] 缺少 ALIPAY_PUBLIC_KEY 环境变量');
    return false;
  }

  // 移除 sign 和 sign_type 后排序拼接
  const sortedParams = Object.keys(params)
    .filter(key => key !== 'sign' && key !== 'sign_type' && params[key] !== undefined && params[key] !== '')
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&');

  const verify = crypto.createVerify(signType === 'RSA2' ? 'RSA-SHA256' : 'RSA-SHA1');
  verify.update(sortedParams);
  return verify.verify(publicKey, sign, 'base64');
}

// 🌟 验证微信支付签名
function verifyWechatSign(body: string, signature: string): boolean {
  const secret = process.env.WECHAT_PAY_SECRET;
  if (!secret) {
    console.error('[支付验签] 缺少 WECHAT_PAY_SECRET 环境变量');
    return false;
  }
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
  return signature === expected;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { out_trade_no, transaction_id, trade_status } = body;

    // 🌟 签名验证
    const signature = req.headers.get('x-payment-signature');
    const paymentMethod = req.headers.get('x-payment-method'); // 'alipay' | 'wechat'

    if (process.env.NODE_ENV === 'production') {
      if (paymentMethod === 'wechat' && signature) {
        const rawBody = JSON.stringify(body);
        const isValid = verifyWechatSign(rawBody, signature);
        if (!isValid) {
          console.error('[支付验签] 微信签名验证失败');
          return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
        }
      } else if (paymentMethod === 'alipay') {
        const isValid = verifyAlipaySignature(body);
        if (!isValid) {
          console.error('[支付验签] 支付宝签名验证失败');
          return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
        }
      } else if (!paymentMethod && !signature) {
        console.warn('[支付验签] 生产环境未提供签名，放行（需尽快配置签名）');
      }
    }

    // 1. 只有明确成功的状态才放行
    if (trade_status !== 'TRADE_SUCCESS' && trade_status !== 'SUCCESS') {
      return NextResponse.json({ message: '忽略未成功或进行中的状态' });
    }

    // 2. 查找对应 PENDING 订单（幂等：已处理直接返回）
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

      // D. 如果是订阅订单，同步 UserQuota 表所有配额
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
        // 同时更新 User 表的 subscriptionTier、planType 和 tokenBalance
        await tx.user.update({
          where: { id: order.userId },
          data: { subscriptionTier: order.plan, planType: order.plan, tokenBalance: newTokens }
        });
      } else {
        // 非订阅订单（加购），只更新 tokenBalance，不动 tier
        await tx.user.update({
          where: { id: order.userId },
          data: { tokenBalance: newTokens }
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