import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// 【关键】禁止 Next.js 缓存，每次请求都读数据库真实状态
export const dynamic = 'force-dynamic'

/**
 * GET /api/campaigns/status?campaignId=xxx
 * 获取 Agent 运行状态
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
    const campaignId = searchParams.get('campaignId')

    if (!campaignId) {
      return NextResponse.json(
        { error: '缺少 campaignId 参数' },
        { status: 400 }
      )
    }

    // 获取活动和会话
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId }
    })

    if (!campaign || campaign.userId !== user.id) {
      return NextResponse.json(
        { error: '活动不存在或无权限' },
        { status: 404 }
      )
    }

    const session_data = await prisma.agentSession.findUnique({
      where: { campaignId }
    })

    // 检查余额是否充足（如果还在运行）
    let shouldPause = false
    let pauseReason = ''

    if (campaign.status === 'RUNNING' && user.tokenBalance <= 0) {
      shouldPause = true
      pauseReason = '余额不足，已自动暂停'

      // 自动暂停
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: 'PAUSED_OUT_OF_CREDITS' }
      })

      if (session_data) {
        await prisma.agentSession.update({
          where: { campaignId },
          data: {
            status: 'PAUSED',
            pausedAt: new Date(),
            errorMessage: pauseReason
          }
        })
      }
    }

    return NextResponse.json({
      success: true,
      campaign: {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        estimatedLeads: campaign.estimatedLeads,
        totalTokensNeeded: campaign.totalTokensNeeded
      },
      session: session_data ? {
        id: session_data.id,
        status: session_data.status,
        tokensUsed: session_data.tokensUsed,
        emailsSent: session_data.emailsSent,
        emailsBounced: session_data.emailsBounced,
        startedAt: session_data.startedAt,
        pausedAt: session_data.pausedAt,
        errorMessage: session_data.errorMessage
      } : null,
      userBalance: user.tokenBalance,
      shouldPause,
      pauseReason
    })
  } catch (error) {
    console.error('Status check error:', error)
    return NextResponse.json(
      { error: '获取状态失败' },
      { status: 500 }
    )
  }
}
