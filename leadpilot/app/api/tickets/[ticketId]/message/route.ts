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

export async function POST(
  request: NextRequest,
  { params }: { params: { ticketId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { ticketId } = params
    const body = await request.json()
    const content = String(body?.content || '').trim()
    if (!content) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 })
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId }
    })
    if (!ticket) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // 安全转换 JsonValue 为 string
    const rawMessages = typeof ticket.messages === 'string' ? ticket.messages : JSON.stringify(ticket.messages || [])
    const messages = safeParseMessages(rawMessages)
    messages.push({ role: 'user', content, createdAt: new Date().toISOString() })

    await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        messages: JSON.stringify(messages),
        status: 'OPEN',
        updatedAt: new Date(),
      },
    })

    return NextResponse.json({ success: true, ticketId })
  } catch (error: any) {
    console.error('[Ticket Message] Error:', error)
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}