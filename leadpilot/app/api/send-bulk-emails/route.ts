/**
 * API: 批量发送邮件
 *
 * 核心特性：
 * 1. VIP 插队优先级（MAX=1, PRO=2, STARTER=3）
 * 2. 多域名 Round-Robin 轮换防封号
 * 3. 配额检查 + 原子扣费
 * 4. 【新增】多租户公平调度（防止大任务堵塞队列）
 * 5. 【新增】合规退订检查（发送前过滤黑名单）
 * 6. 【新增】退信熔断机制
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { checkAndDeductQuota, QuotaActionType, QuotaErrorCode } from '@/lib/quota'
import { refundQuota } from '@/lib/quota'
import { getUserDomains, selectDomainByIndex } from '@/lib/domain-rotation'
import { prisma } from '@/lib/prisma'
import { addEmailJobsBatch, getQueueStats } from '@/lib/queue-manager'
import { checkBeforeSending } from '@/lib/email-validation'
import { getUserPriority } from '@/lib/queue'

export async function POST(request: NextRequest) {
  try {
    // ─── 1. 鉴权 ───────────────────────────────────────────
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
    }

    const userId = session.user.id
    const body = await request.json()
    const { recipients, campaignId } = body

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json({ error: 'recipients array is required' }, { status: 400 })
    }

    // ─── 2. 【合规检查】发信前验证 ────────────────────────
    const recipientEmails = recipients.map((r: any) => r.email || r)
    const validation = await checkBeforeSending(userId, recipientEmails)
    
    if (!validation.canSend) {
      return NextResponse.json(
        { error: validation.reason },
        { status: 403 }
      )
    }

    // 使用过滤后的收件人列表（已排除退订者）
    const validEmails = validation.filteredEmails || recipientEmails
    const filteredCount = recipientEmails.length - validEmails.length

    if (validEmails.length === 0) {
      return NextResponse.json(
        { error: '所有收件人均已退订或不可发送' },
        { status: 400 }
      )
    }

    console.log(`[BulkEmail] Filtered ${filteredCount} unsubscribed emails, ${validEmails.length} valid recipients`)

    // ─── 3. 验证用户有可用域名 ────────────────────────────
    const domains = await getUserDomains(userId)
    if (domains.length === 0) {
      return NextResponse.json(
        { error: '无可用发信域名，请先绑定并验证域名', code: 'NO_DOMAINS' },
        { status: 403 }
      )
    }

    // ─── 4. 配额检查 + 原子扣费 ───────────────────────────
    const quotaResult = await checkAndDeductQuota(
      userId,
      QuotaActionType.EMAIL_SEND,
      validEmails.length
    )
    if (!quotaResult.allowed) {
      const statusCode =
        quotaResult.error === QuotaErrorCode.INSUFFICIENT_TOKENS
          ? 402
          : quotaResult.error === QuotaErrorCode.FUP_LIMIT_REACHED
          ? 429
          : 403
      return NextResponse.json(
        { error: quotaResult.message, code: quotaResult.error },
        { status: statusCode }
      )
    }

    // ─── 5. 获取用户优先级 ────────────────────────────────
    const priority = await getUserPriority(userId)
    const priorityLabel =
      priority === 1 ? 'VIP·旗舰版' : priority === 2 ? '优先·专业版' : '标准·入门版'

    // ─── 6. 【公平调度】准备邮件任务 ──────────────────────
    const emailJobs = validEmails.map((email: any, index: number) => {
      const recipient = typeof email === 'string' ? { email } : email
      const fromDomain = selectDomainByIndex(domains, index)
      const fromEmail = `sales@${fromDomain}`

      return {
        to: recipient.email,
        subject: recipient.subject || 'Hello',
        body: recipient.body || '',
        fromEmail,
        fromDomain,
        domainIndex: index % domains.length,
      }
    })

    // 使用公平调度队列管理器
    const { queued, skipped, queueUnavailable } = await addEmailJobsBatch(userId, emailJobs, campaignId)

    // ─── 6.1 队列异常兜底：入队失败则补偿退还算力 ─────────────────
    if (skipped > 0) {
      await refundQuota(userId, QuotaActionType.EMAIL_SEND, skipped).catch(() => {})
    }
    if (queueUnavailable || queued === 0) {
      // campaignId 存在时将状态回滚为 IDLE，避免前端误判 RUNNING
      if (campaignId) {
        await prisma.campaign.update({
          where: { id: campaignId },
          data: { status: 'IDLE', updatedAt: new Date() },
        }).catch(() => {})
      }
      return NextResponse.json(
        {
          error: '任务排队失败（队列不可用），已退还算力',
          code: 'QUEUE_UNAVAILABLE',
          queued,
          skipped,
          refunded: skipped,
        },
        { status: 503 }
      )
    }

    // ─── 7. 获取队列统计 ──────────────────────────────────
    const queueStats = await getQueueStats().catch(() => null)

    // ─── 8. 更新 Campaign 状态 ────────────────────────────
    if (campaignId) {
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { 
          status: 'RUNNING',
          updatedAt: new Date() 
        },
      }).catch(() => {/* campaign 不存在时忽略 */})
    }

    return NextResponse.json({
      success: true,
      queued,
      skipped,
      filtered: filteredCount,
      totalRecipients: recipientEmails.length,
      validRecipients: validEmails.length,
      priority,
      priorityLabel,
      domainsUsed: domains.length,
      rotationPattern: `每 ${domains.length} 封轮换一次域名`,
      queueStats,
      remainingTokens: quotaResult.remainingTokens,
      message: `已将 ${queued} 封邮件加入发送队列（过滤 ${filteredCount} 个已退订邮箱）`,
    })
  } catch (error) {
    console.error('[BulkEmail] Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
