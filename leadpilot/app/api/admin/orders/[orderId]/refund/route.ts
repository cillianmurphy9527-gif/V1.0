/**
 * POST /api/admin/orders/[orderId]/refund
 * Admin 审批退款申请：同意原路退回 或 驳回
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
        tokensAllocated: true, // 🚨 极其关键：必须把这个查出来，后面才能扣算力！
      },
    })

    if (!order) {
      return NextResponse.json({ error: '订单不存在' }, { status: 404 })
    }

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

      // 🐛 修复了未定义 session 的崩溃 bug
      console.log(`[Admin Refund] ✅ 驳回退款：orderId=${orderId} reason=${rejectReason}`)

      return NextResponse.json({
        success: true,
        action: 'rejected',
        message: '退款申请已驳回',
      })
    }

    // ── 4. 同意分支：调用支付网关退款 API ──────────────────────────
    let gatewayRefundId: string | undefined

    if (order.paymentIntentId) {
      console.log(`[Admin Refund] 调用支付网关退款：paymentIntentId=${order.paymentIntentId} 金额=¥${order.amount}`)
      const gatewayResult = await callPaymentGatewayRefund({
        paymentIntentId: order.paymentIntentId,
        amount: order.amount,
        orderId: order.id,
        reason: '管理员审批同意退款',
      })

      if (!gatewayResult.success) {
        console.error(`[Admin Refund] ❌ 网关退款失败：${gatewayResult.error}`)
        return NextResponse.json(
          { error: `支付网关退款失败：${gatewayResult.error}，订单状态未变更。` },
          { status: 502 }
        )
      }
      gatewayRefundId = gatewayResult.gatewayRefundId
      console.log(`[Admin Refund] ✅ 网关退款成功：gatewayRefundId=${gatewayRefundId}`)
    } else {
      console.warn(`[Admin Refund] ⚠️ 订单 ${orderId} 无 paymentIntentId，跳过网关调用。`)
    }

    // ── 5. 💰 [终极防御] 核心清算事务锁：改状态 + 扣算力 + 记流水 ────────
    await prisma.$transaction(async (tx) => {
      
      // A. 更新订单状态为彻底退款完成
      await tx.order.update({
        where: { id: orderId },
        data: {
          refundStatus: 'COMPLETED',
          status: 'REFUNDED',
        },
      })

      // B. 追回资产：精准扣除当初发给客户的算力，堵死白嫖漏洞！
      const user = await tx.user.findUnique({ where: { id: order.userId } })
      const currentBalance = user?.tokenBalance || 0
      const newBalance = Math.max(0, currentBalance - (order.tokensAllocated || 0))

      await tx.user.update({
        where: { id: order.userId },
        data: { tokenBalance: newBalance }
      })

      // C. 财务平账：记一笔冲销流水
      if (order.tokensAllocated > 0) {
        await tx.tokenTransaction.create({
          data: {
            userId: order.userId,
            amount: -(order.tokensAllocated),
            reason: 'REFUND',
            balanceBefore: currentBalance,
            balanceAfter: newBalance,
            status: 'COMPLETED'
          }
        })
      }
    })

    // ── 6. 通知用户退款成功 ──────────────────────────────────────
    await prisma.systemNotification.create({
      data: {
        userId: order.userId,
        title: '退款已处理完成',
        content: `您的订单（${order.tradeNo || orderId}，¥${order.amount}）退款已原路返回，预计 3-5 个工作日到账。相关算力已扣除。`,
        type: 'REFUND',
      },
    })

    console.log(`[Admin Refund] ✅ 退款及清算全部完成：orderId=${orderId}`)

    return NextResponse.json({
      success: true,
      action: 'approved',
      message: '退款已处理，资金将原路退回，算力已收回',
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