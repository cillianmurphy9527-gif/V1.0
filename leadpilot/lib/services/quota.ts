/**
 * LeadPilot 线索中枢 - 全局配额哨兵 (QuotaManager)
 * 工业级升级：基于动态数据库 PlanTemplate 配置，实现多维度额度硬拦截与并发保护
 * (已修复 updateNovaJobProgress 中的 startedAt/completedAt 类型报错)
 */

import { prisma } from "@/lib/prisma"

// ======= 1. 向后兼容层：定义常量与类型 =======
export const TIER_CONFIG = {
  BASIC: { tier: "BASIC", price: 299, leadsLimit: 300, tokensLimit: 50000, apiCostLimit: 50 },
  PRO: { tier: "PRO", price: 799, leadsLimit: 1000, tokensLimit: 200000, apiCostLimit: 150 },
  ENTERPRISE: { tier: "ENTERPRISE", price: 1999, leadsLimit: 3000, tokensLimit: 500000, apiCostLimit: 400 },
} as const

export type TierType = keyof typeof TIER_CONFIG

export class QuotaServiceError extends Error {
  constructor(
    public message: string, 
    public code: "INSUFFICIENT_QUOTA" | "USER_NOT_FOUND" | "DB_ERROR" | "TIER_INVALID", 
    public statusCode: number = 403
  ) {
    super(message)
    this.name = "QuotaServiceError"
  }
}

export interface QuotaDeductResult { 
  success: boolean; 
  newBalance: number; 
  cost?: number; 
  error?: QuotaServiceError 
}

/**
 * 2. 核心配额管理器
 */
export const QuotaManager = {
  
  async consumeLead(userId: string, count: number = 1): Promise<QuotaDeductResult> {
    if (count <= 0) return { success: true, newBalance: 0 }

    try {
      return await prisma.$transaction(async (tx) => {
        // 🌟 先查配额，找不到就自动创建（而非报错）
let userQuota = await tx.userQuota.findUnique({
  where: { userId }
})

if (!userQuota) {
  // 从 User 表查用户当前套餐类型
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { planType: true }
  })
  const tier = user?.planType || 'FREE'

  // 尝试从 PlanTemplate 读取该套餐的线索上限
  const template = await tx.planTemplate.findUnique({
    where: { planCode: tier },
    select: { leadsLimit: true }
  })
  const leadsLimit = template?.leadsLimit || 3

  // 自动创建配额记录
  userQuota = await tx.userQuota.create({
    data: {
      userId,
      tier,
      leadsLimit,
      leadsBalance: leadsLimit,
    }
  })
}

        // 试用期动态拦截
        if ((userQuota.tier === 'FREE' || userQuota.tier === 'TRIAL') && count > userQuota.leadsLimit) {
            throw new QuotaServiceError(`试用版单次最多挖掘 ${userQuota.leadsLimit} 条线索。请升级套餐解锁全部功能。`, "INSUFFICIENT_QUOTA", 403)
        }

        const updatedQuota = await tx.userQuota.update({
          where: { userId },
          data: { leadsBalance: { decrement: count } },
          select: { leadsBalance: true, tier: true },
        })

        if (updatedQuota.leadsBalance < 0) {
          throw new QuotaServiceError(`线索额度不足。本次需要 ${count} 条，请充值。`, "INSUFFICIENT_QUOTA", 403)
        }

        // 🌟 修复 unused 报错：使用 getApiCostPerLead 计算成本
        const plan = await tx.planTemplate.findUnique({ where: { planCode: userQuota.tier } })
        const estimatedApiCost = plan && plan.leadsLimit > 0 
            ? (plan.price / plan.leadsLimit) * count 
            : (count * getApiCostPerLead(userQuota.tier as TierType));
        
        await tx.userQuota.update({
          where: { userId },
          data: { apiCostTotal: { increment: estimatedApiCost } },
        })

        return { success: true, newBalance: updatedQuota.leadsBalance, cost: estimatedApiCost }
      })
    } catch (error) {
      if (error instanceof QuotaServiceError) return { success: false, newBalance: 0, error }
      throw error
    }
  },

  async getQuotaStatus(userId: string) {
    const quota = await prisma.userQuota.findUnique({ 
        where: { userId }, 
        select: { tier: true, leadsBalance: true, leadsLimit: true, apiCostTotal: true, emailAccountsLimit: true, dailySendLimit: true, exportBalance: true, updatedAt: true }
    })
    
    if (!quota) return { 
        tier: "FREE", 
        leadsBalance: 0, 
        leadsLimit: 0, 
        emailAccountsLimit: 0,
        dailySendLimit: 0,
        apiCostTotal: 0, 
        usagePercent: 0 
    }
    
    const usagePercent = quota.leadsLimit > 0 
        ? Math.round(((quota.leadsLimit - quota.leadsBalance) / quota.leadsLimit) * 100) 
        : 0;

    return { ...quota, usagePercent }
  },

  async canAddEmailAccount(userId: string): Promise<boolean> {
     const quota = await prisma.userQuota.findUnique({ where: { userId }})
     if (!quota) return false;
     
     const activeDomainsCount = await prisma.domain.count({
         where: { userId, status: { notIn: ['BANNED'] } }
     })

     return activeDomainsCount < quota.emailAccountsLimit;
  },

  async isFreeTier(userId: string): Promise<boolean> {
     const quota = await prisma.userQuota.findUnique({ where: { userId }, select: { tier: true }})
     return quota?.tier === 'FREE' || quota?.tier === 'TRIAL';
  },

  async refundLeadQuota(userId: string, count: number = 1): Promise<{ success: boolean; newBalance: number }> {
    try {
      const updatedQuota = await prisma.userQuota.update({ 
          where: { userId }, 
          data: { leadsBalance: { increment: count } }, 
          select: { leadsBalance: true }
      })
      return { success: true, newBalance: updatedQuota.leadsBalance }
    } catch (error) { 
      return { success: false, newBalance: 0 } 
    }
  },

  async upgradeUserTier(userId: string, planCode: string): Promise<{ success: boolean; newQuota?: any, error?: string }> {
      const template = await prisma.planTemplate.findUnique({ where: { planCode }})
      if (!template) return { success: false, error: "系统无此套餐模板" }

      try {
          const updatedQuota = await prisma.userQuota.upsert({
              where: { userId },
              update: {
                  tier: template.planCode,
                  leadsLimit: template.leadsLimit,
                  leadsBalance: template.leadsLimit, 
                  emailAccountsLimit: template.emailAccountsLimit,
                  dailySendLimit: template.dailySendLimit,
                  exportBalance: { increment: template.exportQuota } 
              },
              create: {
                  userId,
                  tier: template.planCode,
                  leadsLimit: template.leadsLimit,
                  leadsBalance: template.leadsLimit,
                  emailAccountsLimit: template.emailAccountsLimit,
                  dailySendLimit: template.dailySendLimit,
                  exportBalance: template.exportQuota
              }
          })
          
          await prisma.user.update({
              where: { id: userId },
              data: { subscriptionTier: template.planCode, planType: template.planCode }
          })

          return { success: true, newQuota: updatedQuota }
      } catch(e) {
          return { success: false, error: "数据库更新失败" }
      }
  }
}

/**
 * 3. 向后兼容层：逻辑出口
 */
export async function withQuotaCheck<T>(
  userId: string, 
  executeAction: (quota: { newBalance: number }) => Promise<T>
): Promise<T> {
  const result = await QuotaManager.consumeLead(userId, 1)
  if (!result.success || result.error) throw result.error
  return await executeAction({ newBalance: result.newBalance })
}

export async function deductQuotaBatch(userId: string, count: number) {
  return await QuotaManager.consumeLead(userId, count)
}

export async function refundQuota(userId: string, count: number = 1) {
  return await QuotaManager.refundLeadQuota(userId, count)
}

export async function getQuotaStatus(userId: string) {
  return await QuotaManager.getQuotaStatus(userId)
}

export async function upgradeTier(userId: string, newTier: TierType) {
  return await QuotaManager.upgradeUserTier(userId, newTier as string)
}

export function getApiCostPerLead(tier: TierType): number { 
    const config = TIER_CONFIG[tier]; 
    return config ? config.price / config.leadsLimit : 0.1;
}

// ======= 保持原有的业务模型缓存方法不变 =======
export async function saveLeadToCache(params: { userId: string, domain: string, companyName?: string, contactEmail: string, jobTitle?: string, isValid?: boolean }) {
  return await prisma.leadsCache.upsert({
    where: { contactEmail: params.contactEmail },
    update: { domain: params.domain, companyName: params.companyName, jobTitle: params.jobTitle, isValid: params.isValid ?? true },
    create: { userId: params.userId, domain: params.domain, companyName: params.companyName, contactEmail: params.contactEmail, jobTitle: params.jobTitle, isValid: params.isValid ?? true },
  })
}
export async function getLeadsByDomain(userId: string, domain: string) { return await prisma.leadsCache.findMany({ where: { userId, domain }, orderBy: { createdAt: "desc" }}) }
export async function getUserLeads(userId: string, options?: { skip?: number, take?: number, isValid?: boolean }) { return await prisma.leadsCache.findMany({ where: { userId, ...(options?.isValid !== undefined && { isValid: options.isValid }) }, orderBy: { createdAt: "desc" }, skip: options?.skip ?? 0, take: options?.take ?? 50 }) }
export async function createNovaJob(params: { userId: string, jobType: string, totalTargets: number }) { return await prisma.novaJob.create({ data: { userId: params.userId, jobType: params.jobType, totalTargets: params.totalTargets, status: "PENDING" }}) }

// 🌟🌟🌟 这里是彻底修复了红线的函数 🌟🌟🌟
export async function updateNovaJobProgress(
  jobId: string, 
  updates: { 
    status?: string, 
    currentProgress?: number, 
    leadsFound?: number, 
    leadsSaved?: number, 
    errorMessage?: string, 
    logs?: string,
    startedAt?: Date,     // 显式声明时间类型
    completedAt?: Date    // 显式声明时间类型
  }
) {
  const data: any = { ...updates }
  if (updates.status === "RUNNING" && !updates.startedAt) data.startedAt = new Date()
  if (updates.status === "COMPLETED" || updates.status === "FAILED") data.completedAt = new Date()
  return await prisma.novaJob.update({ where: { id: jobId }, data })
}

export async function getNovaJob(jobId: string, userId: string) { return await prisma.novaJob.findFirst({ where: { id: jobId, userId }}) }
export async function getUserNovaJobs(userId: string, options?: { status?: string, skip?: number, take?: number }) { return await prisma.novaJob.findMany({ where: { userId, ...(options?.status && { status: options.status }) }, orderBy: { createdAt: "desc" }, skip: options?.skip ?? 0, take: options?.take ?? 10 }) }