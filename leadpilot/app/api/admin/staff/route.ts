import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminRole } from '@/lib/admin-auth'

const VALID_ROLES = ['SUPER_ADMIN', 'FINANCE', 'OPS']

/**
 * GET /api/admin/staff
 * 获取所有内部员工列表（adminRole 非 null 的用户）
 * 仅 SUPER_ADMIN 可访问
 */
export async function GET(_request: NextRequest) {
  try {
    const auth = await requireAdminRole(['SUPER_ADMIN'])
    if (!auth.ok) return auth.response

    const staff = await prisma.user.findMany({
      where: { adminRole: { not: null } },
      select: {
        id: true,
        email: true,
        phone: true,
        adminRole: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ staff })
  } catch (error: any) {
    console.error('[Admin Staff GET] Error:', error)
    return NextResponse.json({ error: error.message || '获取员工列表失败' }, { status: 500 })
  }
}

/**
 * POST /api/admin/staff
 * 为已有用户分配内部员工角色
 * body: { email: string, adminRole: 'SUPER_ADMIN' | 'FINANCE' | 'OPS' }
 * 仅 SUPER_ADMIN 可操作
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminRole(['SUPER_ADMIN'])
    if (!auth.ok) return auth.response

    const body = await request.json()
    const email = String(body?.email || '').trim().toLowerCase()
    const adminRole = String(body?.adminRole || '').trim()

    if (!email) {
      return NextResponse.json({ error: '请输入用户邮箱' }, { status: 400 })
    }
    if (!VALID_ROLES.includes(adminRole)) {
      return NextResponse.json(
        { error: `角色无效，允许值：${VALID_ROLES.join(', ')}` },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return NextResponse.json({ error: '未找到该邮箱对应的用户' }, { status: 404 })
    }

    const updated = await prisma.user.update({
      where: { email },
      data: { adminRole },
      select: { id: true, email: true, phone: true, adminRole: true, createdAt: true },
    })

    return NextResponse.json({ success: true, staff: updated })
  } catch (error: any) {
    console.error('[Admin Staff POST] Error:', error)
    return NextResponse.json({ error: error.message || '添加员工失败' }, { status: 500 })
  }
}

/**
 * PATCH /api/admin/staff
 * 修改员工角色
 * body: { userId: string, adminRole: string }
 * 仅 SUPER_ADMIN 可操作
 */
export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAdminRole(['SUPER_ADMIN'])
    if (!auth.ok) return auth.response

    const body = await request.json()
    const userId = String(body?.userId || '').trim()
    const adminRole = String(body?.adminRole || '').trim()

    if (!userId) {
      return NextResponse.json({ error: '缺少 userId' }, { status: 400 })
    }
    if (!VALID_ROLES.includes(adminRole)) {
      return NextResponse.json(
        { error: `角色无效，允许值：${VALID_ROLES.join(', ')}` },
        { status: 400 }
      )
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { adminRole },
      select: { id: true, email: true, phone: true, adminRole: true, createdAt: true },
    })

    return NextResponse.json({ success: true, staff: updated })
  } catch (error: any) {
    console.error('[Admin Staff PATCH] Error:', error)
    return NextResponse.json({ error: error.message || '更新角色失败' }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/staff?userId=xxx
 * 撤销员工角色（将 adminRole 置为 null）
 * 仅 SUPER_ADMIN 可操作
 */
export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAdminRole(['SUPER_ADMIN'])
    if (!auth.ok) return auth.response

    const userId = new URL(request.url).searchParams.get('userId')
    if (!userId) {
      return NextResponse.json({ error: '缺少 userId' }, { status: 400 })
    }

    await prisma.user.update({
      where: { id: userId },
      data: { adminRole: null },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[Admin Staff DELETE] Error:', error)
    return NextResponse.json({ error: error.message || '撤销角色失败' }, { status: 500 })
  }
}

