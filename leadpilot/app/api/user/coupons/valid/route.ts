import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/user/coupons/valid
 *
 * 返回当前用户所有可用优惠券：
 *   - isUsed = false
 *   - validUntil > now()
 */
export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request as any, secret: process.env.NEXTAUTH_SECRET })
    if (!token?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = token.id as string
    const now = new Date()

    const coupons = await prisma.coupon.findMany({
      where: {
        userId,
        isUsed:     false,
        validUntil: { gt: now },
      },
      orderBy: { validUntil: 'asc' }, // 快到期的排前面，提醒用户
      select: {
        id:                true,
        discountAmount:    true,
        sourceDescription: true,
        validUntil:        true,
        createdAt:         true,
      },
    })

    return NextResponse.json({
      coupons: coupons.map(c => ({
        id:          c.id,
        // 折扣类型：当前 Schema 只有直减（单位：元），统一为 FIXED
        type:        'FIXED' as const,
        name:        c.sourceDescription || `减 ¥${c.discountAmount} 优惠券`,
        value:       c.discountAmount,        // 直减金额（元）
        validUntil:  c.validUntil.toISOString(),
        createdAt:   c.createdAt.toISOString(),
      })),
    })
  } catch (error: any) {
    console.error('[coupons/valid]', error?.message)
    return NextResponse.json({ error: error?.message || '获取优惠券失败' }, { status: 500 })
  }
}
