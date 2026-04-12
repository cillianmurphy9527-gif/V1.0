/**
 * API: Nova 任务启动接口
 * 
 * POST /api/nova/launch
 * 
 * 功能：
 * 1. 接收前端 Payload（目标人群、目标数量、知识库）
 * 2. 在 nova_jobs 表创建新记录
 * 3. 立即返回 jobId（绝不阻塞）
 * 
 * 前端应该：
 * 1. 获取 jobId 后立即显示"任务已启动"
 * 2. 使用 jobId 轮询 /api/nova/status/[jobId] 获取进度
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getQuotaStatus } from '@/lib/services/quota'

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
    const {
      targetAudience,
      targetCount = 50,
      knowledgeBaseIds = [],
    } = body

    // 参数校验
    if (!targetAudience) {
      return NextResponse.json(
        { error: 'targetAudience is required' },
        { status: 400 }
      )
    }

    if (typeof targetCount !== 'number' || targetCount < 1 || targetCount > 5000) {
      return NextResponse.json(
        { error: 'targetCount must be between 1 and 5000' },
        { status: 400 }
      )
    }

    // ─── 3. 核验用户配额 ────────────────────────────────────
    const quotaStatus = await getQuotaStatus(userId)
    
    if (quotaStatus.leadsBalance < targetCount) {
      return NextResponse.json(
        {
          error: '线索余额不足',
          code: 'INSUFFICIENT_QUOTA',
          required: targetCount,
          current: quotaStatus.leadsBalance,
          upgrade: true,
        },
        { status: 403 }
      )
    }

    // ─── 4. 解析目标人群配置 ────────────────────────────────
    const audienceConfig = {
      country: targetAudience.country || 'CN',
      industry: targetAudience.industry || 'Technology',
      keywords: targetAudience.keywords || [],
    }

    // ─── 5. 创建 Nova 任务记录 ──────────────────────────────
    const novaJob = await prisma.novaJob.create({
      data: {
        userId,
        jobType: 'SEARCH', // SEARCH | ENRICH | VALIDATE
        status: 'PENDING',
        totalTargets: targetCount,
        currentProgress: 0,
        leadsFound: 0,
        leadsSaved: 0,
        logs: JSON.stringify([{
          timestamp: new Date().toISOString(),
          level: 'INFO',
          message: '任务已创建，等待后台处理',
          details: {
            targetCount,
            audienceConfig,
            knowledgeBaseIds,
          },
        }]),
      },
    })

    // ─── 6. 【关键】立即返回 jobId ─────────────────────────
    // 绝不等待任务执行完成
    return NextResponse.json({
      success: true,
      jobId: novaJob.id,
      status: novaJob.status,
      totalTargets: novaJob.totalTargets,
      message: '任务已启动，后台处理中',
      // 返回轮询建议
      pollUrl: `/api/nova/status/${novaJob.id}`,
      pollInterval: 5000, // 建议 5 秒轮询一次
    })

  } catch (error) {
    console.error('[NovaLaunch] Error:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
