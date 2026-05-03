import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { getCodeStore } from '@/lib/verification-store'

const codeStore = getCodeStore()

/**
 * POST /api/admin/profile/send-code
 * body: { purpose: 'update' | 'password' }
 *
 * TODO: 对接阿里云/腾讯云短信 API，将 console.log 替换为真实短信发送
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const role = session.user.role
    if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const purpose = String(body?.purpose || 'update')

    // 防刷：同一用户 60 秒内不允许重复发送
    const existing = codeStore.get(session.user.id)
    if (existing && existing.expiresAt - 4 * 60 * 1000 > Date.now()) {
      return NextResponse.json({ error: '请勿频繁发送，60 秒后再试' }, { status: 429 })
    }

    // 生成 6 位随机数字验证码
    const code = String(Math.floor(100000 + Math.random() * 900000))
    const expiresAt = Date.now() + 5 * 60 * 1000 // 5 分钟有效

    codeStore.set(session.user.id, { code, expiresAt, purpose })

    // TODO: 对接阿里云/腾讯云短信 API，发送到 session.user.phone
    // TODO: 或调用 Email 服务发送到 session.user.email
    console.log(`\n【安全验证码 - ${purpose}】用户: ${session.user.email || session.user.id} | 验证码: ${code} | 有效期: 5分钟\n`)

    return NextResponse.json({
      success: true,
      message: `验证码已发送至 ${session.user.email ? session.user.email.replace(/(.{2}).+(@.+)/, '$1***$2') : '您的手机'}（开发模式：请查看服务端终端）`,
    })
  } catch (error: any) {
    console.error('[Send Code] Error:', error)
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}