/**
 * Email Service - Resend 邮件发送服务
 * 负责邮件发送、盖楼参数注入与域名轮换
 */

interface SendEmailParams {
  from: string
  to: string
  subject: string
  html: string
  text?: string
  inReplyTo?: string
  references?: string
}

interface SendEmailResult {
  success: boolean
  messageId?: string
  error?: string
}

export class EmailService {
  private apiKey: string
  private baseUrl = 'https://api.resend.com'

  constructor() {
    this.apiKey = process.env.RESEND_API_KEY || ''
  }

  async sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
    if (!this.apiKey) {
      console.error('❌ RESEND_API_KEY 未配置')
      return {
        success: false,
        error: 'RESEND_API_KEY 未配置，无法发送邮件',
      }
    }

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      }

      const emailPayload: Record<string, any> = {
        from: params.from,
        to: params.to,
        subject: params.subject,
        html: params.html,
      }

      if (params.text) {
        emailPayload.text = params.text
      }

      if (params.inReplyTo) {
        emailPayload.headers = {
          'In-Reply-To': params.inReplyTo,
          'References': params.references || params.inReplyTo,
        }
      }

      console.log('📧 发送邮件:', {
        from: params.from,
        to: params.to,
        subject: params.subject,
        inReplyTo: params.inReplyTo,
        hasText: !!params.text,
      })

      const response = await fetch(`${this.baseUrl}/emails`, {
        method: 'POST',
        headers,
        body: JSON.stringify(emailPayload),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Email send failed')
      }

      const data = await response.json()

      console.log('✅ 邮件发送成功:', data.id)

      return {
        success: true,
        messageId: data.id,
      }
    } catch (error: any) {
      console.error('❌ 邮件发送失败:', error)
      return {
        success: false,
        error: error.message,
      }
    }
  }

  selectActiveDomain(
    domains: Array<{ domainName: string; status: string; dailySentCount: number }>
  ): string | null {
    const activeDomains = domains.filter(
      (d) => d.status === 'ACTIVE' && d.dailySentCount < 100
    )

    if (activeDomains.length === 0) {
      return null
    }

    const randomIndex = Math.floor(Math.random() * activeDomains.length)
    return activeDomains[randomIndex].domainName
  }

  async sleep(minMs: number = 180000, maxMs: number = 420000): Promise<void> {
    const sleepTime = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs
    console.log(`💤 Sleeping for ${Math.round(sleepTime / 1000)}s to avoid spam detection`)
    return new Promise((resolve) => setTimeout(resolve, sleepTime))
  }

  extractMessageId(rawEmail: any): string | null {
    try {
      return rawEmail.message_id || rawEmail.headers?.['message-id'] || null
    } catch (error) {
      console.error('Failed to extract message ID:', error)
      return null
    }
  }

  buildReferencesChain(existingReferences: string | null, newMessageId: string): string {
    if (!existingReferences) {
      return newMessageId
    }
    return `${existingReferences} ${newMessageId}`
  }
}

export const emailService = new EmailService()
