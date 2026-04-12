import { NextRequest, NextResponse } from "next/server"
import { prisma } from '@/lib/prisma'
import { recordEmailBounce, recordEmailComplaint } from '@/lib/email-compliance'

/**
 * Webhook API - 接收邮件服务商的回调（退信、投诉等）
 * 
 * POST /api/email/webhook
 * 
 * 用于接收 SendGrid、AWS SES、Resend 等邮件服务商的事件回调
 */

export async function POST(request: NextRequest) {
  try {
    const events = await request.json()

    // 验证 webhook 签名（根据邮件服务商的要求）
    const signature = request.headers.get('x-webhook-signature')
    if (!verifyWebhookSignature(signature)) {
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 403 }
      )
    }

    // 处理事件（支持批量）
    const eventArray = Array.isArray(events) ? events : [events]

    for (const event of eventArray) {
      await handleEmailEvent(event)
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error("Webhook error:", error)
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    )
  }
}

/**
 * 处理单个邮件事件
 */
async function handleEmailEvent(event: any) {
  const { type, email, userId, reason } = event

  switch (type) {
    case 'bounce':
    case 'dropped':
      // 退信事件
      if (userId && email) {
        await recordEmailBounce(userId, email, reason)
      }
      break

    case 'spamreport':
    case 'complaint':
      // 投诉事件
      if (email) {
        await recordEmailComplaint(email, reason)
      }
      break

    case 'unsubscribe':
      // 退订事件
      if (email) {
        await prisma.unsubscribeList.create({
          data: {
            email,
            reason: reason || '用户通过邮件退订',
            source: 'USER_REQUEST'
          }
        }).catch(() => {
          // 可能已存在，忽略
        })
      }
      break

    default:
      console.log(`未处理的事件类型: ${type}`)
  }
}

/**
 * 验证 Webhook 签名
 * 根据实际使用的邮件服务商调整验证逻辑
 */
function verifyWebhookSignature(signature: string | null): boolean {
  // TODO: 实现真实的签名验证
  // 示例：SendGrid 使用 HMAC-SHA256
  // const secret = process.env.EMAIL_WEBHOOK_SECRET
  // const expectedSignature = crypto.createHmac('sha256', secret).update(body).digest('hex')
  // return signature === expectedSignature
  
  // 开发环境暂时跳过验证
  if (process.env.NODE_ENV === 'development') {
    return true
  }
  
  return !!signature
}
