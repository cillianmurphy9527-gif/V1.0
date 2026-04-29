/**
 * BullMQ Worker - LeadPilot 发信工作流
 * 负责 Nova 引擎触发后的批量 AI 邮件生成与发送
 *
 * 运行方式（npx tsx / node --experimental-strip-types 兼容 ESM）：
 *   npx tsx workers/emailWorkers.ts
 *   node --experimental-strip-types workers/emailWorkers.ts
 */

import { Worker, Job } from 'bullmq'
import { prisma } from '@/lib/prisma'
import { LLMService } from '@/services/LLMService'
import crypto from 'crypto'
import * as dotenv from 'dotenv'

dotenv.config()

// ─── Redis 连接配置（含重试机制）──────────────────────────────────
function createRedisConnection() {
  let retries = 0
  const MAX_RETRIES = 5
  const BASE_DELAY = 1000

  const tryConnect = async (): Promise<any> => {
    try {
      const { default: Redis } = await import('ioredis')
      const client = new Redis({
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD || undefined,
        maxRetriesPerRequest: null,
        retryStrategy: (times) => {
          if (times > MAX_RETRIES) return null
          const delay = Math.min(BASE_DELAY * Math.pow(2, times - 1), 15000)
          console.log(`[Redis] 连接重试 ${times}/${MAX_RETRIES}，${delay}ms 后重连...`)
          return delay
        },
        lazyConnect: true,
      })

      client.on('error', (err) => {
        console.error(`[Redis] 连接错误: ${err.message}`)
      })
      client.on('ready', () => {
        console.log('[Redis] 连接就绪')
        retries = 0
      })

      await client.connect()
      return client
    } catch (err: any) {
      retries++
      if (retries > MAX_RETRIES) throw err
      const delay = BASE_DELAY * Math.pow(2, retries - 1)
      console.log(`[Redis] 连接失败，${delay}ms 后重试 (${retries}/${MAX_RETRIES})...`)
      await new Promise((res) => setTimeout(res, delay))
      return tryConnect()
    }
  }

  return tryConnect()
}

// ─── 退订 Token ─────────────────────────────────────────────────
function generateUnsubscribeToken(email: string): string {
  const secret = process.env.UNSUBSCRIBE_SECRET || 'default-secret-change-in-production'
  return crypto
    .createHmac('sha256', secret)
    .update(email)
    .digest('hex')
    .substring(0, 16)
}

// ─── 邮件内容工具 ────────────────────────────────────────────────
interface EmailContent {
  html: string
  text: string
}

function injectUnsubscribeFooter(
  textBody: string,
  htmlBody: string | undefined,
  unsubscribeUrl: string,
  email: string,
): EmailContent {
  const baseUrl =
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://leadpilot.io'

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
    finalHtml = htmlBody.includes('</body>')
      ? htmlBody.replace('</body>', `${unsubscribeHtml}</body>`)
      : htmlBody + unsubscribeHtml
  } else {
    const simpleHtml = `<div style="font-family: Arial, sans-serif; line-height: 1.6;">${textBody.replace(/\n/g, '<br>')}</div>`
    finalHtml = simpleHtml.includes('</body>')
      ? simpleHtml.replace('</body>', `${unsubscribeHtml}</body>`)
      : simpleHtml + unsubscribeHtml
  }

  const finalText = textBody ? textBody + unsubscribeText : unsubscribeText

  return { html: finalHtml, text: finalText }
}

// ─── 邮件发送 ────────────────────────────────────────────────────
interface SendResult {
  success: boolean
  messageId?: string
  error?: string
}

async function sendEmail(params: {
  from: string
  to: string
  subject: string
  html: string
  text: string
}): Promise<SendResult> {
  const { from, to, subject, html, text } = params

  if (process.env.RESEND_API_KEY) {
    return await sendViaResend(from, to, subject, html, text)
  }

  if (process.env.AWS_SES_REGION) {
    return await sendViaSES(from, to, subject, html, text)
  }

  if (process.env.SENDGRID_API_KEY) {
    return await sendViaSendGrid(from, to, subject, html, text)
  }

  // 开发模式：模拟发送
  if (process.env.NODE_ENV === 'development') {
    console.log(`[MockSend] From: ${from} | To: ${to} | Subject: ${subject}`)
    return { success: true, messageId: `mock-${Date.now()}` }
  }

  return { success: false, error: 'No email provider configured' }
}

async function sendViaResend(
  from: string,
  to: string,
  subject: string,
  html: string,
  text?: string,
): Promise<SendResult> {
  const payload: Record<string, unknown> = { from, to, subject, html }
  if (text) payload.text = text

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    return { success: false, error: err.message || 'Resend API error' }
  }

  const data = (await response.json()) as { id?: string }
  return { success: true, messageId: data.id }
}

async function sendViaSES(
  from: string,
  to: string,
  subject: string,
  html: string,
  text?: string,
): Promise<SendResult> {
  console.log(`[SES] Would send from ${from} to ${to}: ${subject}`)
  return { success: true, messageId: `ses-${Date.now()}` }
}

async function sendViaSendGrid(
  from: string,
  to: string,
  subject: string,
  html: string,
  text?: string,
): Promise<SendResult> {
  console.log(`[SendGrid] Would send from ${from} to ${to}: ${subject}`)
  return { success: true, messageId: `sg-${Date.now()}` }
}

// ─── AI 个性化邮件生成 ────────────────────────────────────────────
async function generatePersonalizedEmail(params: {
  leadEmail: string
  campaignSystemPrompt: string
  userRagContext: string
  userId: string
}): Promise<{ subject: string; html: string; text: string }> {
  const { leadEmail, campaignSystemPrompt, userRagContext } = params

  const prompt = `请根据以下业务指令，为目标联系人生成一封专业的英文开发信。

业务指令：
${campaignSystemPrompt}

要求：
1. 邮件主题简洁有力，不超过 60 个字符
2. 正文不超过 200 词，语言专业、个性化
3. 包含明确的 Call-to-Action
4. 不使用模板化语言

请直接返回 JSON 格式（不需要代码块包裹）：
{"subject": "邮件主题", "html": "<html>邮件HTML正文</html>", "text": "邮件纯文本正文"}`

  const content = await LLMService.generateContent(prompt, undefined, params.userId)

  try {
    const cleaned = content.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
    const parsed = JSON.parse(cleaned) as { subject: string; html: string; text: string }
    return {
      subject: parsed.subject || 'Partnership Opportunity',
      html: parsed.html || `<p>${parsed.text || 'Hello, we would like to connect with you.'}</p>`,
      text: parsed.text || 'Hello, we would like to connect with you.',
    }
  } catch {
    return {
      subject: 'Partnership Opportunity',
      html: `<p>${content.substring(0, 500)}</p>`,
      text: content.substring(0, 500),
    }
  }
}

// ─── 任务数据接口 ────────────────────────────────────────────────
interface GenerateEmailsJob {
  campaignId: string
}

interface LeadJob {
  leadId: string
  campaignId: string
  userId: string
}

// ─── 启动 Workers ────────────────────────────────────────────────
async function main() {
  console.log('='.repeat(50))
  console.log('[LeadPilot Workers] 启动中...')
  console.log(`[Env] NODE_ENV=${process.env.NODE_ENV || 'development'}`)
  console.log(`[Redis] ${process.env.REDIS_HOST || '127.0.0.1'}:${process.env.REDIS_PORT || '6379'}`)
  console.log('='.repeat(50))

  const connection = await createRedisConnection()

  // ── generate-emails Worker ──────────────────────────────────────
  const generateWorker = new Worker<GenerateEmailsJob>(
    'ai-email-jobs',
    async (job: Job<GenerateEmailsJob>) => {
      const { campaignId } = job.data
      console.log(`\n[GenerateEmails] 任务开始 | Campaign: ${campaignId}`)

      // 1. 捞出 Campaign 信息（获取 systemPrompt 和 userId）
      const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } })
      if (!campaign) throw new Error(`Campaign ${campaignId} not found`)

      // 2. 获取用户信息（RAG context 用于个性化生成）
      const user = await prisma.user.findUnique({ where: { id: campaign.userId } })
      if (!user) throw new Error(`User ${campaign.userId} not found`)

      // 3. 从 Lead 表捞出所有 VERIFIED 状态的邮箱
      const verifiedLeads = await prisma.lead.findMany({
        where: { campaignId, status: 'VERIFIED' },
        orderBy: { createdAt: 'asc' },
      })

      console.log(`[GenerateEmails] 发现 ${verifiedLeads.length} 条 VERIFIED 线索`)
      if (verifiedLeads.length === 0) {
        await prisma.campaign.update({
          where: { id: campaignId },
          data: { status: 'COMPLETED' },
        })
        console.log(`[GenerateEmails] 无 VERIFIED 线索，Campaign ${campaignId} 已标记为 COMPLETED`)
        return { campaignId, sent: 0, total: 0 }
      }

      // 4. 批量生成并发送个性化邮件
      let sentCount = 0
      let failedCount = 0

      for (let i = 0; i < verifiedLeads.length; i++) {
        const lead = verifiedLeads[i]
        console.log(`[GenerateEmails] [${i + 1}/${verifiedLeads.length}] 正在处理: ${lead.email}`)

        try {
          // 生成个性化邮件内容
          const generated = await generatePersonalizedEmail({
            leadEmail: lead.email,
            campaignSystemPrompt: campaign.systemPrompt,
            userRagContext: user.ragContext || '',
            userId: user.id,
          })

          // 生成退订链接
          const unsubscribeToken = generateUnsubscribeToken(lead.email)
          const baseUrl =
            process.env.NEXTAUTH_URL ||
            process.env.NEXT_PUBLIC_APP_URL ||
            'https://leadpilot.io'
          const unsubscribeUrl = `${baseUrl}/api/email/unsubscribe?email=${encodeURIComponent(lead.email)}&token=${unsubscribeToken}`

          // 注入退订 footer
          const emailContent = injectUnsubscribeFooter(
            generated.text,
            generated.html,
            unsubscribeUrl,
            lead.email,
          )

          // 发送邮件（from 地址可从 campaign 或 user.domains 中取，这里用默认 sales 地址）
          const sendResult = await sendEmail({
            from: process.env.DEFAULT_FROM_EMAIL || 'sales@leadpilot.io',
            to: lead.email,
            subject: generated.subject,
            html: emailContent.html,
            text: emailContent.text,
          })

          if (sendResult.success) {
            // 每成功发送一封，原子更新 Campaign.emailsSent
            await prisma.campaign.update({
              where: { id: campaignId },
              data: { emailsSent: { increment: 1 } },
            })
            sentCount++
            console.log(`[GenerateEmails] ✅ 已发送至 ${lead.email} (累计: ${sentCount})`)
          } else {
            await prisma.lead.update({
              where: { id: lead.id },
              data: { status: 'BOUNCED' },
            })
            failedCount++
            console.error(`[GenerateEmails] ❌ 发送失败 [${lead.email}]: ${sendResult.error}`)
          }
        } catch (err: any) {
          failedCount++
          console.error(`[GenerateEmails] ❌ 处理异常 [${lead.email}]: ${err.message}`)
        }

        // 每处理完一条，稍作短暂间隔（防 API 频率限制）
        if (i < verifiedLeads.length - 1) {
          await new Promise((res) => setTimeout(res, 200))
        }
      }

      // 5. 所有线索发信完毕后，将 Campaign 状态更新为 COMPLETED
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: 'COMPLETED' },
      })

      console.log(`\n[GenerateEmails] ✅ Campaign ${campaignId} 发信完毕`)
      console.log(`[GenerateEmails] 发送成功: ${sentCount} | 失败: ${failedCount} | 总计: ${verifiedLeads.length}`)

      return { campaignId, sent: sentCount, failed: failedCount, total: verifiedLeads.length }
    },
    { connection },
  )

  // ── Qualifier Worker（保留原有逻辑）─────────────────────────────
  new Worker<LeadJob>(
    'qualifier-queue',
    async (job: Job<LeadJob>) => {
      const { leadId, userId } = job.data
      console.log(`[Qualifier] Processing lead ${leadId}`)

      const [lead, user] = await Promise.all([
        prisma.lead.findUnique({ where: { id: leadId } }),
        prisma.user.findUnique({ where: { id: userId } }),
      ])

      if (!lead || !user) throw new Error('Lead or User not found')

      const features = user.features as Record<string, boolean>
      if (!features?.aiScoring) {
        await prisma.lead.update({ where: { id: leadId }, data: { status: 'QUEUED', aiScore: 100 } })
        return { skipped: true }
      }

      const result = await LLMService.generateContent(
        lead.websiteData || '',
        user.ragContext || '',
      )

      const score = result.includes('high') ? 90 : result.includes('medium') ? 60 : 30
      const shouldProceed = score >= 50

      await prisma.lead.update({
        where: { id: leadId },
        data: { status: shouldProceed ? 'QUEUED' : 'FILTERED_LOW_INTENT', aiScore: score },
      })

      console.log(`[Qualifier] Lead ${leadId} score: ${score} → ${shouldProceed ? 'QUEUED' : 'FILTERED'}`)
      return { score, shouldProceed }
    },
    { connection },
  )

  // ── Copywriter Worker（保留原有逻辑）────────────────────────────
  new Worker<LeadJob>(
    'copywriter-queue',
    async (job: Job<LeadJob>) => {
      const { leadId, campaignId, userId } = job.data
      console.log(`[Copywriter] Processing lead ${leadId}`)

      const [lead, campaign, user] = await Promise.all([
        prisma.lead.findUnique({ where: { id: leadId } }),
        prisma.campaign.findUnique({ where: { id: campaignId } }),
        prisma.user.findUnique({ where: { id: userId } }),
      ])

      if (!lead || !campaign || !user) throw new Error('Data not found')

      const draft = await LLMService.generateContent(
        JSON.stringify({ email: lead.email, websiteData: lead.websiteData, aiScore: lead.aiScore }),
        campaign.systemPrompt,
      )

      console.log(`[Copywriter] Generated for ${lead.email}: ${draft.substring(0, 80)}...`)
      return { draft }
    },
    { connection },
  )

  // ── Delivery Worker（保留原有逻辑）─────────────────────────────
  new Worker<LeadJob>(
    'delivery-queue',
    async (job: Job<LeadJob>) => {
      const { leadId, userId } = job.data
      console.log(`[Delivery] Processing lead ${leadId}`)

      const [lead, user] = await Promise.all([
        prisma.lead.findUnique({ where: { id: leadId } }),
        prisma.user.findUnique({ where: { id: userId }, include: { domains: { where: { status: 'ACTIVE' } } } }),
      ])

      if (!lead || !user) throw new Error('Data not found')

      if (user.credits <= 0) {
        await prisma.campaign.updateMany({ where: { userId }, data: { status: 'PAUSED_OUT_OF_CREDITS' } })
        throw new Error('Out of credits')
      }

      const fromDomain = user.domains[0]?.domainName
      if (!fromDomain) {
        await prisma.campaign.updateMany({ where: { userId }, data: { status: 'PAUSED_NO_DOMAINS' } })
        throw new Error('No active domains')
      }

      const unsubscribeToken = generateUnsubscribeToken(lead.email)
      const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://leadpilot.io'
      const unsubscribeUrl = `${baseUrl}/api/email/unsubscribe?email=${encodeURIComponent(lead.email)}&token=${unsubscribeToken}`
      const emailContent = injectUnsubscribeFooter('Mock email content', '<p>Mock email content</p>', unsubscribeUrl, lead.email)

      const result = await sendEmail({
        from: `sales@${fromDomain}`,
        to: lead.email,
        subject: 'Partnership Opportunity',
        html: emailContent.html,
        text: emailContent.text,
      })

      if (result.success) {
        await prisma.user.update({ where: { id: userId }, data: { credits: { decrement: 1 } } })
        await prisma.lead.update({ where: { id: leadId }, data: { status: 'SENT' } })
        console.log(`[Delivery] ✅ Sent to ${lead.email}`)
      } else {
        await prisma.lead.update({ where: { id: leadId }, data: { status: 'BOUNCED' } })
        console.error(`[Delivery] ❌ Failed: ${lead.email}`)
      }

      return { success: result.success }
    },
    { connection },
  )

  // ── 事件监听 ───────────────────────────────────────────────────
  generateWorker.on('completed', (job) => {
    console.log(`[GenerateEmails] Job ${job.id} completed`)
  })

  generateWorker.on('failed', (job, err) => {
    console.error(`[GenerateEmails] Job ${job?.id} failed:`, err.message)
  })

  generateWorker.on('error', (err) => {
    console.error('[GenerateEmails] Worker error:', err)
  })

  // ── 优雅关闭 ───────────────────────────────────────────────────
  const shutdown = async () => {
    console.log('\n[Workers] 收到关闭信号，正在关闭...')
    await generateWorker.close()
    await connection.quit()
    console.log('[Workers] 已关闭')
    process.exit(0)
  }

  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)

  console.log('[Workers] 所有 Worker 已就绪，监听任务队列中...')
}

main().catch((err) => {
  console.error('[Workers] 启动失败:', err)
  process.exit(1)
})
