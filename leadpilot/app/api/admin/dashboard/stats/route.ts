import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminRole } from '@/lib/admin-auth'

/**
 * Admin Dashboard 实时统计数据
 * 从数据库实时计算，绝不使用硬编码
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminRole()
    if (!auth.ok) return auth.response

    // 获取今天的日期范围
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    // 1. 今日新增注册用户
    const newUsers = await prisma.user.count({
      where: {
        createdAt: {
          gte: today,
          lt: tomorrow,
        },
      },
    })

    // 2. 今日实收总营收
    const revenueData = await prisma.order.aggregate({
      where: {
        status: 'PAID',
        createdAt: {
          gte: today,
          lt: tomorrow,
        },
      },
      _sum: {
        amount: true,
      },
    })
    const totalRevenue = revenueData._sum.amount || 0

    // 3. 今日消耗总算力（通过订单分配的算力总和）
    const creditsData = await prisma.order.aggregate({
      where: {
        status: 'PAID',
        createdAt: {
          gte: today,
          lt: tomorrow,
        },
      },
      _sum: {
        tokensAllocated: true,
      },
    })
    const creditsConsumed = creditsData._sum.tokensAllocated || 0

    // 4. 今日发信总数
    const emailsSent = await prisma.emailMessage.count({
      where: {
        createdAt: {
          gte: today,
          lt: tomorrow,
        },
      },
    })

    // 5. 任务队列排队数（通过 Campaign 状态统计）
    const queuedTasks = await prisma.campaign.count({
      where: {
        status: 'RUNNING',
      },
    })

    // 6. 拦截无效线索（AI 过滤的低意向线索）
    const filteredLeads = await prisma.lead.count({
      where: {
        status: 'FILTERED_LOW_INTENT',
        createdAt: {
          gte: today,
          lt: tomorrow,
        },
      },
    })

    // 7. 近 30 天营收趋势（区分订阅和增值服务）
    const thirtyDaysAgo = new Date(today)
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const revenueByDay = await prisma.order.groupBy({
      by: ['createdAt', 'orderType'],
      where: {
        status: 'PAID',
        createdAt: {
          gte: thirtyDaysAgo,
        },
      },
      _sum: {
        amount: true,
      },
    })

    // 格式化营收趋势数据
    const revenueTrend = revenueByDay.reduce((acc: any, item) => {
      const date = new Date(item.createdAt).toISOString().split('T')[0]
      if (!acc[date]) {
        acc[date] = { date, subscription: 0, addon: 0 }
      }
      if (item.orderType === 'SUBSCRIPTION') {
        acc[date].subscription += item._sum.amount || 0
      } else if (item.orderType === 'ADDON') {
        acc[date].addon += item._sum.amount || 0
      }
      return acc
    }, {})

    // 8. MRR 漏斗图（订阅收入 vs 增值服务）
    const mrrData = await prisma.order.groupBy({
      by: ['orderType'],
      where: {
        status: 'PAID',
        createdAt: {
          gte: thirtyDaysAgo,
        },
      },
      _sum: {
        amount: true,
      },
    })

    const mrrBreakdown = {
      subscription: mrrData.find(m => m.orderType === 'SUBSCRIPTION')?._sum.amount || 0,
      addon: mrrData.find(m => m.orderType === 'ADDON')?._sum.amount || 0,
    }

    // 9. Agent 实时流水（最近的 Campaign 活动）
    const recentActivities = await prisma.campaign.findMany({
      where: {
        updatedAt: {
          gte: new Date(Date.now() - 60 * 60 * 1000), // 最近 1 小时
        },
      },
      include: {
        user: {
          select: {
            companyName: true,
            email: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
      take: 10,
    })

    const activities = recentActivities.map(campaign => ({
      id: campaign.id,
      user: campaign.user?.companyName || campaign.user?.email || '未知用户',
      action: `正在执行拓客任务：${campaign.name}`,
      status: campaign.status === 'RUNNING' ? 'running' : 'completed',
      time: getRelativeTime(campaign.updatedAt),
    }))

    return NextResponse.json({
      todayStats: {
        newUsers,
        totalRevenue,
        creditsConsumed,
        emailsSent,
        queuedTasks,
        filteredLeads,
      },
      revenueTrend: Object.values(revenueTrend),
      mrrBreakdown,
      recentActivities: activities,
    })
  } catch (error: any) {
    console.error('Failed to fetch dashboard stats:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// 辅助函数：计算相对时间
function getRelativeTime(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - new Date(date).getTime()
  const minutes = Math.floor(diff / 60000)
  
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  
  const days = Math.floor(hours / 24)
  return `${days} 天前`
}
