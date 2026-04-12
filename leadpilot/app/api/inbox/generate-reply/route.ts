/**
 * API: 收件箱 AI 智能回复生成
 *
 * 套餐差异：
 * - PRO : 支持 5 种预设指令（POSITIVE / NEGOTIATION / TECHNICAL_SUPPORT / ORDER_CONFIRM / FOLLOW_UP）
 * - MAX : 在 PRO 基础上额外支持「自定义指令」(customInstruction 字段)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { checkFeatureAccess, recordQuotaUsage, FeatureGateError } from '@/lib/feature-gate'
import { checkAndDeductQuota, QuotaActionType, QuotaErrorCode } from '@/lib/quota'
import { prisma } from '@/lib/prisma'
import { llmService } from '@/services/LLMService'

// ─── 允许的预设指令 ──────────────────────────────────────
export type ReplyType =
  | 'POSITIVE'
  | 'NEGOTIATION'
  | 'TECHNICAL_SUPPORT'
  | 'ORDER_CONFIRM'
  | 'FOLLOW_UP'

const PRESET_PROMPTS: Record<ReplyType, string> = {
  POSITIVE: `你是专业外贸销售代表。请生成一封积极热情的回复邮件：
- 感谢客户的询问，突出产品优势
- 邀请进一步沟通，语气专业友好
- 严格按 JSON {"subject":"...","body":"..."} 返回，不附加说明
- 绝对禁止捏造产品价格、折扣、包邮、免费、交期等任何未经授权商业条款`,

  NEGOTIATION: `你是专业外贸谈判顾问。请生成一封价格谈判回复：
- 理解客户价格关切，强调价值与可谈判空间
- 如果原文未提供明确价格/折扣条款：只能提出“需要确认规格/数量/贸易条款后再报价”，不得编造任何数字
- 严格按 JSON {"subject":"...","body":"..."} 返回，不附加说明
- 绝对禁止捏造产品价格、折扣、包邮、免费、交期等任何未经授权商业条款`,

  TECHNICAL_SUPPORT: `你是专业技术支持工程师。请生成一封技术问题解答邮件：
- 确认理解了客户的问题，提供清晰解决步骤
- 附上技术细节，邀请客户反馈
- 严格按 JSON {"subject":"...","body":"..."} 返回，不附加说明
- 绝对禁止捏造产品价格、折扣、包邮、免费、交期等任何未经授权商业条款`,

  ORDER_CONFIRM: `你是专业订单处理代表。请生成一封订单确认邮件：
- 确认订单详情（产品/数量/贸易条款/交付要求等），如果原文未给出明确价格：不得编造价格，只能请求确认后再出正式 PI
- 感谢客户信任，语气正式专业
- 严格按 JSON {"subject":"...","body":"..."} 返回，不附加说明
- 绝对禁止捏造产品价格、折扣、包邮、免费、交期等任何未经授权商业条款`,

  FOLLOW_UP: `你是专业销售跟进代表。请生成一封跟进邮件：
- 回顾之前讨论要点，提供新的价值信息
- 推动下一步行动，保持专业热情
- 严格按 JSON {"subject":"...","body":"..."} 返回，不附加说明
- 绝对禁止捏造产品价格、折扣、包邮、免费、交期等任何未经授权商业条款`,
}

const VALID_REPLY_TYPES = Object.keys(PRESET_PROMPTS) as ReplyType[]

export async function POST(request: NextRequest) {
  try {
    // ─── 1. 鉴权 ───────────────────────────────────────────
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
    }

    const userId = session.user.id
    const body = await request.json()
    const {
      originalEmailContent,
      replyType,
      customInstruction, // 仅 MAX 套餐有效
      targetLanguage = 'English',
      ragContext,
    } = body

    if (!originalEmailContent) {
      return NextResponse.json({ error: 'originalEmailContent is required' }, { status: 400 })
    }

    // ─── 2. 功能门控：仅专业版+ ────────────────────────────
    const gateResult = await checkFeatureAccess(userId, 'INTENT_ANALYSIS', 200)
    if (!gateResult.allowed) {
      const statusCode = gateResult.error === FeatureGateError.UPGRADE_REQUIRED ? 403 : 429
      return NextResponse.json(
        { error: gateResult.message, code: gateResult.error, remainingQuota: gateResult.remainingQuota },
        { status: statusCode }
      )
    }

    // ─── 3. 获取套餐等级 ────────────────────────────────────
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { subscriptionTier: true },
    })
    const isMAX = user?.subscriptionTier === 'MAX'

    // ─── 4. 指令选择与套餐隔离 ──────────────────────────────
    let systemPrompt: string

    if (customInstruction) {
      // 自定义指令：仅 MAX 套餐允许
      if (!isMAX) {
        return NextResponse.json(
          {
            error: '自定义回复指令需要升级到旗舰版（MAX）',
            code: 'UPGRADE_REQUIRED',
            hint: '专业版支持 5 种预设指令，旗舰版解锁自定义指令',
          },
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
      // 预设指令：PRO/MAX 均支持
      if (!replyType || !VALID_REPLY_TYPES.includes(replyType as ReplyType)) {
        return NextResponse.json(
          {
            error: `replyType must be one of: ${VALID_REPLY_TYPES.join(', ')}`,
            validTypes: VALID_REPLY_TYPES,
          },
          { status: 400 }
        )
      }
      systemPrompt =
        PRESET_PROMPTS[replyType as ReplyType] +
        `\n\n目标语言：${targetLanguage}\n知识库背景：${ragContext || '无'}`
    }

    // ─── 5. 配额扣费 ────────────────────────────────────────
    const quotaResult = await checkAndDeductQuota(userId, QuotaActionType.AI_GENERATION, 1)
    if (!quotaResult.allowed) {
      const statusCode = quotaResult.error === QuotaErrorCode.INSUFFICIENT_TOKENS ? 402 : 429
      return NextResponse.json(
        { error: quotaResult.message, code: quotaResult.error, remainingTokens: quotaResult.remainingTokens },
        { status: statusCode }
      )
    }

    // ─── 6. 调用 LLM 生成回复草稿 ──────────────────────────
    let replyDraft: { subject: string; body: string }
    try {
      const raw = await llmService.complete(
        [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `原始邮件内容：\n${originalEmailContent}`,
          },
        ],
        0.7
      )
      replyDraft = JSON.parse(raw)
    } catch (e: any) {
      return NextResponse.json(
        { error: e?.message || 'AI 服务暂时不可用，请稍后重试' },
        { status: 503 }
      )
    }

    // ─── 7. 记录 token 消耗 ─────────────────────────────────
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
