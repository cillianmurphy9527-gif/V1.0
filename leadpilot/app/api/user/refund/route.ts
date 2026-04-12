import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * 提交退款申请
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const { orderId, reason } = await request.json()

    if (!orderId || !reason) {
      return NextResponse.json({ error: '缺少必填字段' }, { status: 400 })
    }

    // 验证订单是否属于当前用户
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        userId,
      },
    })

    if (!order) {
      return NextResponse.json({ error: '订单不存在' }, { status: 404 })
    }

    // 验证订单状态
    if (order.status !== 'PAID') {
      return NextResponse.json({ error: '只能对已支付订单申请退款' }, { status: 400 })
    }

    // 验证是否在 7 天内
    const daysSince = (Date.now() - order.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    if (daysSince > 7) {
      return NextResponse.json({ error: '超过 7 天退款期限' }, { status: 400 })
    }

    // 更新订单状态为退款申请中
    await prisma.order.update({
      where: { id: orderId },
      data: {
        refundStatus: 'REQUESTED',
      },
    })

    // 创建系统通知给管理员
    // TODO: 发送通知给管理员审核

    // 创建用户通知
    await prisma.systemNotification.create({
      data: {
        userId,
        title: '退款申请已提交',
        content: `您的订单 ${orderId} 退款申请已提交，我们将在 3-5 个工作日内处理。退款原因：${reason}`,
        type: 'REFUND',
      },
    })

    return NextResponse.json({
      success: true,
      message: '退款申请已提交',
    })
  } catch (error: any) {
    console.error('Failed to submit refund:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
