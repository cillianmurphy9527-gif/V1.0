/**
 * API: 搜索目标客户 (集成 Redis 互斥锁与缓存免单机制)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { checkFeatureAccess, recordQuotaUsage, FeatureGateError } from '@/lib/feature-gate'
import { checkAndDeductQuota, QuotaActionType, QuotaErrorCode } from '@/lib/quota'
import { getRedis, acquireLock, releaseLock, sleep } from '@/lib/redis'

export async function POST(request: NextRequest) {
  try {
    // ─── 1. 鉴权 ───────────────────────────────────────────
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
    }

    const userId = session.user.id
    const body = await request.json()
    const { country, industry, limit = 50 } = body

    if (!country || !industry) {
      return NextResponse.json({ error: 'country and industry are required' }, { status: 400 })
    }

    // ─── 2. 客户挖掘配额门控 ────────────────────────────────
    const gateResult = await checkFeatureAccess(userId, 'LEAD_GENERATION')
    if (!gateResult.allowed) {
      const statusCode = gateResult.error === FeatureGateError.UPGRADE_REQUIRED ? 403 : 429
      return NextResponse.json(
        { error: gateResult.message, code: gateResult.error, remainingQuota: gateResult.remainingQuota },
        { status: statusCode }
      )
    }

    // ─── 3. 原子扣费（searches + tokens）───────────────────
    const quotaResult = await checkAndDeductQuota(userId, QuotaActionType.LEAD_SEARCH, limit)
    if (!quotaResult.allowed) {
      const statusCode = quotaResult.error === QuotaErrorCode.INSUFFICIENT_TOKENS ? 402 : 
                         quotaResult.error === QuotaErrorCode.UPGRADE_REQUIRED ? 403 : 429
      return NextResponse.json(
        { error: quotaResult.message, code: quotaResult.error, remainingSearches: quotaResult.remainingSearches },
        { status: statusCode }
      )
    }

    // ─── 4. 高并发防刷锁 & 缓存白嫖逻辑 (核心装甲) ──────────────
    const lockKey = `lock:search:${country}:${industry}`
    const cacheKey = `cache:search:${country}:${industry}`
    const client = getRedis()

    // 动作 A：先查 Redis 缓存。如果有同行搜过，直接白嫖数据！
    if (client) {
      const cachedData = await client.get(cacheKey)
      if (cachedData) {
        const cachedLeads = JSON.parse(cachedData)
        await recordQuotaUsage(userId, 'leads', cachedLeads.length) // 照样扣用户的额度
        return NextResponse.json({
          success: true,
          leads: cachedLeads,
          count: cachedLeads.length,
          from: 'redis_cache', // 标记为白嫖缓存
          remainingSearches: quotaResult.remainingSearches,
          remainingTokens: quotaResult.remainingTokens,
        })
      }
    }

    // 动作 B：缓存没有，尝试抢锁去调扣费 API
    const gotLock = await acquireLock(lockKey, 30)

    if (gotLock) {
      try {
        // TODO: 这里未来替换为真实的 Proxycurl/Hunter 请求
        console.log(`[向外网发起 API 请求] 正在搜索: ${country} - ${industry}...`)
        const leads = Array.from({ length: Math.min(limit, 10) }, (_, i) => ({
          id: `lead-${Date.now()}-${i}`,
          company: `Company ${String.fromCharCode(65 + i)}`,
          email: `contact@company${String.fromCharCode(97 + i)}.com`,
          country,
          industry,
        }))

        // 把花钱查回来的数据，存入 Redis 缓存 24 小时，造福后面的搜索者
        if (client) {
          await client.set(cacheKey, JSON.stringify(leads), 'EX', 86400) // 86400秒 = 24小时
        }

        await recordQuotaUsage(userId, 'leads', leads.length)

        return NextResponse.json({
          success: true,
          leads,
          count: leads.length,
          from: 'api_fetch', // 标记为真实抓取
          remainingSearches: quotaResult.remainingSearches,
          remainingTokens: quotaResult.remainingTokens,
        })
      } finally {
        // 极度重要：无论成功失败，干完活必须把锁解开！
        await releaseLock(lockKey)
      }
    } else {
      // 动作 C：没抢到锁（同行正在搜这个词），原地等待同行把数据放进缓存
      console.log(`[触发并发锁] 发现同行正在搜索 ${country}-${industry}，挂机等待白嫖...`)
      for (let t = 0; t < 15; t++) {
        await sleep(1000) // 每秒看一眼缓存
        if (client) {
          const cachedData = await client.get(cacheKey)
          if (cachedData) {
            const cachedLeads = JSON.parse(cachedData)
            await recordQuotaUsage(userId, 'leads', cachedLeads.length)
            return NextResponse.json({
              success: true,
              leads: cachedLeads,
              count: cachedLeads.length,
              from: 'waited_for_peer_cache', // 标记为等到了同行的缓存
              remainingSearches: quotaResult.remainingSearches,
              remainingTokens: quotaResult.remainingTokens,
            })
          }
        }
      }
      // 15秒都没等到，防卡死，直接报错让用户重试
      return NextResponse.json({ error: '系统当前搜索人数过多，请稍后重试' }, { status: 504 })
    }

  } catch (error) {
    console.error('[SearchLeads] Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}