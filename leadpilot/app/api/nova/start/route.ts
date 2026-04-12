/**
 * POST /api/nova/start
 * 将 Dashboard 战术配置写入 NovaTask，并入队 Redis（nova_tasks_queue）供异步消费。
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getRedis } from '@/lib/redis'

export const runtime = 'nodejs'

const QUEUE_KEY = 'nova_tasks_queue'

function joinList(arr: unknown, single: unknown, fallback: string): string {
  if (Array.isArray(arr) && arr.length > 0) {
    return arr.map((x) => String(x).trim()).filter(Boolean).join(', ')
  }
  if (typeof single === 'string' && single.trim()) return single.trim()
  return fallback
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))

    const targetCountry = joinList(
      body.targetRegions,
      body.targetCountry,
      '未指定'
    )
    const targetIndustry = joinList(
      body.targetIndustries,
      body.targetIndustry,
      '未指定'
    )
    const decisionMaker = joinList(
      body.targetPersonas,
      body.decisionMaker,
      '未指定'
    )
    const pitch =
      typeof body.pitch === 'string'
        ? body.pitch.trim()
        : typeof body.systemPrompt === 'string'
          ? body.systemPrompt.trim()
          : ''

    if (!pitch) {
      return NextResponse.json(
        { error: 'pitch / systemPrompt 不能为空' },
        { status: 400 }
      )
    }

    const task = await prisma.novaTask.create({
      data: {
        userId: session.user.id,
        targetCountry,
        targetIndustry,
        decisionMaker,
        pitch,
      },
    })

    const redis = getRedis()
    if (redis) {
      try {
        await redis.lpush(QUEUE_KEY, task.id)
      } catch (e) {
        console.error('[nova/start] Redis LPUSH failed:', e)
      }
    } else {
      console.warn('[nova/start] Redis 未配置，任务已入库但未入队')
    }

    return NextResponse.json({
      success: true,
      task: {
        id: task.id,
        userId: task.userId,
        targetCountry: task.targetCountry,
        targetIndustry: task.targetIndustry,
        decisionMaker: task.decisionMaker,
        pitch: task.pitch,
        status: task.status,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
      },
      queued: Boolean(redis),
    })
  } catch (error) {
    console.error('[nova/start]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
