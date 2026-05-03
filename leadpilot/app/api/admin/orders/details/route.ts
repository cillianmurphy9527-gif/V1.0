import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminRole } from '@/lib/admin-auth'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminRole(['SUPER_ADMIN', 'FINANCE'])
    if (!auth.ok) return auth.response

    const { searchParams } = new URL(request.url)
    const orderId = searchParams.get('orderId')

    if (!orderId) {
      return NextResponse.json({ error: '缺少订单 ID' }, { status: 400 })
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { user: true }
    })

    if (!order) {
      return NextResponse.json({ error: '订单不存在' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        tradeNo: order.tradeNo,
        amount: order.amount,
        plan: order.plan,
        status: order.status,
        refundStatus: order.refundStatus,
        refundReason: order.refundStatus !== 'NONE' ? '用户申请退款' : null,
        userEmail: order.user.email,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt
      }
    })
  } catch (error) {
    console.error('Failed to fetch order details:', error)
    return NextResponse.json({ error: '获取订单失败' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    // 鉴权统一改为 requireAdminRole
    const auth = await requireAdminRole(['SUPER_ADMIN', 'FINANCE'])
    if (!auth.ok) return auth.response

    const body = await request.json()
    const { orderId, refundStatus } = body

    if (!orderId || !refundStatus) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 })
    }

    const validStatuses = ['NONE', 'REQUESTED', 'APPROVED', 'REJECTED', 'COMPLETED']
    if (!validStatuses.includes(refundStatus)) {
      return NextResponse.json({ error: '无效的退款状态' }, { status: 400 })
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { refundStatus }
    })

    return NextResponse.json({
      success: true,
      message: '退款状态已更新',
      order: updatedOrder
    })
  } catch (error) {
    console.error('Failed to update order:', error)
    return NextResponse.json({ error: '更新失败' }, { status: 500 })
  }
}