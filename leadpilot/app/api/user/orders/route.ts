import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/user/orders
 * 获取当前用户的订单历史列表（含完整退款状态字段）
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orders = await prisma.order.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        createdAt: true,
        plan: true,
        amount: true,
        status: true,
        orderType: true,
        tradeNo: true,
        refundStatus: true,
        refundReason: true,
        rejectReason: true,
      },
    })

    return NextResponse.json({
      orders: orders.map(o => ({
        id: o.id,
        createdAt: o.createdAt.toISOString(),
        plan: o.plan,
        amount: o.amount,
        status: o.status,
        orderType: o.orderType,
        tradeNo: o.tradeNo,
        refundStatus: o.refundStatus,
        refundReason: o.refundReason ?? null,
        rejectReason: o.rejectReason ?? null,
      })),
    })
  } catch (error: any) {
    console.error('[Orders GET] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * POST /api/user/orders
 * 申请退款（兼容旧调用方）
 * 建议新代码改用 POST /api/user/orders/refund
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { orderId, reason } = await request.json()

    if (!orderId) {
      return NextResponse.json({ error: '订单ID不能为空' }, { status: 400 })
    }
    if (!reason || !reason.trim()) {
      return NextResponse.json({ error: '请填写退款原因' }, { status: 400 })
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
      return NextResponse.json({ error: '只有已支付的订单可以申请退款' }, { status: 400 })
    }
    if (order.refundStatus !== 'NONE') {
      return NextResponse.json({ error: '该订单已申请过退款' }, { status: 400 })
    }

    const daysDiff = (Date.now() - order.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    if (daysDiff > 7) {
      return NextResponse.json({ error: '订单超过7天退款期，无法申请退款' }, { status: 400 })
    }

    await prisma.order.update({
      where: { id: orderId },
      data: {
        refundStatus: 'REQUESTED',
        refundReason: reason.trim(),
      },
    })

    await prisma.systemNotification.create({
      data: {
        userId: session.user.id,
        title: '退款申请已提交',
        content: `您的订单 ${order.tradeNo || orderId} 退款申请已提交，我们将在 3-5 个工作日内处理。`,
        type: 'REFUND',
      },
    })

    return NextResponse.json({
      success: true,
      message: '退款申请已提交，我们将在 3-5 个工作日内处理',
    })
  } catch (error: any) {
    console.error('Failed to request refund:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
