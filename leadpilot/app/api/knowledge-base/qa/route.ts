import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { llmService } from '@/services/LLMService'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const question = String(body?.question || '').trim()
    if (!question) return NextResponse.json({ error: 'Question is required' }, { status: 400 })

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { ragContext: true },
    })

    const kb = await prisma.knowledgeBase.findMany({
      where: { userId: session.user.id, parseStatus: 'READY' },
      orderBy: { updatedAt: 'desc' },
      take: 3,
      include: {
        chunks: {
          orderBy: { chunkIndex: 'asc' },
          take: 20,
          select: { content: true },
        },
      },
    })

    const contextPieces: string[] = []
    if (user?.ragContext) contextPieces.push(`用户业务背景：\n${user.ragContext}`)
    for (const doc of kb) {
      const joined = (doc.chunks || []).map(c => c.content).filter(Boolean).join('\n')
      if (joined) contextPieces.push(`文档《${doc.name}》摘要：\n${joined}`)
    }

    if (contextPieces.length === 0) {
      return NextResponse.json({ error: '知识库为空，无法问答' }, { status: 400 })
    }

    const answer = await llmService.answerWithContext(question, contextPieces.join('\n\n---\n\n'))

    return NextResponse.json({ success: true, answer })
  } catch (error: any) {
    console.error('[KB QA] Error:', error)
    const msg = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

