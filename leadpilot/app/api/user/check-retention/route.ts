import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'

const PAID_TIERS = ['STARTER', 'PRO', 'MAX']
const INACTIVE_THRESHOLD_MS = 72 * 60 * 60 * 1000 // 72 小时

/**
 * GET /api/user/check-retention
 *
 * 每次用户进入 Dashboard 时调用。
 * 逻辑：
 *   1. 只对 PAID 用户触发检查
 *   2. 查询最近一次有消耗的记录（SendingLog / Campaign）
 *   3. 若超过 72h 无操作，且当前没有未读的 FORCE_ALERT，则插入一条
 *   4. 返回未读 FORCE_ALERT 消息列表（前端据此决定是否弹窗）
 */
export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request as any, secret: process.env.NEXTAUTH_SECRET })
    if (!token?.id) {
      return NextResponse.json({ alert: null }, { status: 200 })
    }
    const userId = token.id as string

    // 1. 查当前套餐
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { subscriptionTier: true },
    })

    if (!user || !PAID_TIERS.includes(user.subscriptionTier)) {
      return NextResponse.json({ alert: null })
    }

    // 2. 检查是否已有未读 FORCE_ALERT（防重复弹）
    const existing = await prisma.siteMessage.findFirst({
      where: { userId, type: 'FORCE_ALERT', isRead: false },
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, content: true, createdAt: true },
    })

    if (existing) {
      return NextResponse.json({ alert: existing })
    }

    // 3. 查最近一次活跃记录
    const [lastLog, lastCampaign] = await Promise.all([
      prisma.sendingLog.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
      prisma.campaign.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    ])

    const lastActive = [lastLog?.createdAt, lastCampaign?.createdAt]
      .filter(Boolean)
      .sort((a, b) => b!.getTime() - a!.getTime())[0]

    const isInactive = !lastActive ||
      Date.now() - lastActive.getTime() > INACTIVE_THRESHOLD_MS

    if (!isInactive) {
      return NextResponse.json({ alert: null })
    }

    // 3b. 用户曾处理过（已读）任意一条留存强提示后，不再自动新建 —— 否则 POST 标已读后下次 GET 仍会走到此处并无限弹窗
    const everDismissedForceAlert = await prisma.siteMessage.findFirst({
      where: { userId, type: 'FORCE_ALERT', isRead: true },
      select: { id: true },
    })
    if (everDismissedForceAlert) {
      return NextResponse.json({ alert: null })
    }

    // 4. 计算不活跃天数用于消息文案
    const inactiveDays = lastActive
      ? Math.floor((Date.now() - lastActive.getTime()) / 86400000)
      : null
    const dayText = inactiveDays ? `${inactiveDays} 天` : '一段时间'

    // 5. 插入 FORCE_ALERT
    const newAlert = await prisma.siteMessage.create({
      data: {
        userId,
        type: 'FORCE_ALERT',
        title: `系统检测到您已 ${dayText} 未触发自动化拓客`,
        content: `您订阅的套餐正在计费中，但 ${dayText} 内没有发现任何拓客操作。是否遇到了配置困难？我们可以帮您一键跑通流程。`,
        isRead: false,
      },
      select: { id: true, title: true, content: true, createdAt: true },
    })

    return NextResponse.json({ alert: newAlert })
  } catch (error: any) {
    console.error('[check-retention]', error)
    // 静默失败，不影响正常使用
    return NextResponse.json({ alert: null })
  }
}

/**
 * POST /api/user/check-retention
 * body: { messageId: string }
 * 将指定 FORCE_ALERT 标为已读
 */
export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request as any, secret: process.env.NEXTAUTH_SECRET })
    if (!token?.id) return NextResponse.json({ ok: false }, { status: 401 })
    const userId = token.id as string
    const { messageId } = await request.json()
    if (!messageId) return NextResponse.json({ ok: false }, { status: 400 })

    await prisma.siteMessage.updateMany({
      where: { id: messageId, userId, type: 'FORCE_ALERT' },
      data: { isRead: true },
    })

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('[check-retention POST]', error)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}

