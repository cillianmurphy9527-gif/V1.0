/**
 * 邮件发送工具函数
 * 负责在发送前注入退订链接和检查退订列表
 */

import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

/**
 * 生成退订 Token
 */
export function generateUnsubscribeToken(email: string): string {
  const secret = process.env.UNSUBSCRIBE_SECRET || 'default-secret-change-in-production'
  return crypto
    .createHmac('sha256', secret)
    .update(email)
    .digest('hex')
    .substring(0, 16)
}

/**
 * 生成退订 URL
 */
export function generateUnsubscribeUrl(email: string, token?: string): string {
  const unsubscribeToken = token || generateUnsubscribeToken(email)
  const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://leadpilot.io'
  return `${baseUrl}/api/email/unsubscribe?email=${encodeURIComponent(email)}&token=${unsubscribeToken}`
}

/**
 * 在邮件 HTML 底部注入退订链接
 */
export function injectUnsubscribeLink(
  emailHtml: string, 
  recipientEmail: string,
  unsubscribeUrl?: string
): string {
  const url = unsubscribeUrl || generateUnsubscribeUrl(recipientEmail)
  
  const unsubscribeFooterHtml = `
<br><br>
<hr style="border: none; border-top: 1px solid #eaeaea; margin: 20px 0;">
<p style="font-size: 12px; color: #999999; text-align: center; margin: 0;">
  If you no longer wish to receive these emails, you can 
  <a href="${url}" style="color: #666666; text-decoration: underline;">unsubscribe here</a>.
</p>
<p style="font-size: 11px; color: #cccccc; text-align: center; margin: 12px 0 0 0;">
  This email was sent to: ${recipientEmail}
</p>
  `.trim()

  if (emailHtml.includes('</body>')) {
    return emailHtml.replace('</body>', `${unsubscribeFooterHtml}</body>`)
  }

  return emailHtml + unsubscribeFooterHtml
}

/**
 * 在邮件纯文本底部注入退订链接
 */
export function injectUnsubscribeText(
  emailText: string,
  recipientEmail: string,
  unsubscribeUrl?: string
): string {
  const url = unsubscribeUrl || generateUnsubscribeUrl(recipientEmail)
  
  const unsubscribeFooterText = `

---

If you no longer wish to receive these emails, you can unsubscribe here: ${url}

This email was sent to: ${recipientEmail}
  `.trim()

  return emailText + unsubscribeFooterText
}

/**
 * 检查邮箱是否在退订列表中
 */
export async function isEmailUnsubscribed(email: string): Promise<boolean> {
  try {
    const record = await prisma.unsubscribeList.findUnique({
      where: { email }
    })
    return !!record
  } catch (error) {
    console.error('Failed to check unsubscribe status:', error)
    return false
  }
}

/**
 * 批量检查邮箱是否在退订列表中
 */
export async function filterUnsubscribedEmails(emails: string[]): Promise<{
  validEmails: string[]
  unsubscribedEmails: string[]
}> {
  try {
    const unsubscribed = await prisma.unsubscribeList.findMany({
      where: {
        email: {
          in: emails
        }
      }
    })

    const unsubscribedSet = new Set(unsubscribed.map(u => u.email))
    const validEmails = emails.filter(email => !unsubscribedSet.has(email))
    const unsubscribedEmails = emails.filter(email => unsubscribedSet.has(email))

    return { validEmails, unsubscribedEmails }
  } catch (error) {
    console.error('Failed to filter unsubscribed emails:', error)
    return { validEmails: emails, unsubscribedEmails: [] }
  }
}

/**
 * 记录发信日志
 */
export async function logEmailSending(data: {
  userId: string
  campaignId?: string
  recipient: string
  fromDomain: string
  fromEmail: string
  subject: string
  status: string
  messageId?: string
  errorMessage?: string
}) {
  try {
    await prisma.sendingLog.create({
      data: {
        userId: data.userId,
        campaignId: data.campaignId,
        recipient: data.recipient,
        fromDomain: data.fromDomain,
        fromEmail: data.fromEmail,
        subject: data.subject,
        status: data.status,
        messageId: data.messageId,
        errorMessage: data.errorMessage
      }
    })
  } catch (error) {
    console.error('Failed to log email sending:', error)
  }
}
