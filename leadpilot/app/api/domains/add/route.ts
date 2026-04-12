import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request as any, secret: process.env.NEXTAUTH_SECRET })
    if (!token?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const domainName = String(body?.domainName || '').trim().toLowerCase()
    const warmupEnabled = Boolean(body?.warmupEnabled)

    if (!domainName || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domainName)) {
      return NextResponse.json({ error: 'Invalid domainName' }, { status: 400 })
    }

    const created = await prisma.domain.create({
      data: {
        userId: token.id as string,
        domainName,
        status: 'PENDING_DNS',
        warmupEnabled,
      },
      select: { id: true },
    })

    return NextResponse.json({ success: true, id: created.id })
  } catch (error: any) {
    console.error('[Domains Add] Error:', error)
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}

