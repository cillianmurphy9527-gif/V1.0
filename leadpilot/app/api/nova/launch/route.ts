import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
// 🌟 改为直接调用 QuotaManager，实施硬拦截与预扣费
import { QuotaManager } from '@/lib/services/quota'

async function optimizeSearchQuery(industry: string, keywords: string[]): Promise<string> {
  const rawInput = `${industry} ${keywords.join(' ')}`.trim()
  if (!rawInput) return 'China'

  const apiKey = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY
  if (!apiKey) return rawInput

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
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
    }
    const userId = session.user.id

    const body = await request.json()
    const { targetAudience, targetCount = 50, knowledgeBaseIds = [] } = body

    if (!targetAudience) {
      return NextResponse.json({ error: 'targetAudience is required' }, { status: 400 })
    }

    // 🌟 核心拦截升级：先扣费 / 拦截白嫖！
    // 免费用户如果 targetCount > 3，这里会直接抛错被 catch 捕获。
    // 付费用户如果额度不够，也会在这里直接被拦截。
    // 如果额度够，这里会直接先把额度扣除（相当于押金）。
    const deductResult = await QuotaManager.consumeLead(userId, targetCount);
    
    if (!deductResult.success || deductResult.error) {
      return NextResponse.json(
        {
          error: deductResult.error?.message || '线索余额不足',
          code: deductResult.error?.code || 'INSUFFICIENT_QUOTA',
          required: targetCount,
          upgrade: true,
        },
        { status: 403 }
      )
    }

    // ─── 4. 调用 AI 翻译客户意图 ────────────────
    const rawIndustry = targetAudience.industry || ''
    const rawKeywords = targetAudience.keywords || []
    const optimizedEnglishQuery = await optimizeSearchQuery(rawIndustry, rawKeywords)

    const audienceConfig = {
      originalInput: { industry: rawIndustry, keywords: rawKeywords },
      searchQuery: optimizedEnglishQuery, 
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
          message: '任务已创建，配额已锁定，AI 已完成搜索指令翻译',
          details: { targetCount, audienceConfig, knowledgeBaseIds },
        }]),
      },
    })

    return NextResponse.json({
      success: true,
      jobId: novaJob.id,
      status: novaJob.status,
      totalTargets: novaJob.totalTargets,
      message: '任务已启动，后台处理中',
      pollUrl: `/api/nova/status/${novaJob.id}`,
      pollInterval: 5000,
    })

  } catch (error: any) {
    console.error('[NovaLaunch] Error:', error)
    
    // 如果抛出的是配额错误，返回 403
    if (error.name === 'QuotaServiceError') {
        return NextResponse.json({ error: error.message, code: error.code, upgrade: true }, { status: 403 })
    }

    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}