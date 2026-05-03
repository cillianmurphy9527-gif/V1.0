import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { checkFeatureAccess, recordQuotaUsage, FeatureGateError } from '@/lib/feature-gate'
import { checkAndDeductQuota, QuotaActionType, QuotaErrorCode } from '@/lib/quota'
import { LLMService } from '@/services/LLMService'

export async function POST(request: NextRequest) {
  try {
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

    // 语言锁
    const isMultilang = language.toLowerCase() !== 'english' && language !== 'en'
    if (isMultilang) {
      const multilangGate = await checkFeatureAccess(userId, 'MULTILANG')
      if (!multilangGate.allowed) {
        return NextResponse.json(
          { error: multilangGate.message, code: multilangGate.error, hint: '入门版仅支持英语邮件生成，请升级到专业版以解锁 8 种语言' },
          { status: 403 }
        )
      }
    }

    const gateResult = await checkFeatureAccess(userId, 'EMAIL_SEND', estimatedTokens)
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

    // 构建提示词，要求 AI 返回包含 subject 和 body 的 JSON
    const prompt = `
请根据以下客户数据撰写一封个性化开发信，使用 ${language} 语言。
用户自定义指令：${userContext || '无'}

客户数据：${JSON.stringify(leadData)}

请严格按照 JSON 格式返回，不要附加任何其他文字：
{"subject": "邮件主题", "body": "邮件正文"}`

    let generatedSubject = ''
    let generatedBody = ''

    try {
      const raw = await LLMService.generateContent(prompt, systemPrompt)
      // 尝试解析 AI 返回的 JSON
      const parsed = JSON.parse(raw)
      generatedSubject = parsed.subject || ''
      generatedBody = parsed.body || raw  // 如果解析失败，将整个内容作为 body
    } catch (e) {
      // 如果 AI 没有返回合法 JSON，直接将整个内容作为 body
      const raw = await LLMService.generateContent(prompt, systemPrompt)
      generatedBody = raw
      generatedSubject = '新建开发信'
    }

    await recordQuotaUsage(userId, 'tokens', estimatedTokens)

    return NextResponse.json({
      success: true,
      subject: generatedSubject,
      body: generatedBody,
      language: language,
      tokensUsed: estimatedTokens,
      remainingTokens: quotaResult.remainingTokens,
    })
  } catch (error) {
    console.error('[GenerateEmail] Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}