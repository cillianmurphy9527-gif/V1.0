/**
 * 铁血风控 - 发信信誉管理服务
 * 
 * 核心职责：
 * 1. 追踪用户发信退信率
 * 2. 退信率 > 5% → 冻结发信权限
 * 3. 暂停用户所有运行中的任务
 */

import { prisma } from '@/lib/prisma'

// ─── 信誉配置 ─────────────────────────────────────────
const REPUTATION_CONFIG = {
  // 退信率熔断阈值
  BOUNCE_RATE_THRESHOLD: 0.05, // 5%
  
  // 统计时间窗口（天）
  STATS_WINDOW_DAYS: 30,
  
  // 最小发信量（低于此数量不计算退信率）
  MIN_SAMPLES: 10,
}

// ─── 发信状态 ─────────────────────────────────────────
export enum SendingStatus {
  ACTIVE = 'active',
  FROZEN = 'frozen',
  SUSPENDED = 'suspended',
}

// ─── 信誉检查结果 ─────────────────────────────────────
export interface ReputationCheckResult {
  userId: string
  status: SendingStatus
  totalSent: number
  totalBounced: number
  bounceRate: number
  isAtRisk: boolean
  shouldFreeze: boolean
}

// ─── 获取用户发信信誉 ─────────────────────────────────
/**
 * 获取用户最近 N 天的发信统计
 */
export async function getSendingReputation(
  userId: string,
  windowDays?: number
): Promise<ReputationCheckResult> {
  const days = windowDays || REPUTATION_CONFIG.STATS_WINDOW_DAYS
  const since = new Date()
  since.setDate(since.getDate() - days)

  // 查询最近的发送记录
  const stats = await prisma.sendingLog.groupBy({
    by: ['status'],
    where: {
      userId,
      sentAt: { gte: since },
    },
    _count: { status: true },
  })

  // 统计
  let totalSent = 0
  let totalBounced = 0

  for (const stat of stats) {
    totalSent += stat._count.status
    if (['BOUNCED', 'HARD_BOUNCE', 'SOFT_BOUNCE'].includes(stat.status)) {
      totalBounced += stat._count.status
    }
  }

  const bounceRate = totalSent > 0 ? totalBounced / totalSent : 0

  // 判断是否应该冻结
  const shouldFreeze = 
    totalSent >= REPUTATION_CONFIG.MIN_SAMPLES &&
    bounceRate > REPUTATION_CONFIG.BOUNCE_RATE_THRESHOLD

  return {
    userId,
    status: shouldFreeze ? SendingStatus.FROZEN : SendingStatus.ACTIVE,
    totalSent,
    totalBounced,
    bounceRate: Math.round(bounceRate * 10000) / 100, // 保留2位小数
    isAtRisk: bounceRate >= REPUTATION_CONFIG.BOUNCE_RATE_THRESHOLD * 0.8,
    shouldFreeze,
  }
}

// ─── 冻结用户发信 ─────────────────────────────────────
/**
 * 冻结用户发信权限
 */
export async function freezeUserSending(userId: string, reason: string): Promise<void> {
  // 1. 更新用户表
  await prisma.user.update({
    where: { id: userId },
    data: {
      isSendingSuspended: true,
    },
  })

  // 2. 暂停所有运行中的 Nova 任务
  await prisma.novaJob.updateMany({
    where: {
      userId,
      status: { in: ['PENDING', 'RUNNING'] },
    },
    data: {
      status: 'PAUSED',
    },
  })

  // 3. 记录系统通知
  await prisma.systemNotification.create({
    data: {
      userId,
      title: '⚠️ 发信权限已被冻结',
      content: `由于近期邮件退信率过高（>${(REPUTATION_CONFIG.BOUNCE_RATE_THRESHOLD * 100).toFixed(0)}%），您的发信权限已被系统自动冻结。${reason}`,
      type: 'SYSTEM',
      actionUrl: '/dashboard/settings',
    },
  })

  console.warn(`[Reputation] 🔒 用户 ${userId} 发信权限已冻结，原因: ${reason}`)
}

// ─── 解冻用户发信 ─────────────────────────────────────
/**
 * 解冻用户发信权限
 * 需要人工审核通过后调用
 */
export async function unfreezeUserSending(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      isSendingSuspended: false,
      bounceCount: 0, // 重置退信计数
    },
  })

  await prisma.systemNotification.create({
    data: {
      userId,
      title: '✅ 发信权限已恢复',
      content: '您的发信权限已恢复。建议清理无效邮箱后再继续使用。',
      type: 'SYSTEM',
      actionUrl: '/dashboard/settings',
    },
  })

  console.log(`[Reputation] 🔓 用户 ${userId} 发信权限已恢复`)
}

// ─── 添加发送记录 ─────────────────────────────────────
/**
 * 记录邮件发送（更新到 sending_log）
 */
export async function recordEmailSent(params: {
  userId: string
  campaignId?: string
  recipient: string
  fromDomain: string
  fromEmail: string
  subject: string
  messageId: string
}): Promise<void> {
  await prisma.sendingLog.create({
    data: {
      userId: params.userId,
      taskId: params.campaignId,           // ✅ 已映射为正确的新字段 taskId
      recipientEmail: params.recipient,    // ✅ 已映射为正确的新字段 recipientEmail
      senderDomain: params.fromDomain,     // ✅ 已映射为正确的新字段 senderDomain
      fromEmail: params.fromEmail,
      subject: params.subject,
      status: 'SENT',
      messageId: params.messageId,
      sentAt: new Date(),
    },
  })
}

// ─── 记录退信 ─────────────────────────────────────────
/**
 * 记录邮件退信
 */
export async function recordBounce(params: {
  userId: string
  recipient: string
  bounceType: 'HARD' | 'SOFT'
  reason?: string
}): Promise<void> {
  // 1. 记录到 sending_log
  const log = await prisma.sendingLog.findFirst({
    where: {
      recipientEmail: params.recipient, // ✅ 这里也修正为 recipientEmail，防止隐患！
      userId: params.userId,
    },
    orderBy: { sentAt: 'desc' },
  })

  if (log) {
    await prisma.sendingLog.update({
      where: { id: log.id },
      data: {
        status: params.bounceType === 'HARD' ? 'BOUNCED' : 'SOFT_BOUNCE',
        errorMessage: params.reason,
      },
    })
  }

  // 2. 更新用户退信计数
  await prisma.user.update({
    where: { id: params.userId },
    data: {
      bounceCount: { increment: 1 },
    },
  })

  // 3. 检查是否需要冻结
  const reputation = await getSendingReputation(params.userId)
  
  if (reputation.shouldFreeze) {
    await freezeUserSending(
      params.userId,
      `系统检测到近30天退信率为 ${reputation.bounceRate}%，超过安全阈值。`
    )
  }
}

// ─── 检查发信权限 ─────────────────────────────────────
/**
 * 检查用户是否有权发送邮件
 */
export async function checkSendingPermission(userId: string): Promise<{
  allowed: boolean
  reason?: string
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      isSendingSuspended: true,
      unsubscribed: true,
    },
  })

  if (!user) {
    return { allowed: false, reason: '用户不存在' }
  }

  if (user.isSendingSuspended) {
    return { allowed: false, reason: '发信权限已被冻结' }
  }

  if (user.unsubscribed) {
    return { allowed: false, reason: '用户已退订' }
  }

  // 检查发信信誉
  const reputation = await getSendingReputation(userId)
  
  if (reputation.shouldFreeze) {
    return { allowed: false, reason: `退信率过高 (${reputation.bounceRate}%)，发信权限已冻结` }
  }

  return { allowed: true }
}