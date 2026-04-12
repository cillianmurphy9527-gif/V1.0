import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminRole } from '@/lib/admin-auth'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminRole(['SUPER_ADMIN', 'FINANCE'])
    if (!auth.ok) return auth.response

    const { searchParams } = new URL(request.url)
    const take = Math.min(Number(searchParams.get('take') || 200), 500)

    const orders = await prisma.order.findMany({
      include: { user: { select: { email: true } } },
      orderBy: { createdAt: 'desc' },
      take: Number.isFinite(take) ? take : 200,
    })

    return NextResponse.json({
      orders: orders.map(o => ({
        id: o.tradeNo || o.id,
        rawId: o.id,
        userEmail: o.user?.email || '—',
        plan: o.plan,
        amount: o.amount,
        status: o.refundStatus === 'COMPLETED' ? 'REFUNDED' : o.status,
        payMethod: o.tradeNo ? '在线支付' : '—',
        createdAt: o.createdAt.toLocaleString('zh-CN'),
        planType: o.orderType === 'SUBSCRIPTION' ? 'subscription' : 'addon',
        refundStatus: o.refundStatus,
        refundReason: o.refundReason ?? null,
        rejectReason: o.rejectReason ?? null,
        paymentIntentId: o.paymentIntentId ?? null,
      })),
    })
  } catch (error: any) {
    console.error('[Admin Orders List] Error:', error)
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}

