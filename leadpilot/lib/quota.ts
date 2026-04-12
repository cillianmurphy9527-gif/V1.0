/**
 * 全局配额鉴权与扣费拦截器
 * 
 * 核心职责：
 * 1. 验证用户配额是否充足
 * 2. 执行配额扣费
 * 3. 触发 FUP（公平使用政策）硬顶
 * 4. 返回标准化错误码
 */

import { getPlan } from "@/config/pricing"
import { prisma } from "@/lib/prisma"

// ─── 配额操作类型 ────────────────────────────────────
export enum QuotaActionType {
  AI_GENERATION = 'AI_GENERATION',      // AI 邮件生成（消耗 tokens）
  LEAD_SEARCH = 'LEAD_SEARCH',          // 客户搜索（消耗 searches）
  RAG_UPLOAD = 'RAG_UPLOAD',            // 知识库上传（消耗 rag_files）
  EMAIL_SEND = 'EMAIL_SEND',            // 发送邮件（消耗 tokens）
}

// ─── 配额成本定义 ────────────────────────────────────
const QUOTA_COSTS: Record<QuotaActionType, { tokens?: number; searches?: number; ragFiles?: number }> = {
  [QuotaActionType.AI_GENERATION]: { tokens: 100 },
  [QuotaActionType.LEAD_SEARCH]: { searches: 1, tokens: 50 },
  [QuotaActionType.RAG_UPLOAD]: { ragFiles: 1, tokens: 10 },
  [QuotaActionType.EMAIL_SEND]: { tokens: 5 },
}

// ─── 套餐配置 ─────────────────────────────────────────
// 与 lib/services/quota.ts 的 TIER_CONFIG 保持一致！
// 
// 套餐定价与额度对照表：
// ┌──────────┬────────┬─────────────┬─────────────┐
// │  套餐     │  价格  │   线索额度   │   算力水箱   │
// ├──────────┼────────┼─────────────┼─────────────┤
// │ STARTER  │  ¥299  │    1,000    │   50,000   │
// │ PRO      │  ¥799  │    3,000    │   200,000  │
// │ MAX      │ ¥1,999 │   10,000    │   500,000  │
// └──────────┴────────┴─────────────┴─────────────┘
const PLAN_QUOTAS = {
  STARTER: {
    maxTokensPerMonth: 50000,
    maxSearchesPerMonth: 500,
    maxRagFiles: 3,
  },
  PRO: {
    maxTokensPerMonth: 200000,
    maxSearchesPerMonth: 2000,
    maxRagFiles: 20,
  },
  MAX: {
    maxTokensPerMonth: 500000,
    maxSearchesPerMonth: 50000,
    maxRagFiles: 100,
  },
}

// ─── 错误码 ──────────────────────────────────────────
export enum QuotaErrorCode {
  INSUFFICIENT_TOKENS = 'INSUFFICIENT_TOKENS',
  INSUFFICIENT_SEARCHES = 'INSUFFICIENT_SEARCHES',
  RAG_FILE_LIMIT_EXCEEDED = 'RAG_FILE_LIMIT_EXCEEDED',
  FUP_LIMIT_REACHED = 'FUP_LIMIT_REACHED',
  UPGRADE_REQUIRED = 'UPGRADE_REQUIRED',
  UNAUTHORIZED = 'UNAUTHORIZED',
}

export interface QuotaCheckResult {
  allowed: boolean
  error?: QuotaErrorCode
  message?: string
  remainingTokens?: number
  remainingSearches?: number
  remainingRagFiles?: number
}

// ─── 检查并扣费 ──────────────────────────────────────
export async function checkAndDeductQuota(
  userId: string,
  actionType: QuotaActionType,
  quantity: number = 1
): Promise<QuotaCheckResult> {
  try {
    // 1. 获取用户信息
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        subscriptionTier: true,
        tokenBalance: true,
        monthlySearches: true,
        ragFileCount: true,
        monthlyResetAt: true,
      },
    })

    if (!user) {
      return {
        allowed: false,
        error: QuotaErrorCode.UNAUTHORIZED,
        message: '用户不存在',
      }
    }

    // 2. 检查月度重置
    const now = new Date()
    if (!user.monthlyResetAt || new Date(user.monthlyResetAt) < now) {
      // 重置月度配额
      await prisma.user.update({
        where: { id: userId },
        data: {
          tokenBalance: PLAN_QUOTAS[user.subscriptionTier as keyof typeof PLAN_QUOTAS]?.maxTokensPerMonth || 0,
          monthlySearches: 0,
          monthlyResetAt: new Date(now.getFullYear(), now.getMonth() + 1, 1),
        },
      })
      // 重新获取更新后的用户数据
      const updatedUser = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          tokenBalance: true,
          monthlySearches: true,
          ragFileCount: true,
        },
      })
      if (updatedUser) {
        user.tokenBalance = updatedUser.tokenBalance
        user.monthlySearches = updatedUser.monthlySearches
        user.ragFileCount = updatedUser.ragFileCount
      }
    }

    // 3. 获取套餐配额
    const planQuotas = PLAN_QUOTAS[user.subscriptionTier as keyof typeof PLAN_QUOTAS]
    if (!planQuotas) {
      return {
        allowed: false,
        error: QuotaErrorCode.UPGRADE_REQUIRED,
        message: '套餐配置错误',
      }
    }

    // 4. 获取操作成本
    const cost = QUOTA_COSTS[actionType]

    // 5. 验证配额充足性
    if (cost.tokens && user.tokenBalance < cost.tokens * quantity) {
      return {
        allowed: false,
        error: QuotaErrorCode.INSUFFICIENT_TOKENS,
        message: `算力不足。需要 ${cost.tokens * quantity} tokens，剩余 ${user.tokenBalance} tokens。请充值或升级套餐。`,
        remainingTokens: user.tokenBalance,
      }
    }

    if (cost.searches && user.monthlySearches + cost.searches * quantity > planQuotas.maxSearchesPerMonth) {
      return {
        allowed: false,
        error: QuotaErrorCode.FUP_LIMIT_REACHED,
        message: `本月搜索次数已达上限（${planQuotas.maxSearchesPerMonth} 次）。请等待下月重置或升级套餐。`,
        remainingSearches: planQuotas.maxSearchesPerMonth - user.monthlySearches,
      }
    }

    if (cost.ragFiles && user.ragFileCount + cost.ragFiles * quantity > planQuotas.maxRagFiles) {
      return {
        allowed: false,
        error: QuotaErrorCode.RAG_FILE_LIMIT_EXCEEDED,
        message: `知识库文件已达上限（${planQuotas.maxRagFiles} 个）。请删除旧文件或升级套餐。`,
        remainingRagFiles: planQuotas.maxRagFiles - user.ragFileCount,
      }
    }

    // 6. 【关键】执行扣费
    const updateData: any = {}
    if (cost.tokens) updateData.tokenBalance = { decrement: cost.tokens * quantity }
    if (cost.searches) updateData.monthlySearches = { increment: cost.searches * quantity }
    if (cost.ragFiles) updateData.ragFileCount = { increment: cost.ragFiles * quantity }

    await prisma.user.update({
      where: { id: userId },
      data: updateData,
    })

    // 7. 返回成功结果
    return {
      allowed: true,
      remainingTokens: user.tokenBalance - (cost.tokens ? cost.tokens * quantity : 0),
      remainingSearches: planQuotas.maxSearchesPerMonth - (user.monthlySearches + (cost.searches ? cost.searches * quantity : 0)),
      remainingRagFiles: planQuotas.maxRagFiles - (user.ragFileCount + (cost.ragFiles ? cost.ragFiles * quantity : 0)),
    }
  } catch (error) {
    console.error('[Quota] Error:', error)
    return {
      allowed: false,
      error: QuotaErrorCode.UNAUTHORIZED,
      message: '配额检查异常',
    }
  }
}

/**
 * 退还配额（用于队列入队失败等场景）
 * 只做“回滚/补偿”，不做月度重置与 FUP 检查
 */
export async function refundQuota(
  userId: string,
  actionType: QuotaActionType,
  quantity: number = 1
): Promise<void> {
  const cost = QUOTA_COSTS[actionType]
  const updateData: any = {}
  if (cost.tokens) updateData.tokenBalance = { increment: cost.tokens * quantity }
  if (cost.searches) updateData.monthlySearches = { decrement: cost.searches * quantity }
  if (cost.ragFiles) updateData.ragFileCount = { decrement: cost.ragFiles * quantity }
  if (Object.keys(updateData).length === 0) return

  await prisma.user.update({
    where: { id: userId },
    data: updateData,
  })
}

// ─── 获取用户当前配额状态 ────────────────────────────
export async function getUserQuotaStatus(userId: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        subscriptionTier: true,
        tokenBalance: true,
        monthlySearches: true,
        ragFileCount: true,
      },
    })

    if (!user) return null

    const planQuotas = PLAN_QUOTAS[user.subscriptionTier as keyof typeof PLAN_QUOTAS]

    return {
      tier: user.subscriptionTier,
      tokens: {
        used: planQuotas.maxTokensPerMonth - user.tokenBalance,
        remaining: user.tokenBalance,
        limit: planQuotas.maxTokensPerMonth,
      },
      searches: {
        used: user.monthlySearches,
        remaining: planQuotas.maxSearchesPerMonth - user.monthlySearches,
        limit: planQuotas.maxSearchesPerMonth,
      },
      ragFiles: {
        used: user.ragFileCount,
        remaining: planQuotas.maxRagFiles - user.ragFileCount,
        limit: planQuotas.maxRagFiles,
      },
    }
  } catch (error) {
    console.error('[GetQuotaStatus] Error:', error)
    return null
  }
}
