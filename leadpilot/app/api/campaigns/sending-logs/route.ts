import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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

    const skip = (page - 1) * limit

    // 构建查询条件
    const where: any = { userId: user.id }
    if (status) {
      where.status = status
    }

    // 获取总数
    const total = await prisma.sendingLog.count({ where })

    // 获取日志
    const logs = await prisma.sendingLog.findMany({
      where,
      orderBy: { sentAt: 'desc' },
      skip,
      take: limit
    })

    // 统计数据
    const stats = {
      sent: await prisma.sendingLog.count({ where: { ...where, status: 'SENT' } }),
      bounced: await prisma.sendingLog.count({ where: { ...where, status: 'BOUNCED' } }),
      opened: await prisma.sendingLog.count({ where: { ...where, status: 'OPENED' } }),
      clicked: await prisma.sendingLog.count({ where: { ...where, status: 'CLICKED' } }),
      replied: await prisma.sendingLog.count({ where: { ...where, status: 'REPLIED' } }),
      unsubscribed: await prisma.sendingLog.count({ where: { ...where, status: 'UNSUBSCRIBED' } }),
      successRate: total > 0 ? Math.round((await prisma.sendingLog.count({ where: { ...where, status: 'SENT' } }) / total) * 100) : 0,
      totalAttempts: total
    }

    return NextResponse.json({
      success: true,
      data: logs,
      stats,
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
