import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminRole } from '@/lib/admin-auth'

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
    const auth = await requireAdminRole()
    if (!auth.ok) return auth.response

    const tickets = await prisma.ticket.findMany({
      include: { user: { select: { email: true, companyName: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    })

    return NextResponse.json({
      tickets: tickets.map(t => {
        // 安全转换 messages 类型（JsonValue → string）
        const rawMessages = typeof t.messages === 'string' ? t.messages : JSON.stringify(t.messages || [])
        const parsedMessages = safeParseMessages(rawMessages)

        return {
          id: t.id,
          userEmail: t.user?.email || '—',
          userCompanyName: t.user?.companyName || null,
          type: (t.type || 'GENERAL').toLowerCase(),
          subject: t.title,
          status: t.status === 'IN_PROGRESS' ? 'PENDING' : t.status,
          priority: t.priority,
          createdAt: t.createdAt.toLocaleString('zh-CN'),
          updatedAt: t.updatedAt.toLocaleString('zh-CN'),
          messages: parsedMessages.map((m, idx) => ({
            id: `${t.id}-${idx}`,
            from: m.role === 'admin' ? 'admin' : 'user',
            content: m.content,
            createdAt: m.createdAt || '',
          })),
        }
      }),
    })
  } catch (error: any) {
    console.error('[Admin Tickets List] Error:', error)
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}