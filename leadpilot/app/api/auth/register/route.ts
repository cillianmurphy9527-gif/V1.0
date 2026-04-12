import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/password'
import { Prisma } from '@prisma/client'
import { getClientIp, performAntiAbuseCheck, logIpRegistration } from '@/lib/anti-abuse'
import { getRedis } from '@/lib/redis'

const PHONE_REGEX = /^1[3-9]\d{9}$/

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const name = typeof body?.name === 'string' ? body.name.trim() : ''
    const email =
      typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
    const phone = typeof body?.phone === 'string' ? body.phone.trim() : ''
    const password = typeof body?.password === 'string' ? body.password : ''
    const code = body?.code != null ? String(body.code).trim() : ''

    if (!name || !email || !phone || !password || !code) {
      return NextResponse.json({ error: '缺少必要字段' }, { status: 400 })
    }

    if (!PHONE_REGEX.test(phone)) {
      return NextResponse.json({ error: '手机号格式不正确' }, { status: 400 })
    }

    const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d@$!%*?&_#.\-]{8,32}$/
    if (!PASSWORD_REGEX.test(password)) {
      return NextResponse.json(
        {
          error: '密码需为 8-32 位，必须包含大小写字母与数字，且不能含有空格或中文字符',
        },
        { status: 400 }
      )
    }

    const redis = getRedis()
    if (!redis) {
      return NextResponse.json({ error: '验证码错误或已过期' }, { status: 400 })
    }

    const authKey = `auth_code_${phone}`
    const stored = await redis.get(authKey)
    if (!stored || stored !== code) {
      return NextResponse.json({ error: '验证码错误或已过期' }, { status: 400 })
    }

    const clientIp = getClientIp()
    const antiAbuseCheck = await performAntiAbuseCheck(clientIp)
    if (!antiAbuseCheck.allowed) {
      return NextResponse.json(
        { error: antiAbuseCheck.reason || '注册被拒绝' },
        { status: 403 }
      )
    }

    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      return NextResponse.json({ error: '邮箱已被注册' }, { status: 409 })
    }

    const existingPhone = await prisma.user.findUnique({ where: { phone } })
    if (existingPhone) {
      return NextResponse.json({ error: '手机号已被注册' }, { status: 409 })
    }

    const hashedPassword = await hashPassword(password)
    const referralCode = `REF_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
    const trialEndsAt = new Date()
    trialEndsAt.setDate(trialEndsAt.getDate() + 7)

    const features: Prisma.InputJsonValue = {
      canUseInbox: true,
      aiScoring: true,
      multiDomain: false,
    }

    const user = await prisma.user.create({
      data: {
        name,
        companyName: name,
        email,
        phone,
        password: hashedPassword,
        phoneVerified: new Date(),
        subscriptionTier: 'TRIAL',
        tokenBalance: 50000,
        referralCode,
        trialEndsAt,
        registerIp: clientIp,
        features,
      },
    })

    await redis.del(authKey)
    await logIpRegistration(clientIp, user.id, email)

    return NextResponse.json(
      {
        success: true,
        message: '注册成功，已为您发放 50,000 体验 Token',
        user: {
          id: user.id,
          email: user.email,
          phone: user.phone,
          tokenBalance: user.tokenBalance,
          trialEndsAt: user.trialEndsAt,
        },
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json({ error: '注册失败，请稍后重试' }, { status: 500 })
  }
}
