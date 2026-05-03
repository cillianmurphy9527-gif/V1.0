import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { checkFeatureAccess, recordQuotaUsage, FeatureGateError } from '@/lib/feature-gate'
import { checkAndDeductQuota, QuotaActionType, QuotaErrorCode } from '@/lib/quota'
import { prisma } from '@/lib/prisma'
import { LLMService } from '@/services/LLMService'

export type ReplyType = 'POSITIVE' | 'NEGOTIATION' | 'TECHNICAL_SUPPORT' | 'ORDER_CONFIRM' | 'FOLLOW_UP'

const PRESET_PROMPTS: Record<ReplyType, string> = {
  POSITIVE: `...`,
  NEGOTIATION: `...`,
  TECHNICAL_SUPPORT: `...`,
  ORDER_CONFIRM: `...`,
  FOLLOW_UP: `...`,
}

const VALID_REPLY_TYPES = Object.keys(PRESET_PROMPTS) as ReplyType[]

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
    }

    const userId = session.user.id
    const body = await request.json()
    const {
      originalEmailContent,
      replyType,
      customInstruction,
      targetLanguage = 'English',
      ragContext,
    } = body

    if (!originalEmailContent) {
      return NextResponse.json({ error: 'originalEmailContent is required' }, { status: 400 })
    }

    const gateResult = await checkFeatureAccess(userId, 'INTENT_ANALYSIS', 200)
    if (!gateResult.allowed) {
      const statusCode = gateResult.error === FeatureGateError.UPGRADE_REQUIRED ? 403 : 429
      return NextResponse.json(
        { error: gateResult.message, code: gateResult.error, remainingQuota: gateResult.remainingQuota },
        { status: statusCode }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { subscriptionTier: true },
    })
    const isMAX = user?.subscriptionTier === 'MAX'

    let systemPrompt: string
    if (customInstruction) {
      if (!isMAX) {
        return NextResponse.json(
          { error: '自定义回复指令需要升级到旗舰版（MAX）', code: 'UPGRADE_REQUIRED' },
          { status: 403 }
        )
      }
      systemPrompt = `你是专业外贸邮件助手。请严格按照以下用户自定义指令生成回复邮件。
用户指令：${customInstruction}
要求：
- 使用 ${targetLanguage} 语言撰写
- 知识库背景：${ragContext || '无'}
- 严格按 JSON {"subject":"...","body":"..."} 返回，不附加任何说明
- 禁止捏造价格、折扣或未经授权的承诺`
    } else {
      if (!replyType || !VALID_REPLY_TYPES.includes(replyType as ReplyType)) {
        return NextResponse.json(
          { error: `replyType must be one of: ${VALID_REPLY_TYPES.join(', ')}`, validTypes: VALID_REPLY_TYPES },
          { status: 400 }
        )
      }
      systemPrompt = PRESET_PROMPTS[replyType as ReplyType] +
        `\n\n目标语言：${targetLanguage}\n知识库背景：${ragContext || '无'}`
    }

    const quotaResult = await checkAndDeductQuota(userId, QuotaActionType.AI_GENERATION, 1)
    if (!quotaResult.allowed) {
      const statusCode = quotaResult.error === QuotaErrorCode.INSUFFICIENT_TOKENS ? 402 : 429
      return NextResponse.json(
        { error: quotaResult.message, code: quotaResult.error, remainingTokens: quotaResult.remainingTokens },
        { status: statusCode }
      )
    }

    let replyDraft: { subject: string; body: string }
    try {
      const raw = await LLMService.generateContent(
        `原始邮件内容：\n${originalEmailContent}`,
        systemPrompt,
        userId
      )
      replyDraft = JSON.parse(raw)
    } catch (e: any) {
      return NextResponse.json(
        { error: e?.message || 'AI 服务暂时不可用，请稍后重试' },
        { status: 503 }
      )
    }

    await recordQuotaUsage(userId, 'tokens', 200)

    return NextResponse.json({
      success: true,
      replyDraft,
      replyType: customInstruction ? 'CUSTOM' : replyType,
      language: targetLanguage,
      tier: user?.subscriptionTier,
      tokensUsed: 200,
      remainingTokens: (quotaResult.remainingTokens ?? 0) - 200,
    })
  } catch (error) {
    console.error('[GenerateReply] Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}