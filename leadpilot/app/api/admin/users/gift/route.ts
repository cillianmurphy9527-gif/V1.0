import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminRole } from '@/lib/admin-auth'

/**
 * POST /api/admin/users/gift
 * 管理员手动赠送用户 tokenBalance（算力）
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminRole()
    if (!auth.ok) return auth.response

    const body = await request.json()
    const userId = String(body?.userId || '')
    const amount = Number(body?.amount)

    if (!userId || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Invalid params' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, tokenBalance: true },
    })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { tokenBalance: { increment: Math.floor(amount) } },
      select: { id: true, tokenBalance: true },
    })

    await prisma.tokenTransaction.create({
      data: {
        userId,
        amount: Math.floor(amount),
        reason: 'ADMIN_GIFT',
        balanceBefore: user.tokenBalance,
        balanceAfter: updated.tokenBalance,
        status: 'COMPLETED',
      },
    })

    return NextResponse.json({ success: true, user: updated })
  } catch (error: any) {
    console.error('[Admin Gift] Error:', error)
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}

