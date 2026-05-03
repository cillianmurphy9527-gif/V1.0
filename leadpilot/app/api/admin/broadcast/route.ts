import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminRole } from '@/lib/admin-auth'

/**
 * 获取广播消息列表
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminRole()
    if (!auth.ok) return auth.response

    const messages = await prisma.broadcastMessage.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return NextResponse.json({
      messages: messages.map((m) => ({
        id: m.id,
        title: m.title,
        content: m.content,
        targetPlan: m.targetPlan,
        sentCount: m.sentCount,
        status: m.status,
        createdAt: m.createdAt.toISOString(),
        scheduledAt: m.scheduledAt?.toISOString(),
      })),
    })
  } catch (error: any) {
    console.error('❌ [广播API] 错误:', error)
    return NextResponse.json(
      { error: error?.message || '获取广播消息失败' },
      { status: 500 }
    )
  }
}

/**
 * 发送广播消息
 * 写扩散模式：为每个目标用户在 SystemNotification 表中创建通知记录
 */
export async function POST(request: NextRequest) {
  try {
    // 使用 requireAdminRole 进行鉴权
    const auth = await requireAdminRole()
    if (!auth.ok) return auth.response

    // 从 session 中获取管理员邮箱
    const sessionUser = (auth.session as any)?.user
    const adminEmail = sessionUser?.email
    if (!adminEmail) {
      return NextResponse.json(
        { error: '无法获取管理员邮箱' },
        { status: 400 }
      )
    }

    const adminPhone = sessionUser?.phone

    console.log('[广播API] 当前管理员:', {
      email: adminEmail,
      phone: adminPhone,
      sessionId: sessionUser?.id,
    })

    // 【第一步】：通过管理员邮箱从数据库中查找（或创建）真实的管理员记录
    let adminUser = await prisma.user.findUnique({
      where: { email: adminEmail },
    })

    if (!adminUser) {
      console.log('[广播API] 数据库中无该管理员邮箱，创建新记录...')

      // 检查是否使用了硬编码测试账号，如果是则用硬编码的 phone
      const isHardcodedAdmin = adminPhone === '18342297595'
      const adminPhoneForDb = isHardcodedAdmin ? adminPhone : `ADMIN_${Date.now()}`

      adminUser = await prisma.user.create({
        data: {
          phone: adminPhoneForDb,
          email: adminEmail,
          companyName: 'LeadPilot Admin',
          subscriptionTier: 'MAX',
          features: JSON.stringify({ canUseInbox: true, aiScoring: true }),
          role: 'ADMIN',
          adminRole: 'SUPER_ADMIN',
          tokenBalance: 999999,
          monthlySearches: 0,
          ragFileCount: 0,
          credits: 999999,
        },
      })

      console.log('[广播API] 管理员记录已创建:', {
        id: adminUser.id,
        email: adminUser.email,
        phone: adminUser.phone,
      })
    } else {
      console.log('[广播API] 找到管理员记录:', {
        id: adminUser.id,
        email: adminUser.email,
        adminRole: adminUser.adminRole,
      })

      // 如果记录存在但 adminRole 为空，更新它
      if (!adminUser.adminRole) {
        await prisma.user.update({
          where: { id: adminUser.id },
          data: { adminRole: 'SUPER_ADMIN' },
        })
        console.log('[广播API] 管理员 adminRole 已更新为 SUPER_ADMIN')
      }
    }

    // 【第二步】：解析请求参数
    const { title, content, targetPlan, scheduledAt } = await request.json()

    if (!title?.trim() || !content?.trim()) {
      return NextResponse.json({ error: '标题和内容不能为空' }, { status: 400 })
    }

    // 【第三步】：查询目标用户（使用数据库中的真实 ID）
    const userWhere: any = {}
    if (targetPlan) {
      userWhere.subscriptionTier = targetPlan
    }

    const targetUsers = await prisma.user.findMany({
      where: userWhere,
      select: { id: true, email: true },
    })

    console.log('[广播API] 目标用户数量:', targetUsers.length)

    // 【第四步】：创建广播记录
    const message = await prisma.broadcastMessage.create({
      data: {
        adminId: adminUser.id,
        title,
        content,
        targetPlan: targetPlan || null,
        sentCount: targetUsers.length,
        status: scheduledAt ? 'SCHEDULED' : 'SENT',
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      },
    })

    console.log('[广播API] 广播记录已创建:', message.id)

    // 【第五步】：写扩散——为每个目标用户在 SystemNotification 表中创建通知
    if (!scheduledAt && targetUsers.length > 0) {
      console.log('[广播API] 开始写入扩散通知...')

      // 构建通知数据
      const notificationsData = targetUsers.map((user) => ({
        userId: user.id,
        title,
        content,
        type: 'SYSTEM',
        isRead: false,
        actionUrl: null,
      }))

      // 批量插入通知（写扩散）
      await prisma.systemNotification.createMany({
        data: notificationsData,
      })

      console.log('[广播API] 写扩散完成，已写入', targetUsers.length, '条通知记录')
    }

    // 【第六步】：同时写入 DismissedBroadcast（用于接收端的广播兜底读取）
    if (!scheduledAt && targetUsers.length > 0) {
      console.log('[广播API] 同时写入 DismissedBroadcast 记录...')

      const dismissedData = targetUsers.map((user) => ({
        userId: user.id,
        broadcastId: message.id,
        isRead: false,
        isDismissed: false,
      }))

      // 使用 upsert 避免重复写入
      for (const data of dismissedData) {
        await prisma.dismissedBroadcast.upsert({
          where: {
            userId_broadcastId: {
              userId: data.userId,
              broadcastId: data.broadcastId,
            },
          },
          update: {},
          create: data,
        })
      }

      console.log('[广播API] DismissedBroadcast 记录写入完成')
    }

    console.log('[广播API] 广播发送成功:', {
      messageId: message.id,
      targetCount: targetUsers.length,
    })

    return NextResponse.json({
      success: true,
      messageId: message.id,
      sentCount: targetUsers.length,
    })
  } catch (error: any) {
    console.error('❌ [广播发送API] 错误:', error)
    return NextResponse.json(
      { error: error?.message || '发送广播失败' },
      { status: 500 }
    )
  }
}