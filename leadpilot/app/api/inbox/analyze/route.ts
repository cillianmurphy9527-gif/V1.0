import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { checkFeatureAccess, recordQuotaUsage, FeatureGateError } from '@/lib/feature-gate'
import { checkAndDeductQuota, QuotaActionType, QuotaErrorCode } from '@/lib/quota'
import { prisma } from '@/lib/prisma'
import { LLMService } from '@/services/LLMService'

const INTENT_SYSTEM_PROMPT = `你是专业的商务邮件分析助手。分析邮件意图，严格返回如下 JSON，不附加任何说明：
{
  "intent": "POSITIVE|INQUIRY|REJECTION|NEGOTIATION|COMPLAINT|SPAM|UNKNOWN",
  "confidence": 0-100,
  "summary": "邮件核心内容摘要（中文，50字以内）",
  "sentiment": "positive|neutral|negative",
  "suggestedAction": "建议的回复方向",
  "keywords": ["关键词1", "关键词2", "关键词3"]
}
...`

const LEAD_SCORE_SYSTEM_PROMPT = `在意图分析的基础上，额外给出「商机评分」...`

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
    }

    const userId = session.user.id
    const body = await request.json()
    const { emailId, emailContent, senderEmail } = body
    if (!emailContent) {
      return NextResponse.json({ error: 'emailContent is required' }, { status: 400 })
    }

    const gateResult = await checkFeatureAccess(userId, 'INTENT_ANALYSIS', 150)
    if (!gateResult.allowed) {
      const statusCode = gateResult.error === FeatureGateError.UPGRADE_REQUIRED ? 403 : 429
      return NextResponse.json(
        { error: gateResult.message, code: gateResult.error, remainingQuota: gateResult.remainingQuota },
        { status: statusCode }
      )
    }

    const quotaResult = await checkAndDeductQuota(userId, QuotaActionType.AI_GENERATION, 1)
    if (!quotaResult.allowed) {
      const statusCode = quotaResult.error === QuotaErrorCode.INSUFFICIENT_TOKENS ? 402 : 429
      return NextResponse.json(
        { error: quotaResult.message, code: quotaResult.error, remainingTokens: quotaResult.remainingTokens },
        { status: statusCode }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { subscriptionTier: true },
    })
    const isMAX = user?.subscriptionTier === 'MAX'

    const systemPrompt = isMAX
      ? `${INTENT_SYSTEM_PROMPT}\n\n${LEAD_SCORE_SYSTEM_PROMPT}`
      : INTENT_SYSTEM_PROMPT

    let analysisResult: any
    try {
      const raw = await LLMService.generateContent(emailContent, systemPrompt, userId)
      analysisResult = JSON.parse(raw)
    } catch (e: any) {
      return NextResponse.json(
        { error: e?.message || 'AI 服务暂时不可用，请稍后重试' },
        { status: 503 }
      )
    }

    await recordQuotaUsage(userId, 'tokens', 150)

    return NextResponse.json({
      success: true,
      analysis: analysisResult,
      emailId,
      senderEmail,
      tier: user?.subscriptionTier,
      tokensUsed: 150,
      remainingTokens: (quotaResult.remainingTokens ?? 0) - 150,
    })
  } catch (error) {
    console.error('[InboxAnalyze] Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}