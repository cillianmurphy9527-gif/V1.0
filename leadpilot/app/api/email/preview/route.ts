import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { LLMService } from '@/services/LLMService'

// 试用版套餐列表
const TRIAL_TIERS = ['TRIAL', 'FREE', 'UNSUBSCRIBED', '未订阅']

function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return email
  const [local, domain] = email.split('@')
  if (local.length <= 1) return `${local}***@${domain}`
  return `${local[0]}***@${domain}`
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权', code: 'UNAUTHORIZED' }, { status: 401 })
    }

    const userId = session.user.id
    const body = await request.json()
    const {
      leadId,
      leadIndex = 0,
      userContext = '',
      systemPrompt = '请撰写一封专业的外贸开发信',
    } = body

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { subscriptionTier: true, tokenBalance: true, companyName: true },
    })

    if (!user) {
      return NextResponse.json({ error: '用户不存在', code: 'USER_NOT_FOUND' }, { status: 404 })
    }

    const isTrial = TRIAL_TIERS.includes(user.subscriptionTier?.toUpperCase() || '')

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

    if (isTrial && (user.tokenBalance || 0) <= 0) {
      return NextResponse.json({
        error: '算力余额不足',
        code: 'INSUFFICIENT_TOKENS',
        message: '试用版算力已耗尽，请升级套餐获取更多算力。',
        requiresUpgrade: true,
      }, { status: 402 })
    }

    const lead = await prisma.userLead.findFirst({
      where: { id: leadId, userId: userId },
    })

    if (!lead) {
      return NextResponse.json({ error: '线索不存在', code: 'LEAD_NOT_FOUND' }, { status: 404 })
    }

    // 🔧 关键修复：LLMService.generateEmail 只接受 (systemPrompt, websiteData) 两个参数
    const emailContent = await LLMService.generateEmail(systemPrompt, {
      companyName: lead.companyName,
      contactName: lead.contactName || '决策人',
      jobTitle: lead.jobTitle || '高管',
      country: lead.country || '海外',
      website: lead.website,
      companyDescription: userContext
    } as any);

    if (isTrial) {
      // 简单扣减 tokens
      const estimatedTokens = Math.ceil(emailContent.length / 4)
      if (user.tokenBalance && user.tokenBalance > 0) {
        await prisma.user.update({
          where: { id: userId },
          data: { tokenBalance: { decrement: Math.min(estimatedTokens, user.tokenBalance) } },
        })
      }
    }

    return NextResponse.json({
      success: true,
      leadId: lead.id,
      companyName: lead.companyName,
      contactName: lead.contactName || null,
      jobTitle: lead.jobTitle || null,
      email: lead.isUnlocked ? lead.email : maskEmail(lead.email),
      isEmailMasked: !lead.isUnlocked,
      subject: emailContent,
      body: emailContent,
      preview: emailContent,
      isTrial,
      tokensUsed: isTrial ? Math.ceil(emailContent.length / 4) : 0,
    })

  } catch (error) {
    console.error('[generateEmailPreview] Error:', error)
    return NextResponse.json({ error: '生成预览失败', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}