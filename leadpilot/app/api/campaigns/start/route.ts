import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/campaigns/start
 * 【修复版】启动 Campaign - 纯点火，不预扣费！
 * 
 * 职责：
 * 1. 验证用户和 Campaign 状态
 * 2. 将任务状态更新为 RUNNING
 * 3. 创建 AgentSession 记录
 * 
 * 扣费逻辑已移至 Worker：每次处理线索时实时扣费（lib/nova/pipeline.ts）
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
    const { campaignId, estimatedLeads, enableDeepAnalysis } = body

    if (!campaignId) {
      return NextResponse.json(
        { error: '缺少 campaignId 参数' },
        { status: 400 }
      )
    }

    // 幂等检查：只有 IDLE/PAUSED 才允许启动
    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } })
    
    if (!campaign || campaign.userId !== user.id) {
      return NextResponse.json({ error: '活动不存在或无权限' }, { status: 404 })
    }
    
    if (campaign.status === 'RUNNING') {
      return NextResponse.json({ 
        error: '任务已在运行中，请勿重复启动', 
        code: 'ALREADY_RUNNING' 
      }, { status: 409 })
    }

    // 计算预估 Token（仅用于显示，不扣费）
    const tokensPerLead = 100 + (enableDeepAnalysis ? 50 : 0)
    const totalTokensEstimated = (estimatedLeads || campaign.estimatedLeads || 0) * tokensPerLead

    // ─── 事务：更新状态 + 创建会话 ───
    const result = await prisma.$transaction(async (tx) => {
      // 更新 Campaign 状态
      const updated = await tx.campaign.update({
        where: { id: campaignId, status: { in: ['IDLE', 'PAUSED', 'PAUSED_OUT_OF_CREDITS'] } },
        data: {
          status: 'RUNNING',
          estimatedLeads: estimatedLeads || campaign.estimatedLeads,
        },
      })

      if (!updated) {
        throw new Error('INVALID_STATE')
      }

      // 创建 AgentSession
      const agentSession = await tx.agentSession.create({
        data: {
          userId: user.id,
          campaignId,
          status: 'RUNNING',
          estimatedLeads: estimatedLeads || campaign.estimatedLeads || 0,
          totalTokensNeeded: totalTokensEstimated,
          startedAt: new Date(),
        },
      })

      return { campaign: updated, agentSession }
    })

    return NextResponse.json({
      success: true,
      message: '任务已点火！Worker 将在后台执行任务',
      campaign: result.campaign,
      session: result.agentSession,
      note: '扣费将在 Worker 处理每条线索时实时进行'
    })

  } catch (error) {
    console.error('Start campaign error:', error)
    
    if (error instanceof Error && error.message === 'INVALID_STATE') {
      return NextResponse.json({ 
        error: '任务状态不允许启动', 
        code: 'INVALID_STATE' 
      }, { status: 409 })
    }
    
    return NextResponse.json({ error: '启动失败' }, { status: 500 })
  }
}
