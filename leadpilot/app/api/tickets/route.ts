import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type TicketMessage = { role: 'user' | 'admin'; content: string; createdAt: string }

function safeParseMessages(raw: string | null | undefined): TicketMessage[] {
  if (!raw) return []
  try {
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return []
    return (arr as any[])
      .map((m: any): TicketMessage => ({
        role: m?.role === 'admin' ? 'admin' : 'user',
        content: String(m?.content ?? ''),
        createdAt: String(m?.createdAt ?? ''),
      }))
      .filter(m => m.content)
  } catch {
    return []
  }
}

export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const userId = session.user.id
    const tickets = await prisma.ticket.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    })

    return NextResponse.json({
      tickets: tickets.map(t => ({
        id: t.id,
        title: t.title,
        type: t.type,
        status: t.status,
        priority: t.priority,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
        messages: safeParseMessages(t.messages),
      })),
    })
  } catch (error: any) {
    console.error('[Tickets GET] Error:', error)
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const title = String(body?.title || '').trim()
    const type = String(body?.type || 'GENERAL').trim().toUpperCase()
    const content = String(body?.content || '').trim()
    const priority = String(body?.priority || 'NORMAL').trim().toUpperCase()

    if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 })

    const now = new Date().toISOString()
    const messages: TicketMessage[] = content ? [{ role: 'user', content, createdAt: now }] : []

    const ticket = await prisma.ticket.create({
      data: {
        userId: session.user.id,
        title,
        type,
        status: 'OPEN',
        priority,
        messages: JSON.stringify(messages),
      },
    })

    return NextResponse.json({ success: true, ticketId: ticket.id })
  } catch (error: any) {
    console.error('[Tickets POST] Error:', error)
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}

