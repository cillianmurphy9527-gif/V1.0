import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/campaigns/sending-logs/detailed
 * 获取发信明细表数据 - 完整的发信记录
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

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const status = searchParams.get('status')
    const campaignId = searchParams.get('campaignId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const skip = (page - 1) * limit

    // 构建查询条件
    const where: any = { userId: user.id }
    
    if (status) {
      where.status = status
    }
    
    if (campaignId) {
      where.campaignId = campaignId
    }
    
    if (startDate || endDate) {
      where.sentAt = {}
      if (startDate) {
        where.sentAt.gte = new Date(startDate)
      }
      if (endDate) {
        where.sentAt.lte = new Date(endDate)
      }
    }

    // 获取总数
    const total = await prisma.sendingLog.count({ where })

    // 获取分页数据
    const logs = await prisma.sendingLog.findMany({
      where,
      orderBy: { sentAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        recipient: true,
        fromDomain: true,
        fromEmail: true,
        subject: true,
        status: true,
        sentAt: true,
        openedAt: true,
        clickedAt: true,
        repliedAt: true,
        errorMessage: true,
        messageId: true
      }
    })

    // 统计数据
    const stats = {
      total,
      sent: await prisma.sendingLog.count({ where: { ...where, status: 'SENT' } }),
      bounced: await prisma.sendingLog.count({ where: { ...where, status: 'BOUNCED' } }),
      opened: await prisma.sendingLog.count({ where: { ...where, status: 'OPENED' } }),
      clicked: await prisma.sendingLog.count({ where: { ...where, status: 'CLICKED' } }),
      replied: await prisma.sendingLog.count({ where: { ...where, status: 'REPLIED' } }),
      unsubscribed: await prisma.sendingLog.count({ where: { ...where, status: 'UNSUBSCRIBED' } })
    }

    const successRate = total > 0 ? Math.round((stats.sent / total) * 100) : 0

    return NextResponse.json({
      success: true,
      data: logs.map(log => ({
        ...log,
        sentAt: log.sentAt.toISOString(),
        openedAt: log.openedAt?.toISOString() || null,
        clickedAt: log.clickedAt?.toISOString() || null,
        repliedAt: log.repliedAt?.toISOString() || null
      })),
      stats: {
        ...stats,
        successRate,
        openRate: stats.opened > 0 ? Math.round((stats.opened / stats.sent) * 100) : 0,
        clickRate: stats.clicked > 0 ? Math.round((stats.clicked / stats.sent) * 100) : 0,
        replyRate: stats.replied > 0 ? Math.round((stats.replied / stats.sent) * 100) : 0
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Failed to fetch sending logs:', error)
    return NextResponse.json({ error: '获取日志失败' }, { status: 500 })
  }
}
