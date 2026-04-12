/**
 * API: 生成 AI 信件预览（单点触发）
 * 
 * 试用版权限：
 * - 仅索引为 0 的线索可触发预览（单一样本破冰）
 * - 其他线索触发时返回 403，提示升级套餐
 * - 试用版邮件生成仅展示预览，不可批量发送
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { llmService } from '@/services/LLMService'

// 试用版套餐列表
const TRIAL_TIERS = ['TRIAL', 'FREE', 'UNSUBSCRIBED', '未订阅']

// 邮箱脱敏函数（服务端）
function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return email
  const [local, domain] = email.split('@')
  if (local.length <= 1) return `${local}***@${domain}`
  return `${local[0]}***@${domain}`
}

export async function POST(request: NextRequest) {
  try {
    // ─── 1. 鉴权 ───────────────────────────────────────────
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权', code: 'UNAUTHORIZED' }, { status: 401 })
    }

    const userId = session.user.id
    const body = await request.json()
    const {
      leadId,
      leadIndex = 0,
      language = 'English',
      userContext = '',
      systemPrompt = '请撰写一封专业的外贸开发信',
    } = body

    // ─── 2. 获取用户套餐信息 ───────────────────────────────
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        subscriptionTier: true,
        tokenBalance: true,
        companyName: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: '用户不存在', code: 'USER_NOT_FOUND' }, { status: 404 })
    }

    const isTrial = TRIAL_TIERS.includes(user.subscriptionTier?.toUpperCase() || '')

    // ─── 3. 试用版权限拦截：仅索引 0 可触发 ────────────────
    if (isTrial && leadIndex !== 0) {
      return NextResponse.json({
        error: '升级套餐解锁全量撰写',
        code: 'TRIAL_LIMIT_EXCEEDED',
        message: '试用版仅支持预览第一条线索。升级到专业版解锁全量 AI 撰写功能。',
        requiresUpgrade: true,
        targetTier: 'PRO',
        currentTier: user.subscriptionTier,
      }, { status: 403 })
    }

    // ─── 4. 试用版 token 余额检查 ─────────────────────────
    if (isTrial && (user.tokenBalance || 0) <= 0) {
      return NextResponse.json({
        error: '算力余额不足',
        code: 'INSUFFICIENT_TOKENS',
        message: '试用版算力已耗尽，请升级套餐获取更多算力。',
        requiresUpgrade: true,
      }, { status: 402 })
    }

    // ─── 5. 获取线索详情（需验证归属）───────────────────────
    const lead = await prisma.userLead.findFirst({
      where: {
        id: leadId,
        userId: userId,
      },
    })

    if (!lead) {
      return NextResponse.json({ error: '线索不存在', code: 'LEAD_NOT_FOUND' }, { status: 404 })
    }

    // ─── 6. 调用 LLM 生成个性化邮件（千人千面）──────────────
    // 构建用户上下文用于个性化生成
    const personalizationContext = `
用户信息：
- 公司名：${user.companyName || 'LeadPilot 用户'}
- 目标客户公司：${lead.companyName}
- 目标客户联系人：${lead.contactName || '未知'}
- 目标客户职位：${lead.jobTitle || '决策人'}
- 目标国家：${lead.country || '海外市场'}

用户自定义指令：${userContext}
    `.trim()

    // 真实调用 LLM 服务（千人千面逻辑）
    const draft = await llmService.generateEmail(
      {
        email: lead.isUnlocked ? lead.email : maskEmail(lead.email),
        websiteData: lead.website || undefined,
      },
      personalizationContext,
      systemPrompt,
      language.toLowerCase().startsWith('en') ? 'en' : language
    )

    // ─── 7. 扣减 token（试用版）───────────────────────────
    if (isTrial) {
      const estimatedTokens = Math.ceil(draft.body.length / 4) // 约 4 字符 = 1 token
      if (user.tokenBalance && user.tokenBalance > 0) {
        await prisma.user.update({
          where: { id: userId },
          data: {
            tokenBalance: {
              decrement: Math.min(estimatedTokens, user.tokenBalance),
            },
          },
        })
      }
    }

    // ─── 8. 返回结果 ──────────────────────────────────────
    return NextResponse.json({
      success: true,
      leadId: lead.id,
      companyName: lead.companyName,
      contactName: lead.contactName || null,
      jobTitle: lead.jobTitle || null,
      // 试用版返回脱敏邮箱，付费版返回完整邮箱
      email: lead.isUnlocked ? lead.email : maskEmail(lead.email),
      isEmailMasked: !lead.isUnlocked,
      language: targetLanguage,
      subject: draft.subject,
      body: draft.body,
      preview: draft.subject, // 预览用主题
      isTrial,
      tokensUsed: isTrial ? Math.ceil(draft.body.length / 4) : 0,
    })
  } catch (error) {
    console.error('[generateEmailPreview] Error:', error)
    return NextResponse.json({ error: '生成预览失败', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
