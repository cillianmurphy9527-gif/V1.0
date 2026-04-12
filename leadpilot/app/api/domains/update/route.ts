import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'

/**
 * PATCH /api/domains/update
 * - 支持更新 warmupEnabled / status（Active 开关）
 *
 * 说明：
 * - 前端“启用发信(Active)”会把 status 置为 ACTIVE；关闭则置为 PENDING_DNS（不引入新状态，保持兼容）
 */
export async function PATCH(request: NextRequest) {
  try {
    const token = await getToken({ req: request as any, secret: process.env.NEXTAUTH_SECRET })
    if (!token?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const domainId = String(body?.domainId || '').trim()
    const warmupEnabled = body?.warmupEnabled
    const active = body?.active

    if (!domainId) return NextResponse.json({ error: 'Missing domainId' }, { status: 400 })

    const domain = await prisma.domain.findUnique({ where: { id: domainId } })
    if (!domain || domain.userId !== (token.id as string)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const data: any = {}

    if (typeof warmupEnabled === 'boolean') {
      data.warmupEnabled = warmupEnabled
      data.warmupDay = warmupEnabled ? Math.max(1, domain.warmupDay || 0) : 0
      data.sentToday = 0
    }

    if (typeof active === 'boolean') {
      // 幂等性：若状态已是目标值，直接返回成功，不写数据库
      const currentActive = domain.status === 'ACTIVE'
      if (currentActive === active) {
        return NextResponse.json({
          success: true,
          idempotent: true,
          domain: {
            id: domain.id,
            domainName: domain.domainName,
            status: domain.status,
            warmupEnabled: domain.warmupEnabled,
            dailyLimit: domain.dailyLimit,
            sentToday: domain.sentToday,
            createdAt: domain.createdAt.toISOString(),
          },
        })
      }
      data.status = active ? 'ACTIVE' : 'PENDING_DNS'
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No updates' }, { status: 400 })
    }

    const updated = await prisma.domain.update({
      where: { id: domainId },
      data,
    })

    return NextResponse.json({
      success: true,
      domain: {
        id: updated.id,
        domainName: updated.domainName,
        status: updated.status,
        warmupEnabled: updated.warmupEnabled,
        dailyLimit: updated.dailyLimit,
        sentToday: updated.sentToday,
        createdAt: updated.createdAt.toISOString(),
      },
    })
  } catch (e) {
    console.error('[Domains Update] Error:', e)
    return NextResponse.json(
      { error: '操作失败，请稍后重试', code: 500 },
      { status: 500 }
    )
  }
}

