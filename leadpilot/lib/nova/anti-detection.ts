/**
 * Nova 异步任务处理器 - 反侦察防封策略
 * 
 * 核心特性：
 * 1. 批次循环执行（每批 5-10 个线索）
 * 2. 随机延迟模拟真人操作节奏（60-180 秒）
 * 3. 任务状态检查（paused/stopped 时中止）
 * 4. 实时进度更新到数据库
 */

import { prisma } from '@/lib/prisma'

// ─── 批次配置 ─────────────────────────────────────────
export const BATCH_CONFIG = {
  MIN_BATCH_SIZE: 5,
  MAX_BATCH_SIZE: 10,
  MIN_DELAY_SECONDS: 60,  // 最小间隔
  MAX_DELAY_SECONDS: 180, // 最大间隔
  CHECK_INTERVAL_MS: 5000, // 状态检查间隔
}

// ─── 日志类型 ─────────────────────────────────────────
export interface NovaJobLog {
  timestamp: string
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG'
  message: string
  details?: Record<string, unknown>
}

// ─── 添加日志 ─────────────────────────────────────────
export function createLog(
  level: NovaJobLog['level'],
  message: string,
  details?: Record<string, unknown>
): NovaJobLog {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    details,
  }
}

// ─── 反侦察延迟 ───────────────────────────────────────
/**
 * 生成随机延迟（60-180 秒），模拟真人操作节奏
 * 防止被邮件服务商识别为机器行为
 */
export function getRandomDelay(): number {
  const { MIN_DELAY_SECONDS, MAX_DELAY_SECONDS } = BATCH_CONFIG
  const delaySeconds = Math.floor(
    Math.random() * (MAX_DELAY_SECONDS - MIN_DELAY_SECONDS + 1)
  ) + MIN_DELAY_SECONDS
  
  return delaySeconds * 1000 // 转换为毫秒
}

/**
 * 安全的 sleep 函数
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 随机批次大小
 */
export function getRandomBatchSize(): number {
  return Math.floor(
    Math.random() * (BATCH_CONFIG.MAX_BATCH_SIZE - BATCH_CONFIG.MIN_BATCH_SIZE + 1)
  ) + BATCH_CONFIG.MIN_BATCH_SIZE
}

// ─── 任务状态检查 ──────────────────────────────────────
export type NovaJobStatus = 'PENDING' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'FAILED' | 'STOPPED'

/**
 * 检查任务是否应该继续运行
 */
export async function shouldContinue(jobId: string): Promise<{
  continue: boolean
  reason?: string
}> {
  const job = await prisma.novaJob.findUnique({
    where: { id: jobId },
    select: { status: true, userId: true },
  })

  if (!job) {
    return { continue: false, reason: '任务不存在' }
  }

  // 已停止或已完成
  if (job.status === 'STOPPED' || job.status === 'COMPLETED' || job.status === 'FAILED') {
    return { continue: false, reason: `任务已${job.status}` }
  }

  // 被暂停
  if (job.status === 'PAUSED') {
    return { continue: false, reason: '任务已暂停' }
  }

  return { continue: true }
}

/**
 * 更新任务日志
 */
export async function appendJobLog(jobId: string, log: NovaJobLog): Promise<void> {
  const job = await prisma.novaJob.findUnique({
    where: { id: jobId },
    select: { logs: true },
  })

  if (!job) return

  try {
    const logs: NovaJobLog[] = JSON.parse(job.logs || '[]')
    logs.push(log)
    
    // 保留最近 500 条日志
    const trimmedLogs = logs.slice(-500)
    
    await prisma.novaJob.update({
      where: { id: jobId },
      data: { logs: JSON.stringify(trimmedLogs) },
    })
  } catch (error) {
    console.error('[NovaLog] Failed to parse logs:', error)
  }
}

/**
 * 更新任务进度
 */
export async function updateJobProgress(
  jobId: string,
  updates: {
    leadsFound?: number
    leadsSaved?: number
  }
): Promise<void> {
  const job = await prisma.novaJob.findUnique({
    where: { id: jobId },
    select: { currentProgress: true, totalTargets: true, leadsFound: true, leadsSaved: true },
  })

  if (!job) return

  const newProgress = Math.min(
    Math.round(
      ((job.currentProgress + (updates.leadsFound || 0)) / job.totalTargets) * 100
    ),
    100
  )

  await prisma.novaJob.update({
    where: { id: jobId },
    data: {
      currentProgress: newProgress,
      leadsFound: job.leadsFound + (updates.leadsFound || 0),
      leadsSaved: job.leadsSaved + (updates.leadsSaved || 0),
    },
  })
}

/**
 * 标记任务为完成
 */
export async function completeJob(
  jobId: string,
  result: {
    totalProcessed: number
    leadsFound: number
    leadsSaved: number
    errors?: string[]
  }
): Promise<void> {
  await prisma.novaJob.update({
    where: { id: jobId },
    data: {
      status: 'COMPLETED',
      currentProgress: 100,
      completedAt: new Date(),
      errorMessage: result.errors?.length ? result.errors.join('; ') : null,
    },
  })
}

/**
 * 标记任务失败
 */
export async function failJob(jobId: string, error: string): Promise<void> {
  await prisma.novaJob.update({
    where: { id: jobId },
    data: {
      status: 'FAILED',
      errorMessage: error,
      completedAt: new Date(),
    },
  })
}
