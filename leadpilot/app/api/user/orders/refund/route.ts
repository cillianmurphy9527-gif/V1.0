import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/user/orders/refund
 * 用户申请退款
 *
 * body: { orderId: string, reason: string }
 *
 * 规则：
 *   - 订单 status 必须为 PAID
 *   - 订单 refundStatus 必须为 NONE（未申请过）
 *   - 订单创建时间在 7 天内
 *   - reason 必填，写入 Order.refundReason
 *   - 成功后 refundStatus → REQUESTED
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const orderId = String(body?.orderId || '').trim()
    const reason  = String(body?.reason  || '').trim()

    if (!orderId) {
      return NextResponse.json({ error: '订单ID不能为空' }, { status: 400 })
    }
    if (!reason) {
      return NextResponse.json({ error: '请填写退款原因' }, { status: 400 })
    }
    if (reason.length < 5) {
      return NextResponse.json({ error: '退款原因至少填写 5 个字符' }, { status: 400 })
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
    })

    if (!order) {
      return NextResponse.json({ error: '订单不存在' }, { status: 404 })
    }
    if (order.userId !== session.user.id) {
      return NextResponse.json({ error: '无权操作此订单' }, { status: 403 })
    }
    if (order.status !== 'PAID') {
      return NextResponse.json({ error: '只有已付款的订单才可申请退款' }, { status: 400 })
    }
    if (order.refundStatus !== 'NONE') {
      return NextResponse.json({ error: '该订单已提交过退款申请，请耐心等待审核' }, { status: 400 })
    }

    const daysDiff = (Date.now() - order.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    if (daysDiff > 7) {
      return NextResponse.json({ error: '订单已超过 7 天退款期，无法申请退款' }, { status: 400 })
    }

    // 原子更新：写入退款原因 + 变更退款状态
    await prisma.order.update({
      where: { id: orderId },
      data: {
        refundStatus: 'REQUESTED',
        refundReason: reason,
      },
    })

    // 系统通知：告知用户申请已收到
    await prisma.systemNotification.create({
      data: {
        userId: session.user.id,
        title: '退款申请已收到',
        content: `您的订单（${order.tradeNo || orderId}，¥${order.amount}）退款申请已提交，审核周期为 3-5 个工作日，请留意通知。`,
        type: 'REFUND',
      },
    })

    return NextResponse.json({
      success: true,
      message: '退款申请已提交，3-5 个工作日内审核完成',
    })
  } catch (error: any) {
    console.error('[Refund POST] Error:', error)
    return NextResponse.json({ error: error?.message || '提交退款申请失败' }, { status: 500 })
  }
}
