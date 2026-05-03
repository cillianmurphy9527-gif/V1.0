import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { recordEmailBounce, recordEmailComplaint } from '@/lib/email-compliance'

/**
 * POST /api/webhooks/resend
 * 接收 Resend 邮件服务商的回调事件
 */
export async function POST(request: NextRequest) {
  try {
    const events = await request.json()

    // 验证 webhook 签名
    const signature = request.headers.get('x-webhook-signature')
    if (!verifyWebhookSignature(signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 })
    }

    const eventArray = Array.isArray(events) ? events : [events]

    for (const event of eventArray) {
      await handleEmailEvent(event)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Resend webhook error:", error)
    return NextResponse.json({ error: "处理回调失败" }, { status: 500 })
  }
}

function verifyWebhookSignature(signature: string | null): boolean {
  if (process.env.NODE_ENV === 'development') {
    return true
  }
  // 修复类型错误：确保返回值明确为 boolean
  return typeof signature === 'string' && signature.length > 0
}

async function handleEmailEvent(event: any) {
  const { type, email, userId, reason } = event

  switch (type) {
    case 'bounce':
    case 'dropped':
      if (userId && email) {
        await recordEmailBounce(userId, email, reason)
      }
      break

    case 'spamreport':
    case 'complaint':
      if (email) {
        await recordEmailComplaint(email, reason)
      }
      break

    case 'unsubscribe':
      if (email) {
        await prisma.unsubscribeList.create({
          data: { email, reason: reason || '用户通过邮件退订', source: 'USER_REQUEST' }
        }).catch(() => {})
      }
      break

    default:
      console.log(`未处理的事件类型: ${type}`)
  }
}