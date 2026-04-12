import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/tokens/deduct
 * 原子级别的 Token 扣减 - 防穿透
 * 用于 AI 功能、邮件发送等消耗 Token 的操作
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
    const { amount, reason, campaignId } = body

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: '扣减数量必须大于 0' },
        { status: 400 }
      )
    }

    // 检查余额是否充足
    if (user.tokenBalance < amount) {
      return NextResponse.json(
        {
          error: '余额不足',
          required: amount,
          current: user.tokenBalance,
          shortage: amount - user.tokenBalance
        },
        { status: 402 }
      )
    }

    // 原子级别的扣费操作
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        tokenBalance: {
          decrement: amount
        }
      }
    })

    // 记录交易
    await prisma.tokenTransaction.create({
      data: {
        userId: user.id,
        campaignId: campaignId || null,
        amount: -amount,
        reason: reason || 'AI_USAGE',
        balanceBefore: user.tokenBalance,
        balanceAfter: updatedUser.tokenBalance,
        status: 'COMPLETED'
      }
    })

    // 如果余额耗尽，自动暂停所有运行中的活动
    if (updatedUser.tokenBalance <= 0) {
      // 查找所有运行中的活动
      const runningCampaigns = await prisma.campaign.findMany({
        where: {
          userId: user.id,
          status: 'RUNNING'
        }
      })

      // 暂停所有运行中的活动
      for (const campaign of runningCampaigns) {
        await prisma.campaign.update({
          where: { id: campaign.id },
          data: { status: 'PAUSED_OUT_OF_CREDITS' }
        })

        // 更新会话状态
        await prisma.agentSession.update({
          where: { campaignId: campaign.id },
          data: {
            status: 'PAUSED',
            pausedAt: new Date(),
            errorMessage: '余额不足，已自动暂停'
          }
        })
      }

      // 发送站内信通知用户充值
      await prisma.systemNotification.create({
        data: {
          userId: user.id,
          title: '⚠️ 余额不足，Agent 已暂停',
          content: '您的算力余额已耗尽，所有运行中的 Agent 任务已自动暂停。请立即充值以继续使用。',
          type: 'SYSTEM',
          actionUrl: '/billing'
        }
      })
    }

    return NextResponse.json({
      success: true,
      message: '扣费成功',
      newBalance: updatedUser.tokenBalance,
      transaction: {
        amount,
        reason,
        balanceBefore: user.tokenBalance,
        balanceAfter: updatedUser.tokenBalance
      },
      paused: updatedUser.tokenBalance <= 0
    })
  } catch (error) {
    console.error('Token deduction error:', error)
    return NextResponse.json(
      { error: '扣费失败' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/tokens/balance
 * 获取当前 Token 余额
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

    // 获取最近的交易记录
    const recentTransactions = await prisma.tokenTransaction.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 10
    })

    return NextResponse.json({
      success: true,
      balance: user.tokenBalance,
      recentTransactions: recentTransactions.map(t => ({
        id: t.id,
        amount: t.amount,
        reason: t.reason,
        balanceAfter: t.balanceAfter,
        createdAt: t.createdAt.toISOString()
      }))
    })
  } catch (error) {
    console.error('Get balance error:', error)
    return NextResponse.json(
      { error: '获取余额失败' },
      { status: 500 }
    )
  }
}
