import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import { unlink } from 'fs/promises'
import path from 'path'

const PLAN_QUOTAS: Record<string, number> = {
  STARTER: 50000,
  PRO: 200000,
  MAX: 500000,    // 50万 tokens
  TRIAL: 50000,
}

export async function GET(request: NextRequest) {
  try {
    const token = await getToken({
      req: request as any,
      secret: process.env.NEXTAUTH_SECRET,
    })

    if (!token?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = token.id as string

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        phone: true,
        name: true,
        companyName: true,
        image: true,
        industry: true,
        website: true,
        businessDesc: true,
        tokenBalance: true,
        subscriptionTier: true,
        monthlySearches: true,
        ragFileCount: true,
        monthlyResetAt: true,
        trialEndsAt: true,
        bounceCount: true,
        isSendingSuspended: true,
      },
    })

    if (!user) {
      // 兜底：DB 中不存在该用户（如硬编码开发账号），直接从 JWT token 读取字段
      const tokenPhone = (token.phone as string | undefined) || ''
      const tokenEmail = (token.email as string | undefined) || ''
      // 若 email 字段存的是手机号（历史数据错位），则 email 显示为空
      const isPhoneLike = (s: string) => /^\d{8,}$/.test(s.replace(/[\s\-+]/g, ''))
      return NextResponse.json({
        id:               token.id,
        phone:            tokenPhone,
        email:            isPhoneLike(tokenEmail) ? '' : tokenEmail,
        name:             '',
        companyName:      '',
        image:            '',
        tokenBalance:     0,
        totalTokens:      50000,
        subscriptionTier: 'TRIAL',
        nextRenewalDate:  '未设置',
        monthlySearches:  0,
        ragFileCount:     0,
        trialEndsAt:      null,
        bounceCount:      0,
        isSendingSuspended: false,
      })
    }

    const totalTokens = PLAN_QUOTAS[user.subscriptionTier] || 0
    const nextRenewalDate = user.monthlyResetAt
      ? new Date(user.monthlyResetAt).toLocaleDateString('zh-CN')
      : '未设置'

    return NextResponse.json({
      id:               user.id,
      // phone 字段是真实手机号（登录凭证）
      phone:            user.phone,
      // email 字段：若历史数据把手机号存入了 email，则返回空字符串，避免前端错误展示
      email:            (() => {
        const isPhoneLike = (s: string) => /^\d{8,}$/.test(s.replace(/[\s\-+]/g, ''))
        return user.email && !isPhoneLike(user.email) ? user.email : ''
      })(),
      name:             user.name        || '',
      companyName:      user.companyName,
      image:            user.image       || '',
      industry:         user.industry    || '',
      website:          user.website     || '',
      businessDesc:     user.businessDesc || '',
      tokenBalance:     user.tokenBalance,
      totalTokens,
      subscriptionTier: user.subscriptionTier,
      nextRenewalDate,
      monthlySearches:  user.monthlySearches,
      ragFileCount:     user.ragFileCount,
      trialEndsAt:      user.trialEndsAt,
      bounceCount:      user.bounceCount,
      isSendingSuspended: user.isSendingSuspended,
    })
  } catch (error) {
    console.error('Failed to fetch user assets:', error)
    return NextResponse.json(
      { error: '服务暂不可用，请稍后重试', code: 500 },
      { status: 500 }
    )
  }
}

// ─── PATCH /api/user/assets ─── 保存企业资料
export async function PATCH(request: NextRequest) {
  try {
    const token = await getToken({ req: request as any, secret: process.env.NEXTAUTH_SECRET })
    if (!token?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = token.id as string
    const body = await request.json()

    // 仅提取合法字段，丢弃所有其他字段（含 system 字段）
    const name         = body.name
    const companyName  = body.companyName
    const image        = body.image
    const industry     = body.industry
    const website      = body.website
    const businessDesc = body.businessDesc

    // ─── Base64 防御：拒绝 data:image... 写入数据库 ────────────────
    // 原因：Base64 字符串会撑爆 NextAuth JWT Cookie（4KB 限制），
    // 即使 auth.ts 已拦截，数据库也不应存储冗余的 Base64 源码。
    const safeImage = (() => {
      if (!image) return null
      if (typeof image === 'string' && image.startsWith('data:image')) return null
      return image
    })()

    // 构建干净的 Prisma payload
    const updateData: Record<string, string | null> = {}
    if (name         !== undefined) updateData.name          = name
    if (companyName  !== undefined) updateData.companyName   = companyName
    if (image        !== undefined) updateData.image         = safeImage
    if (industry     !== undefined) updateData.industry      = industry
    if (website      !== undefined) updateData.website       = website
    if (businessDesc !== undefined) updateData.businessDesc  = businessDesc

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: '没有需要保存的字段' }, { status: 400 })
    }

    // ── 脏数据清理：物理删除旧头像文件 ────────────────────────────────────
    // 策略：只有当本次请求包含 image 字段时，才需要处理旧文件。
    // 条件：旧路径指向 /uploads/avatars/ 目录（说明是用户上传的），且不是默认头像。
    // 原因：避免用户换 100 次头像时，磁盘堆满 99 个垃圾文件。
    // 注意：即使 unlink 失败也不阻断主流程（只多一个过期文件，不影响功能）。
    if (updateData.image !== undefined && updateData.image !== null) {
      try {
        const userRecord = await prisma.user.findUnique({
          where: { id: userId },
          select: { image: true },
        })
        const oldImage = userRecord?.image
        if (
          oldImage &&
          typeof oldImage === 'string' &&
          oldImage.startsWith('/uploads/avatars/')
        ) {
          const oldPath = path.join(process.cwd(), 'public', oldImage)
          await unlink(oldPath).catch(() => { /* 忽略删除失败，如文件已不存在 */ })
        }
      } catch {
        // 静默处理，确保清理失败不影响主流程
      }
    }

    await prisma.user.update({
      where: { id: userId },
      data:  updateData,
    })

    return NextResponse.json({ success: true, message: '资料已保存' })
  } catch (error) {
    console.error('[assets PATCH] Error:', error)
    return NextResponse.json(
      { error: '保存失败，请稍后重试', code: 500 },
      { status: 500 }
    )
  }
}
