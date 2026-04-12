import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

/**
 * POST /api/auth/reset-password
 * Body: { phone, code, newPassword }
 *
 * 校验验证码 → bcrypt hash → 更新密码
 * 内测万能码：123456
 */
export async function POST(request: NextRequest) {
  try {
    const { phone, code, newPassword } = await request.json()

    // ── 基础参数校验 ────────────────────────────────────────────
    if (!phone?.trim()) {
      return NextResponse.json({ error: '请输入手机号' }, { status: 400 })
    }
    if (!code?.trim()) {
      return NextResponse.json({ error: '请输入验证码' }, { status: 400 })
    }
    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json({ error: '密码不能少于 6 位' }, { status: 400 })
    }

    // ── 验证码校验（万能码 123456 直接放行）──────────────────────
    const isMasterCode = code === '123456'
    if (!isMasterCode) {
      const record = await prisma.verificationCode.findFirst({
        where: {
          phone,
          code,
          used:      false,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'desc' },
      })
      if (!record) {
        return NextResponse.json({ error: '验证码错误或已过期' }, { status: 400 })
      }
      // 标记已使用（防重放）
      await prisma.verificationCode.update({
        where: { id: record.id },
        data:  { used: true },
      })
    }

    // ── 查找用户（兼容 phone 字段 + 历史 email 字段存了手机号）──
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { phone },
          { email: phone },
        ],
      },
    })
    if (!user) {
      return NextResponse.json({ error: '该手机号未注册' }, { status: 404 })
    }

    // ── 密码强度校验（与注册接口保持一致）─────────────────────────
    const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d@$!%*?&_#.\-]{8,32}$/
    if (!PASSWORD_REGEX.test(newPassword)) {
      return NextResponse.json(
        { error: '密码需为 8-32 位，必须包含大小写字母与数字，且不能含有空格或中文字符' },
        { status: 400 }
      )
    }

    // ── bcrypt hash & 更新 ────────────────────────────────────────
    const hashed = await bcrypt.hash(newPassword, 10)
    await prisma.user.update({
      where: { id: user.id },
      data:  { password: hashed },
    })

    console.log(`[reset-password] ✅ 用户 ${phone} 密码重置成功`)
    return NextResponse.json({ success: true, message: '密码重置成功，请使用新密码登录' })
  } catch (error: any) {
    console.error('[reset-password]', error?.message)
    return NextResponse.json({ error: '重置失败，请稍后重试' }, { status: 500 })
  }
}
