import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * 使用优惠券 API
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { couponId, orderId } = await request.json()

    if (!couponId) {
      return NextResponse.json({ error: '优惠券ID不能为空' }, { status: 400 })
    }

    // 查询优惠券
    const coupon = await prisma.coupon.findUnique({
      where: { id: couponId },
    })

    if (!coupon) {
      return NextResponse.json({ error: '优惠券不存在' }, { status: 404 })
    }

    if (coupon.userId !== session.user.id) {
      return NextResponse.json({ error: '无权使用此优惠券' }, { status: 403 })
    }

    if (coupon.isUsed) {
      return NextResponse.json({ error: '优惠券已使用' }, { status: 400 })
    }

    if (coupon.validUntil && new Date(coupon.validUntil) < new Date()) {
      return NextResponse.json({ error: '优惠券已过期' }, { status: 400 })
    }

    // 标记优惠券为已使用
    await prisma.coupon.update({
      where: { id: couponId },
      data: {
        isUsed: true,
        usedAt: new Date(),
        usedOrderId: orderId || null,
      },
    })

    return NextResponse.json({
      success: true,
      discountAmount: coupon.discountAmount,
      message: `优惠券已使用，减免 ¥${coupon.discountAmount}`,
    })
  } catch (error: any) {
    console.error('Failed to use coupon:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
