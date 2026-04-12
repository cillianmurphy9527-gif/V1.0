/**
 * Nova 后台任务处理器 (Background Worker)
 * 
 * 核心职责：
 * 1. 轮询 nova_jobs 表获取待执行任务
 * 2. 按批次执行搜客→写信→发信流水线
 * 3. 反侦察防封策略（随机延迟）
 * 4. 实时更新任务状态和日志
 * 5. 成本熔断检查
 * 
 * 运行方式：
 * - 生产环境：作为独立 Node.js 进程运行
 * - Vercel：使用 Cron Job 调用 /api/cron/nova-worker
 * - 本地开发：npm run nova:worker
 */

import { prisma } from '@/lib/prisma'
import {
  BATCH_CONFIG,
  shouldContinue,
  getRandomDelay,
  getRandomBatchSize,
  sleep,
  createLog,
  appendJobLog,
  updateJobProgress,
  completeJob,
  failJob,
} from './anti-detection'
import { executeLeadPipeline } from './pipeline'
import {
  checkCircuitBreaker,
  triggerCircuitBreak,
  addApiCost,
  checkCostWarning,
} from '@/lib/risk/circuit-breaker'
import { checkSendingPermission } from '@/lib/risk/sending-reputation'

// ─── Worker 配置 ──────────────────────────────────────
const WORKER_CONFIG = {
  // 每次轮询获取的任务数
  MAX_JOBS_PER_POLL: 5,

  // 轮询间隔（毫秒）
  POLL_INTERVAL_MS: 10000,

  // 最大并发任务数
  MAX_CONCURRENT_JOBS: 3,

  // 是否运行中
  isRunning: false,
}

// ─── 开发模式检测 ─────────────────────────────────────
const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === undefined

// ─── 前置检查 ─────────────────────────────────────────
/**
 * 执行任务前的各项检查
 */
async function preFlightChecks(jobId: string, userId: string): Promise<{
  allowed: boolean
  reason?: string
}> {
  // 【开发模式】跳过所有前置检查
  if (isDev) {
    console.log('[PreFlight] [DEV MODE] Skipping all pre-flight checks')
    return { allowed: true }
  }

  // 1. 检查发信权限
  const sendingCheck = await checkSendingPermission(userId)
  if (!sendingCheck.allowed) {
    return { allowed: false, reason: `发信权限检查失败: ${sendingCheck.reason}` }
  }

  // 2. 检查成本熔断
  const circuitCheck = await checkCircuitBreaker(userId)
  if (circuitCheck.tripped) {
    return { allowed: false, reason: `成本熔断触发: ${circuitCheck.usagePercent}%` }
  }

  // 3. 成本预警（仅记录日志）
  const warningCheck = await checkCostWarning(userId)
  if (warningCheck.warning) {
    await appendJobLog(jobId, createLog('WARN', warningCheck.message || '接近成本阈值'))
  }

  return { allowed: true }
}

// ─── 单个任务执行器 ────────────────────────────────────
/**
 * 执行单个 Campaign 任务
 */
async function processJob(campaignId: string): Promise<void> {
  const startTime = Date.now()
  
  // 获取 Campaign 详情（不是 novaJob！）
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { user: true }
  })

  if (!campaign) {
    console.error(`[NovaWorker] Campaign ${campaignId} not found`)
    return
  }

  const userId = campaign.userId
  console.log(`[NovaWorker] Processing campaign: ${campaign.name} (user: ${userId})`)

  // ─── 前置检查：配额 + 熔断 ──────────────────────────
  const preFlight = await preFlightChecks(campaignId, userId)
  if (!preFlight.allowed) {
    console.log(`[NovaWorker] Pre-flight failed for ${campaignId}: ${preFlight.reason}`)
    await triggerCircuitBreak(userId, campaignId)
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'PAUSED_OUT_OF_CREDITS' },
    })
    return
  }

  console.log(`[NovaWorker] Campaign ${campaignId} starting execution...`)

  let totalProcessed = 0
  let totalLeadsFound = 0
  let totalLeadsSaved = 0
  const allErrors: string[] = []

  try {
    // 主循环：批次执行直到任务完成或被停止
    while (true) {
      // 【关键刹车检查】每次批次开始前，必须查询数据库最新状态
      const currentCampaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        select: { status: true },
      })

      // 🚨 检测到 STOPPED/IDLE → 立刻退出，不执行任何批次
      if (currentCampaign?.status === 'STOPPED') {
        console.log(`[NovaWorker] 🛑 Detected STOPPED signal for campaign ${campaignId}. Halting execution immediately.`)
        break
      }
      if (currentCampaign?.status === 'IDLE') {
        console.log(`[NovaWorker] 🛑 Detected IDLE signal for campaign ${campaignId}. Halting execution immediately.`)
        break
      }
      if (!currentCampaign) {
        console.log(`[NovaWorker] 🛑 Campaign ${campaignId} no longer exists in DB. Halting.`)
        break
      }
      // 如果状态不是 RUNNING，也退出
      if (currentCampaign.status !== 'RUNNING') {
        console.log(`[NovaWorker] 🛑 Campaign ${campaignId} status is '${currentCampaign.status}', not RUNNING. Halting.`)
        break
      }

      // 2. 获取本次批次大小
      const batchSize = getRandomBatchSize()

      console.log(`[NovaWorker] Executing batch for campaign ${campaignId}, batchSize: ${batchSize}`)

      // 【第1次刹车】执行流水线前再次确认状态
      const preExecCheck = await prisma.campaign.findUnique({
        where: { id: campaignId },
        select: { status: true },
      })
      if (preExecCheck?.status !== 'RUNNING') {
        console.log(`[NovaWorker] 🛑 Pre-exec check failed: status=${preExecCheck?.status}. Halting before batch.`)
        break
      }

      // 3. 执行流水线（搜客 → 写信 → 发信，每条实时扣费）
      const result = await executeLeadPipeline(campaignId, userId, {
        targetAudience: {}, // TODO: 从 campaign 配置中解析
        knowledgeBaseIds: [],
        batchSize,
      })

      totalProcessed += batchSize
      totalLeadsFound += result.leadsFound
      totalLeadsSaved += result.leadsSaved
      allErrors.push(...result.errors)

      // 【第2次刹车】批次执行完成后立即检查是否被外部停止
      const postBatchCheck = await prisma.campaign.findUnique({
        where: { id: campaignId },
        select: { status: true },
      })
      if (postBatchCheck?.status === 'STOPPED') {
        console.log(`[NovaWorker] 🛑 Post-batch STOPPED check for ${campaignId}. Halting.`)
        break
      }

      // 4. 更新 Campaign 进度（只更新 config，不动 status）
      await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          config: {
            ...(campaign.config as object || {}),
            totalProcessed,
            totalLeadsFound,
            totalLeadsSaved,
            lastBatchAt: new Date().toISOString(),
          }
        },
      })

      console.log(`[NovaWorker] Batch complete for ${campaignId}: found=${result.leadsFound}, saved=${result.leadsSaved}`)

      // 5. 【批次间熔断检查】
      // 【开发模式】跳过熔断检查
      if (!isDev) {
        const circuitCheck = await checkCircuitBreaker(userId)
        if (circuitCheck.tripped) {
          console.log(`[NovaWorker] Circuit breaker triggered for ${campaignId}`)
          await triggerCircuitBreak(userId, campaignId)
          await prisma.campaign.update({
            where: { id: campaignId },
            data: { status: 'PAUSED_OUT_OF_CREDITS' },
          })
          break
        }
      } else {
        console.log(`[NovaWorker] [DEV MODE] Skipping circuit breaker check after batch`)
      }

      // 6. 【关键】反侦察延迟（防止被封）
      // 开发环境：休眠时间限制为 2 秒（快速测试）
      // 生产环境：随机 30-180 秒（防止被封）
      const rawDelay = getRandomDelay()
      const delay = isDev ? 2000 : rawDelay

      if (isDev) {
        console.log(`[NovaWorker] [DEV] Batch delay: 2s (skip anti-detection in dev mode)`)
      } else {
        console.log(`[NovaWorker] Anti-detection delay: ${Math.round(delay / 1000)}s`)
      }
      await sleep(delay)

      // 【第3次刹车】批次延迟后再次确认状态，防止用户在等待期间点击停止
      const postDelayCheck = await prisma.campaign.findUnique({
        where: { id: campaignId },
        select: { status: true },
      })
      if (postDelayCheck?.status !== 'RUNNING') {
        console.log(`[NovaWorker] 🛑 Post-delay check: status=${postDelayCheck?.status}. Halting.`)
        break
      }

      // 7. 安全检查：避免无限循环
      if (totalProcessed >= (campaign.estimatedLeads || 100) * 2) {
        console.log(`[NovaWorker] Campaign ${campaignId} reached max iterations`)
        break
      }
    }

    // 任务完成：先查最新状态，防止覆盖 STOPPED
    const finalCampaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { status: true },
    })

    // 🚨 只有确认为 RUNNING 才更新为 COMPLETED，禁止覆盖 STOPPED
    if (finalCampaign?.status === 'RUNNING') {
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: 'COMPLETED' },
      })
      console.log(`[NovaWorker] Campaign ${campaignId} completed!`)
    } else if (finalCampaign?.status === 'STOPPED') {
      console.log(`[NovaWorker] Campaign ${campaignId} was STOPPED, skipping COMPLETED update.`)
    }

    const elapsed = Date.now() - startTime
    console.log(`[NovaWorker] Campaign ${campaignId} finished in ${elapsed}ms. Processed: ${totalProcessed}, Found: ${totalLeadsFound}, Saved: ${totalLeadsSaved}`)

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : '未知错误'
    console.error(`[NovaWorker] Campaign ${campaignId} error:`, error)
    
    // 【开发模式】遇到错误时继续运行，不暂停任务
    if (isDev) {
      console.log(`[NovaWorker] [DEV MODE] Error occurred but continuing...`)
    } else {
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: 'PAUSED_OUT_OF_CREDITS' },
      }).catch(() => {})
    }
  }
}

// ─── Worker 主循环 ────────────────────────────────────
/**
 * 主 Worker 循环（非阻塞版）
 * 
 * 关键设计：
 * 1. 轮询发现 RUNNING 的 Campaign 后，立即扔到后台并发处理
 * 2. 不 await 单个 Campaign 的执行过程
 * 3. 主循环保持每 10 秒轮询一次数据库
 * 4. 开发环境休眠时间限制为 2 秒
 */
async function runWorkerLoop(): Promise<void> {
  if (WORKER_CONFIG.isRunning) {
    console.log('[NovaWorker] Already running, skipping...')
    return
  }

  WORKER_CONFIG.isRunning = true
  console.log('[NovaWorker] Worker loop started (non-blocking mode)')

  // 跟踪正在后台执行的任务，避免重复启动
  const activeJobs = new Set<string>()

  try {
    while (WORKER_CONFIG.isRunning) {
      // 1. 获取待执行的 Campaign 任务
      const pendingJobs = await prisma.campaign.findMany({
        where: { status: 'RUNNING' },
        take: WORKER_CONFIG.MAX_JOBS_PER_POLL,
        orderBy: { createdAt: 'asc' },
      })

      // 2. 过滤出还未启动的任务
      const newJobs = pendingJobs.filter(job => !activeJobs.has(job.id))
      
      if (newJobs.length > 0) {
        console.log(`[NovaWorker] Found ${newJobs.length} new campaigns, launching in background...`)
        
        // 3. 立即启动后台执行，不阻塞主循环
        for (const job of newJobs) {
          activeJobs.add(job.id)
          
          // 扔到后台执行（不 await）
          processJob(job.id).finally(() => {
            activeJobs.delete(job.id)
          }).catch(err => {
            console.error(`[NovaWorker] Background job ${job.id} failed:`, err)
            activeJobs.delete(job.id)
          })
        }
      }

      // 4. 每 10 秒轮询一次数据库（即使有任务在后台跑，主循环也不阻塞）
      await sleep(WORKER_CONFIG.POLL_INTERVAL_MS)
    }
  } catch (error) {
    console.error('[NovaWorker] Worker loop error:', error)
  } finally {
    WORKER_CONFIG.isRunning = false
    console.log('[NovaWorker] Worker loop stopped')
  }
}

/**
 * 停止 Worker
 */
function stopWorker(): void {
  console.log('[NovaWorker] Stopping...')
  WORKER_CONFIG.isRunning = false
}

/**
 * 单次执行（用于 Cron Job）
 * 返回处理的 job 数量
 */
export async function runOnce(): Promise<{ processed: number; errors: string[] }> {
  const result = { processed: 0, errors: [] as string[] }

  try {
    // 查询 RUNNING 状态的 Campaign
    const pendingJobs = await prisma.campaign.findMany({
      where: { status: 'RUNNING' },
      take: WORKER_CONFIG.MAX_JOBS_PER_POLL,
      orderBy: { createdAt: 'asc' },
    })

    for (const job of pendingJobs) {
      try {
        await processJob(job.id)
        result.processed++
      } catch (error) {
        const errMsg = `Campaign ${job.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
        result.errors.push(errMsg)
        console.error(`[NovaWorker] Error processing campaign ${job.id}:`, error)
      }
    }
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : 'Unknown error')
  }

  return result
}

// ─── 导出 ─────────────────────────────────────────────
export {
  runWorkerLoop,
  stopWorker,
  processJob,
}

// 独立运行时
if (require.main === module) {
  console.log('[NovaWorker] Starting standalone worker...')
  
  // 优雅关闭
  process.on('SIGINT', () => {
    console.log('[NovaWorker] Received SIGINT')
    stopWorker()
    process.exit(0)
  })
  
  process.on('SIGTERM', () => {
    console.log('[NovaWorker] Received SIGTERM')
    stopWorker()
    process.exit(0)
  })

  runWorkerLoop().catch(console.error)
}
