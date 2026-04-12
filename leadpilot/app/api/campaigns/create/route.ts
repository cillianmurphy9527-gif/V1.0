import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/campaigns/create
 * 创建一个新的 Campaign（不启动、不扣费）
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const name = String(body?.name || 'Nova 任务').trim()
    const systemPrompt = String(body?.systemPrompt || '').trim()

    if (!systemPrompt) {
      return NextResponse.json({ error: 'systemPrompt is required' }, { status: 400 })
    }

    const campaign = await prisma.campaign.create({
      data: {
        userId: session.user.id,
        name,
        systemPrompt,
        status: 'IDLE',
        tokensPerLead: 100,
      },
      select: { id: true, name: true, status: true, createdAt: true },
    })

    return NextResponse.json({ success: true, campaign })
  } catch (error: any) {
    console.error('[Campaign Create] Error:', error)
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}

