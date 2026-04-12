import { NextRequest, NextResponse } from 'next/server'
import { getRedis } from '@/lib/redis'

/** Node 运行时（ioredis 依赖 TCP，不可用 Edge） */
export const runtime = 'nodejs'

/** 11 位中国大陆手机号：1 开头，第二位 3–9，共 11 位数字 */
const PHONE_REGEX = /^1[3-9]\d{9}$/

const RATE_KEY = (phone: string) => `rate_limit_phone_${phone}`
const AUTH_KEY = (phone: string) => `auth_code_${phone}`

/**
 * POST /api/auth/send-code
 * Body: { "phone": "13800138000" }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const raw = body && typeof body.phone === 'string' ? body.phone.trim() : ''

    if (!PHONE_REGEX.test(raw)) {
      return NextResponse.json({ error: '手机号格式不正确' }, { status: 400 })
    }

    const phone = raw

    const redis = getRedis()
    if (!redis) {
      return NextResponse.json({ error: '服务暂不可用，请稍后重试' }, { status: 503 })
    }

    const rateLimitKey = RATE_KEY(phone)
    const alreadyLimited = await redis.exists(rateLimitKey)
    if (alreadyLimited === 1) {
      return NextResponse.json({ error: '发送过于频繁，请 60 秒后再试' }, { status: 429 })
    }

    await redis.set(rateLimitKey, '1', 'EX', 60)

    const code = String(Math.floor(100000 + Math.random() * 900000))
    await redis.set(AUTH_KEY(phone), code, 'EX', 300)

    console.log(`[模拟阿里云SMS] 成功向手机号 ${phone} 发送验证码: ${code}`)

    return NextResponse.json({ success: true, message: '验证码已发送' }, { status: 200 })
  } catch (e) {
    console.error('[send-code]', e)
    return NextResponse.json({ error: '发送失败，请稍后重试' }, { status: 500 })
  }
}
