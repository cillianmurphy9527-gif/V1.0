/**
 * CleanupService - 历史数据定期清理服务
 *
 * 数据保留策略（对齐 pricing.ts quotas.dataRetentionDays）：
 * - STARTER : 7 天
 * - PRO     : 90 天
 * - MAX     : 36500 天（永久，跳过清理）
 * - TRIAL   : 7 天
 *
 * 清理范围：
 * 1. Lead 记录（SENT / BOUNCED / FILTERED 状态，超出保留期）
 * 2. EmailMessage 收发记录（所属 thread 超出保留期）
 * 3. 解析失败的 KnowledgeBase chunk
 */

import { prisma } from '@/lib/prisma'

// ─── 套餐保留天数（严格对齐 pricing.ts）─────────────────
const RETENTION_DAYS: Record<string, number> = {
  STARTER: 7,
  PRO: 90,
  MAX: 36500, // 永久保留，清理任务对 MAX 是空操作
  TRIAL: 7,
}

export interface CleanupStats {
  usersProcessed: number
  leadsDeleted: number
  messagesDeleted: number
  chunksDeleted: number
  errors: string[]
  durationMs: number
}

/**
 * 主清理函数：遍历所有用户，按套餐保留策略清理历史数据
 */
export async function runCleanup(): Promise<CleanupStats> {
  const startTime = Date.now()
  const stats: CleanupStats = {
    usersProcessed: 0,
    leadsDeleted: 0,
    messagesDeleted: 0,
    chunksDeleted: 0,
    errors: [],
    durationMs: 0,
  }

  try {
    // 1. 获取所有用户（仅查询套餐字段，节省内存）
    const users = await prisma.user.findMany({
      select: { id: true, subscriptionTier: true },
    })

    for (const user of users) {
      try {
        const retentionDays = RETENTION_DAYS[user.subscriptionTier] ?? 7

        // MAX 套餐永久保留，跳过
        if (retentionDays >= 36500) {
          stats.usersProcessed++
          continue
        }

        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

        // ── 清理 Lead 记录 ─────────────────────────────────
        const deletedLeads = await prisma.lead.deleteMany({
          where: {
            campaign: { userId: user.id },
            status: { in: ['SENT', 'BOUNCED', 'FILTERED_LOW_INTENT'] },
            createdAt: { lt: cutoffDate },
          },
        })
        stats.leadsDeleted += deletedLeads.count

        // ── 清理 EmailMessage（收件箱历史）───────────────────
        const deletedMessages = await prisma.emailMessage.deleteMany({
          where: {
            thread: { userId: user.id },
            createdAt: { lt: cutoffDate },
          },
        })
        stats.messagesDeleted += deletedMessages.count

        stats.usersProcessed++
      } catch (userError) {
        const msg = `User ${user.id}: ${userError instanceof Error ? userError.message : String(userError)}`
        stats.errors.push(msg)
        console.error('[Cleanup] Error processing user:', msg)
      }
    }

    // 2. 全局清理：解析失败的 KnowledgeBase chunk（超过 30 天）
    const chunkCutoff = new Date()
    chunkCutoff.setDate(chunkCutoff.getDate() - 30)

    const deletedChunks = await prisma.documentChunk.deleteMany({
      where: {
        knowledgeBase: { parseStatus: 'FAILED' },
        createdAt: { lt: chunkCutoff },
      },
    })
    stats.chunksDeleted += deletedChunks.count

  } catch (error) {
    const msg = `Global cleanup error: ${error instanceof Error ? error.message : String(error)}`
    stats.errors.push(msg)
    console.error('[Cleanup] Fatal error:', msg)
  }

  stats.durationMs = Date.now() - startTime
  console.log('[Cleanup] Completed:', stats)
  return stats
}

/**
 * 单用户清理（管理后台手动触发）
 */
export async function cleanupUser(userId: string): Promise<Omit<CleanupStats, 'usersProcessed' | 'durationMs'>> {
  const stats = { leadsDeleted: 0, messagesDeleted: 0, chunksDeleted: 0, errors: [] as string[] }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { subscriptionTier: true },
    })
    if (!user) {
      stats.errors.push('User not found')
      return stats
    }

    const retentionDays = RETENTION_DAYS[user.subscriptionTier] ?? 7
    if (retentionDays >= 36500) return stats // MAX 套餐跳过

    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

    const leads = await prisma.lead.deleteMany({
      where: {
        campaign: { userId },
        status: { in: ['SENT', 'BOUNCED', 'FILTERED_LOW_INTENT'] },
        createdAt: { lt: cutoffDate },
      },
    })
    stats.leadsDeleted = leads.count

    const messages = await prisma.emailMessage.deleteMany({
      where: {
        thread: { userId },
        createdAt: { lt: cutoffDate },
      },
    })
    stats.messagesDeleted = messages.count
  } catch (error) {
    stats.errors.push(error instanceof Error ? error.message : String(error))
  }

  return stats
}
