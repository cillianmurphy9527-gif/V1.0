import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminRole } from '@/lib/admin-auth'

/**
 * 修改订单状态
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const auth = await requireAdminRole(['SUPER_ADMIN', 'FINANCE'])
    if (!auth.ok) return auth.response

    const { status } = await request.json()

    if (!['PENDING', 'PAID', 'REFUNDED', 'CANCELED'].includes(status)) {
      return NextResponse.json({ error: '无效的订单状态' }, { status: 400 })
    }

    const order = await prisma.order.update({
      where: { id: params.orderId },
      data: { status }
    })

    return NextResponse.json({
      success: true,
      message: `订单状态已更新为 ${status}`
    })
  } catch (error: any) {
    console.error('❌ [订单状态修改API] 错误:', error)
    return NextResponse.json({ error: error?.message || '修改订单状态失败' }, { status: 500 })
  }
}
