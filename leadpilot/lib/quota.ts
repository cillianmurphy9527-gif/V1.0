/**
 * 全局配额鉴权与扣费拦截器 (已升级：大厂级原子扣费防并发锁)
 */

import { getPlan } from "@/config/pricing"
import { prisma } from "@/lib/prisma"

export enum QuotaActionType {
  AI_GENERATION = 'AI_GENERATION',
  LEAD_SEARCH = 'LEAD_SEARCH',
  RAG_UPLOAD = 'RAG_UPLOAD',
  EMAIL_SEND = 'EMAIL_SEND',
}

const QUOTA_COSTS: Record<QuotaActionType, { tokens?: number; searches?: number; ragFiles?: number }> = {
  [QuotaActionType.AI_GENERATION]: { tokens: 100 },
  [QuotaActionType.LEAD_SEARCH]: { searches: 1, tokens: 50 },
  [QuotaActionType.RAG_UPLOAD]: { ragFiles: 1, tokens: 10 },
  [QuotaActionType.EMAIL_SEND]: { tokens: 5 },
}

const PLAN_QUOTAS = {
  STARTER: { maxTokensPerMonth: 50000, maxSearchesPerMonth: 500, maxRagFiles: 3 },
  PRO: { maxTokensPerMonth: 200000, maxSearchesPerMonth: 2000, maxRagFiles: 20 },
  MAX: { maxTokensPerMonth: 500000, maxSearchesPerMonth: 50000, maxRagFiles: 100 },
}

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

// ─── 检查并扣费 (已加锁版) ──────────────────────────────────────
export async function checkAndDeductQuota(
  userId: string,
  actionType: QuotaActionType,
  quantity: number = 1
): Promise<QuotaCheckResult> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, subscriptionTier: true, tokenBalance: true, monthlySearches: true, ragFileCount: true, monthlyResetAt: true },
    })

    if (!user) return { allowed: false, error: QuotaErrorCode.UNAUTHORIZED, message: '用户不存在' }

    const now = new Date()
    if (!user.monthlyResetAt || new Date(user.monthlyResetAt) < now) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          tokenBalance: PLAN_QUOTAS[user.subscriptionTier as keyof typeof PLAN_QUOTAS]?.maxTokensPerMonth || 0,
          monthlySearches: 0,
          monthlyResetAt: new Date(now.getFullYear(), now.getMonth() + 1, 1),
        },
      })
    }

    const planQuotas = PLAN_QUOTAS[user.subscriptionTier as keyof typeof PLAN_QUOTAS]
    if (!planQuotas) return { allowed: false, error: QuotaErrorCode.UPGRADE_REQUIRED, message: '套餐配置错误' }

    const cost = QUOTA_COSTS[actionType]

    // 🚨 架构师防线：不查余额了，直接用数据库底层扣除 (乐观锁)
    const updateData: any = {}
    if (cost.tokens) updateData.tokenBalance = { decrement: cost.tokens * quantity }
    if (cost.searches) updateData.monthlySearches = { increment: cost.searches * quantity }
    if (cost.ragFiles) updateData.ragFileCount = { increment: cost.ragFiles * quantity }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
    })

    // 🚨 并发防线核心：扣完之后如果变负数/超标，当场抓获羊毛党，立刻没收并回滚！
    let rollbackNeeded = false;
    let errorMessage = '';
    let errorCode = QuotaErrorCode.UNAUTHORIZED;

    if (cost.tokens && updatedUser.tokenBalance < 0) {
      rollbackNeeded = true;
      errorMessage = `算力不足(并发拦截)。需要 ${cost.tokens * quantity}，请充值。`;
      errorCode = QuotaErrorCode.INSUFFICIENT_TOKENS;
    } else if (cost.searches && updatedUser.monthlySearches > planQuotas.maxSearchesPerMonth) {
      rollbackNeeded = true;
      errorMessage = `本月搜索次数已达上限(并发拦截)。`;
      errorCode = QuotaErrorCode.FUP_LIMIT_REACHED;
    } else if (cost.ragFiles && updatedUser.ragFileCount > planQuotas.maxRagFiles) {
      rollbackNeeded = true;
      errorMessage = `知识库文件已达上限(并发拦截)。`;
      errorCode = QuotaErrorCode.RAG_FILE_LIMIT_EXCEEDED;
    }

    if (rollbackNeeded) {
      // 触发回滚（把刚才超扣的还回去，拒绝服务）
      const rollbackData: any = {}
      if (cost.tokens) rollbackData.tokenBalance = { increment: cost.tokens * quantity }
      if (cost.searches) rollbackData.monthlySearches = { decrement: cost.searches * quantity }
      if (cost.ragFiles) rollbackData.ragFileCount = { decrement: cost.ragFiles * quantity }
      await prisma.user.update({ where: { id: userId }, data: rollbackData });
      
      console.warn(`⚠️ [安全警报] 成功拦截用户 ${userId} 的并发超卖攻击！`);
      return { allowed: false, error: errorCode, message: errorMessage }
    }

    return {
      allowed: true,
      remainingTokens: updatedUser.tokenBalance,
      remainingSearches: planQuotas.maxSearchesPerMonth - updatedUser.monthlySearches,
      remainingRagFiles: planQuotas.maxRagFiles - updatedUser.ragFileCount,
    }
  } catch (error) {
    return { allowed: false, error: QuotaErrorCode.UNAUTHORIZED, message: '配额检查异常' }
  }
}

export async function refundQuota(userId: string, actionType: QuotaActionType, quantity: number = 1): Promise<void> {
  const cost = QUOTA_COSTS[actionType]
  const updateData: any = {}
  if (cost.tokens) updateData.tokenBalance = { increment: cost.tokens * quantity }
  if (cost.searches) updateData.monthlySearches = { decrement: cost.searches * quantity }
  if (cost.ragFiles) updateData.ragFileCount = { decrement: cost.ragFiles * quantity }
  if (Object.keys(updateData).length === 0) return
  await prisma.user.update({ where: { id: userId }, data: updateData })
}

export async function getUserQuotaStatus(userId: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { subscriptionTier: true, tokenBalance: true, monthlySearches: true, ragFileCount: true },
    })
    if (!user) return null
    const planQuotas = PLAN_QUOTAS[user.subscriptionTier as keyof typeof PLAN_QUOTAS]
    return {
      tier: user.subscriptionTier,
      tokens: { used: planQuotas.maxTokensPerMonth - user.tokenBalance, remaining: user.tokenBalance, limit: planQuotas.maxTokensPerMonth },
      searches: { used: user.monthlySearches, remaining: planQuotas.maxSearchesPerMonth - user.monthlySearches, limit: planQuotas.maxSearchesPerMonth },
      ragFiles: { used: user.ragFileCount, remaining: planQuotas.maxRagFiles - user.ragFileCount, limit: planQuotas.maxRagFiles },
    }
  } catch (error) {
    return null
  }
}