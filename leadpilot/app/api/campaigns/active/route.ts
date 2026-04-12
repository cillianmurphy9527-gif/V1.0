import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// 【关键】禁止 Next.js 缓存，每次请求都读数据库真实状态
export const dynamic = 'force-dynamic'

/**
 * GET /api/campaigns/active
 * 查询当前用户是否有正在运行的活动
 * 
 * 返回：
 * - success: 查询是否成功
 * - activeCampaign: 当前活跃的 Campaign（RUNNING 状态时）
 * - status: 当前状态
 * - message: 状态说明
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ 
        success: true, // 未登录不算错误，只是没有活跃任务
        activeCampaign: null,
        status: 'IDLE',
        message: '未登录',
      })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json({ 
        success: true,
        activeCampaign: null,
        status: 'IDLE',
        message: '用户不存在',
      })
    }

    // 查询用户最新的 Campaign（按更新时间���序）
    // 注意：agentSession 是一对一关系，不用 include 而是用 select + 手动查询
    const latestCampaign = await prisma.campaign.findFirst({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
      include: {
        leads: {
          select: { id: true },
          take: 1,
        },
      },
    })

    if (!latestCampaign) {
      return NextResponse.json({
        success: true,
        activeCampaign: null,
        status: 'IDLE',
        message: '暂无运行中的任务',
      })
    }

    // 单独查询 agentSession（一对一关系）
    const agentSession = await prisma.agentSession.findUnique({
      where: { campaignId: latestCampaign.id }
    })

    // 构建进度信息
    const progress = {
      totalProcessed: (latestCampaign.config as Record<string, unknown>)?.totalProcessed as number || 0,
      totalLeadsFound: (latestCampaign.config as Record<string, unknown>)?.totalLeadsFound as number || 0,
      totalLeadsSaved: (latestCampaign.config as Record<string, unknown>)?.totalLeadsSaved as number || 0,
      lastBatchAt: (latestCampaign.config as Record<string, unknown>)?.lastBatchAt as string || null,
      estimatedLeads: latestCampaign.estimatedLeads || 0,
      // 从 agentSession 获取真实数据
      tokensUsed: agentSession?.tokensUsed || 0,
      emailsSent: agentSession?.emailsSent || 0,
    }

    // 生成状态消息
    let message = ''
    switch (latestCampaign.status) {
      case 'RUNNING':
        if (progress.totalProcessed > 0) {
          message = `任务执行中，已处理 ${progress.totalProcessed} 条线索`
        } else {
          message = '任务已点火，正在排队等待执行...'
        }
        break
      case 'PAUSED_OUT_OF_CREDITS':
        message = '⚠️ 余额校验异常，任务已暂停'
        break
      case 'PAUSED':
        message = '任务已暂停'
        break
      case 'COMPLETED':
        message = `任务已完成，共发送 ${progress.emailsSent} 封邮件`
        break
      case 'STOPPED':
        message = '任务已终止'
        break
      case 'IDLE':
        message = '任务待启动'
        break
      default:
        message = `状态: ${latestCampaign.status}`
    }

    // 【关键修正】只要不是终止状态，就视为活跃任务
    const isActive = ['RUNNING', 'PAUSED', 'PAUSED_OUT_OF_CREDITS'].includes(latestCampaign.status)
    
    const campaignData = {
      id: latestCampaign.id,
      name: latestCampaign.name,
      status: latestCampaign.status,
      estimatedLeads: latestCampaign.estimatedLeads,
      progress,
      createdAt: latestCampaign.createdAt,
      updatedAt: latestCampaign.updatedAt,
    }

    return NextResponse.json({
      success: true,
      // 只要不是终止状态，就返回 activeCampaign
      activeCampaign: isActive ? campaignData : null,
      // 始终返回完整 campaign 数据
      campaign: campaignData,
      status: latestCampaign.status,
      message,
      progress,
      agentSession,
    })

  } catch (error) {
    console.error('[campaigns/active] Error:', error)
    // 发生错误时返回安全的降级响应
    return NextResponse.json({ 
      success: false, 
      activeCampaign: null,
      status: 'IDLE',
      message: error instanceof Error ? error.message : '查询失败'
    }, { status: 500 })
  }
}
