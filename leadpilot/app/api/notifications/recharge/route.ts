import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/notifications/recharge-reminder
 * 发送充值提醒通知
 */
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
    const { title, content, actionUrl } = body

    // 创建充值提醒通知
    const notification = await prisma.systemNotification.create({
      data: {
        userId: user.id,
        title: title || '💰 余额不足，请立即充值',
        content: content || `您的算力余额已不足，当前余额：${user.tokenBalance} tokens。请立即充值以继续使用 Agent 功能。`,
        type: 'SYSTEM',
        actionUrl: actionUrl || '/billing'
      }
    })

    return NextResponse.json({
      success: true,
      message: '充值提醒已发送',
      notification
    })
  } catch (error) {
    console.error('Send notification error:', error)
    return NextResponse.json(
      { error: '发送通知失败' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/notifications/unread
 * 获取未读通知
 */
export async function GET(request: NextRequest) {
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

    // 获取未读通知
    const notifications = await prisma.systemNotification.findMany({
      where: {
        userId: user.id,
        isRead: false
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    })

    return NextResponse.json({
      success: true,
      unreadCount: notifications.length,
      notifications: notifications.map(n => ({
        id: n.id,
        title: n.title,
        content: n.content,
        type: n.type,
        actionUrl: n.actionUrl,
        createdAt: n.createdAt.toISOString()
      }))
    })
  } catch (error) {
    console.error('Get notifications error:', error)
    return NextResponse.json(
      { error: '获取通知失败' },
      { status: 500 }
    )
  }
}
