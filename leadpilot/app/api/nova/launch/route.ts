import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getQuotaStatus } from '@/lib/services/quota'

// 🧠 核心新增：AI 隐形翻译官
// 将客户随手输入的中文，瞬间转化为专业的英文布尔搜索指令
async function optimizeSearchQuery(industry: string, keywords: string[]): Promise<string> {
  const rawInput = `${industry} ${keywords.join(' ')}`.trim()
  if (!rawInput) return 'China'

  // 读取您系统现有的 AI 秘钥 (优先用便宜强大的 DeepSeek)
  const apiKey = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY
  if (!apiKey) return rawInput // 如果没配置秘钥，就原样返回兜底

  const isDeepSeek = !!process.env.DEEPSEEK_API_KEY
  const baseUrl = isDeepSeek ? 'https://api.deepseek.com/chat/completions' : 'https://api.openai.com/v1/chat/completions'
  const model = isDeepSeek ? 'deepseek-chat' : 'gpt-3.5-turbo'

  try {
    const prompt = `你是一个外贸B2B搜客专家。用户输入了中文的搜索意图，你需要将其翻译并扩写为精确的英文布尔搜索指令(Boolean Search)，用于在LinkedIn或Google中搜刮海外客户。
用户输入: "${rawInput}"
要求: 
1. 提取出城市名并翻译为英文 (如 Dalian, Shenzhen)。
2. 将行业词扩写为专业的英文外贸词汇。
3. 必须输出带有 AND/OR 逻辑的纯英文指令。
4. 只返回最终的字符串，绝对不要包含任何解释和其他废话。
示例输出: ("Heavy Machinery" OR "Construction Equipment") AND "Dalian"`

    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3
      })
    })
    
    const data = await res.json()
    const optimizedQuery = data.choices?.[0]?.message?.content?.trim()
    console.log(`🧠 [AI 意图翻译] 用户输入: "${rawInput}" -> 优化为: ${optimizedQuery}`)
    return optimizedQuery || rawInput
  } catch (error) {
    console.error(`❌ [AI 意图翻译] 失败, 降级使用原文:`, error)
    return rawInput
  }
}

export async function POST(request: NextRequest) {
  try {
    // ─── 1. 鉴权 ───────────────────────────────────────────
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
    }
    const userId = session.user.id

    // ─── 2. 解析请求体 ─────────────────────────────────────
    const body = await request.json()
    const { targetAudience, targetCount = 50, knowledgeBaseIds = [] } = body

    if (!targetAudience) {
      return NextResponse.json({ error: 'targetAudience is required' }, { status: 400 })
    }

    // ─── 3. 核验用户配额 ────────────────────────────────────
    const quotaStatus = await getQuotaStatus(userId)
    if (quotaStatus.leadsBalance < targetCount) {
      return NextResponse.json(
        {
          error: '线索余额不足',
          code: 'INSUFFICIENT_QUOTA',
          required: targetCount,
          current: quotaStatus.leadsBalance,
          upgrade: true,
        },
        { status: 403 }
      )
    }

    // ─── 4. 【核心截流】调用 AI 翻译客户意图 ────────────────
    const rawIndustry = targetAudience.industry || ''
    const rawKeywords = targetAudience.keywords || []
    
    // 把中文转化为专业的英文查询词
    const optimizedEnglishQuery = await optimizeSearchQuery(rawIndustry, rawKeywords)

    const audienceConfig = {
      originalInput: { industry: rawIndustry, keywords: rawKeywords }, // 留底给老板查账用
      searchQuery: optimizedEnglishQuery, // 👈 这是真正喂给泥头车引擎的子弹！
      country: targetAudience.country || 'CN',
    }

    // ─── 5. 创建 Nova 任务记录 ──────────────────────────────
    const novaJob = await prisma.novaJob.create({
      data: {
        userId,
        jobType: 'SEARCH', 
        status: 'PENDING',
        totalTargets: targetCount,
        currentProgress: 0,
        leadsFound: 0,
        leadsSaved: 0,
        logs: JSON.stringify([{
          timestamp: new Date().toISOString(),
          level: 'INFO',
          message: '任务已创建，AI 已完成搜索指令翻译',
          details: { targetCount, audienceConfig, knowledgeBaseIds },
        }]),
      },
    })

    // ─── 6. 立即返回 jobId ─────────────────────────
    return NextResponse.json({
      success: true,
      jobId: novaJob.id,
      status: novaJob.status,
      totalTargets: novaJob.totalTargets,
      message: '任务已启动，后台处理中',
      pollUrl: `/api/nova/status/${novaJob.id}`,
      pollInterval: 5000,
    })

  } catch (error) {
    console.error('[NovaLaunch] Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}