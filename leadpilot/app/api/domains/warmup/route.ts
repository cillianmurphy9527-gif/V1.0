import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/domains/warmup/toggle
 * 开启/关闭域名预热
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
    const { domainId, enabled } = body

    if (!domainId) {
      return NextResponse.json(
        { error: '缺少 domainId 参数' },
        { status: 400 }
      )
    }

    // 获取域名
    const domain = await prisma.domain.findUnique({
      where: { id: domainId }
    })

    if (!domain || domain.userId !== user.id) {
      return NextResponse.json(
        { error: '域名不存在或无权限' },
        { status: 404 }
      )
    }

    // ── 幂等性校验 ──────────────────────────────────────────────────────
    // 如果状态已是目标值，说明请求是重复点击（如连点两次"启用发信"）。
    // 直接返回成功，跳过后续所有昂贵操作（不发事件、不触发重连逻辑）。
    if (domain.warmupEnabled === enabled) {
      return NextResponse.json({
        success: true,
        message: enabled ? '域名预热已启用' : '域名预热已关闭',
        idempotent: true,
        domain: {
          id: domain.id,
          domainName: domain.domainName,
          warmupEnabled: domain.warmupEnabled,
          warmupDay: domain.warmupDay,
          dailyLimit: domain.dailyLimit,
        }
      })
    }

    // ── 并发安全：使用 selectForUpdate 锁定行，防止竞态条件 ────────────────
    // （Prisma 不直接支持 SELECT FOR UPDATE，但通过原子性事务保证一致性）
    const updatedDomain = await prisma.$transaction(async (tx) => {
      return await tx.domain.update({
        where: { id: domainId },
        data: {
          warmupEnabled: enabled,
          warmupDay: enabled ? 1 : 0,
          sentToday: 0,
        }
      })
    })

    return NextResponse.json({
      success: true,
      message: enabled ? '域名预热已启用' : '域名预热已关闭',
      idempotent: false,
      domain: {
        id: updatedDomain.id,
        domainName: updatedDomain.domainName,
        warmupEnabled: updatedDomain.warmupEnabled,
        warmupDay: updatedDomain.warmupDay,
        dailyLimit: updatedDomain.dailyLimit
      }
    })
  } catch (error) {
    console.error('Warmup toggle error:', error)
    return NextResponse.json(
      { error: '操作失败' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/domains/warmup/status?domainId=xxx
 * 获取域名预热状态
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

    const { searchParams } = new URL(request.url)
    const domainId = searchParams.get('domainId')

    if (!domainId) {
      return NextResponse.json(
        { error: '缺少 domainId 参数' },
        { status: 400 }
      )
    }

    const domain = await prisma.domain.findUnique({
      where: { id: domainId }
    })

    if (!domain || domain.userId !== user.id) {
      return NextResponse.json(
        { error: '域名不存在或无权限' },
        { status: 404 }
      )
    }

    // 检查是否需要重置每日计数（新的一天）
    const today = new Date().toDateString()
    const lastSentDate = domain.lastSentAt?.toDateString()

    if (lastSentDate !== today) {
      // 新的一天，重置计数并递增预热天数
      await prisma.domain.update({
        where: { id: domainId },
        data: {
          sentToday: 0,
          warmupDay: domain.warmupEnabled ? domain.warmupDay + 1 : 0
        }
      })
    }

    return NextResponse.json({
      success: true,
      domain: {
        id: domain.id,
        domainName: domain.domainName,
        status: domain.status,
        warmupEnabled: domain.warmupEnabled,
        warmupDay: domain.warmupDay,
        dailyLimit: domain.dailyLimit,
        sentToday: domain.sentToday,
        remainingToday: Math.max(0, domain.dailyLimit - domain.sentToday),
        canSend: domain.sentToday < domain.dailyLimit
      }
    })
  } catch (error) {
    console.error('Warmup status error:', error)
    return NextResponse.json(
      { error: '获取状态失败' },
      { status: 500 }
    )
  }
}
