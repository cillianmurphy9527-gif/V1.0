/**
 * API: 收件箱 AI 深度意图分析
 *
 * 套餐差异：
 * - PRO : 返回意图标签（积极/拒绝/询价/谈判）+ 摘要
 * - MAX : 在 PRO 基础上额外返回「商机评分 leadScore (0-100)」
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { checkFeatureAccess, recordQuotaUsage, FeatureGateError } from '@/lib/feature-gate'
import { checkAndDeductQuota, QuotaActionType, QuotaErrorCode } from '@/lib/quota'
import { prisma } from '@/lib/prisma'
import { llmService } from '@/services/LLMService'

const INTENT_SYSTEM_PROMPT = `你是专业的商务邮件分析助手。分析邮件意图，严格返回如下 JSON，不附加任何说明：
{
  "intent": "POSITIVE|INQUIRY|REJECTION|NEGOTIATION|COMPLAINT|SPAM|UNKNOWN",
  "confidence": 0-100,
  "summary": "邮件核心内容摘要（中文，50字以内）",
  "sentiment": "positive|neutral|negative",
  "suggestedAction": "建议的回复方向",
  "keywords": ["关键词1", "关键词2", "关键词3"]
}

意图定义：
- POSITIVE：客户表示满意、同意、确认
- INQUIRY：客户询问产品/价格/规格
- REJECTION：客户明确拒绝
- NEGOTIATION：客户讨价还价、提出条件
- COMPLAINT：客户投诉、表示不满
- SPAM：垃圾邮件
- UNKNOWN：无法判定`

const LEAD_SCORE_SYSTEM_PROMPT = `在意图分析的基础上，额外给出「商机评分」，评估该邮件发件人成为付费客户的概率。
评分标准（0-100）：
- 85-100：高价值商机，立即跟进
- 60-84：有潜力，需持续培育
- 30-59：潜在可能，低优先级
- 0-29：几乎无商机

在原有 JSON 基础上追加字段：
"leadScore": 0-100,
"leadScoreReason": "评分理由（中文，30字以内）"`

export async function POST(request: NextRequest) {
  try {
    // ─── 1. 鉴权 ───────────────────────────────────────────
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

    // ─── 2. 功能门控：仅专业版+ ────────────────────────────
    const gateResult = await checkFeatureAccess(userId, 'INTENT_ANALYSIS', 150)
    if (!gateResult.allowed) {
      const statusCode = gateResult.error === FeatureGateError.UPGRADE_REQUIRED ? 403 : 429
      return NextResponse.json(
        { error: gateResult.message, code: gateResult.error, remainingQuota: gateResult.remainingQuota },
        { status: statusCode }
      )
    }

    // ─── 3. 配额扣费 ────────────────────────────────────────
    const quotaResult = await checkAndDeductQuota(userId, QuotaActionType.AI_GENERATION, 1)
    if (!quotaResult.allowed) {
      const statusCode = quotaResult.error === QuotaErrorCode.INSUFFICIENT_TOKENS ? 402 : 429
      return NextResponse.json(
        { error: quotaResult.message, code: quotaResult.error, remainingTokens: quotaResult.remainingTokens },
        { status: statusCode }
      )
    }

    // ─── 4. 获取用户套餐等级 ───────────────────────────────
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { subscriptionTier: true },
    })
    const isMAX = user?.subscriptionTier === 'MAX'

    // ─── 5. 调用 LLM：MAX 套餐使用增强提示词 ──────────────
    const systemPrompt = isMAX
      ? `${INTENT_SYSTEM_PROMPT}\n\n${LEAD_SCORE_SYSTEM_PROMPT}`
      : INTENT_SYSTEM_PROMPT

    let analysisResult: any
    try {
      const raw = await llmService.complete(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: emailContent },
        ],
        0.3
      )
      analysisResult = JSON.parse(raw)
    } catch (e: any) {
      return NextResponse.json(
        { error: e?.message || 'AI 服务暂时不可用，请稍后重试' },
        { status: 503 }
      )
    }

    // ─── 6. 记录 token 消耗 ─────────────────────────────────
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
