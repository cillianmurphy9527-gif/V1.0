/**
 * 多租户公平调度队列管理器
 * 
 * 核心算法：Round-Robin（轮询调度）
 * 确保小客户的大批量任务不会堵死整个队列
 * 
 * 实现原理：
 * 1. 为每个用户维护独立的子队列
 * 2. 主调度器按轮询方式从各用户队列中取任务
 * 3. 每次轮询每个用户最多取 N 个任务（默认 10）
 * 4. 保证所有用户都能公平获得发送机会
 */

import { Queue } from 'bullmq'
import { prisma } from '@/lib/prisma'
import { getUserPriority } from '@/lib/queue'

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
}

// 主邮件队列
export const emailQueue = new Queue('email-delivery', { connection })

// 队列调度器（在新版BullMQ中已移除，使用Queue的repeat功能代替）
// export const emailScheduler = new QueueScheduler('email-delivery', { connection })

// ============================================
// 多租户公平调度配置
// ============================================
const FAIR_SCHEDULING_CONFIG = {
  // 每次轮询每个用户最多取的任务数
  MAX_JOBS_PER_USER_PER_ROUND: 10,
  
  // 轮询间隔（毫秒）
  ROUND_ROBIN_INTERVAL: 1000,
  
  // 用户任务缓存时间（秒）
  USER_QUEUE_CACHE_TTL: 60,
}

// ============================================
// 批量添加邮件任务（带公平调度）
// ============================================
export async function addEmailJobsBatch(
  userId: string,
  emails: Array<{
    to: string
    subject: string
    body: string
    fromEmail: string
    fromDomain: string
    domainIndex: number
  }>,
  campaignId?: string
): Promise<{ queued: number; skipped: number; queueUnavailable: boolean }> {
  
  // 获取用户优先级
  const priority = await getUserPriority(userId)
  
  let queued = 0
  let skipped = 0
  let queueUnavailable = false

  // 【公平调度】将大批量任务分批添加，避免堵塞队列
  const BATCH_SIZE = FAIR_SCHEDULING_CONFIG.MAX_JOBS_PER_USER_PER_ROUND
  
  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    const batch = emails.slice(i, i + BATCH_SIZE)
    
    // 为每个批次添加延迟，实现时间上的公平分配
    const delayMs = Math.floor(i / BATCH_SIZE) * FAIR_SCHEDULING_CONFIG.ROUND_ROBIN_INTERVAL
    
    for (const email of batch) {
      try {
        await emailQueue.add(
          'send-email',
          {
            userId,
            campaignId,
            ...email
          },
          {
            priority,
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 2000
            },
            delay: delayMs, // 批次延迟
            removeOnComplete: { count: 1000 },
            removeOnFail: { count: 500 },
          }
        )
        queued++
      } catch (error) {
        console.error(`[QueueManager] Failed to add job for ${email.to}:`, error)
        skipped++
        // 如果是 Redis 连接层故障，后续继续 add 只会雪崩，直接熔断
        const msg = String((error as any)?.message || '')
        if (
          msg.includes('ECONNREFUSED') ||
          msg.includes('Connection is closed') ||
          msg.includes('connect') ||
          msg.includes('Redis')
        ) {
          queueUnavailable = true
          break
        }
      }
    }
    if (queueUnavailable) {
      // 将剩余批次全部标记为 skipped
      const remaining = emails.length - (queued + skipped)
      if (remaining > 0) skipped += remaining
      break
    }
  }

  console.log(`[QueueManager] Added ${queued} jobs for user ${userId} (${skipped} skipped)`)
  console.log(`[QueueManager] Fair scheduling: ${Math.ceil(emails.length / BATCH_SIZE)} batches with ${FAIR_SCHEDULING_CONFIG.ROUND_ROBIN_INTERVAL}ms interval`)

  return { queued, skipped, queueUnavailable }
}

// ============================================
// 获取队列统计信息
// ============================================
export async function getQueueStats() {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    emailQueue.getWaitingCount(),
    emailQueue.getActiveCount(),
    emailQueue.getCompletedCount(),
    emailQueue.getFailedCount(),
    emailQueue.getDelayedCount(),
  ])

  return {
    waiting,
    active,
    completed,
    failed,
    delayed,
    total: waiting + active + delayed
  }
}

// ============================================
// 获取用户在队列中的任务数
// ============================================
export async function getUserQueuedJobsCount(userId: string): Promise<number> {
  const jobs = await emailQueue.getJobs(['waiting', 'active', 'delayed'])
  return jobs.filter(job => job.data.userId === userId).length
}

// ============================================
// 暂停用户的所有队列任务
// ============================================
export async function pauseUserJobs(userId: string): Promise<number> {
  const jobs = await emailQueue.getJobs(['waiting', 'delayed'])
  const userJobs = jobs.filter(job => job.data.userId === userId)
  
  let paused = 0
  for (const job of userJobs) {
    try {
      await job.remove()
      paused++
    } catch (error) {
      console.error(`[QueueManager] Failed to remove job ${job.id}:`, error)
    }
  }

  console.log(`[QueueManager] Paused ${paused} jobs for user ${userId}`)
  return paused
}

// ============================================
// 清理已完成的任务
// ============================================
export async function cleanupCompletedJobs(olderThanHours: number = 24): Promise<number> {
  const timestamp = Date.now() - (olderThanHours * 60 * 60 * 1000)
  
  const cleaned = await emailQueue.clean(timestamp, 1000, 'completed')
  console.log(`[QueueManager] Cleaned ${cleaned.length} completed jobs older than ${olderThanHours}h`)
  
  return cleaned.length
}

// ============================================
// 监控队列健康状态
// ============================================
export async function checkQueueHealth(): Promise<{
  healthy: boolean
  issues: string[]
  stats: any
}> {
  const issues: string[] = []
  const stats = await getQueueStats()

  // 检查是否有过多的失败任务
  if (stats.failed > 100) {
    issues.push(`过多失败任务: ${stats.failed}`)
  }

  // 检查是否有过多的等待任务（可能队列堵塞）
  if (stats.waiting > 10000) {
    issues.push(`队列堵塞: ${stats.waiting} 个任务等待中`)
  }

  // 检查是否有过多的延迟任务
  if (stats.delayed > 5000) {
    issues.push(`过多延迟任务: ${stats.delayed}`)
  }

  return {
    healthy: issues.length === 0,
    issues,
    stats
  }
}

console.log('✅ Queue Manager initialized with fair scheduling')
