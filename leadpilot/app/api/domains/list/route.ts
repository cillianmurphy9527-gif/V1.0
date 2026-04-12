import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request as any, secret: process.env.NEXTAUTH_SECRET })
    if (!token?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const domains = await prisma.domain.findMany({
      where: { userId: token.id as string },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      domains: domains.map(d => ({
        id: d.id,
        domainName: d.domainName,
        status: d.status,
        warmupEnabled: d.warmupEnabled,
        warmupDay: d.warmupDay,
        warmupScore: d.warmupScore,
        isReady: d.isReady,
        dailyLimit: d.dailyLimit,
        sentToday: d.sentToday,
        createdAt: d.createdAt.toISOString(),
      })),
    })
  } catch (error: any) {
    console.error('[Domains List] Error:', error)
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}

