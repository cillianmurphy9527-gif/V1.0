/**
 * 铁血风控 - 成本物理熔断器 (Circuit Breaker)
 * 
 * 核心策略：
 * 1. 每次调用外部 API 后实时估算成本
 * 2. 累加到 user_quotas.api_cost_total
 * 3. 超过套餐价格 60% → 强制熔断
 * 
 * 【开发模式】完全跳过熔断检查，允许无限测试
 */

import { prisma } from '@/lib/prisma'
import { TIER_CONFIG, TierType } from '@/lib/services/quota'
import { createLog } from '@/lib/nova/anti-detection'

// ─── 开发模式检测 ─────────────────────────────────────
const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === undefined

// ─── 熔断配置 ─────────────────────────────────────────
const CIRCUIT_BREAKER_CONFIG = {
  // 熔断阈值（套餐价格的百分比）
  TRIGGER_THRESHOLD_PERCENT: 60,
  
  // API 成本估算（每次调用的预估成本）
  API_COSTS: {
    PROXYCURL: 0.05,      // $0.05/次
    HUNTER: 0.02,         // $0.02/次
    EMAIL_VALIDATION: 0.01, // $0.01/次
    GPT_4O_MINI: 0.001,    // ~$0.001/次（1000 tokens）
    GPT_4O: 0.01,          // ~$0.01/次（1000 tokens）
    RESEND: 0.001,         // $0.001/封
  },
}

// ─── 熔断结果 ─────────────────────────────────────────
export interface CircuitBreakerResult {
  tripped: boolean
  currentCost: number
  costLimit: number
  usagePercent: number
  message?: string
}

// ─── API 调用成本追踪 ─────────────────────────────────
export type ApiServiceType = keyof typeof CIRCUIT_BREAKER_CONFIG.API_COSTS

/**
 * 计算单次 API 调用的成本
 */
export function estimateApiCost(service: ApiServiceType): number {
  return CIRCUIT_BREAKER_CONFIG.API_COSTS[service] || 0
}

// ─── 成本熔断检查 ─────────────────────────────────────
/**
 * 检查用户是否触发成本熔断（内部使用，不重复定义）
 */
async function doCheckCircuitBreaker(userId: string): Promise<CircuitBreakerResult> {
  // 【开发模式】跳过熔断检查
  if (isDev) {
    return {
      tripped: false,
      currentCost: 0,
      costLimit: Infinity,
      usagePercent: 0,
      message: '开发模式跳过熔断检查',
    }
  }

  let userQuota = await prisma.userQuota.findUnique({
    where: { userId },
    select: { tier: true, apiCostTotal: true },
  })

  // 如果不存在，初始化
  if (!userQuota) {
    try {
      await prisma.userQuota.create({
        data: {
          userId,
          tier: 'BASIC',
          leadsBalance: 300,
          leadsLimit: 300,
          tokensLimit: 50000,
          apiCostTotal: 0,
        },
      })
      userQuota = { tier: 'BASIC', apiCostTotal: 0 }
    } catch {
      return { tripped: false, currentCost: 0, costLimit: Infinity, usagePercent: 0 }
    }
  }

  const tierPrice = TIER_CONFIG[userQuota.tier as TierType]?.price || 299
  const costLimit = tierPrice * (CIRCUIT_BREAKER_CONFIG.TRIGGER_THRESHOLD_PERCENT / 100)
  const usagePercent = (userQuota.apiCostTotal / costLimit) * 100

  return {
    tripped: userQuota.apiCostTotal >= costLimit,
    currentCost: userQuota.apiCostTotal,
    costLimit,
    usagePercent: Math.round(usagePercent * 100) / 100,
  }
}

/**
 * 【导出】检查用户是否触发成本熔断
 */
export async function checkCircuitBreaker(userId: string): Promise<CircuitBreakerResult> {
  return doCheckCircuitBreaker(userId)
}

// ─── 累加 API 成本 ─────────────────────────────────────
/**
 * 累加 API 成本
 */
export async function addApiCost(
  userId: string,
  cost: number,
  reason: string
): Promise<CircuitBreakerResult> {
  // 【开发模式】跳过成本追踪
  if (isDev) {
    console.log(`[CircuitBreaker] [DEV MODE] Skipping cost tracking: ${reason} ($${cost})`)
    return {
      tripped: false,
      currentCost: 0,
      costLimit: Infinity,
      usagePercent: 0,
      message: '开发模式跳过成本追踪',
    }
  }

  const beforeResult = await doCheckCircuitBreaker(userId)

  // 确保 UserQuota 存在
  let quota = await prisma.userQuota.findUnique({ where: { userId } })
  if (!quota) {
    try {
      quota = await prisma.userQuota.create({
        data: {
          userId,
          tier: 'BASIC',
          leadsBalance: 300,
          leadsLimit: 300,
          tokensLimit: 50000,
          apiCostTotal: 0,
        },
      })
    } catch {
      return beforeResult
    }
  }

  // 累加成本
  await prisma.userQuota.update({
    where: { userId },
    data: {
      apiCostTotal: { increment: cost },
    },
  })

  const afterResult = await doCheckCircuitBreaker(userId)

  // 如果触发熔断
  if (afterResult.tripped && !beforeResult.tripped) {
    console.warn(`[CircuitBreaker] ⚠️ 用户 ${userId} 触发成本熔断！`)
  }

  return afterResult
}

// ─── 强制熔断 ─────────────────────────────────────────
/**
 * 触发熔断：暂停用户所有运行中的 Nova 任务
 */
export async function triggerCircuitBreak(
  userId: string,
  jobId?: string
): Promise<{
  success: boolean
  pausedJobs: number
  error?: string
}> {
  // 【开发模式】跳过熔断
  if (isDev) {
    console.log('[CircuitBreaker] [DEV MODE] Skipping circuit break trigger')
    return {
      success: true,
      pausedJobs: 0,
    }
  }

  try {
    // 1. 更新用户配额状态（可选：冻结）
    await prisma.userQuota.update({
      where: { userId },
      data: {
        tier: 'BASIC', // 降级到最低套餐
      },
    })

    // 2. 暂停所有运行中的 Nova 任务
    const pausedJobs = await prisma.novaJob.updateMany({
      where: {
        userId,
        status: { in: ['PENDING', 'RUNNING'] },
      },
      data: {
        status: 'PAUSED',
      },
    })

    // 3. 记录日志
    if (jobId) {
      await prisma.novaJob.update({
        where: { id: jobId },
        data: {
          logs: JSON.stringify([
            ...JSON.parse(
              (await prisma.novaJob.findUnique({ where: { id: jobId }, select: { logs: true } }))?.logs || '[]'
            ),
            createLog(
              'WARN',
              '⚠️ 触发系统成本风控保护！任务已暂停，等待人工审核。',
              {
                reason: 'API成本超限',
                action: '自动熔断',
                timestamp: new Date().toISOString(),
              }
            ),
          ].slice(-500)),
        },
      })
    }

    // 4. 发送系统通知
    await prisma.systemNotification.create({
      data: {
        userId,
        title: '⚠️ 账号已被临时风控',
        content: `由于本月 API 消耗已达到套餐限额，您的 Nova 任务已自动暂停。请联系客服或升级套餐以继续使用。`,
        type: 'SYSTEM',
        actionUrl: '/dashboard/settings',
      },
    })

    console.warn(`[CircuitBreaker] 🔒 用户 ${userId} 已熔断，暂停了 ${pausedJobs.count} 个任务`)

    return {
      success: true,
      pausedJobs: pausedJobs.count,
    }
  } catch (error) {
    console.error('[CircuitBreaker] 熔断失败:', error)
    return {
      success: false,
      pausedJobs: 0,
      error: error instanceof Error ? error.message : '未知错误',
    }
  }
}

// ─── 熔断中间件包装器 ─────────────────────────────────
/**
 * 带成本追踪的 API 调用包装器
 * 
 * @example
 * ```typescript
 * const result = await withCircuitBreaker(userId, 'PROXYCURL', async () => {
 *   // 实际 API 调用
 *   return await fetchCompanyInfo(domain)
 * })
 * 
 * if (result.circuitTripped) {
 *   // 处理熔断
 * }
 * ```
 */
export async function withCircuitBreaker<T>(
  userId: string,
  service: ApiServiceType,
  apiCall: () => Promise<T>,
  options?: {
    jobId?: string
    autoTrip?: boolean // 是否自动熔断
  }
): Promise<{
  data: T | null
  costTracked: number
  circuitTripped: boolean
  error?: string
}> {
  const estimatedCost = estimateApiCost(service)
  const beforeCheck = await checkCircuitBreaker(userId)

  // 如果已经熔断，直接拒绝
  if (beforeCheck.tripped) {
    return {
      data: null,
      costTracked: 0,
      circuitTripped: true,
      error: '账户已达到 API 消耗上限，请升级套餐',
    }
  }

  try {
    // 执行实际调用
    const data = await apiCall()

    // 追踪成本
    const afterCheck = await addApiCost(userId, estimatedCost, service)

    // 如果触发熔断
    if (afterCheck.tripped && options?.autoTrip) {
      await triggerCircuitBreak(userId, options.jobId)
      return {
        data,
        costTracked: estimatedCost,
        circuitTripped: true,
        error: 'API 消耗已超限，任务已自动暂停',
      }
    }

    return {
      data,
      costTracked: estimatedCost,
      circuitTripped: false,
    }
  } catch (error) {
    // API 调用失败，不计入成本
    return {
      data: null,
      costTracked: 0,
      circuitTripped: false,
      error: error instanceof Error ? error.message : 'API 调用失败',
    }
  }
}

// ─── 成本重置（月度重置）──────────────────────────────
/**
 * 重置用户 API 成本计数
 * 建议每月执行一次
 */
export async function resetMonthlyApiCost(userId: string): Promise<void> {
  await prisma.userQuota.update({
    where: { userId },
    data: {
      apiCostTotal: 0,
    },
  })
}

// ─── 成本预警 ─────────────────────────────────────────
/**
 * 检查用户是否接近熔断阈值（>80%）
 */
export async function checkCostWarning(userId: string): Promise<{
  warning: boolean
  percent: number
  message?: string
}> {
  const result = await checkCircuitBreaker(userId)
  
  if (result.usagePercent >= 80 && result.usagePercent < 100) {
    return {
      warning: true,
      percent: result.usagePercent,
      message: `本月 API 消耗已达 ${result.usagePercent.toFixed(1)}%，接近风控阈值`,
    }
  }

  return {
    warning: false,
    percent: result.usagePercent,
  }
}
