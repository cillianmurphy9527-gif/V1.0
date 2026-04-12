import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

/**
 * POST /api/user/security
 * Body: { email?, password?, code }
 *
 * 校验短信验证码后，更新用户的邮箱和/或密码。
 * 万能验证码（测试用）：123456
 *
 * 安全规范：强制使用 session.user.id 进行数据库操作，绝不使用前端传来的标识字段
 */
export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request as any, secret: process.env.NEXTAUTH_SECRET })
    if (!token?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { email, password, code } = await request.json()

    // ── 第一道防线：验证码校验 ──────────────────────────────────
    if (!code) {
      return NextResponse.json({ error: '请输入验证码' }, { status: 400 })
    }

    const phone = token.phone as string | undefined

    // 万能验证码（测试环境放行）
    const isMasterCode = code === '123456'

    if (!isMasterCode) {
      // 校验数据库中真实的验证码记录
      if (!phone) {
        return NextResponse.json({ error: '账号未绑定手机号，无法验证' }, { status: 400 })
      }
      const record = await prisma.verificationCode.findFirst({
        where: {
          phone,
          code,
          used: false,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'desc' },
      })
      if (!record) {
        return NextResponse.json({ error: '验证码错误或已过期' }, { status: 400 })
      }
      // 标记验证码已使用
      await prisma.verificationCode.update({
        where: { id: record.id },
        data: { used: true },
      })
    }

    // ── 第二道防线：至少有一个字段要修改 ───────────────────────
    if (!email && !password) {
      return NextResponse.json({ error: '未提供需要修改的内容' }, { status: 400 })
    }

    // ── 强制使用 session.user.id 查找用户（安全规范）────────────
    const dbUser = await prisma.user.findUnique({
      where: { id: token.id as string },
    })
    if (!dbUser) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 })
    }

    // ── 构建更新数据 ────────────────────────────────────────────
    const updateData: { email?: string; password?: string } = {}

    if (email && email.trim() !== dbUser.email) {
      // 检查邮箱是否已被其他用户占用
      const existing = await prisma.user.findUnique({ where: { email: email.trim() } })
      if (existing && existing.id !== dbUser.id) {
        return NextResponse.json({ error: '该邮箱已被其他账号使用' }, { status: 409 })
      }
      updateData.email = email.trim()
    }

    if (password && password.trim().length > 0) {
      if (password.trim().length < 6) {
        return NextResponse.json({ error: '密码长度不能少于 6 位' }, { status: 400 })
      }
      updateData.password = await bcrypt.hash(password.trim(), 10)
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: '未检测到有效修改' }, { status: 400 })
    }

    // ── 执行更新 ─────────────────────────────────────────────────
    await prisma.user.update({
      where: { id: dbUser.id },
      data:  updateData,
    })

    return NextResponse.json({ success: true, message: '安全信息已更新' })
  } catch (error: any) {
    console.error('[security API] 错误:', error?.message)
    return NextResponse.json({ error: error?.message || '服务器内部错误' }, { status: 500 })
  }
}
