import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 })
    }

    const body = await request.json()
    const { recipients } = body

    if (!recipients || !Array.isArray(recipients)) {
      return NextResponse.json({ error: '缺少收件人列表' }, { status: 400 })
    }

    // 检查退订列表
    const unsubscribed = await prisma.unsubscribeList.findMany({
      where: {
        email: {
          in: recipients
        }
      }
    })

    const unsubscribedEmails = new Set(unsubscribed.map(u => u.email))
    const validRecipients = recipients.filter((email: string) => !unsubscribedEmails.has(email))
    const skippedRecipients = recipients.filter((email: string) => unsubscribedEmails.has(email))

    return NextResponse.json({
      success: true,
      validRecipients,
      skippedRecipients,
      skippedCount: skippedRecipients.length,
      message: `已过滤 ${skippedRecipients.length} 个已退订邮箱`
    })
  } catch (error) {
    console.error('Failed to check unsubscribe list:', error)
    return NextResponse.json({ error: '检查失败' }, { status: 500 })
  }
}
