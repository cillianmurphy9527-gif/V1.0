/**
 * API: Nova 任务控制接口
 * 
 * POST /api/nova/control
 * 
 * 功能：
 * 1. 暂停任务 (pause)
 * 2. 恢复任务 (resume)
 * 3. 停止任务 (stop)
 * 
 * 用于前端用户手动控制任务状态
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createLog } from '@/lib/nova/anti-detection'

export async function POST(request: NextRequest) {
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

    // ─── 2. 解析请求体 ─────────────────────────────────────
    const body = await request.json()
    const { jobId, action } = body

    if (!jobId || !action) {
      return NextResponse.json(
        { error: 'jobId and action are required' },
        { status: 400 }
      )
    }

    if (!['pause', 'resume', 'stop'].includes(action)) {
      return NextResponse.json(
        { error: 'action must be one of: pause, resume, stop' },
        { status: 400 }
      )
    }

    // ─── 3. 获取任务并校验权限 ─────────────────────────────
    const job = await prisma.novaJob.findFirst({
      where: { id: jobId, userId },
      select: { id: true, status: true, userId: true, logs: true },
    })

    if (!job) {
      return NextResponse.json(
        { error: '任务不存在或无权限访问', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }

    // ─── 4. 执行状态转换 ──────────────────────────────────
    let newStatus: string
    let logMessage: string

    switch (action) {
      case 'pause':
        if (job.status !== 'RUNNING' && job.status !== 'PENDING') {
          return NextResponse.json(
            { error: '当前状态不允许暂停', code: 'INVALID_STATE' },
            { status: 409 }
          )
        }
        newStatus = 'PAUSED'
        logMessage = '用户手动暂停任务'
        break

      case 'resume':
        if (job.status !== 'PAUSED') {
          return NextResponse.json(
            { error: '当前状态不允许恢复', code: 'INVALID_STATE' },
            { status: 409 }
          )
        }
        newStatus = 'PENDING'
        logMessage = '用户恢复任务，重新加入队列'
        break

      case 'stop':
        if (job.status === 'COMPLETED' || job.status === 'FAILED' || job.status === 'STOPPED') {
          return NextResponse.json(
            { error: '任务已结束，无法停止', code: 'ALREADY_FINISHED' },
            { status: 409 }
          )
        }
        newStatus = 'STOPPED'
        logMessage = '用户手动停止任务'
        break

      default:
        return NextResponse.json(
          { error: 'Unknown action' },
          { status: 400 }
        )
    }

    // ─── 5. 更新日志 ──────────────────────────────────────
    const logs = JSON.parse(job.logs || '[]')
    logs.push(createLog('INFO', logMessage))
    const trimmedLogs = logs.slice(-500)

    // ─── 6. 更新任务状态 ──────────────────────────────────
    await prisma.novaJob.update({
      where: { id: jobId },
      data: {
        status: newStatus,
        logs: JSON.stringify(trimmedLogs),
        ...(newStatus === 'STOPPED' ? { completedAt: new Date() } : {}),
      },
    })

    return NextResponse.json({
      success: true,
      jobId,
      previousStatus: job.status,
      newStatus,
      message: `任务已${action === 'pause' ? '暂停' : action === 'resume' ? '恢复' : '停止'}`,
    })

  } catch (error) {
    console.error('[NovaControl] Error:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
