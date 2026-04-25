import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { LLMService } from '@/lib/services/LLMService'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const question = String(body?.question || '').trim()
    if (!question) return NextResponse.json({ error: '请输入问题' }, { status: 400 })

    const contextPieces: string[] = []

    // 🌟 核心修复：只查 parseStatus，去掉不存在的 status 字段！
    try {
      const kb = await prisma.knowledgeBase.findMany({
        where: { 
          userId: session.user.id,
          parseStatus: 'READY' // ⬅️ 错误就是在这里解决的，就留这一行
        },
        orderBy: { updatedAt: 'desc' },
        take: 3,
        include: { chunks: { select: { content: true } } }
      })

      kb.forEach(doc => {
        const content = (doc as any).chunks?.map((c: any) => c.content).join('\n')
        if (content) contextPieces.push(`文档《${doc.name}》内容：\n${content}`)
      })
    } catch (kbError: any) {
       console.error('❌ [KB QA] 查询知识库失败:', kbError)
       return NextResponse.json({ error: '查询知识库时数据库发生错误' }, { status: 500 })
    }

    if (contextPieces.length === 0) {
      return NextResponse.json({ error: '知识库还没准备好，或者没有找到相关文档，请先上传并等待解析完成' }, { status: 400 })
    }

    // 调用大模型
    console.log('[KB QA] 准备调用大模型...');
    const answer = await LLMService.answerWithContext(question, contextPieces.join('\n\n---\n\n'))

    return NextResponse.json({ success: true, answer })
  } catch (error: any) {
    console.error('[KB QA] 顶级接口 CRASH:', error)
    return NextResponse.json({ error: '系统内部错误，请检查终端日志' }, { status: 500 })
  }
}