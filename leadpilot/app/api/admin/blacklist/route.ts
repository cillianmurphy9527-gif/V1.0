import { NextRequest, NextResponse } from "next/server"
import { prisma } from '@/lib/prisma'
import { requireAdminRole } from '@/lib/admin-auth'

/**
 * 管理后台 - IP 黑名单管理 API
 * 
 * GET /api/admin/blacklist?type=ip|email
 * POST /api/admin/blacklist - 添加黑名单
 * DELETE /api/admin/blacklist - 移除黑名单
 */

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminRole()
    if (!auth.ok) return auth.response

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'ip'

    if (type === 'ip') {
      const ipBlacklist = await prisma.ipBlacklist.findMany({
        orderBy: { createdAt: 'desc' },
        take: 100
      })
      return NextResponse.json({ data: ipBlacklist })
    } else if (type === 'email') {
      const emailBlacklist = await prisma.unsubscribeList.findMany({
        orderBy: { createdAt: 'desc' },
        take: 100
      })
      return NextResponse.json({ data: emailBlacklist })
    }

    return NextResponse.json({ error: "无效的类型参数" }, { status: 400 })

  } catch (error) {
    console.error("Blacklist GET error:", error)
    return NextResponse.json({ error: "查询失败" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // 验证管理员权限
    const token = await getToken({ req: request as any, secret: process.env.NEXTAUTH_SECRET })
    const user = { role: token?.role as string | undefined }
    if (user?.role !== 'ADMIN' && user?.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { type, value, reason, expiresInDays } = await request.json()

    if (!type || !value || !reason) {
      return NextResponse.json({ error: "缺少必填字段" }, { status: 400 })
    }

    if (type === 'ip') {
      const expiresAt = expiresInDays 
        ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
        : null

      await prisma.ipBlacklist.create({
        data: {
          ipAddress: value,
          reason,
          expiresAt
        }
      })

      return NextResponse.json({ 
        success: true, 
        message: `IP ${value} 已加入黑名单` 
      })

    } else if (type === 'email') {
      await prisma.unsubscribeList.create({
        data: {
          email: value,
          reason,
          source: 'ADMIN'
        }
      })

      return NextResponse.json({ 
        success: true, 
        message: `邮箱 ${value} 已加入退订列表` 
      })
    }

    return NextResponse.json({ error: "无效的类型参数" }, { status: 400 })

  } catch (error) {
    console.error("Blacklist POST error:", error)
    return NextResponse.json({ error: "添加失败" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // 验证管理员权限
    const token = await getToken({ req: request as any, secret: process.env.NEXTAUTH_SECRET })
    const user = { role: token?.role as string | undefined }
    if (user?.role !== 'ADMIN' && user?.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { type, value } = await request.json()

    if (!type || !value) {
      return NextResponse.json({ error: "缺少必填字段" }, { status: 400 })
    }

    if (type === 'ip') {
      await prisma.ipBlacklist.delete({
        where: { ipAddress: value }
      })

      return NextResponse.json({ 
        success: true, 
        message: `IP ${value} 已从黑名单移除` 
      })

    } else if (type === 'email') {
      await prisma.unsubscribeList.delete({
        where: { email: value }
      })

      return NextResponse.json({ 
        success: true, 
        message: `邮箱 ${value} 已从退订列表移除` 
      })
    }

    return NextResponse.json({ error: "无效的类型参数" }, { status: 400 })

  } catch (error) {
    console.error("Blacklist DELETE error:", error)
    return NextResponse.json({ error: "删除失败" }, { status: 500 })
  }
}
