/**
 * BullMQ Worker - 核心发信工作流
 * 负责 AI 打分、邮件生成、发送与休眠
 */

import { Worker, Job } from 'bullmq'
import { prisma } from '@/lib/prisma'
import { llmService } from '@/services/LLMService'
import { emailService } from '@/services/EmailService'
import crypto from 'crypto'

interface LeadJob {
  leadId: string
  campaignId: string
  userId: string
}

// Redis 连接配置
const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
}

// ─── 退订链接工具函数 ─────────────────────────────────────────────
function generateUnsubscribeToken(email: string): string {
  const secret = process.env.UNSUBSCRIBE_SECRET || 'default-secret-change-in-production'
  return crypto
    .createHmac('sha256', secret)
    .update(email)
    .digest('hex')
    .substring(0, 16)
}

interface EmailContent {
  html: string
  text: string
}

function injectUnsubscribeFooter(
  textBody: string,
  htmlBody: string | undefined,
  unsubscribeUrl: string,
  email: string
): EmailContent {
  const unsubscribeHtml = `
<br><br>
<hr style="border: none; border-top: 1px solid #eaeaea; margin: 20px 0;">
<p style="font-size: 12px; color: #999999; text-align: center; margin: 0;">
  If you no longer wish to receive these emails, you can
  <a href="${unsubscribeUrl}" style="color: #666666; text-decoration: underline;">unsubscribe here</a>.
</p>
<p style="font-size: 11px; color: #cccccc; text-align: center; margin: 12px 0 0 0;">
  This email was sent to: ${email}
</p>
  `.trim()

  const unsubscribeText = `

---

If you no longer wish to receive these emails, you can unsubscribe here: ${unsubscribeUrl}

This email was sent to: ${email}
  `.trim()

  let finalHtml = ''

  if (htmlBody) {
    if (htmlBody.includes('</body>')) {
      finalHtml = htmlBody.replace('</body>', `${unsubscribeHtml}</body>`)
    } else {
      finalHtml = htmlBody + unsubscribeHtml
    }
  } else {
    const simpleHtml = `<div style="font-family: Arial, sans-serif; line-height: 1.6;">${textBody.replace(/\n/g, '<br>')}</div>`
    if (simpleHtml.includes('</body>')) {
      finalHtml = simpleHtml.replace('</body>', `${unsubscribeHtml}</body>`)
    } else {
      finalHtml = simpleHtml + unsubscribeHtml
    }
  }

  const finalText = textBody ? textBody + unsubscribeText : unsubscribeText

  return { html: finalHtml, text: finalText }
}

/**
 * Qualifier Worker - AI 意图打分
 */
export const qualifierWorker = new Worker<LeadJob>(
  'qualifier-queue',
  async (job: Job<LeadJob>) => {
    const { leadId, userId } = job.data

    console.log(`🎯 [Qualifier] Processing lead ${leadId}`)

    // 1. 获取 Lead 和用户信息
    const lead = await prisma.lead.findUnique({ where: { id: leadId } })
    const user = await prisma.user.findUnique({ where: { id: userId } })

    if (!lead || !user) {
      throw new Error('Lead or User not found')
    }

    // 2. 检查用户是否有 AI 打分权限
    const features = user.features as any
    if (!features?.aiScoring) {
      console.log('⏭️ Skipping AI scoring (feature not enabled)')
      await prisma.lead.update({
        where: { id: leadId },
        data: { status: 'QUEUED', aiScore: 100 },
      })
      return { skipped: true }
    }

    // 3. AI 意图打分
    const result = await llmService.scoreIntent(
      lead.websiteData || '',
      user.ragContext || ''
    )

    // 4. 更新 Lead 状态
    if (result.shouldProceed) {
      await prisma.lead.update({
        where: { id: leadId },
        data: { status: 'QUEUED', aiScore: result.score },
      })
      console.log(`✅ Lead ${leadId} passed (score: ${result.score})`)
    } else {
      await prisma.lead.update({
        where: { id: leadId },
        data: { status: 'FILTERED_LOW_INTENT', aiScore: result.score },
      })
      console.log(`❌ Lead ${leadId} filtered (score: ${result.score})`)
    }

    return { score: result.score, shouldProceed: result.shouldProceed }
  },
  { connection }
)

/**
 * Copywriter Worker - AI 邮件撰写
 */
export const copywriterWorker = new Worker<LeadJob>(
  'copywriter-queue',
  async (job: Job<LeadJob>) => {
    const { leadId, campaignId, userId } = job.data

    console.log(`✍️ [Copywriter] Processing lead ${leadId}`)

    // 1. 获取数据
    const lead = await prisma.lead.findUnique({ where: { id: leadId } })
    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } })
    const user = await prisma.user.findUnique({ where: { id: userId } })

    if (!lead || !campaign || !user) {
      throw new Error('Data not found')
    }

    // 2. AI 生成邮件
    const draft = await llmService.generateEmail(
      {
        email: lead.email,
        websiteData: lead.websiteData || undefined,
        aiScore: lead.aiScore || undefined,
      },
      user.ragContext || '',
      campaign.systemPrompt,
      'en'
    )

    // 3. 存储草稿（实际应扩展 Lead 表字段）
    console.log(`📝 Generated email for ${lead.email}:`, draft.subject)

    return { draft }
  },
  { connection }
)

/**
 * Delivery Worker - 发送邮件 + 强制注入退订链接 + 防封休眠
 */
export const deliveryWorker = new Worker<LeadJob>(
  'delivery-queue',
  async (job: Job<LeadJob>) => {
    const { leadId, userId } = job.data

    console.log(`📤 [Delivery] Processing lead ${leadId}`)

    // 1. 获取数据
    const lead = await prisma.lead.findUnique({ where: { id: leadId } })
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { domains: { where: { status: 'ACTIVE' } } },
    })

    if (!lead || !user) {
      throw new Error('Data not found')
    }

    // 2. 算力校验（硬拦截）
    if (user.credits <= 0) {
      await prisma.campaign.updateMany({
        where: { userId },
        data: { status: 'PAUSED_OUT_OF_CREDITS' },
      })
      throw new Error('Out of credits')
    }

    // 3. 域名校验（硬拦截）
    const fromDomain = emailService.selectActiveDomain(user.domains)
    if (!fromDomain) {
      await prisma.campaign.updateMany({
        where: { userId },
        data: { status: 'PAUSED_NO_DOMAINS' },
      })
      throw new Error('No active domains')
    }

    // 4. 生成退订链接并注入邮件底部（HTML + Text 双端）
    const unsubscribeToken = generateUnsubscribeToken(lead.email)
    const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://leadpilot.io'
    const unsubscribeUrl = `${baseUrl}/api/email/unsubscribe?email=${encodeURIComponent(lead.email)}&token=${unsubscribeToken}`

    // 模拟邮件内容（实际场景中由 copywriter 生成）
    const mockHtml = '<p>Mock email content</p>'
    const mockText = 'Mock email content'

    const emailContent = injectUnsubscribeFooter(mockText, mockHtml, unsubscribeUrl, lead.email)

    // 5. 发送邮件（使用含退订链接的 HTML 和 Text）
    const result = await emailService.sendEmail({
      from: `sales@${fromDomain}`,
      to: lead.email,
      subject: 'Partnership Opportunity',
      html: emailContent.html,
      text: emailContent.text,
    })

    if (result.success) {
      // 6. 扣除算力
      await prisma.user.update({
        where: { id: userId },
        data: { credits: { decrement: 1 } },
      })

      // 7. 更新 Lead 状态
      await prisma.lead.update({
        where: { id: leadId },
        data: { status: 'SENT' },
      })

      console.log(`✅ Email sent to ${lead.email} with unsubscribe footer`)

      // 8. 防封休眠（关键）
      await emailService.sleep(180000, 420000)
    } else {
      await prisma.lead.update({
        where: { id: leadId },
        data: { status: 'BOUNCED' },
      })
      console.error(`❌ Failed to send to ${lead.email}`)
    }

    return { success: result.success }
  },
  { connection }
)

console.log('🚀 Workers started')
