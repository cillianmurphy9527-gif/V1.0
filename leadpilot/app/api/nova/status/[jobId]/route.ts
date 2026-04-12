/**
 * API: Nova 任务状态轮询接口
 * 
 * GET /api/nova/status/[jobId]
 * 
 * 功能：
 * 1. 返回任务的实时状态和进度
 * 2. 返回最新的日志条目
 * 3. 支持前端轮询
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface RouteParams {
  params: Promise<{ jobId: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // ─── 1. 鉴权 ───────────────────────────────────────────
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      )
    }

    const userId = session.user.id
    const { jobId } = await params

    // ─── 2. 获取任务状态 ──────────────────────────────────
    const job = await prisma.novaJob.findFirst({
      where: {
        id: jobId,
        userId, // 确保用户只能查看自己的任务
      },
      select: {
        id: true,
        status: true,
        jobType: true,
        totalTargets: true,
        currentProgress: true,
        leadsFound: true,
        leadsSaved: true,
        errorMessage: true,
        logs: true,
        startedAt: true,
        completedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!job) {
      return NextResponse.json(
        { error: '任务不存在或无权限访问', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }

    // ─── 3. 解析日志 ───────────────────────────────────────
    let logs: Array<{
      timestamp: string
      level: string
      message: string
      details?: Record<string, unknown>
    }> = []

    try {
      logs = JSON.parse(job.logs || '[]')
    } catch {
      logs = []
    }

    // ─── 4. 计算预估剩余时间 ───────────────────────────────
    let estimatedRemainingSeconds: number | null = null
    
    if (job.status === 'RUNNING' && job.currentProgress > 0) {
      const elapsedMs = job.startedAt
        ? new Date().getTime() - new Date(job.startedAt).getTime()
        : 0
      const progressPerMs = job.currentProgress / 100 / elapsedMs
      const remainingProgress = 100 - job.currentProgress
      estimatedRemainingSeconds = Math.round(remainingProgress / 100 / progressPerMs / 1000)
    }

    // ─── 5. 返回状态 ───────────────────────────────────────
    return NextResponse.json({
      jobId: job.id,
      status: job.status,
      jobType: job.jobType,
      totalTargets: job.totalTargets,
      currentProgress: job.currentProgress,
      leadsFound: job.leadsFound,
      leadsSaved: job.leadsSaved,
      errorMessage: job.errorMessage,
      logs: logs.slice(-20), // 只返回最近 20 条日志
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      createdAt: job.createdAt,
      estimatedRemainingSeconds,
      isComplete: job.status === 'COMPLETED' || job.status === 'FAILED' || job.status === 'STOPPED',
    })

  } catch (error) {
    console.error('[NovaStatus] Error:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
