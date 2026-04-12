import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminRole } from '@/lib/admin-auth'

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminRole()
    if (!auth.ok) return auth.response

    const body = await request.json()
    const email = String(body?.email || '').trim().toLowerCase()
    const amount = Number(body?.amount)
    const expireDays = Number(body?.expireDays)
    const source = String(body?.source || '后台补偿')

    if (!email || !Number.isFinite(amount) || amount <= 0 || !Number.isFinite(expireDays) || expireDays <= 0) {
      return NextResponse.json({ error: 'Invalid params' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const validUntil = new Date()
    validUntil.setDate(validUntil.getDate() + Math.floor(expireDays))

    const coupon = await prisma.coupon.create({
      data: {
        userId: user.id,
        discountAmount: Math.floor(amount),
        sourceDescription: source,
        validUntil,
      },
    })

    return NextResponse.json({ success: true, couponId: coupon.id })
  } catch (error: any) {
    console.error('[Admin Coupon Issue] Error:', error)
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}

