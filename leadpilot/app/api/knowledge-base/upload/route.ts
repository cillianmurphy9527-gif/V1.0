import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import { processKnowledgeBase } from '@/lib/rag.service'

/**
 * 🕸️ 双重容灾网页爬虫（Jina 破壁 + 本地原生兜底 + 终极防乱码扫描仪）
 */
async function processWebLink(kbId: string, url: string) {
  try {
    console.log(`[Web Crawler] 🚀 开始抓取网页: ${url}`)
    let textContent = ''

    // 方案 A：先尝试 Jina AI 穿透抓取
    try {
      console.log(`[Web Crawler] 尝试使用 Jina API...`)
      const jinaUrl = `https://r.jina.ai/${url}`
      const res = await fetch(jinaUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        signal: AbortSignal.timeout(10000)
      })
      if (!res.ok) throw new Error(`Jina 响应异常: ${res.status}`)
      textContent = await res.text()
    } catch (jinaErr: any) {
      // 方案 B：本地原生兜底爬虫
      console.warn(`⚠️ [Web Crawler] Jina 穿透失败 (${jinaErr.message})，启动本地原生兜底抓取...`)
      
      const nativeRes = await fetch(url, {
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
        },
        signal: AbortSignal.timeout(10000)
      })
      
      if (!nativeRes.ok) throw new Error(`目标网站直接拒绝访问: ${nativeRes.status}`)

      // 🚨 防线 1：拦截非文本的二进制流数据
      const contentType = nativeRes.headers.get('content-type') || '';
      if (!contentType.includes('text/') && !contentType.includes('application/json')) {
         throw new Error(`网站返回了非文本格式 (${contentType})，防污染已拦截`);
      }

      // 强制用 UTF-8 解码，防止乱码
      const arrayBuffer = await nativeRes.arrayBuffer();
      const decoder = new TextDecoder('utf-8');
      const html = decoder.decode(arrayBuffer);
      
      // 暴力清洗 HTML
      textContent = html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    }

    if (!textContent || textContent.length < 10) {
      throw new Error('网页内容为空，或遭遇终极反爬拦截')
    }

    // 🚨 防线 2：终极纯净度扫描仪
    // 统计文本中正常字符（汉字、字母、数字、常用标点符号）的数量
    const validCharMatch = textContent.match(/[\u4e00-\u9fa5a-zA-Z0-9\s.,!?'"()\[\]{}。，！？、；：“”‘’（）《》【】\-\+\=\%\@\#\&\*\/]/g);
    const validCharCount = validCharMatch ? validCharMatch.length : 0;
    const validRatio = validCharCount / textContent.length;

    // 如果正常人类可读字符的比例连 70% 都不到，说明绝对抓到了百度的加密乱码，直接熔断！
    if (validRatio < 0.7) {
      throw new Error(`触发防乱码装甲！正常文本比例仅为 ${(validRatio*100).toFixed(1)}%，已阻断污染数据入库。`);
    }

    // 文本切片
    const chunkSize = 500
    const chunkData = []
    for (let i = 0; i < textContent.length; i += chunkSize) {
      chunkData.push({
        content: textContent.slice(i, i + chunkSize),
        chunkIndex: Math.floor(i / chunkSize),
        tokenCount: Math.ceil(chunkSize / 4), 
      })
    }

    // 存入数据库
    await prisma.knowledgeBase.update({
      where: { id: kbId },
      data: {
        parseStatus: 'READY',
        chunkCount: chunkData.length,
        chunks: {
          create: chunkData
        }
      }
    })
    console.log(`[Web Crawler] ✅ 抓取大功告成: ${url}, 成功切分 ${chunkData.length} 块。`)

  } catch (err: any) {
    console.error(`❌ [Web Crawler] 抓取彻底失败 ${url}:`, err.message)
    await prisma.knowledgeBase.update({
      where: { id: kbId },
      data: { parseStatus: 'FAILED' }
    }).catch(() => {})
  }
}

/**
 * ⬆️ 上传知识库文件 API
 */
export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request as any, secret: process.env.NEXTAUTH_SECRET })
    if (!token?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
    const file = formData.get('file') as File | null
    const fileType = formData.get('fileType') as string
    let sourceUrl = (formData.get('sourceUrl') as string | null) ?? ''

    if (!fileType || !['PDF', 'WORD', 'LINK'].includes(fileType)) {
      return NextResponse.json({ error: '文件类型无效' }, { status: 400 })
    }

    if (fileType === 'LINK') {
      if (!sourceUrl.trim()) return NextResponse.json({ error: '链接地址不能为空' }, { status: 400 })
      if (!/^https?:\/\//i.test(sourceUrl.trim())) sourceUrl = 'https://' + sourceUrl.trim()
      
      try {
        const parsed = new URL(sourceUrl)
        if (!parsed.hostname.includes('.')) throw new Error('Invalid domain')
      } catch {
        return NextResponse.json({ error: '请输入包含域名的完整有效网址' }, { status: 400 })
      }

      const kb = await prisma.knowledgeBase.create({
        data: {
          userId:      dbUser.id,
          name:        sourceUrl,
          fileType:    'LINK',
          sourceUrl,
          parseStatus: 'PARSING', 
          chunkCount:  0,
        },
      })

      // 后台静默抓取
      processWebLink(kb.id, sourceUrl).catch(console.error)

      return NextResponse.json({
        success: true,
        knowledgeBase: kb,
        message: '链接已加入后台抓取队列！',
      })
    }

    if (!file) return NextResponse.json({ error: '文件不能为空' }, { status: 400 })
    if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: '文件大小不能超过 10MB' }, { status: 400 })

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const fileExt = file.name.slice(file.name.lastIndexOf('.')).toLowerCase() || '.bin'

    const kb = await prisma.knowledgeBase.create({
      data: {
        userId:        dbUser.id,
        name:          file.name,
        fileType,
        parseStatus:   'PARSING',
        fileSizeBytes: file.size,
      },
    })

    // 后台静默处理
    processKnowledgeBase(kb.id, buffer, fileExt).catch(err => {
      console.error('[upload] RAG 处理异常（兜底）:', err?.message)
    })

    return NextResponse.json({
      success: true,
      knowledgeBase: kb,
      message: '文件已开始后台解析！',
    })
  } catch (error: any) {
    console.error('Failed to upload knowledge base:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * ⬇️ 获取知识库列表 API
 */
export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request as any, secret: process.env.NEXTAUTH_SECRET })
    if (!token?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
        vectorizedAt: (kb as any).vectorizedAt?.toISOString(),
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
 * ❌ 删除知识库 API
 */
export async function DELETE(request: NextRequest) {
  try {
    const token = await getToken({ req: request as any, secret: process.env.NEXTAUTH_SECRET })
    if (!token?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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

    if (!id) return NextResponse.json({ error: 'ID不能为空' }, { status: 400 })

    const kb = await prisma.knowledgeBase.findUnique({ where: { id } })
    if (!kb) return NextResponse.json({ error: '知识库不存在' }, { status: 404 })
    if (kb.userId !== dbUser.id) return NextResponse.json({ error: '无权删除' }, { status: 403 })

    await prisma.knowledgeBase.delete({ where: { id } })

    return NextResponse.json({ success: true, message: '知识库已删除' })
  } catch (error: any) {
    console.error('Failed to delete knowledge base:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}