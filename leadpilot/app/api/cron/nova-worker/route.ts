/**
 * API: Nova Worker Cron 触发器
 *
 * GET /api/cron/nova-worker
 *
 * 功能：
 * 1. 被定时任务调用（如 Vercel Cron）
 * 2. 触发 Worker 处理待执行的 Nova 任务
 * 3. 返回处理结果
 *
 * 配置示例 (vercel.json): 见 vercel.json
 */

import { NextRequest, NextResponse } from 'next/server'
import { runOnce } from '@/lib/nova/worker'

// 简单的密钥验证（防止被恶意调用）
const CRON_SECRET = process.env.CRON_SECRET

export async function GET(request: NextRequest) {
  try {
    // ─── 1. Cron 密钥验证 ─────────────────────────────────
    const authHeader = request.headers.get('authorization')
    
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // ─── 2. 触发 Worker ───────────────────────────────────
    const startTime = Date.now()
    const result = await runOnce()
    const duration = Date.now() - startTime

    // ─── 3. 返回结果 ───────────────────────────────────────
    return NextResponse.json({
      success: true,
      processed: result.processed,
      errors: result.errors,
      durationMs: duration,
      timestamp: new Date().toISOString(),
    })

  } catch (error) {
    console.error('[NovaCron] Error:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Internal Server Error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
