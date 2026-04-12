/**
 * API: 数据清理定时触发端点
 *
 * 用法：
 * 1. 配置 Vercel Cron / 外部定时任务每天凌晨调用
 *    POST /api/cleanup  Header: { Authorization: Bearer CLEANUP_SECRET }
 *
 * 2. 管理后台手动触发单用户清理：
 *    POST /api/cleanup  Body: { userId: "xxx" }  （需 ADMIN 角色）
 *
 * 安全：通过 CLEANUP_SECRET 环境变量验证调用方身份
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { runCleanup, cleanupUser } from '@/services/CleanupService'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { userId } = body

    // ─── 认证模式 A：Cron Secret（无 Session 的定时任务）────
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CLEANUP_SECRET
    const isCronCall = cronSecret && authHeader === `Bearer ${cronSecret}`

    if (!isCronCall) {
      // ─── 认证模式 B：管理员 Session（后台手动触发）────────
      const session = await getServerSession(authOptions)
      if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      // 仅 ADMIN 角色可访问
      const { prisma } = await import('@/lib/prisma')
      const admin = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true },
      })
      if (admin?.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Forbidden: Admin only' }, { status: 403 })
      }
    }

    // ─── 执行清理 ────────────────────────────────────────────
    if (userId && typeof userId === 'string') {
      // 单用户清理
      const stats = await cleanupUser(userId)
      return NextResponse.json({ success: true, mode: 'single_user', userId, stats })
    } else {
      // 全量清理
      const stats = await runCleanup()
      return NextResponse.json({ success: true, mode: 'full_cleanup', stats })
    }
  } catch (error) {
    console.error('[CleanupAPI] Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// GET：健康检查，返回保留策略说明
export async function GET() {
  return NextResponse.json({
    service: 'CleanupService',
    retentionPolicy: {
      STARTER: '7 天',
      PRO: '90 天',
      MAX: '永久保留',
      TRIAL: '7 天',
    },
    trigger: 'POST /api/cleanup with Authorization: Bearer CLEANUP_SECRET',
  })
}
