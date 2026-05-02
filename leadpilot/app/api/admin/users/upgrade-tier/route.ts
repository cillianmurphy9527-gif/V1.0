import { NextRequest, NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/admin-auth'
import { QuotaManager } from '@/lib/services/quota'

/**
 * POST /api/admin/users/upgrade-tier
 * 管理员手动调整用户 subscriptionTier，并自动同步所有配额
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminRole()
    if (!auth.ok) return auth.response

    const body = await request.json()
    const userId = String(body?.userId || '')
    const tier = String(body?.tier || '').toUpperCase()

    const allowed = new Set(['TRIAL', 'STARTER', 'PRO', 'MAX', 'FREE'])
    if (!userId || !allowed.has(tier)) {
      return NextResponse.json({ error: 'Invalid params' }, { status: 400 })
    }

    // 🌟 核心修复：调用 QuotaManager，自动同步 User + UserQuota
    const result = await QuotaManager.upgradeUserTier(userId, tier)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || '套餐修改失败' },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true, newQuota: result.newQuota })
  } catch (error: any) {
    console.error('[Admin UpgradeTier] Error:', error)
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}