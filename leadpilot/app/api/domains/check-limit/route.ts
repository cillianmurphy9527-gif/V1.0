import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/domains/check-limit
 * 发信前检查域名是否超过每日限制
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
    const { domainId, emailCount } = body

    if (!domainId || !emailCount) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      )
    }

    // 获取域名
    const domain = await prisma.domain.findUnique({
      where: { id: domainId }
    })

    if (!domain || domain.userId !== user.id) {
      return NextResponse.json(
        { error: '域名不存在或无权限' },
        { status: 404 }
      )
    }

    // 检查是否启用预热
    if (!domain.warmupEnabled) {
      // 未启用预热，无限制
      return NextResponse.json({
        success: true,
        canSend: true,
        message: '域名预热未启用，无发信限制'
      })
    }

    // 检查每日限制
    const canSend = domain.sentToday + emailCount <= domain.dailyLimit
    const remaining = Math.max(0, domain.dailyLimit - domain.sentToday)

    if (!canSend) {
      return NextResponse.json({
        success: false,
        canSend: false,
        message: `域名预热第 ${domain.warmupDay} 天，每日限制 ${domain.dailyLimit} 封，今日已发 ${domain.sentToday} 封，剩余 ${remaining} 封`,
        remaining,
        dailyLimit: domain.dailyLimit,
        sentToday: domain.sentToday
      })
    }

    return NextResponse.json({
      success: true,
      canSend: true,
      message: `可发送 ${emailCount} 封邮件，剩余 ${remaining - emailCount} 封`,
      remaining: remaining - emailCount,
      dailyLimit: domain.dailyLimit,
      sentToday: domain.sentToday
    })
  } catch (error) {
    console.error('Check limit error:', error)
    return NextResponse.json(
      { error: '检查失败' },
      { status: 500 }
    )
  }
}
