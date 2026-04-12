import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminRole } from '@/lib/admin-auth'

/**
 * POST /api/admin/users/suspend-sending
 * 管理员将用户发信能力置为暂停（不改 Prisma 结构）
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminRole()
    if (!auth.ok) return auth.response

    const body = await request.json()
    const userId = String(body?.userId || '')
    const suspended = Boolean(body?.suspended)

    if (!userId) {
      return NextResponse.json({ error: 'Invalid params' }, { status: 400 })
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { isSendingSuspended: suspended },
      select: { id: true, isSendingSuspended: true },
    })

    return NextResponse.json({ success: true, user: updated })
  } catch (error: any) {
    console.error('[Admin SuspendSending] Error:', error)
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}

