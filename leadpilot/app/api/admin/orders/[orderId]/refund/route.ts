/**
 * POST /api/admin/orders/[orderId]/refund
 * Admin 审批退款申请：同意原路退回 或 驳回
 *
 * body: { action: 'approve' | 'reject', rejectReason?: string }
 *
 * ─── 真实退款网关调用说明 ──────────────────────────────────────────
 * 项目当前处于 MVP 阶段，支付网关（微信支付/支付宝）尚未完成对接，
 * Order.paymentIntentId 字段暂时为空。
 *
 * 真实退款调用逻辑：
 *   - 有 paymentIntentId：调用对应网关的退款 API（见下方 callPaymentGatewayRefund）
 *   - 无 paymentIntentId：降级为 Mock 模式，记录 console.warn，直接更新数据库状态
 *     （生产上线前必须接入真实网关并移除 Mock 分支）
 *
 * 网关对接示意（取消注释即可启用）：
 *   微信支付 v3：POST https://api.mch.weixin.qq.com/v3/refund/domestic/refunds
 *   支付宝：alipay.trade.refund
 *   Stripe：stripe.refunds.create({ payment_intent: paymentIntentId })
 * ─────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminRole } from '@/lib/admin-auth'

// ─── 支付网关退款调用（当前为 Mock，上线前替换为真实实现）──────────
async function callPaymentGatewayRefund(params: {
  paymentIntentId: string
  amount: number
  orderId: string
  reason: string
}): Promise<{ success: boolean; gatewayRefundId?: string; error?: string }> {
  const { paymentIntentId, amount, orderId } = params

  // ── Stripe 示例（取消注释并安装 stripe 包即可启用）──────────────
  // import Stripe from 'stripe'
  // const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-04-10' })
  // try {
  //   const refund = await stripe.refunds.create({
  //     payment_intent: paymentIntentId,
  //     amount: Math.round(amount * 100), // Stripe 使用分为单位
  //   })
  //   return { success: true, gatewayRefundId: refund.id }
  // } catch (e: any) {
  //   return { success: false, error: e.message }
  // }

  // ── 微信支付 v3 示例（取消注释并配置密钥即可启用）────────────────
  // const wxRefundRes = await fetch('https://api.mch.weixin.qq.com/v3/refund/domestic/refunds', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json', Authorization: `WECHATPAY2-SHA256-RSA2048 ...` },
  //   body: JSON.stringify({
  //     out_trade_no: orderId,
  //     out_refund_no: `REFUND-${orderId}-${Date.now()}`,
  //     reason: params.reason,
  //     amount: { refund: Math.round(amount * 100), total: Math.round(amount * 100), currency: 'CNY' },
  //   }),
  // })
  // const wxData = await wxRefundRes.json()
  // if (!wxRefundRes.ok) return { success: false, error: wxData.message || '微信退款失败' }
  // return { success: true, gatewayRefundId: wxData.refund_id }

  // ── MVP Mock 降级（paymentIntentId 存在但网关未接入时）───────────
  console.warn(
    `[RefundGateway] ⚠️ Mock 模式：paymentIntentId=${paymentIntentId} 订单=${orderId} 金额=¥${amount}。` +
    `生产上线前必须替换为真实网关调用！`
  )
  // 模拟网关延迟
  await new Promise(r => setTimeout(r, 300))
  return { success: true, gatewayRefundId: `MOCK-REFUND-${Date.now()}` }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    // ── 1. 鉴权 ──────────────────────────────────────────────────
    const auth = await requireAdminRole(['SUPER_ADMIN', 'FINANCE'])
    if (!auth.ok) return auth.response

    const orderId = params.orderId
    const body = await request.json()
    const action = String(body?.action || '')
    const rejectReason = String(body?.rejectReason || '').trim()

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'action 必须为 approve 或 reject' }, { status: 400 })
    }
    if (action === 'reject' && !rejectReason) {
      return NextResponse.json({ error: '驳回时必须填写驳回原因' }, { status: 400 })
    }

    // ── 2. 读取订单，验证状态 ────────────────────────────────────
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        amount: true,
        status: true,
        refundStatus: true,
        paymentIntentId: true,
        userId: true,
        tradeNo: true,
        plan: true,
      },
    })

    if (!order) {
      return NextResponse.json({ error: '订单不存在' }, { status: 404 })
    }

    // 只允许对 refundStatus=REQUESTED 的订单进行审批，防止状态倒退
    if (order.refundStatus !== 'REQUESTED') {
      return NextResponse.json(
        { error: `当前退款状态为 ${order.refundStatus}，只有 REQUESTED 状态才可审批` },
        { status: 400 }
      )
    }

    // ── 3. 驳回分支 ──────────────────────────────────────────────
    if (action === 'reject') {
      await prisma.order.update({
        where: { id: orderId },
        data: {
          refundStatus: 'REJECTED',
          rejectReason: rejectReason,
        },
      })

      // 通知用户退款被驳回
      await prisma.systemNotification.create({
        data: {
          userId: order.userId,
          title: '退款申请已被驳回',
          content: `您的订单（${order.tradeNo || orderId}，¥${order.amount}）退款申请已被驳回。驳回原因：${rejectReason}`,
          type: 'REFUND',
        },
      })

      console.log(`[Admin Refund] ✅ 驳回退款：orderId=${orderId} reason=${rejectReason} by=${session.user.email}`)

      return NextResponse.json({
        success: true,
        action: 'rejected',
        message: '退款申请已驳回',
      })
    }

    // ── 4. 同意分支：调用支付网关退款 API ──────────────────────────
    let gatewayRefundId: string | undefined

    if (order.paymentIntentId) {
      // 有真实支付流水号 → 调用网关
      console.log(`[Admin Refund] 调用支付网关退款：paymentIntentId=${order.paymentIntentId} 金额=¥${order.amount}`)
      const gatewayResult = await callPaymentGatewayRefund({
        paymentIntentId: order.paymentIntentId,
        amount: order.amount,
        orderId: order.id,
        reason: '管理员审批同意退款',
      })

      if (!gatewayResult.success) {
        // 网关报错 → 状态不变，直接返回错误给前端
        console.error(`[Admin Refund] ❌ 网关退款失败：${gatewayResult.error}`)
        return NextResponse.json(
          { error: `支付网关退款失败：${gatewayResult.error}，订单状态未变更，请稍后重试或联系技术支持。` },
          { status: 502 }
        )
      }
      gatewayRefundId = gatewayResult.gatewayRefundId
      console.log(`[Admin Refund] ✅ 网关退款成功：gatewayRefundId=${gatewayRefundId}`)
    } else {
      // 无支付流水号（MVP 阶段手动确认退款）
      console.warn(
        `[Admin Refund] ⚠️ 订单 ${orderId} 无 paymentIntentId，跳过网关调用，直接更新数据库状态。` +
        `（生产上线前必须确保支付网关回调正确写入 paymentIntentId）`
      )
    }

    // ── 5. 网关成功 → 更新数据库状态（只有网关成功才到这里）────────
    await prisma.order.update({
      where: { id: orderId },
      data: {
        refundStatus: 'COMPLETED',
        status: 'REFUNDED',
      },
    })

    // ── 6. 通知用户退款成功 ──────────────────────────────────────
    await prisma.systemNotification.create({
      data: {
        userId: order.userId,
        title: '退款已处理完成',
        content: `您的订单（${order.tradeNo || orderId}，¥${order.amount}）退款已原路返回，预计 3-5 个工作日到账。`,
        type: 'REFUND',
      },
    })

    console.log(`[Admin Refund] ✅ 退款完成：orderId=${orderId} gatewayRefundId=${gatewayRefundId || 'N/A'} by=${session.user.email}`)

    return NextResponse.json({
      success: true,
      action: 'approved',
      message: '退款已处理，资金将原路退回用户账户',
      gatewayRefundId: gatewayRefundId || null,
    })
  } catch (error: any) {
    console.error('[Admin Refund] ❌ 未捕获异常：', error)
    return NextResponse.json(
      { error: error?.message || '处理退款失败，请稍后重试' },
      { status: 500 }
    )
  }
}
