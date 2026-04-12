import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import { processKnowledgeBase } from '@/lib/rag.service'

/**
 * 上传知识库文件 API
 */
export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request as any, secret: process.env.NEXTAUTH_SECRET })

    // 必须有 email 才能做 upsert 兜底
    if (!token?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 上帝模式兜底：找不到用户就当场建一个，绝不返回 401
    const dbUser = await prisma.user.upsert({
      where: { email: token.email as string },
      update: {},
      create: {
        email:            token.email as string,
        phone:            (token.phone as string | undefined) ?? `auto_${Date.now()}`,
        companyName:      '待完善',
        subscriptionTier: 'TRIAL',
        features:         JSON.stringify({ canUseInbox: true, aiScoring: true }),
        role:             'USER',
      },
    })

    const formData = await request.formData()
    const file = formData.get('file') as File
    const fileType = formData.get('fileType') as string
    let sourceUrl = (formData.get('sourceUrl') as string | null) ?? ''

    if (!fileType || !['PDF', 'WORD', 'LINK'].includes(fileType)) {
      return NextResponse.json({ error: '文件类型无效' }, { status: 400 })
    }

    if (fileType === 'LINK') {
      if (!sourceUrl.trim()) {
        return NextResponse.json({ error: '链接地址不能为空' }, { status: 400 })
      }
      // 第三斧：后端强制补全 https:// 协议头
      if (!/^https?:\/\//i.test(sourceUrl.trim())) {
        sourceUrl = 'https://' + sourceUrl.trim()
      }
      // 第一刀：真实 URL 合法性验证（防止 https://baidu 这种假地址入库）
      try {
        const parsed = new URL(sourceUrl)
        if (!parsed.hostname.includes('.')) throw new Error('Invalid domain')
      } catch {
        return NextResponse.json(
          { error: '请输入包含域名的完整有效网址（如 baidu.com 或 www.example.com）' },
          { status: 400 }
        )
      }

      const kb = await prisma.knowledgeBase.create({
        data: {
          userId:      dbUser.id,
          name:        sourceUrl,
          fileType:    'LINK',
          sourceUrl,
          parseStatus: 'READY',
          chunkCount:  0,
          vectorizedAt: new Date(),
        },
      })

      return NextResponse.json({
        success: true,
        knowledgeBase: kb,
        message: '链接已添加，正在解析...',
      })
    }

    if (!file) {
      return NextResponse.json({ error: '文件不能为空' }, { status: 400 })
    }

    // 验证文件大小（最大 10MB）
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: '文件大小不能超过 10MB' }, { status: 400 })
    }

    // 读取文件二进制内容（在 formData 流关闭前必须先读取）
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // 获取文件后缀，用于选择解析器
    const fileExt = file.name.slice(file.name.lastIndexOf('.')).toLowerCase() || '.bin'

    // 先创建数据库记录，状态置为 PARSING（前端立刻可见进度条）
    const kb = await prisma.knowledgeBase.create({
      data: {
        userId:        dbUser.id,
        name:          file.name,
        fileType,
        parseStatus:   'PARSING',
        fileSizeBytes: file.size,
      },
    })

    // 异步触发 RAG 流水线（不阻塞本次 HTTP 响应）
    // processKnowledgeBase 内部会在完成后将状态更新为 READY 或 FAILED
    processKnowledgeBase(kb.id, buffer, fileExt).catch(err => {
      console.error('[upload] RAG 处理异常（兜底）:', err?.message)
    })

    return NextResponse.json({
      success: true,
      knowledgeBase: kb,
      message: '文件上传成功，正在解析中...',
    })
  } catch (error: any) {
    console.error('Failed to upload knowledge base:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * 获取知识库列表 API
 */
export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request as any, secret: process.env.NEXTAUTH_SECRET })
    if (!token?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 上帝模式兜底
    const dbUser = await prisma.user.upsert({
      where: { email: token.email as string },
      update: {},
      create: {
        email:            token.email as string,
        phone:            (token.phone as string | undefined) ?? `auto_${Date.now()}`,
        companyName:      '待完善',
        subscriptionTier: 'TRIAL',
        features:         JSON.stringify({ canUseInbox: true, aiScoring: true }),
        role:             'USER',
      },
    })

    const knowledgeBases = await prisma.knowledgeBase.findMany({
      where: { userId: dbUser.id },
      include: {
        chunks: {
          orderBy: { chunkIndex: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      knowledgeBases: knowledgeBases.map(kb => ({
        id: kb.id,
        name: kb.name,
        category: kb.fileType,
        status: kb.parseStatus,
        chunkCount: kb.chunkCount,
        fileSizeBytes: kb.fileSizeBytes,
        sourceUrl: kb.sourceUrl,
        vectorizedAt: kb.vectorizedAt?.toISOString(),
        chunks: kb.chunks.map(c => ({
          id: c.id,
          index: c.chunkIndex,
          content: c.content,
          tokenCount: c.tokenCount,
        })),
      })),
    })
  } catch (error: any) {
    console.error('Failed to fetch knowledge bases:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * 删除知识库 API
 */
export async function DELETE(request: NextRequest) {
  try {
    const token = await getToken({ req: request as any, secret: process.env.NEXTAUTH_SECRET })
    if (!token?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 上帝模式兜底
    const dbUser = await prisma.user.upsert({
      where: { email: token.email as string },
      update: {},
      create: {
        email:            token.email as string,
        phone:            (token.phone as string | undefined) ?? `auto_${Date.now()}`,
        companyName:      '待完善',
        subscriptionTier: 'TRIAL',
        features:         JSON.stringify({ canUseInbox: true, aiScoring: true }),
        role:             'USER',
      },
    })

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID不能为空' }, { status: 400 })
    }

    const kb = await prisma.knowledgeBase.findUnique({
      where: { id },
    })

    if (!kb) {
      return NextResponse.json({ error: '知识库不存在' }, { status: 404 })
    }

    if (kb.userId !== dbUser.id) {
      return NextResponse.json({ error: '无权删除此知识库' }, { status: 403 })
    }

    await prisma.knowledgeBase.delete({
      where: { id },
    })

    return NextResponse.json({
      success: true,
      message: '知识库已删除',
    })
  } catch (error: any) {
    console.error('Failed to delete knowledge base:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
