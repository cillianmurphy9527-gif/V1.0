import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import { acquireIdempotencyLock, findRecentPendingOrder, releaseIdempotencyLock } from '@/lib/idempotency'

// 硬编码账号种子（与 create-order 保持一致）
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
    console.warn('[ensureUserExists] skipped:', (e as any)?.message)
  }
}

/**
 * 充值算力 API
 * POST /api/payment/recharge
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
    const { amount, finalAmount, tokenQty, packageId } = body

    const orderAmount = finalAmount || amount || 0
    if (!orderAmount || orderAmount <= 0) {
      return NextResponse.json({ error: '充值金额无效' }, { status: 400 })
    }

    // 确保硬编码账号在 DB 中存在（防止 FK 崩溃）
    await ensureUserExists(userId)

    // 验证用户存在
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    })

    if (!user) {
      return NextResponse.json({ error: '用户不存在，请重新登录' }, { status: 404 })
    }

    // 计算赠送 token 数量（1元 = 1000 tokens，基础换算）
    const tokensAllocated = tokenQty ? tokenQty * 100000 : orderAmount * 1000

    // ─── Phase 3.1 幂等锁（防连点重复充值下单）──────────────────────
    const idemWindowSec = Number(process.env.IDEMPOTENCY_WINDOW_SECONDS || 5)
    const planName = packageId ? `算力包 ${packageId}` : '增值算力'
    const idemKey = `idem:recharge:${userId}:${planName}:${orderAmount}:${tokensAllocated}`

    const recent = await findRecentPendingOrder({
      userId,
      amount: orderAmount,
      orderType: 'ADDON',
      plan: planName,
      withinSeconds: Math.max(3, Math.min(10, idemWindowSec)),
    })
    if (recent) {
      return NextResponse.json(
        { error: '重复充值已拦截（短时间内相同订单特征）', code: 'IDEMPOTENT_CONFLICT', orderId: recent.id },
        { status: 409 }
      )
    }

    const lock = await acquireIdempotencyLock({ key: idemKey, ttlMs: idemWindowSec * 1000 })
    if (!lock.ok && lock.reason === 'CONFLICT') {
      return NextResponse.json(
        { error: '重复充值已拦截（请勿连续点击）', code: 'IDEMPOTENT_CONFLICT' },
        { status: 409 }
      )
    }

    const lockAcquired = lock.ok
    try {
      const { order, tokensAllocated: allocated } = await prisma.$transaction(async (tx) => {
        // 原子操作：创建充值订单
        const newOrder = await tx.order.create({
          data: {
            userId,
            amount: orderAmount,
            plan: planName,
            orderType: 'ADDON',
            status: 'PENDING',
            tokensAllocated,
            tradeNo: `RECHARGE-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
          },
        })
        return { order: newOrder, tokensAllocated }
      })

      return NextResponse.json({
        success: true,
        orderId: order.id,
        amount: orderAmount,
        tokensAllocated: allocated,
        message: '充值订单已创建，请完成支付',
      })
    } finally {
      if (lockAcquired) await releaseIdempotencyLock(idemKey)
    }
  } catch (error: any) {
    console.error('Failed to create recharge order:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
