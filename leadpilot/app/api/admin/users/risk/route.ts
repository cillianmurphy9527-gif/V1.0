import { NextRequest, NextResponse } from "next/server"
import { prisma } from '@/lib/prisma'
import { requireAdminRole } from '@/lib/admin-auth'
import { unsuspendUserSending } from '@/lib/email-compliance'

/**
 * 管理后台 - 用户风控管理 API
 * 
 * GET /api/admin/users/risk - 查询高风险用户
 * POST /api/admin/users/suspend - 暂停用户发信
 * POST /api/admin/users/unsuspend - 恢复用户发信
 */

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminRole()
    if (!auth.ok) return auth.response
    const user = { role: token?.role as string | undefined }
    if (user?.role !== 'ADMIN' && user?.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 查询高风险用户（退信数 >= 5 或已被暂停）
    const riskUsers = await prisma.user.findMany({
      where: {
        OR: [
          { bounceCount: { gte: 5 } },
          { isSendingSuspended: true }
        ]
      },
      select: {
        id: true,
        phone: true,
        email: true,
        companyName: true,
        bounceCount: true,
        isSendingSuspended: true,
        subscriptionTier: true,
        createdAt: true,
        deviceFingerprints: {
          select: {
            ipAddress: true,
            fingerprint: true,
            trialClaimed: true,
            createdAt: true
          },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      },
      orderBy: { bounceCount: 'desc' },
      take: 50
    })

    return NextResponse.json({ 
      success: true,
      data: riskUsers,
      total: riskUsers.length
    })

  } catch (error) {
    console.error("Risk users query error:", error)
    return NextResponse.json({ error: "查询失败" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // 验证管理员权限
    const token = await getToken({ req: request as any, secret: process.env.NEXTAUTH_SECRET })
    if (!token?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const user = { role: token?.role as string | undefined }
    if (user?.role !== 'ADMIN' && user?.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { action, userId, reason } = await request.json()

    if (!action || !userId) {
      return NextResponse.json({ error: "缺少必填字段" }, { status: 400 })
    }

    if (action === 'suspend') {
      // 暂停用户发信
      await prisma.user.update({
        where: { id: userId },
        data: { isSendingSuspended: true }
      })

      // 发送通知
      await prisma.systemNotification.create({
        data: {
          userId,
          title: '发信权限已暂停',
          content: reason || '您的账号因违规操作被暂停发信权限，请联系客服处理。',
          type: 'SYSTEM',
          actionUrl: '/dashboard/tickets'
        }
      })

      console.log(`🚨 管理员 ${token.id} 暂停了用户 ${userId} 的发信权限`)

      return NextResponse.json({
        success: true,
        message: "用户发信权限已暂停"
      })

    } else if (action === 'unsuspend') {
      // 恢复用户发信
      await unsuspendUserSending(userId, token.id as string)

      return NextResponse.json({
        success: true,
        message: "用户发信权限已恢复"
      })

    } else {
      return NextResponse.json({ error: "无效的操作" }, { status: 400 })
    }

  } catch (error) {
    console.error("User risk management error:", error)
    return NextResponse.json({ error: "操作失败" }, { status: 500 })
  }
}
