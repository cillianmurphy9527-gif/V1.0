/**
 * 服务端特征门控与配额鉴权中间层
 *
 * 核心职责：
 * 1. 验证用户套餐权限
 * 2. 检查月度配额消耗
 * 3. 拦截越权操作
 * 4. 返回标准化错误码
 */

import { prisma } from '@/lib/prisma'
import { getPlan } from '@/config/pricing'

// ─── 标准错误码 ──────────────────────────────────────────
export enum FeatureGateError {
  UPGRADE_REQUIRED = 'UPGRADE_REQUIRED',
  FUP_LIMIT_REACHED = 'FUP_LIMIT_REACHED',
  INSUFFICIENT_QUOTA = 'INSUFFICIENT_QUOTA',
  FEATURE_NOT_AVAILABLE = 'FEATURE_NOT_AVAILABLE',
  UNAUTHORIZED = 'UNAUTHORIZED',
}

export interface FeatureGateResponse {
  allowed: boolean
  error?: FeatureGateError
  message?: string
  remainingQuota?: number
}

// ─── 套餐配额硬顶（与 pricing.ts 对齐）───────────────────
const PLAN_RAG_LIMITS: Record<string, number> = {
  STARTER: 3,
  PRO: 20,
  MAX: 1000, // FUP 硬顶
}

// ─── 核心鉴权函数 ────────────────────────────────────────
export async function checkFeatureAccess(
  userId: string,
  feature: 'MULTILANG' | 'INTENT_ANALYSIS' | 'LEAD_GENERATION' | 'EMAIL_SEND' | 'RAG_UPLOAD' | 'DATA_EXPORT',
  estimatedTokens: number = 0
): Promise<FeatureGateResponse> {
  try {
    // ─── 1. 从数据库获取用户真实订阅状态 ────────────────
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        subscriptionTier: true,
        tokenBalance: true,
        monthlySearches: true,
        ragFileCount: true,
        monthlyResetAt: true,
      },
    })

    if (!user) {
      return { allowed: false, error: FeatureGateError.UNAUTHORIZED, message: '用户不存在' }
    }

    const planId = user.subscriptionTier as 'STARTER' | 'PRO' | 'MAX'
    const plan = getPlan(planId)
    if (!plan) {
      return { allowed: false, error: FeatureGateError.UNAUTHORIZED, message: '套餐配置错误' }
    }

    // ─── 2. 月度配额重置检查 ─────────────────────────────
    const now = new Date()
    if (!user.monthlyResetAt || user.monthlyResetAt < now) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          tokenBalance: plan.quotas.maxTokensPerMonth,
          monthlySearches: 0,
          monthlyResetAt: new Date(now.getFullYear(), now.getMonth() + 1, 1),
        },
      })
      // 刷新本地变量
      user.tokenBalance = plan.quotas.maxTokensPerMonth
      user.monthlySearches = 0
    }

    // ─── 3. 套餐功能权限检查 ──────────────────────────────
    switch (feature) {
      case 'MULTILANG':
        if (planId === 'STARTER') {
          return {
            allowed: false,
            error: FeatureGateError.UPGRADE_REQUIRED,
            message: '多语种邮件生成需要升级到专业版或以上',
          }
        }
        break

      case 'INTENT_ANALYSIS':
        if (planId === 'STARTER') {
          return {
            allowed: false,
            error: FeatureGateError.UPGRADE_REQUIRED,
            message: '深度意图分析需要升级到专业版或以上',
          }
        }
        break

      case 'DATA_EXPORT':
        if (planId === 'STARTER') {
          return {
            allowed: false,
            error: FeatureGateError.UPGRADE_REQUIRED,
            message: '数据导出功能需要升级到专业版或以上',
          }
        }
        break
    }

    // ─── 4. 配额数值检查 ───────────────────────────────────
    const quotas = plan.quotas

    // Token 配额
    if (estimatedTokens > 0) {
      const remaining = user.tokenBalance
      if (remaining <= 0) {
        return {
          allowed: false,
          error: FeatureGateError.FUP_LIMIT_REACHED,
          message: `本月 AI 算力已用尽（${quotas.maxTokensPerMonth.toLocaleString()} tokens），请等待下月重置或升级套餐`,
          remainingQuota: 0,
        }
      }
      if (estimatedTokens > remaining) {
        return {
          allowed: false,
          error: FeatureGateError.INSUFFICIENT_QUOTA,
          message: `本次操作需要 ${estimatedTokens} tokens，但仅剩余 ${remaining} tokens`,
          remainingQuota: remaining,
        }
      }
    }

    // 客户挖掘配额
    if (feature === 'LEAD_GENERATION') {
      const remaining = quotas.maxLeadsPerMonth - user.monthlySearches
      if (remaining <= 0) {
        return {
          allowed: false,
          error: FeatureGateError.FUP_LIMIT_REACHED,
          message: `本月客户挖掘已达上限（${quotas.maxLeadsPerMonth.toLocaleString()} 家），请等待下月重置或升级套餐`,
          remainingQuota: 0,
        }
      }
    }

    // 知识库文件配额（使用 pricing.ts 中的 maxRAGFiles）
    if (feature === 'RAG_UPLOAD') {
      const limit = PLAN_RAG_LIMITS[planId] ?? quotas.maxRAGFiles
      if (user.ragFileCount >= limit) {
        return {
          allowed: false,
          error: FeatureGateError.FUP_LIMIT_REACHED,
          message: `知识库文件已达上限（${limit} 个），请删除旧文件或升级套餐`,
          remainingQuota: 0,
        }
      }
    }

    // ─── 5. 全部检查通过 ──────────────────────────────────
    return {
      allowed: true,
      remainingQuota: user.tokenBalance,
    }
  } catch (error) {
    console.error('[FeatureGate] Error:', error)
    return { allowed: false, error: FeatureGateError.UNAUTHORIZED, message: '鉴权服务异常' }
  }
}

// ─── 记录配额消耗（真实数据库写入）─────────────────────
export async function recordQuotaUsage(
  userId: string,
  type: 'tokens' | 'leads' | 'emails' | 'rag',
  amount: number = 1
): Promise<void> {
  try {
    switch (type) {
      case 'tokens':
        await prisma.user.update({
          where: { id: userId },
          data: { tokenBalance: { decrement: amount } },
        })
        break
      case 'leads':
        await prisma.user.update({
          where: { id: userId },
          data: { monthlySearches: { increment: amount } },
        })
        break
      case 'emails':
        // emailsSent 没有独立字段，通过 credits 扣减
        await prisma.user.update({
          where: { id: userId },
          data: { credits: { decrement: amount } },
        })
        break
      case 'rag':
        await prisma.user.update({
          where: { id: userId },
          data: { ragFileCount: { increment: amount } },
        })
        break
    }
    console.log(`[QuotaUsage] User ${userId}: ${type} ${type === 'tokens' || type === 'emails' ? '-' : '+'}= ${amount}`)
  } catch (error) {
    console.error('[QuotaUsage] Error:', error)
  }
}
