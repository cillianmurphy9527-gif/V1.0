/**
 * Nova 邮件发送服务 - Resend API 集成
 * 
 * 功能：
 * 1. 调用 Resend API 发送邮件
 * 2. 记录返回的 messageId
 * 3. 发送日志入库
 */

import { prisma } from '@/lib/prisma'

// ─── Resend 配置 ──────────────────────────────────────
const RESEND_CONFIG = {
  apiKey: process.env.RESEND_API_KEY,
  fromEmail: process.env.RESEND_FROM_EMAIL || 'noreply@yourdomain.com',
  fromName: process.env.RESEND_FROM_NAME || 'LeadPilot',
}

// ─── 发送结果 ─────────────────────────────────────────
export interface SendResult {
  success: boolean
  messageId?: string
  error?: string
  bounceType?: 'HARD' | 'SOFT' | 'NONE'
}

// ─── 发送邮件 ─────────────────────────────────────────
/**
 * 使用 Resend API 发送邮件
 */
export async function sendEmailViaResend(params: {
  to: string
  subject: string
  body: string
  fromEmail?: string
  fromName?: string
  replyTo?: string
  campaignId?: string
  userId: string
}): Promise<SendResult> {
  const { to, subject, body, fromEmail, fromName, replyTo, campaignId, userId } = params

  if (!RESEND_CONFIG.apiKey) {
    console.warn('[Resend] API key not configured, simulating send')
    return {
      success: true,
      messageId: `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      bounceType: 'NONE',
    }
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_CONFIG.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${fromName || RESEND_CONFIG.fromName} <${fromEmail || RESEND_CONFIG.fromEmail}>`,
        to: [to],
        subject,
        html: body,
        reply_to: replyTo,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error(`[Resend] Send failed: ${response.status}`, error)
      return {
        success: false,
        error: `Resend API error: ${response.status}`,
        bounceType: 'NONE',
      }
    }

    const data = await response.json()
    const messageId = data.id

    // ─── 记录发送日志 ────────────────────────────────────
    await prisma.sendingLog.create({
      data: {
        userId,
        taskId: campaignId,           
        recipientEmail: to,           
        senderDomain: (fromEmail || RESEND_CONFIG.fromEmail).split('@')[1],
        fromEmail: fromEmail || RESEND_CONFIG.fromEmail,
        subject,
        status: 'SENT',
        messageId,
        sentAt: new Date(),
      },
    })

    return {
      success: true,
      messageId,
      bounceType: 'NONE',
    }

  } catch (error) {
    console.error('[Resend] Send error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      bounceType: 'NONE',
    }
  }
}

// ─── 批量发送 ─────────────────────────────────────────
/**
 * 批量发送邮件
 */
export async function sendEmailsBatch(
  emails: Array<{
    to: string
    subject: string
    body: string
  }>,
  params: {
    userId: string
    campaignId?: string
    fromEmail?: string
    fromName?: string
    onProgress?: (sent: number, total: number) => void
  }
): Promise<{
  total: number
  successful: number
  failed: number
  results: SendResult[]
}> {
  const results: SendResult[] = []
  let successful = 0
  let failed = 0

  for (let i = 0; i < emails.length; i++) {
    const email = emails[i]
    
    const result = await sendEmailViaResend({
      ...email,
      userId: params.userId,
      campaignId: params.campaignId,
      fromEmail: params.fromEmail,
      fromName: params.fromName,
    })

    results.push(result)

    if (result.success) {
      successful++
    } else {
      failed++
    }

    params.onProgress?.(i + 1, emails.length)

    // 批次间隔（防封）
    if (i < emails.length - 1) {
      const delay = Math.floor(Math.random() * 2000) + 1000 // 1-3 秒
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  return { total: emails.length, successful, failed, results }
}

// ─── 邮件模板 ─────────────────────────────────────────
/**
 * 生成 HTML 邮件模板
 */
export function buildEmailHtml(params: {
  subject: string
  body: string
  senderName: string
  senderCompany: string
  unsubscribeUrl?: string
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${params.subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 30px 40px; border-bottom: 1px solid #eeeeee;">
              <h1 style="margin: 0; font-size: 18px; color: #333333;">
                ${params.senderCompany}
              </h1>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <div style="font-size: 16px; line-height: 1.6; color: #333333; white-space: pre-wrap;">
${params.body}
              </div>
            </td>
          </tr>
          
          <!-- Signature -->
          <tr>
            <td style="padding: 0 40px 30px;">
              <p style="margin: 0 0 10px; color: #666666;">
                Best regards,
              </p>
              <p style="margin: 0; font-weight: 600; color: #333333;">
                ${params.senderName}
              </p>
              <p style="margin: 5px 0 0; color: #666666; font-size: 14px;">
                ${params.senderCompany}
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px; background-color: #f9f9f9; border-top: 1px solid #eeeeee; border-radius: 0 0 8px 8px;">
              <p style="margin: 0; font-size: 12px; color: #999999; text-align: center;">
                ${params.unsubscribeUrl 
                  ? `<a href="${params.unsubscribeUrl}" style="color: #999999;">退订邮件</a>` 
                  : ''}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim()
}
