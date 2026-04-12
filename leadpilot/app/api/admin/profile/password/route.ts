import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { codeStore } from '../send-code/route'

const DEV_ACCOUNTS: Record<string, string> = {
  'dev-admin-super': 'jiaofuquan123@',
  'dev-user-dashboard': 'jiaofuquan123@',
  'dev-admin-001': 'admin888@',
}

/**
 * PATCH /api/admin/profile/password
 * body: { oldPassword, newPassword, code }
 * 修改当前管理员登录密码 — 必须携带有效验证码
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const role = session.user.role
    if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const oldPassword = String(body?.oldPassword || '')
    const newPassword = String(body?.newPassword || '')
    const code = String(body?.code || '').trim()

    if (!oldPassword || !newPassword) {
      return NextResponse.json({ error: '请填写旧密码和新密码' }, { status: 400 })
    }
    if (newPassword.length < 8) {
      return NextResponse.json({ error: '新密码至少 8 位' }, { status: 400 })
    }

    const isDevAccount = session.user.id in DEV_ACCOUNTS

    // 验证码校验（开发账号跳过）
    if (!isDevAccount) {
      if (!code) {
        return NextResponse.json({ error: '请输入验证码' }, { status: 400 })
      }
      const stored = codeStore.get(session.user.id)
      if (!stored || stored.purpose !== 'password') {
        return NextResponse.json({ error: '验证码无效，请重新获取' }, { status: 400 })
      }
      if (Date.now() > stored.expiresAt) {
        codeStore.delete(session.user.id)
        return NextResponse.json({ error: '验证码已过期，请重新获取' }, { status: 400 })
      }
      if (stored.code !== code) {
        return NextResponse.json({ error: '验证码错误，请检查后重试' }, { status: 400 })
      }
      codeStore.delete(session.user.id)
    }

    // 开发账号：明文比对，不写数据库
    if (isDevAccount) {
      if (oldPassword !== DEV_ACCOUNTS[session.user.id]) {
        return NextResponse.json({ error: '旧密码不正确' }, { status: 400 })
      }
      return NextResponse.json({ success: true, message: '开发账号密码已模拟更新（不持久化）' })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { password: true },
    })
    if (!user?.password) {
      return NextResponse.json({ error: '账号数据异常，请联系超级管理员' }, { status: 500 })
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password)
    if (!isMatch) {
      return NextResponse.json({ error: '旧密码不正确' }, { status: 400 })
    }

    const hashed = await bcrypt.hash(newPassword, 10)
    await prisma.user.update({
      where: { id: session.user.id },
      data: { password: hashed },
    })

    return NextResponse.json({ success: true, message: '密码已更新，下次登录请使用新密码' })
  } catch (error: any) {
    console.error('[Admin Profile Password] Error:', error)
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}
