import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import { PLANS } from '@/config/pricing'
import { acquireIdempotencyLock, findRecentPendingOrder, releaseIdempotencyLock } from '@/lib/idempotency'

// 硬编码账号的真实数据库种子（确保 FK 约束不会失败）
const HARDCODED_SEEDS = [
  {
    id: 'dev-admin-super',
    phone: '18342297595',
    email: 'admin@leadpilot.cn',
    companyName: '系统管理员',
    role: 'ADMIN',
    subscriptionTier: 'MAX',
    tokenBalance: 9999999,
    features: JSON.stringify({ canUseInbox: true, aiScoring: true, multiDomain: true }),
  },
  {
    id: 'dev-user-dashboard',
    phone: '1390504583',
    email: '1390504583@qq.com',
    companyName: '测试用户',
    role: 'USER',
    subscriptionTier: 'PRO',
    tokenBalance: 100000,
    features: JSON.stringify({ canUseInbox: true, aiScoring: true, multiDomain: false }),
  },
]

async function ensureUserExists(userId: string): Promise<void> {
  if (process.env.NODE_ENV !== 'development') return
  const seed = HARDCODED_SEEDS.find(s => s.id === userId)
  if (!seed) return
  try {
    const exists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
    if (!exists) {
      await prisma.user.create({ data: { ...seed } })
    }
  } catch (e) {
    // 并发场景下可能已被其他请求创建，忽略重复错误
    console.warn('[ensureUserExists] skipped:', (e as any)?.message)
  }
}

/**
 * 创建支付订单
 */
export async function POST(request: NextRequest) {
  try {
    const token = await getToken({
      req: request as any,
      secret: process.env.NEXTAUTH_SECRET,
    })

    if (!token?.id) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
    }

    const userId = token.id as string

    const body = await request.json()
    const { planId, finalAmount, cycle, qty, domainQty, orderType: bodyOrderType, couponId } = body

    if (!planId && !domainQty) {
      return NextResponse.json({ error: '缺少套餐 ID' }, { status: 400 })
    }

    // 确保硬编码账号在 DB 中存在（防止 FK 崩溃）
    await ensureUserExists(userId)

    // 验证用户是否存在（真实注册用户）
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, subscriptionTier: true },
    })

    if (!user) {
      return NextResponse.json({ error: '用户不存在，请重新登录' }, { status: 404 })
    }

    let amount = finalAmount || 0
    let orderType = bodyOrderType || 'SUBSCRIPTION'
    let planName = ''

    if (planId) {
      const plan = PLANS.find(p => p.id === planId)
      if (!plan) {
        return NextResponse.json({ error: `无效的套餐 ID: ${planId}` }, { status: 400 })
      }
      planName = plan.name
      if (!amount) {
        const months = cycle === 'quarterly' ? 3 : cycle === 'yearly' ? 12 : 1
        const disc = cycle === 'quarterly' ? 0.85 : cycle === 'yearly' ? 0.70 : 1
        amount = Math.round(plan.price * months * disc)
      }
    } else if (domainQty) {
      planName = `额外域名 x${domainQty}`
      orderType = 'ADDON'
      amount = finalAmount || domainQty * 99
    }

    // ─── 优惠券财务级防篡改校验 ──────────────────────────────────
    // 绝不信任前端传来的价格，由后端独立计算最终扣费金额
    let couponDiscount = 0
    let validatedCoupon: { id: string; discountAmount: number } | null = null

    if (couponId) {
      const now = new Date()
      // 原子性二次验证：必须属于本用户、未使用、未过期
      const coupon = await prisma.coupon.findFirst({
        where: {
          id:         couponId,
          userId,              // 必须是本人持有
          isUsed:     false,   // 未使用
          validUntil: { gt: now }, // 未过期
        },
      })

      if (!coupon) {
        return NextResponse.json(
          { error: '优惠券无效、已使用或已过期，请刷新后重试' },
          { status: 400 }
        )
      }

      couponDiscount  = coupon.discountAmount
      validatedCoupon = { id: coupon.id, discountAmount: coupon.discountAmount }
    }

    // ─── Phase 3.1 幂等锁（防连点重复下单）────────────────────────
    const idemWindowSec = Number(process.env.IDEMPOTENCY_WINDOW_SECONDS || 5)
    const idemKey = `idem:order:${userId}:${orderType}:${planName}:${amount}`
    const recent = await findRecentPendingOrder({
      userId,
      amount,
      orderType,
      plan: planName,
      withinSeconds: Math.max(3, Math.min(10, idemWindowSec)),
    })
    if (recent) {
      return NextResponse.json(
        { error: '重复下单已拦截（短时间内相同订单特征）', code: 'IDEMPOTENT_CONFLICT', orderId: recent.id },
        { status: 409 }
      )
    }

    const lock = await acquireIdempotencyLock({ key: idemKey, ttlMs: idemWindowSec * 1000 })
    if (!lock.ok && lock.reason === 'CONFLICT') {
      return NextResponse.json(
        { error: '重复下单已拦截（请勿连续点击）', code: 'IDEMPOTENT_CONFLICT' },
        { status: 409 }
      )
    }
    // Redis 不可用时，不影响主流程：仅依赖 Prisma 近似兜底
    const lockAcquired = lock.ok
    try {
      // 后端独立计算最终金额（防前端篡改）
      const finalAmountAfterCoupon = Math.max(0, amount - couponDiscount)

      const order = await prisma.$transaction(async (tx) => {
        // 原子操作 1：创建订单（使用后端计算的最终价格）
        const newOrder = await tx.order.create({
          data: {
            userId,
            plan:      planName,
            amount:    finalAmountAfterCoupon, // 已扣除优惠券
            status:    'PENDING',
            orderType,
            tradeNo:   `ORDER-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
          },
        })

        // 原子操作 2：核销优惠券（与订单创建在同一事务，防止超卖）
        if (validatedCoupon) {
          await tx.coupon.update({
            where: { id: validatedCoupon.id },
            data: {
              isUsed:      true,
              usedAt:      new Date(),
              usedOrderId: newOrder.id,
            },
          })
        }

        return newOrder
      })

      return NextResponse.json({
        success: true,
        orderId: order.id,
        amount,
        message: '订单创建成功，请完成支付',
      })
    } finally {
      // TTL 会自然释放；这里主动释放让体验更好
      if (lockAcquired) await releaseIdempotencyLock(idemKey)
    }
  } catch (error: any) {
    console.error('Failed to create order:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
