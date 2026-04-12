import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

function generateTempPassword() {
  // 12 chars: letters+numbers
  return Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 8)
}

/**
 * POST /api/admin/managers
 * 仅 SUPER_ADMIN：创建新的管理员账号（role=ADMIN）
 *
 * body:
 * - phone (required)
 * - email (optional)
 * - password (optional; if missing, server generates temp password and returns it)
 */
export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request as any, secret: process.env.NEXTAUTH_SECRET })
    if (!token?.id || token.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const phone = String(body?.phone || '').trim()
    const email = body?.email ? String(body.email).trim().toLowerCase() : null
    const passwordInput = body?.password ? String(body.password) : ''

    if (!phone || !/^\d{5,20}$/.test(phone)) {
      return NextResponse.json({ error: '无效手机号' }, { status: 400 })
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: '无效邮箱' }, { status: 400 })
    }

    const existingPhone = await prisma.user.findUnique({ where: { phone }, select: { id: true } })
    if (existingPhone) {
      return NextResponse.json({ error: '手机号已存在' }, { status: 409 })
    }

    if (email) {
      const existingEmail = await prisma.user.findUnique({ where: { email }, select: { id: true } })
      if (existingEmail) {
        return NextResponse.json({ error: '邮箱已存在' }, { status: 409 })
      }
    }

    const tempPassword = passwordInput || generateTempPassword()
    const hashed = await bcrypt.hash(tempPassword, 10)

    const created = await prisma.user.create({
      data: {
        phone,
        email,
        password: hashed,
        companyName: '管理员',
        role: 'ADMIN',
        subscriptionTier: 'MAX',
        features: JSON.stringify({ canUseInbox: true, aiScoring: true, multiDomain: true }),
        tokenBalance: 0,
        monthlySearches: 0,
        ragFileCount: 0,
      },
      select: { id: true, phone: true, email: true, role: true, createdAt: true },
    })

    return NextResponse.json({
      success: true,
      manager: {
        id: created.id,
        phone: created.phone,
        email: created.email,
        role: created.role,
        createdAt: created.createdAt.toISOString(),
      },
      tempPassword: passwordInput ? undefined : tempPassword,
    })
  } catch (e: any) {
    console.error('[Admin Managers] Error:', e)
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}

