import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/affiliate/generate-code
 * 为当前用户生成并保存唯一邀请码（幂等：若已存在则直接返回）
 */
export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request as any, secret: process.env.NEXTAUTH_SECRET })
    if (!token?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const userId = token.id as string

    // 确保硬编码账号在 DB 中存在（与 stats API 保持一致）
    await ensureUserExists(userId)

    // 复用 stats API 中的统一邀请码逻辑
    const referralCode = await ensureReferralCode(userId)

    return NextResponse.json({ referralCode })
  } catch (error: any) {
    console.error('[Generate code]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * 统一邀请码生成逻辑（供 stats 和 generate-code 两个 API 共用）
 */
async function ensureReferralCode(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { referralCode: true },
  })
  if (!user) throw new Error('User not found')
  if (user.referralCode) return user.referralCode

  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let attempt = 0; attempt < 10; attempt++) {
    code = ''
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
    const existing = await prisma.user.findFirst({ where: { referralCode: code } })
    if (!existing) break
  }
  if (!code) code = 'LP' + Date.now().toString(36).toUpperCase().slice(-4)

  await prisma.user.update({
    where: { id: userId },
    data: { referralCode: code },
  })
  return code
}

// ─── 辅助函数（确保开发环境硬编码用户存在）────────────────────────────
async function ensureUserExists(userId: string): Promise<void> {
  const seed = HARDCODED_SEEDS[userId]
  if (!seed) return
  await prisma.user.upsert({
    where: { id: userId },
    update: {},
    create: { id: userId, ...seed },
  })
}

const HARDCODED_SEEDS: Record<string, { phone: string; email: string; companyName: string; role: string; subscriptionTier: string; tokenBalance: number; features: string }> = {
  'dev-admin-super': {
    phone: '18342297595',
    email: 'admin@leadpilot.cn',
    companyName: '系统管理员',
    role: 'ADMIN',
    subscriptionTier: 'MAX',
    tokenBalance: 9999999,
    features: JSON.stringify({ canUseInbox: true, aiScoring: true, multiDomain: true }),
  },
  'dev-user-dashboard': {
    phone: '1390504583',
    email: '1390504583@qq.com',
    companyName: '测试用户',
    role: 'USER',
    subscriptionTier: 'PRO',
    tokenBalance: 100000,
    features: JSON.stringify({ canUseInbox: true, aiScoring: true, multiDomain: false }),
  },
}
