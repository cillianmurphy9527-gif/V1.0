import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import { PLANS } from '@/config/pricing'

// 资产类型 → 可读标签映射
const ASSET_LABELS: Record<string, { name: string; icon: string; desc: string }> = {
  TEMPLATE_MECHANICAL:  { name: '机械制造行业模板包', icon: '⚙️', desc: '50 套开发信模板 + 行业话术' },
  TEMPLATE_ELECTRONICS: { name: '电子元器件行业模板包', icon: '🔌', desc: '50 套开发信模板 + 行业话术' },
  TEMPLATE_FURNITURE:   { name: '家居家具行业模板包', icon: '🪑', desc: '50 套开发信模板 + 行业话术' },
  STRATEGY_EXECUTIVE:   { name: '高管成交策略包', icon: '🎯', desc: '针对 C-level 的高转化话术库' },
  STRATEGY_FOLLOWUP:    { name: '跟进序列策略包', icon: '📬', desc: '7 步自动化跟进邮件模板' },
}

export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request as any, secret: process.env.NEXTAUTH_SECRET })
    if (!token?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = token.id as string

    // 并发查询 User + Wallet + UserAsset
    const [user, wallet, assets] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          tokenBalance: true,
          subscriptionTier: true,
          monthlySearches: true,
          trialEndsAt: true,
          extraDomains: true,
          exportCredits: true,
        },
      }),
      prisma.wallet.findUnique({
        where: { userId },
        select: { emailCredits: true, leadCredits: true, aiTokens: true, updatedAt: true },
      }),
      prisma.userAsset.findMany({
        where: { userId },
        select: { id: true, assetType: true, unlockedAt: true },
        orderBy: { unlockedAt: 'desc' },
      }),
    ])

    if (!user) {
      // 用户在 DB 中不存在时，返回全零默认值，不崩溃
      return NextResponse.json({
        plan: { id: 'TRIAL', name: '试用版', coreOutcome: '', trialEndsAt: null },
        quotas: [
          { key: 'aiToken', label: 'AI 算力余额', icon: '⚡', current: 0, total: 50000, unit: 'tokens', percent: 0, addon: 0 },
          { key: 'email',   label: '发信额度',   icon: '✉️', current: 0, total: 1000,  unit: '封',    percent: 0, addon: 0 },
          { key: 'lead',    label: '线索额度',   icon: '🎯', current: 0, total: 300,   unit: '家',    percent: 0, addon: 0 },
          { key: 'export',  label: '导出额度',   icon: '📥', current: 0, total: null,  unit: '条',    percent: null, addon: 0 },
        ],
        unlockedAssets: [],
        walletUpdatedAt: null,
      })
    }

    const plan = PLANS.find(p => p.id === user.subscriptionTier)
    const planQuotas = plan?.quotas

    // 计算百分比（低于 10% 标红）
    const calcPercent = (current: number, total: number) =>
      total > 0 ? Math.round((current / total) * 100) : 0

    const tokenTotal = planQuotas?.maxTokensPerMonth ?? 50000
    const emailTotal = planQuotas?.maxEmailsPerMonth ?? 1000
    const leadTotal  = planQuotas?.maxLeadsPerMonth  ?? 300

    // Wallet 额度（购买的增值额度）
    const walletEmailCredits = wallet?.emailCredits ?? 0
    const walletLeadCredits  = wallet?.leadCredits  ?? 0
    const walletAiTokens     = wallet?.aiTokens     ?? 0

    // 实际剩余 = 套餐内剩余 + 购买的增值额度
    const effectiveTokenBalance = user.tokenBalance + walletAiTokens
    const effectiveEmailBalance = emailTotal - (user.monthlySearches ?? 0) + walletEmailCredits
    const effectiveLeadBalance  = leadTotal  - (user.monthlySearches ?? 0) + walletLeadCredits

    // 导出额度（来自商城购买，永久有效）
    const userExportCredits = user.exportCredits ?? 0

    const quotas = [
      {
        key: 'aiToken',
        label: 'AI 算力余额',
        icon: '⚡',
        current: effectiveTokenBalance,
        total: tokenTotal + walletAiTokens,
        unit: 'tokens',
        percent: calcPercent(effectiveTokenBalance, tokenTotal + walletAiTokens),
        addon: walletAiTokens,
      },
      {
        key: 'email',
        label: '发信额度',
        icon: '✉️',
        current: Math.max(0, effectiveEmailBalance),
        total: emailTotal + walletEmailCredits,
        unit: '封',
        percent: calcPercent(Math.max(0, effectiveEmailBalance), emailTotal + walletEmailCredits),
        addon: walletEmailCredits,
      },
      {
        key: 'lead',
        label: '线索额度',
        icon: '🎯',
        current: Math.max(0, effectiveLeadBalance),
        total: leadTotal + walletLeadCredits,
        unit: '家',
        percent: calcPercent(Math.max(0, effectiveLeadBalance), leadTotal + walletLeadCredits),
        addon: walletLeadCredits,
      },
      {
        key: 'export',
        label: '导出额度',
        icon: '📥',
        current: userExportCredits,
        total: null, // 导出额度无固定上限，用 null 表示
        unit: '条',
        percent: null, // 持续发光状态
        addon: 0,
      },
    ]

    // UserAsset 映射
    const unlockedAssets = assets.map(a => ({
      id: a.id,
      assetType: a.assetType,
      unlockedAt: a.unlockedAt.toISOString(),
      ...( ASSET_LABELS[a.assetType] ?? {
        name: a.assetType,
        icon: '📦',
        desc: '已解锁资产',
      }),
    }))

    return NextResponse.json({
      plan: {
        id: user.subscriptionTier,
        name: plan?.name ?? user.subscriptionTier,
        coreOutcome: plan?.coreOutcome ?? '',
        trialEndsAt: user.trialEndsAt?.toISOString() ?? null,
      },
      quotas,
      unlockedAssets,
      walletUpdatedAt: wallet?.updatedAt?.toISOString() ?? null,
    })
  } catch (error: any) {
    console.error('[wallet API]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

