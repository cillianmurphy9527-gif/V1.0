/**
 * API: 生成个性化邮件
 *
 * 套餐权限矩阵：
 * - STARTER : 仅支持英语；超出 token 配额返回 402
 * - PRO/MAX  : 支持多语种；超出配额返回 429
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { checkFeatureAccess, recordQuotaUsage, FeatureGateError } from '@/lib/feature-gate'
import { checkAndDeductQuota, QuotaActionType, QuotaErrorCode } from '@/lib/quota'
import { llmService } from '@/services/LLMService'

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
      language = 'English',
      estimatedTokens = 500,
      leadData = {},
      userContext = '',
      systemPrompt = '请撰写一封专业的外贸开发信',
    } = body

    // ─── 2. 语言锁：入门版只允许英语 ──────────────────────
    const isMultilang = language.toLowerCase() !== 'english' && language !== 'en'
    if (isMultilang) {
      const multilangGate = await checkFeatureAccess(userId, 'MULTILANG')
      if (!multilangGate.allowed) {
        return NextResponse.json(
          {
            error: multilangGate.message,
            code: multilangGate.error,
            hint: '入门版仅支持英语邮件生成，请升级到专业版以解锁 8 种语言',
          },
          { status: 403 }
        )
      }
    }

    // ─── 3. Token 配额门控 ──────────────────────────────────
    const gateResult = await checkFeatureAccess(userId, 'EMAIL_SEND', estimatedTokens)
    if (!gateResult.allowed) {
      const statusCode = gateResult.error === FeatureGateError.UPGRADE_REQUIRED ? 403 : 429
      return NextResponse.json(
        { error: gateResult.message, code: gateResult.error, remainingQuota: gateResult.remainingQuota },
        { status: statusCode }
      )
    }

    // ─── 4. 配额扣费（原子操作） ────────────────────────────
    const quotaResult = await checkAndDeductQuota(userId, QuotaActionType.AI_GENERATION, 1)
    if (!quotaResult.allowed) {
      const statusCode = quotaResult.error === QuotaErrorCode.INSUFFICIENT_TOKENS ? 402 : 429
      return NextResponse.json(
        { error: quotaResult.message, code: quotaResult.error, remainingTokens: quotaResult.remainingTokens },
        { status: statusCode }
      )
    }

    // ─── 5. 调用真实 LLM 生成邮件 ──────────────────────────
    const langCode = language.toLowerCase().startsWith('en') ? 'en' : language
    const draft = await llmService.generateEmail(
      {
        email: leadData.email || '',
        websiteData: leadData.websiteData,
        aiScore: leadData.aiScore,
      },
      userContext,
      systemPrompt,
      langCode
    )

    // ─── 6. 记录 token 消耗 ─────────────────────────────────
    await recordQuotaUsage(userId, 'tokens', estimatedTokens)

    return NextResponse.json({
      success: true,
      subject: draft.subject,
      body: draft.body,
      language: draft.language,
      tokensUsed: estimatedTokens,
      remainingTokens: quotaResult.remainingTokens,
    })
  } catch (error) {
    console.error('[GenerateEmail] Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
