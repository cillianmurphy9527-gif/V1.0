import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { ticketId } = await ctx.params
    const body = await request.json()
    const content = String(body?.content || '').trim()
    if (!content) return NextResponse.json({ error: 'Content is required' }, { status: 400 })

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } })
    if (!ticket || ticket.userId !== session.user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const messages = safeParseMessages(ticket.messages)
    messages.push({ role: 'user', content, createdAt: new Date().toISOString() })

    const updated = await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        messages: JSON.stringify(messages),
        status: ticket.status === 'RESOLVED' ? 'OPEN' : ticket.status,
        updatedAt: new Date(),
      },
      select: { id: true, updatedAt: true },
    })

    return NextResponse.json({ success: true, ticketId: updated.id })
  } catch (error: any) {
    console.error('[Tickets Message] Error:', error)
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}

