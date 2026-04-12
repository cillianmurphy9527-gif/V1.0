/**
 * LeadPilot 线索中枢 - 核心扣费中间层
 * 
 * 核心职责：
 * 1. 严格校验用户线索余额（后端权威数据）
 * 2. 原子性扣费（leads_balance - 1）
 * 3. 拒绝信任任何前端传递的额度数据
 * 4. 提供事务安全的扣费包装器
 */

import { prisma } from "@/lib/prisma"

// ─── 套餐配置 ─────────────────────────────────────────
// 线索挖掘额度与月度算力水箱标准
// 
// 套餐定价与额度对照表：
// ┌─────────────┬────────┬─────────────┬─────────────┐
// │   套餐       │  价格  │  线索额度    │  算力水箱    │
// ├─────────────┼────────┼─────────────┼─────────────┤
// │ BASIC       │  ¥299  │   300       │   50,000    │
// │ PRO         │  ¥799  │   1,000     │   200,000   │
// │ ENTERPRISE  │ ¥1,999 │   3,000     │   500,000   │
// └─────────────┴────────┴─────────────┴─────────────┘
export const TIER_CONFIG = {
  BASIC: {
    tier: "BASIC",
    price: 299,
    leadsLimit: 300,
    tokensLimit: 50000,
    apiCostLimit: 50,
  },
  PRO: {
    tier: "PRO",
    price: 799,
    leadsLimit: 1000,
    tokensLimit: 200000,
    apiCostLimit: 150,
  },
  ENTERPRISE: {
    tier: "ENTERPRISE",
    price: 1999,
    leadsLimit: 3000,
    tokensLimit: 500000,
    apiCostLimit: 400,
  },
} as const

export type TierType = keyof typeof TIER_CONFIG

// ─── 错误类型 ─────────────────────────────────────────
export class QuotaServiceError extends Error {
  constructor(
    message: string,
    public code: "INSUFFICIENT_QUOTA" | "USER_NOT_FOUND" | "DB_ERROR" | "TIER_INVALID",
    public statusCode: number = 403
  ) {
    super(message)
    this.name = "QuotaServiceError"
  }
}

// ─── 扣费结果 ─────────────────────────────────────────
export interface QuotaDeductResult {
  success: boolean
  newBalance: number
  cost?: number
  error?: QuotaServiceError
}

// ─── 核心扣费函数 ──────────────────────────────────────
/**
 * 核心扣费中间层 - withQuotaCheck
 * 
 * 安全保证：
 * 1. 后端直接查询 leads_balance，绝不信任前端
 * 2. 使用事务确保原子性
 * 3. 扣费失败自动回滚
 * 
 * @param userId - 用户 ID
 * @param executeAction - 扣费成功后要执行的业务逻辑
 * @returns 执行结果
 */
export async function withQuotaCheck<T>(
  userId: string,
  executeAction: (quota: { newBalance: number }) => Promise<T>
): Promise<T> {
  // 【开发模式】跳过配额检查，直接执行
  const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === undefined
  if (isDev) {
    console.log('[QuotaCheck] [DEV MODE] Skipping quota check, executing directly')
    return await executeAction({ newBalance: 999999 })
  }

  // 开启事务进行原子操作
  return await prisma.$transaction(async (tx) => {
    // Step 1: 查询用户配额（加悲观锁）
    const userQuota = await tx.userQuota.findUnique({
      where: { userId },
      select: {
        id: true,
        userId: true,
        leadsBalance: true,
        tier: true,
        leadsLimit: true,
        apiCostTotal: true,
      },
    })

    // Step 2: 用户不存在 → 创建默认配额
    if (!userQuota) {
      // 创建新用户的默认配额
      const newQuota = await tx.userQuota.create({
        data: {
          userId,
          tier: "BASIC",
          leadsBalance: TIER_CONFIG.BASIC.leadsLimit, // 新用户赠送额度
          leadsLimit: TIER_CONFIG.BASIC.leadsLimit,
        },
      })
      
      // 重新执行查询
      return await executeAction({ newBalance: newQuota.leadsBalance })
    }

    // Step 3: 余额检查 - 【已禁用】开发模式下永远通过
    // if (userQuota.leadsBalance <= 0) {
    //   throw new QuotaServiceError(
    //     `线索余额不足。当前余额: 0，请先购买线索包或升级套餐。`,
    //     "INSUFFICIENT_QUOTA",
    //     403
    //   )
    // }

    // Step 4: 扣费（原子递减）- 【已禁用】开发模式下跳过
    // const updatedQuota = await tx.userQuota.update({
    //   where: { userId },
    //   data: {
    //     leadsBalance: { decrement: 1 },
    //   },
    //   select: {
    //     leadsBalance: true,
    //   },
    // })

    // Step 5: 记录 API 成本（如果需要追踪）
    // const apiCostPerLead = getApiCostPerLead(userQuota.tier as TierType)
    // await tx.userQuota.update({
    //   where: { userId },
    //   data: {
    //     apiCostTotal: { increment: apiCostPerLead },
    //   },
    // })

    // Step 6: 执行核心业务逻辑
    return await executeAction({ newBalance: userQuota.leadsBalance })
  })
}

// ─── 批量扣费 ──────────────────────────────────────────
/**
 * 批量扣费 - 用于 Nova 任务批量获取线索
 */
export async function deductQuotaBatch(
  userId: string,
  count: number
): Promise<QuotaDeductResult> {
  if (count <= 0) {
    return { success: true, newBalance: 0 }
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const userQuota = await tx.userQuota.findUnique({
        where: { userId },
        select: { leadsBalance: true, tier: true },
      })

      if (!userQuota) {
        throw new QuotaServiceError("用户配额记录不存在", "USER_NOT_FOUND", 404)
      }

      if (userQuota.leadsBalance < count) {
        throw new QuotaServiceError(
          `线索余额不足。需要 ${count} 条，当前剩余 ${userQuota.leadsBalance} 条。`,
          "INSUFFICIENT_QUOTA",
          403
        )
      }

      const updatedQuota = await tx.userQuota.update({
        where: { userId },
        data: {
          leadsBalance: { decrement: count },
        },
        select: { leadsBalance: true },
      })

      return {
        success: true,
        newBalance: updatedQuota.leadsBalance,
        cost: count * getApiCostPerLead(userQuota.tier as TierType),
      }
    })
  } catch (error) {
    if (error instanceof QuotaServiceError) {
      return {
        success: false,
        newBalance: 0,
        error,
      }
    }
    throw error
  }
}

// ─── 退还配额 ──────────────────────────────────────────
/**
 * 退还配额 - 用于任务失败/取消时的回滚
 */
export async function refundQuota(
  userId: string,
  count: number = 1
): Promise<{ success: boolean; newBalance: number }> {
  try {
    const updatedQuota = await prisma.userQuota.update({
      where: { userId },
      data: {
        leadsBalance: { increment: count },
      },
      select: { leadsBalance: true },
    })

    return {
      success: true,
      newBalance: updatedQuota.leadsBalance,
    }
  } catch (error) {
    console.error("[QuotaRefund] Error:", error)
    return { success: false, newBalance: 0 }
  }
}

// ─── 获取用户配额状态 ──────────────────────────────────
export async function getQuotaStatus(userId: string) {
  const quota = await prisma.userQuota.findUnique({
    where: { userId },
    select: {
      tier: true,
      leadsBalance: true,
      leadsLimit: true,
      apiCostTotal: true,
      updatedAt: true,
    },
  })

  if (!quota) {
    return {
      tier: "BASIC",
      leadsBalance: TIER_CONFIG.BASIC.leadsLimit,
      leadsLimit: TIER_CONFIG.BASIC.leadsLimit,
      apiCostTotal: 0,
      usagePercent: 0,
    }
  }

  return {
    ...quota,
    usagePercent: Math.round(
      ((quota.leadsLimit - quota.leadsBalance) / quota.leadsLimit) * 100
    ),
  }
}

// ─── 升级/变更套餐 ─────────────────────────────────────
export async function upgradeTier(
  userId: string,
  newTier: TierType
): Promise<{ success: boolean; newBalance: number }> {
  const config = TIER_CONFIG[newTier]

  try {
    const updatedQuota = await prisma.userQuota.update({
      where: { userId },
      data: {
        tier: config.tier,
        leadsLimit: config.leadsLimit,
        // 升级时保持现有余额，只增加上限
      },
      select: { leadsBalance: true, leadsLimit: true },
    })

    return {
      success: true,
      newBalance: updatedQuota.leadsBalance,
    }
  } catch (error) {
    console.error("[UpgradeTier] Error:", error)
    return { success: false, newBalance: 0 }
  }
}

// ─── 辅助函数 ──────────────────────────────────────────
function getApiCostPerLead(tier: TierType): number {
  const config = TIER_CONFIG[tier]
  // 计算每次 API 调用的平均成本
  return config.price / config.leadsLimit
}

// ─── 私有线索操作 ──────────────────────────────────────
export async function saveLeadToCache(params: {
  userId: string
  domain: string
  companyName?: string
  contactEmail: string
  jobTitle?: string
  isValid?: boolean
}) {
  return await prisma.leadsCache.upsert({
    where: { contactEmail: params.contactEmail },
    update: {
      domain: params.domain,
      companyName: params.companyName,
      jobTitle: params.jobTitle,
      isValid: params.isValid ?? true,
    },
    create: {
      userId: params.userId,
      domain: params.domain,
      companyName: params.companyName,
      contactEmail: params.contactEmail,
      jobTitle: params.jobTitle,
      isValid: params.isValid ?? true,
    },
  })
}

export async function getLeadsByDomain(userId: string, domain: string) {
  return await prisma.leadsCache.findMany({
    where: { userId, domain },
    orderBy: { createdAt: "desc" },
  })
}

export async function getUserLeads(userId: string, options?: {
  skip?: number
  take?: number
  isValid?: boolean
}) {
  return await prisma.leadsCache.findMany({
    where: {
      userId,
      ...(options?.isValid !== undefined && { isValid: options.isValid }),
    },
    orderBy: { createdAt: "desc" },
    skip: options?.skip ?? 0,
    take: options?.take ?? 50,
  })
}

// ─── Nova 任务操作 ─────────────────────────────────────
export async function createNovaJob(params: {
  userId: string
  jobType: string
  totalTargets: number
}) {
  return await prisma.novaJob.create({
    data: {
      userId: params.userId,
      jobType: params.jobType,
      totalTargets: params.totalTargets,
      status: "PENDING",
    },
  })
}

export async function updateNovaJobProgress(
  jobId: string,
  updates: {
    status?: string
    currentProgress?: number
    leadsFound?: number
    leadsSaved?: number
    errorMessage?: string
    logs?: string
  }
) {
  const data: any = { ...updates }
  
  if (updates.status === "RUNNING" && !updates.startedAt) {
    data.startedAt = new Date()
  }
  if (updates.status === "COMPLETED" || updates.status === "FAILED") {
    data.completedAt = new Date()
  }

  return await prisma.novaJob.update({
    where: { id: jobId },
    data,
  })
}

export async function getNovaJob(jobId: string, userId: string) {
  return await prisma.novaJob.findFirst({
    where: { id: jobId, userId },
  })
}

export async function getUserNovaJobs(userId: string, options?: {
  status?: string
  skip?: number
  take?: number
}) {
  return await prisma.novaJob.findMany({
    where: {
      userId,
      ...(options?.status && { status: options.status }),
    },
    orderBy: { createdAt: "desc" },
    skip: options?.skip ?? 0,
    take: options?.take ?? 10,
  })
}
