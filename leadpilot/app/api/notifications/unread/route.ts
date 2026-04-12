import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getToken } from 'next-auth/jwt'

/**
 * 获取用户通知
 * 同时查询：
 * 1. SystemNotification（定向通知 + 广播写入的通知）
 * 2. BroadcastMessage（全局广播兜底，用于补显示历史广播）
 * 合并后按 createdAt 降序返回
 * 
 * 已忽略的广播会从列表中过滤掉
 */
export async function GET(request: NextRequest) {
  try {
    const token = await getToken({
      req: request as any,
      secret: process.env.NEXTAUTH_SECRET,
    })

    if (!token?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = token.id as string

    // 1. 查询专属该用户的系统通知
    const systemNotifications = await prisma.systemNotification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    // 2. 查询全局广播（兜底：覆盖 createMany 失败前发送的历史广播）
    const broadcastMessages = await prisma.broadcastMessage.findMany({
      where: { status: 'SENT' },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    // 3. 查询用户已忽略/删除的广播
    const dismissedRecords = await prisma.dismissedBroadcast.findMany({
      where: { userId },
    })
    const dismissedBroadcastIds = new Set(
      dismissedRecords.filter(r => r.isDismissed).map(r => r.broadcastId)
    )
    const readBroadcastIds = new Set(
      dismissedRecords.filter(r => r.isRead).map(r => r.broadcastId)
    )

    // 4. 将广播转换为通知格式，过滤掉已删除的
    const broadcastAsNotifications = broadcastMessages
      .filter(b => !dismissedBroadcastIds.has(b.id))
      .map(b => ({
        id: `broadcast-${b.id}`,
        title: b.title,
        content: b.content,
        type: 'SYSTEM' as const,
        isRead: readBroadcastIds.has(b.id),
        createdAt: b.createdAt.toISOString(),
      }))

    // 5. 合并 + 排序
    const allNotifications = [
      ...systemNotifications.map(n => ({
        id: n.id,
        title: n.title,
        content: n.content,
        type: n.type,
        isRead: n.isRead,
        createdAt: n.createdAt.toISOString(),
      })),
      ...broadcastAsNotifications,
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
     .slice(0, 50)

    // 6. 计算未读数（排除已删除的）
    const unreadCount = allNotifications.filter(n => !n.isRead).length

    console.log(`[通知API] 返回 ${allNotifications.length} 条通知，未读数: ${unreadCount}`)
    return NextResponse.json({ notifications: allNotifications, unreadCount })
  } catch (error: any) {
    console.error('❌ [通知API] 错误:', error?.message)
    return NextResponse.json(
      { error: error?.message || '未知内部错误' },
      { status: 500 }
    )
  }
}

/**
 * 删除通知
 * 
 * 对于广播通知（broadcast-xxx 格式）：
 * - 不删除数据库记录（广播是全局的）
 * - 而是创建/更新 DismissedBroadcast 记录，标记为已删除
 */
export async function DELETE(request: NextRequest) {
  try {
    const token = await getToken({
      req: request as any,
      secret: process.env.NEXTAUTH_SECRET,
    })

    if (!token?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const notificationId = searchParams.get('id')

    if (!notificationId) {
      return NextResponse.json({ error: 'notificationId required' }, { status: 400 })
    }

    const userId = token.id as string

    // Broadcast-prefixed IDs: 持久化删除到 DismissedBroadcast 表
    if (notificationId.startsWith('broadcast-')) {
      const broadcastId = notificationId.replace('broadcast-', '')
      
      console.log(`[通知API] 删除广播通知: broadcastId=${broadcastId}, userId=${userId}`)
      
      // upsert: 如果已存在记录则更新 isDismissed，否则创建新记录
      await prisma.dismissedBroadcast.upsert({
        where: {
          userId_broadcastId: {
            userId,
            broadcastId,
          },
        },
        update: {
          isDismissed: true,
        },
        create: {
          userId,
          broadcastId,
          isDismissed: true,
          isRead: true, // 删除时标记为已读
        },
      })

      console.log(`[通知API] 广播通知已持久化删除`)
      return NextResponse.json({ success: true })
    }

    // 普通通知: 直接从数据库删除
    const notification = await prisma.systemNotification.findUnique({ 
      where: { id: notificationId } 
    })
    if (!notification) {
      return NextResponse.json({ error: '通知不存在' }, { status: 404 })
    }
    if (notification.userId !== userId) {
      return NextResponse.json({ error: '无权删除此通知' }, { status: 403 })
    }

    await prisma.systemNotification.delete({ where: { id: notificationId } })

    console.log(`[通知API] 普通通知已删除: id=${notificationId}`)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('❌ [通知API-DELETE] 错误:', error?.message)
    return NextResponse.json(
      { error: error?.message || '未知内部错误' },
      { status: 500 }
    )
  }
}

/**
 * 标记通知为已读
 * 
 * 对于广播通知：
 * - 持久化已读状态到 DismissedBroadcast 表
 */
export async function POST(request: NextRequest) {
  try {
    const token = await getToken({
      req: request as any,
      secret: process.env.NEXTAUTH_SECRET,
    })

    if (!token?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { notificationId } = await request.json()
    if (!notificationId) {
      return NextResponse.json({ error: 'notificationId required' }, { status: 400 })
    }

    const userId = token.id as string

    // Broadcast-prefixed IDs: 持久化已读到 DismissedBroadcast 表
    if (notificationId.startsWith('broadcast-')) {
      const broadcastId = notificationId.replace('broadcast-', '')
      
      console.log(`[通知API] 标记广播已读: broadcastId=${broadcastId}, userId=${userId}`)
      
      await prisma.dismissedBroadcast.upsert({
        where: {
          userId_broadcastId: {
            userId,
            broadcastId,
          },
        },
        update: {
          isRead: true,
        },
        create: {
          userId,
          broadcastId,
          isRead: true,
          isDismissed: false,
        },
      })

      console.log(`[通知API] 广播已读状态已持久化`)
      return NextResponse.json({ success: true })
    }

    // 普通通知: 更新数据库
    await prisma.systemNotification.update({
      where: { id: notificationId },
      data: { isRead: true },
    })

    console.log(`[通知API] 普通通知已标记已读: id=${notificationId}`)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('❌ [通知API-POST] 错误:', error?.message)
    return NextResponse.json(
      { error: error?.message || '未知内部错误' },
      { status: 500 }
    )
  }
}
