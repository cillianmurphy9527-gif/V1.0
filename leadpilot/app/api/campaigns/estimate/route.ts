import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/campaigns/estimate
 * 计算任务预估消耗的 Token 数
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
    const { targetCount, enableDeepAnalysis } = body

    if (!targetCount || targetCount < 1) {
      return NextResponse.json(
        { error: '目标数量必须大于 0' },
        { status: 400 }
      )
    }

    // 计算每个线索的 Token 消耗
    // 基础：100 tokens/线索
    // 深度分析：+50 tokens/线索
    const baseTokensPerLead = 100
    const deepAnalysisBonus = enableDeepAnalysis ? 50 : 0
    const tokensPerLead = baseTokensPerLead + deepAnalysisBonus

    // 总消耗
    const tokensRequired = targetCount * tokensPerLead

    // 检查余额是否充足
    const sufficient = user.tokenBalance >= tokensRequired

    return NextResponse.json({
      success: true,
      estimate: {
        targetCount,
        tokensPerLead,
        tokensRequired,
        currentBalance: user.tokenBalance,
        sufficient,
        message: sufficient
          ? `预估消耗 ${tokensRequired.toLocaleString()} tokens，您的余额充足`
          : `预估消耗 ${tokensRequired.toLocaleString()} tokens，余额不足 ${(tokensRequired - user.tokenBalance).toLocaleString()} tokens`
      }
    })
  } catch (error) {
    console.error('Estimate error:', error)
    return NextResponse.json(
      { error: '预估失败' },
      { status: 500 }
    )
  }
}
