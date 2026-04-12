import { prisma } from '@/lib/prisma'
import { getRedis } from '@/lib/redis'

type LockResult =
  | { ok: true; key: string }
  | { ok: false; key: string; reason: 'CONFLICT' | 'UNAVAILABLE' }

/**
 * 获取幂等锁（Redis 优先）。失败时返回 CONFLICT 或 UNAVAILABLE。
 * 注意：锁 TTL 只是防连点窗口，不等同于支付最终幂等（支付回调仍需 tradeNo/transactionId 去重）。
 */
export async function acquireIdempotencyLock(input: {
  key: string
  ttlMs: number
}): Promise<LockResult> {
  const { key, ttlMs } = input
  const redis = getRedis()
  if (!redis) return { ok: false, key, reason: 'UNAVAILABLE' }

  try {
    const res = await redis.set(key, '1', 'PX', ttlMs, 'NX')
    if (res === 'OK') return { ok: true, key }
    return { ok: false, key, reason: 'CONFLICT' }
  } catch {
    return { ok: false, key, reason: 'UNAVAILABLE' }
  }
}

export async function releaseIdempotencyLock(key: string): Promise<void> {
  const redis = getRedis()
  if (!redis) return
  try {
    await redis.del(key)
  } catch {
    // ignore
  }
}

/**
 * Prisma 兜底：查找 5 秒内同特征的待支付订单。
 */
export async function findRecentPendingOrder(input: {
  userId: string
  amount: number
  orderType: string
  plan: string
  withinSeconds: number
}) {
  const since = new Date(Date.now() - input.withinSeconds * 1000)
  return await prisma.order.findFirst({
    where: {
      userId: input.userId,
      amount: input.amount,
      orderType: input.orderType,
      plan: input.plan,
      status: 'PENDING',
      createdAt: { gte: since },
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true, tradeNo: true, createdAt: true },
  })
}

