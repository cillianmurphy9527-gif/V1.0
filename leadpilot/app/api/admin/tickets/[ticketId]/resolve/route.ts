import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminRole } from '@/lib/admin-auth'

export async function POST(_request: NextRequest, ctx: { params: Promise<{ ticketId: string }> }) {
  try {
    const auth = await requireAdminRole()
    if (!auth.ok) return auth.response

    const sessionUser = (auth.session as any)?.user
    if (!sessionUser?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { ticketId } = await ctx.params
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { status: 'RESOLVED', resolvedAt: new Date(), adminId: sessionUser.id },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[Admin Ticket Resolve] Error:', error)
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}