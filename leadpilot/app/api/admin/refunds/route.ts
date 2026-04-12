import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminRole } from '@/lib/admin-auth'

/**
 * 获取退款申请列表
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminRole(['SUPER_ADMIN', 'FINANCE'])
    if (!auth.ok) return auth.response

    const refunds = await prisma.order.findMany({
      where: {
        refundStatus: { not: 'NONE' }
      },
      select: {
        id: true,
        tradeNo: true,
        amount: true,
        status: true,
        refundStatus: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: { email: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({
      refunds: refunds.map(r => ({
        id: r.id,
        orderId: r.tradeNo || r.id,
        userEmail: r.user.email,
        amount: r.amount,
        refundReason: 'USER_REQUEST',
        refundStatus: r.refundStatus,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString()
      }))
    })
  } catch (error: any) {
    console.error('❌ [退款API] 错误:', error)
    return NextResponse.json({ error: error?.message || '获取退款申请失败' }, { status: 500 })
  }
}
