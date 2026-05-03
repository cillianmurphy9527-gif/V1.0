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

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const tickets = await prisma.ticket.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        type: true,
        status: true,
        priority: true,
        messages: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({
      tickets: tickets.map(t => {
        // 安全转换 JsonValue 为 string
        const rawMessages = typeof t.messages === 'string' ? t.messages : JSON.stringify(t.messages || [])
        return {
          id: t.id,
          title: t.title,
          type: t.type,
          status: t.status,
          priority: t.priority,
          createdAt: t.createdAt.toISOString(),
          updatedAt: t.updatedAt.toISOString(),
          messages: safeParseMessages(rawMessages),
        }
      }),
    })
  } catch (error) {
    console.error('[Tickets] Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { title, type, message } = body

    if (!title || !type || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const ticket = await prisma.ticket.create({
      data: {
        userId: session.user.id,
        title,
        type,
        status: 'OPEN',
        priority: 'NORMAL',
        messages: JSON.stringify([{
          role: 'user',
          content: message,
          createdAt: new Date().toISOString()
        }]),
      },
    })

    const rawMessages = typeof ticket.messages === 'string' ? ticket.messages : JSON.stringify(ticket.messages || [])
    return NextResponse.json({
      success: true,
      ticket: {
        id: ticket.id,
        title: ticket.title,
        type: ticket.type,
        status: ticket.status,
        priority: ticket.priority,
        createdAt: ticket.createdAt.toISOString(),
        updatedAt: ticket.updatedAt.toISOString(),
        messages: safeParseMessages(rawMessages),
      },
    })
  } catch (error) {
    console.error('[Tickets] Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}