/**
 * API: 搜索目标客户
 *
 * 套餐权限矩阵：
 * - STARTER : 每月最多 500 家
 * - PRO     : 每月最多 2,000 家
 * - MAX     : 每月最多 20,000 家（FUP 硬顶）
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { checkFeatureAccess, recordQuotaUsage, FeatureGateError } from '@/lib/feature-gate'
import { checkAndDeductQuota, QuotaActionType, QuotaErrorCode } from '@/lib/quota'

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
      const statusCode =
        quotaResult.error === QuotaErrorCode.INSUFFICIENT_TOKENS
          ? 402
          : quotaResult.error === QuotaErrorCode.UPGRADE_REQUIRED
          ? 403
          : 429
      return NextResponse.json(
        {
          error: quotaResult.message,
          code: quotaResult.error,
          remainingSearches: quotaResult.remainingSearches,
        },
        { status: statusCode }
      )
    }

    // ─── 4. 执行搜索业务逻辑 ────────────────────────────────
    // TODO: 替换为真实爬虫 / 数据源调用
    const leads = Array.from({ length: Math.min(limit, 10) }, (_, i) => ({
      id: `lead-${Date.now()}-${i}`,
      company: `Company ${String.fromCharCode(65 + i)}`,
      email: `contact@company${String.fromCharCode(97 + i)}.com`,
      country,
      industry,
    }))

    // ─── 5. 记录消耗（leads 维度） ──────────────────────────
    await recordQuotaUsage(userId, 'leads', leads.length)

    return NextResponse.json({
      success: true,
      leads,
      count: leads.length,
      remainingSearches: quotaResult.remainingSearches,
      remainingTokens: quotaResult.remainingTokens,
    })
  } catch (error) {
    console.error('[SearchLeads] Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
