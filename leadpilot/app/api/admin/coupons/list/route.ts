import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminRole } from '@/lib/admin-auth'

export async function GET(_request: NextRequest) {
  try {
    const auth = await requireAdminRole()
    if (!auth.ok) return auth.response

    const coupons = await prisma.coupon.findMany({
      include: { user: { select: { email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })

    const totals = coupons.reduce(
      (acc, c) => {
        acc.totalIssued += c.discountAmount
        if (c.isUsed) acc.totalUsed += c.discountAmount
        const expired = c.validUntil.getTime() < Date.now()
        if (!c.isUsed && expired) acc.totalExpired += c.discountAmount
        return acc
      },
      { totalIssued: 0, totalUsed: 0, totalExpired: 0 }
    )

    return NextResponse.json({
      stats: totals,
      coupons: coupons.map(c => {
        const expired = c.validUntil.getTime() < Date.now()
        const status = c.isUsed ? 'used' : expired ? 'expired' : 'unused'
        return {
          id: c.id,
          code: c.id.slice(0, 8).toUpperCase(),
          userId: c.userId,
          userEmail: c.user?.email || '—',
          amount: c.discountAmount,
          status,
          source: c.sourceDescription,
          issuedAt: c.createdAt.toISOString().split('T')[0],
          expiresAt: c.validUntil.toISOString().split('T')[0],
          usedAt: c.usedAt ? c.usedAt.toISOString().split('T')[0] : undefined,
        }
      }),
    })
  } catch (error: any) {
    console.error('[Admin Coupons List] Error:', error)
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}

