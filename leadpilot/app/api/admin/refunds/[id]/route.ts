import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminRole } from '@/lib/admin-auth'

/**
 * 处理退款申请（批准/拒绝）
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAdminRole(['SUPER_ADMIN', 'FINANCE'])
    if (!auth.ok) return auth.response

    const { action } = await request.json()

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: '无效的操作' }, { status: 400 })
    }

    const order = await prisma.order.update({
      where: { id: params.id },
      data: {
        refundStatus: action === 'approve' ? 'APPROVED' : 'REJECTED',
        status: action === 'approve' ? 'REFUNDED' : 'PAID'
      }
    })

    return NextResponse.json({
      success: true,
      message: action === 'approve' ? '退款已批准' : '退款已拒绝'
    })
  } catch (error: any) {
    console.error('❌ [退款处理API] 错误:', error)
    return NextResponse.json({ error: error?.message || '处理退款失败' }, { status: 500 })
  }
}
