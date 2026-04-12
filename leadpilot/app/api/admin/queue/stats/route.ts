/**
 * 管理后台 - 队列监控 API
 * 
 * GET /api/admin/queue/stats - 获取队列统计
 * POST /api/admin/queue/pause-user - 暂停用户任务
 * POST /api/admin/queue/cleanup - 清理已完成任务
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminRole } from '@/lib/admin-auth'
import { 
  getQueueStats, 
  getUserQueuedJobsCount, 
  pauseUserJobs,
  cleanupCompletedJobs,
  checkQueueHealth
} from '@/lib/queue-manager'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminRole()
    if (!auth.ok) return auth.response

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    if (action === 'health') {
      // 队列健康检查
      const health = await checkQueueHealth()
      return NextResponse.json({ success: true, data: health })
    }

    // 默认：获取队列统计
    const stats = await getQueueStats()
    
    // 获取各用户的队列任务数
    const users = await prisma.user.findMany({
      select: { id: true, phone: true, companyName: true, subscriptionTier: true }
    })

    const userQueueCounts = await Promise.all(
      users.map(async (user) => ({
        userId: user.id,
        phone: user.phone,
        companyName: user.companyName,
        tier: user.subscriptionTier,
        queuedJobs: await getUserQueuedJobsCount(user.id)
      }))
    )

    // 只返回有任务的用户
    const activeUsers = userQueueCounts.filter(u => u.queuedJobs > 0)

    return NextResponse.json({
      success: true,
      queueStats: stats,
      activeUsers,
      totalActiveUsers: activeUsers.length
    })

  } catch (error) {
    console.error('Queue stats error:', error)
    return NextResponse.json({ error: '查询失败' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // 验证管理员权限
    const token = await getToken({ req: request as any, secret: process.env.NEXTAUTH_SECRET })
    const user = { role: token?.role as string | undefined }
    if (user?.role !== 'ADMIN' && user?.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { action, userId, hours } = await request.json()

    if (action === 'pause-user') {
      // 暂停用户的所有队列任务
      if (!userId) {
        return NextResponse.json({ error: '缺少 userId' }, { status: 400 })
      }

      const pausedCount = await pauseUserJobs(userId)

      // 同时暂停用户发信权限
      await prisma.user.update({
        where: { id: userId },
        data: { isSendingSuspended: true }
      })

      console.log(`[Admin] Paused ${pausedCount} jobs for user ${userId}`)

      return NextResponse.json({
        success: true,
        message: `已暂停用户 ${userId} 的 ${pausedCount} 个任务`,
        pausedCount
      })

    } else if (action === 'cleanup') {
      // 清理已完成的任务
      const olderThanHours = hours || 24
      const cleaned = await cleanupCompletedJobs(olderThanHours)

      return NextResponse.json({
        success: true,
        message: `已清理 ${cleaned} 个已完成任务`,
        cleaned
      })

    } else {
      return NextResponse.json({ error: '无效的操作' }, { status: 400 })
    }

  } catch (error) {
    console.error('Queue management error:', error)
    return NextResponse.json({ error: '操作失败' }, { status: 500 })
  }
}
