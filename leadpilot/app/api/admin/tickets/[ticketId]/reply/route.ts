import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminRole } from '@/lib/admin-auth'

type TicketMessage = { role: 'user' | 'admin'; content: string; createdAt: string }

function safeParseMessages(raw: string | null | undefined): TicketMessage[] {
  if (!raw) return []
  try {
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ ticketId: string }> }) {
  try {
    const auth = await requireAdminRole()
    if (!auth.ok) return auth.response
    if (!auth.session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const role = auth.session.user.role
    if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { ticketId } = await ctx.params
    const body = await request.json()
    const content = String(body?.content || '').trim()
    if (!content) return NextResponse.json({ error: 'Content is required' }, { status: 400 })

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } })
    if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const messages = safeParseMessages(ticket.messages)
    messages.push({ role: 'admin', content, createdAt: new Date().toISOString() })

    await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        adminId: auth.session.user.id,
        messages: JSON.stringify(messages),
        status: 'IN_PROGRESS',
        updatedAt: new Date(),
      },
    })

    return NextResponse.json({ success: true, ticketId })
  } catch (error: any) {
    console.error('[Admin Ticket Reply] Error:', error)
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}

