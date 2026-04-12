import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { codeStore } from '../send-code/route'

const DEV_IDS = ['dev-admin-super', 'dev-user-dashboard', 'dev-admin-001']

/**
 * PATCH /api/admin/profile/update
 * body: { companyName?, phone?, code }
 * 更新当前管理员的基础资料 — 必须携带有效验证码
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
    const code = String(body?.code || '').trim()
    const companyName = body?.companyName !== undefined ? String(body.companyName).trim() : undefined
    const phone = body?.phone !== undefined ? String(body.phone).trim() : undefined

    // 验证码校验（开发账号跳过）
    if (!DEV_IDS.includes(session.user.id)) {
      if (!code) {
        return NextResponse.json({ error: '请输入验证码' }, { status: 400 })
      }
      const stored = codeStore.get(session.user.id)
      if (!stored || stored.purpose !== 'update') {
        return NextResponse.json({ error: '验证码无效，请重新获取' }, { status: 400 })
      }
      if (Date.now() > stored.expiresAt) {
        codeStore.delete(session.user.id)
        return NextResponse.json({ error: '验证码已过期，请重新获取' }, { status: 400 })
      }
      if (stored.code !== code) {
        return NextResponse.json({ error: '验证码错误，请检查后重试' }, { status: 400 })
      }
      // 验证通过，立即删除（一次性）
      codeStore.delete(session.user.id)
    }

    // 开发账号直接返回成功
    if (DEV_IDS.includes(session.user.id)) {
      return NextResponse.json({ success: true, message: '开发账号无需持久化，已模拟保存成功' })
    }

    const data: Record<string, string> = {}
    if (companyName !== undefined) data.companyName = companyName
    if (phone !== undefined) {
      if (phone) {
        const existing = await prisma.user.findUnique({ where: { phone }, select: { id: true } })
        if (existing && existing.id !== session.user.id) {
          return NextResponse.json({ error: '该手机号已被其他账号使用' }, { status: 409 })
        }
      }
      data.phone = phone
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: '没有需要更新的字段' }, { status: 400 })
    }

    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data,
      select: { id: true, companyName: true, phone: true, email: true },
    })

    return NextResponse.json({ success: true, user: updated })
  } catch (error: any) {
    console.error('[Admin Profile Update] Error:', error)
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}
