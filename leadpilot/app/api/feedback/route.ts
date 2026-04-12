import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

/**
 * 用户反馈提交 API
 * 收集 Bug 报告和功能建议
 */
export async function POST(request: NextRequest) {
  try {
    // 获取用户 session（可选，未登录也可以提交）
    const session = await getServerSession(authOptions)

    const body = await request.json()
    const { type, content, contact } = body

    // 验证必填字段
    if (!type || !content) {
      return NextResponse.json(
        { success: false, error: "缺少必填字段" },
        { status: 400 }
      )
    }

    // 验证反馈类型
    if (!['bug', 'suggestion'].includes(type)) {
      return NextResponse.json(
        { success: false, error: "无效的反馈类型" },
        { status: 400 }
      )
    }

    // TODO: 保存到数据库或发送到第三方服务
    // 选项1: 保存到 Prisma 数据库
    // await prisma.feedback.create({
    //   data: {
    //     userId: session?.user?.id,
    //     type,
    //     content,
    //     contact,
    //     createdAt: new Date()
    //   }
    // })

    // 选项2: 发送到 Slack/Discord Webhook
    // await fetch(process.env.SLACK_WEBHOOK_URL, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({
    //     text: `新反馈 [${type === 'bug' ? 'Bug' : '建议'}]`,
    //     blocks: [
    //       {
    //         type: 'section',
    //         text: {
    //           type: 'mrkdwn',
    //           text: `*类型*: ${type === 'bug' ? '🐛 Bug 报告' : '💡 功能建议'}\n*用户*: ${session?.user?.email || '未登录'}\n*内容*: ${content}\n*联系方式*: ${contact || '未提供'}`
    //         }
    //       }
    //     ]
    //   })
    // })

    // 选项3: 发送邮件通知
    // await fetch('https://api.resend.com/emails', {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
    //     'Content-Type': 'application/json'
    //   },
    //   body: JSON.stringify({
    //     from: 'feedback@leadpilot.ai',
    //     to: 'admin@leadpilot.ai',
    //     subject: `[反馈] ${type === 'bug' ? 'Bug 报告' : '功能建议'}`,
    //     html: `
    //       <h2>新用户反馈</h2>
    //       <p><strong>类型:</strong> ${type === 'bug' ? '🐛 Bug 报告' : '💡 功能建议'}</p>
    //       <p><strong>用户:</strong> ${session?.user?.email || '未登录'}</p>
    //       <p><strong>内容:</strong></p>
    //       <p>${content}</p>
    //       <p><strong>联系方式:</strong> ${contact || '未提供'}</p>
    //       <p><strong>提交时间:</strong> ${new Date().toLocaleString('zh-CN')}</p>
    //     `
    //   })
    // })

    console.log('📝 收到用户反馈:', {
      type,
      user: session?.user?.email || '未登录',
      content: content.substring(0, 50) + '...',
      contact
    })

    return NextResponse.json({
      success: true,
      message: "感谢您的反馈！我们会尽快处理。"
    })
  } catch (error: any) {
    console.error('❌ 反馈提交失败:', error)
    return NextResponse.json(
      { success: false, error: "提交失败，请稍后重试" },
      { status: 500 }
    )
  }
}
