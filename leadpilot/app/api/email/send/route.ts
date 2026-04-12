/**
 * 发送邮件 API 示例 - 集成防薅羊毛和合规检查
 * 
 * 此文件展示如何在实际的邮件发送 API 中集成合规检查
 */

import { NextRequest, NextResponse } from "next/server"
import { prisma } from '@/lib/prisma'
import { checkBeforeSending } from '@/lib/email-validation'
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

/**
 * POST /api/email/send
 * Body: { recipients: string[], subject: string, content: string }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "未授权" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 })
    }

    const { recipients, subject, content } = await request.json()

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json({ error: "收件人列表不能为空" }, { status: 400 })
    }

    // ============================================
    // 【核心】发信前合规检查
    // ============================================
    const validation = await checkBeforeSending(user.id, recipients)
    
    if (!validation.canSend) {
      return NextResponse.json(
        { error: validation.reason },
        { status: 403 }
      )
    }

    const validRecipients = validation.filteredEmails || recipients

    // 如果部分收件人被过滤，返回警告
    if (validRecipients.length < recipients.length) {
      console.log(`⚠️ 已过滤 ${recipients.length - validRecipients.length} 个已退订邮箱`)
    }

    // ============================================
    // 实际发送邮件逻辑
    // ============================================
    
    // TODO: 调用实际的邮件发送服务（SendGrid、AWS SES、Resend 等）
    // const results = await sendEmailBatch(validRecipients, subject, content)

    // 模拟发送
    console.log(`📧 准备发送邮件给 ${validRecipients.length} 个收件人`)

    // 记录发送历史（可选）
    // await prisma.emailLog.createMany({
    //   data: validRecipients.map(email => ({
    //     userId: user.id,
    //     recipient: email,
    //     subject,
    //     status: 'SENT'
    //   }))
    // })

    return NextResponse.json({
      success: true,
      message: "邮件发送成功",
      sent: validRecipients.length,
      filtered: recipients.length - validRecipients.length
    })

  } catch (error) {
    console.error("Email send error:", error)
    return NextResponse.json(
      { error: "发送失败，请稍后重试" },
      { status: 500 }
    )
  }
}
