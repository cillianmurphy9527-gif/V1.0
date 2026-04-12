import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/auth/send-reset-code
 * Body: { phone }
 *
 * 查验手机号是否已注册 → 模拟发送验证码
 * 内测万能码：123456
 */
export async function POST(request: NextRequest) {
  try {
    const { phone } = await request.json()

    if (!phone?.trim()) {
      return NextResponse.json({ error: '请输入手机号' }, { status: 400 })
    }

    const phoneRegex = /^1[3-9]\d{9}$/
    if (!phoneRegex.test(phone)) {
      return NextResponse.json({ error: '手机号格式不正确' }, { status: 400 })
    }

    // 查询用户是否存在（phone 字段优先，兼容历史数据 email 字段存了手机号的情况）
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { phone },
          { email: phone },
        ],
      },
    })

    if (!user) {
      return NextResponse.json({ error: '该手机号未注册，请先注册账号' }, { status: 404 })
    }

    // 频率限制：60 秒内只能发一次
    const recent = await prisma.verificationCode.findFirst({
      where: {
        phone,
        createdAt: { gt: new Date(Date.now() - 60 * 1000) },
      },
      orderBy: { createdAt: 'desc' },
    })
    if (recent) {
      return NextResponse.json({ error: '发送过于频繁，请 60 秒后重试' }, { status: 429 })
    }

    // 生成验证码并写库（内测固定为 123456）
    const mockCode = process.env.NODE_ENV === 'production'
      ? Math.floor(100000 + Math.random() * 900000).toString()
      : '123456'
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000)

    await prisma.verificationCode.create({
      data: { phone, code: mockCode, expiresAt, used: false },
    })

    // 模拟短信（控制台打印）
    console.log('='.repeat(60))
    console.log(`📱 【模拟短信】向 ${phone} 发送重置验证码: ${mockCode}`)
    console.log(`⏰ 有效期 5 分钟，过期时间: ${expiresAt.toLocaleString('zh-CN')}`)
    console.log('='.repeat(60))

    return NextResponse.json({
      success: true,
      message: '验证码已发送',
      ...(process.env.NODE_ENV !== 'production' && { code: mockCode, betaMode: true }),
    })
  } catch (error: any) {
    console.error('[send-reset-code]', error?.message)
    return NextResponse.json({ error: '发送失败，请稍后重试' }, { status: 500 })
  }
}
