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
    
    // 类型断言：绕过 TypeScript 对 session 的严格类型检查
    const sessionUser = (auth.session as any)?.user
    if (!sessionUser?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const role = sessionUser.role
    if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { ticketId } = await ctx.params
    const body = await request.json()
    const content = String(body?.content || '').trim()
    if (!content) return NextResponse.json({ error: 'Content is required' }, { status: 400 })

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } })
    if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // 安全转换 messages 类型（JsonValue → string）
    const rawMessages = typeof ticket.messages === 'string' ? ticket.messages : JSON.stringify(ticket.messages || [])
    const messages = safeParseMessages(rawMessages)
    messages.push({ role: 'admin', content, createdAt: new Date().toISOString() })

    await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        adminId: sessionUser.id,
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