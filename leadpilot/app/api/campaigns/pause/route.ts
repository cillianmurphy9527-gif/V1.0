import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/campaigns/pause
 * 暂停 Agent 任务
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
    const { campaignId, reason } = body

    if (!campaignId) {
      return NextResponse.json(
        { error: '缺少 campaignId 参数' },
        { status: 400 }
      )
    }

    // 获取活动
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId }
    })

    if (!campaign || campaign.userId !== user.id) {
      return NextResponse.json(
        { error: '活动不存在或无权限' },
        { status: 404 }
      )
    }

    // 暂停活动
    const updatedCampaign = await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: 'PAUSED_OUT_OF_CREDITS'
      }
    })

    // 更新会话
    const updatedSession = await prisma.agentSession.update({
      where: { campaignId },
      data: {
        status: 'PAUSED',
        pausedAt: new Date(),
        errorMessage: reason || '用户手动暂停'
      }
    })

    return NextResponse.json({
      success: true,
      message: '任务已暂停',
      campaign: updatedCampaign,
      session: updatedSession
    })
  } catch (error) {
    console.error('Pause campaign error:', error)
    return NextResponse.json(
      { error: '暂停失败' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/campaigns/resume
 * 恢复 Agent 任务
 */
export async function PUT(request: NextRequest) {
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
    const { campaignId } = body

    if (!campaignId) {
      return NextResponse.json(
        { error: '缺少 campaignId 参数' },
        { status: 400 }
      )
    }

    // 获取活动
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId }
    })

    if (!campaign || campaign.userId !== user.id) {
      return NextResponse.json(
        { error: '活动不存在或无权限' },
        { status: 404 }
      )
    }

    // 检查余额
    if (user.tokenBalance <= 0) {
      return NextResponse.json(
        {
          error: '余额不足，无法恢复任务',
          balance: user.tokenBalance
        },
        { status: 402 }
      )
    }

    // 恢复活动
    const updatedCampaign = await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: 'RUNNING'
      }
    })

    // 更新会话
    const updatedSession = await prisma.agentSession.update({
      where: { campaignId },
      data: {
        status: 'RUNNING',
        resumedAt: new Date(),
        errorMessage: null
      }
    })

    return NextResponse.json({
      success: true,
      message: '任务已恢复',
      campaign: updatedCampaign,
      session: updatedSession
    })
  } catch (error) {
    console.error('Resume campaign error:', error)
    return NextResponse.json(
      { error: '恢复失败' },
      { status: 500 }
    )
  }
}
