import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminRole } from '@/lib/admin-auth'

/**
 * POST /api/admin/users/upgrade-tier
 * 管理员手动调整用户 subscriptionTier
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminRole()
    if (!auth.ok) return auth.response

    const body = await request.json()
    const userId = String(body?.userId || '')
    const tier = String(body?.tier || '').toUpperCase()

    const allowed = new Set(['TRIAL', 'STARTER', 'PRO', 'MAX'])
    if (!userId || !allowed.has(tier)) {
      return NextResponse.json({ error: 'Invalid params' }, { status: 400 })
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { subscriptionTier: tier },
      select: { id: true, subscriptionTier: true },
    })

    return NextResponse.json({ success: true, user: updated })
  } catch (error: any) {
    console.error('[Admin UpgradeTier] Error:', error)
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}

