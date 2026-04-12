import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// 【关键】禁止 Next.js 缓存，每次请求都读数据库真实状态
export const dynamic = 'force-dynamic'

/**
 * POST /api/campaigns/stop
 * 强制终止 Campaign 任务（将状态更新为 STOPPED）
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
    const { campaignId } = body

    if (!campaignId) {
      return NextResponse.json(
        { error: '缺少 campaignId 参数' },
        { status: 400 }
      )
    }

    console.log('[Stop API] 收到停止请求, campaignId:', campaignId)

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

    // 强制终止：将状态更新为 STOPPED
    console.log('[Stop API] 即将更新数据库, campaignId:', campaignId)
    const updatedCampaign = await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: 'STOPPED'
      }
    })
    console.log('[Stop API] ✅ Campaign 已更新为 STOPPED:', campaignId, '| 结果 status:', updatedCampaign.status)

    // 更新会话状态
    await prisma.agentSession.updateMany({
      where: { campaignId },
      data: {
        status: 'STOPPED',
        completedAt: new Date(),
        errorMessage: '用户手动终止'
      }
    })

    return NextResponse.json({
      success: true,
      message: '任务已强制终止',
      campaign: updatedCampaign
    })
  } catch (error) {
    console.error('Stop campaign error:', error)
    return NextResponse.json(
      { error: '终止失败' },
      { status: 500 }
    )
  }
}
