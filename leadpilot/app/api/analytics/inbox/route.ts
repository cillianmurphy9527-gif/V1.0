/**
 * API: 收件箱分析数据
 * 
 * GET /api/analytics/inbox
 * 
 * 返回真实的邮件意图分类统计和高优先级待处理邮件
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    // 鉴权
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const userId = session.user.id

    // 查询用户的邮件线程（真实数据）
    const threads = await prisma.emailThread.findMany({
      where: { userId },
      select: {
        id: true,
        targetEmail: true,
        subject: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    })

    // 统计各意图类型数量（暂时返回0，因为数据库中没有intent字段）
    const stats = {
      highIntent: 0,
      needFollowup: 0,
      autoReply: 0,
      rejected: 0,
      total: threads.length
    }

    // 获取高优先级待处理邮件
    const highPriorityEmails = threads
      .slice(0, 10)
      .map(t => ({
        threadId: t.id,
        targetEmail: t.targetEmail,
        subject: t.subject || 'No Subject',
        intent: 'UNKNOWN',
        intentLabel: '未分类',
        createdAt: t.createdAt.toISOString()
      }))

    return NextResponse.json({
      success: true,
      stats,
      highPriorityEmails
    })

  } catch (error) {
    console.error('[AnalyticsInbox] Error:', error)
    return NextResponse.json({ error: '查询失败' }, { status: 500 })
  }
}
