import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// 🛡️ 邮箱脱敏工厂（加入空值保护）
function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return email || ''
  const [local, domain] = email.split('@')
  if (local.length <= 1) return `${local}***@${domain}`
  return `${local[0]}***@${domain}`
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status')
    const search = searchParams.get('search') || ''

    const skip = (page - 1) * limit

    // countOnly: 仅返回数量
    if (searchParams.get('countOnly') === 'true') {
      const total = await prisma.deliveryLog.count({ where: { userId: user.id } })
      return NextResponse.json({ count: total })
    }

    // pending: 仅统计未发送的记录（DRAFT/PENDING状态）
    if (searchParams.get('pending') === 'true') {
      const sentStatuses = ['SENT', 'DELIVERED', 'OPENED', 'CLICKED', 'REPLIED', 'BOUNCED', 'FAILED']
      const pendingCount = await prisma.deliveryLog.count({
        where: {
          userId: user.id,
          status: { notIn: sentStatuses },
        },
      })
      return NextResponse.json({ count: pendingCount })
    }

    const where: any = { userId: user.id }
    if (status) {
      where.status = status
    }
    if (search) {
      where.OR = [
        { recipientEmail: { contains: search, mode: 'insensitive' } },
        { subject: { contains: search, mode: 'insensitive' } },
        { companyName: { contains: search, mode: 'insensitive' } },
        { contactName: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [total, logs] = await Promise.all([
      prisma.deliveryLog.count({ where }),
      prisma.deliveryLog.findMany({
        where,
        include: {
          lead: {
            select: {
              isUnlocked: true,
              companyName: true,
              contactName: true,
              email: true,
            }
          }
        },
        orderBy: { sentAt: 'desc' },
        skip,
        take: limit,
      }),
    ])

    // 🛡️ 服务端绝对物理脱敏：切断一切越权抓包可能 (已修复 TS 类型)
    const processedLogs = logs.map((log: any) => {
      // 1. 拿到最真实的解锁状态（严防死守）
      const isStrictlyUnlocked = log.lead?.isUnlocked === true;

      return {
        id: log.id,
        sentAt: log.sentAt,
        // 2. 邮箱控制：已解锁用真实邮箱，未解锁强制使用顶部定义的 maskEmail 打码
        recipientEmail: isStrictlyUnlocked ? (log.lead?.email || log.recipientEmail) : maskEmail(log.recipientEmail || ''),
        // 3. 核心情报控制：只要没解锁，公司和联系人强行返回 null，抓包也抓不到！
        companyName: isStrictlyUnlocked ? (log.lead?.companyName || log.companyName) : null,
        contactName: isStrictlyUnlocked ? (log.lead?.contactName || log.contactName) : null,
        
        senderDomain: log.senderDomain,
        subject: log.subject,
        body: log.body,
        status: log.status,
        openCount: log.openCount || 0,
        clickCount: log.clickCount || 0,
        errorMessage: log.errorMessage,
        leadId: log.leadId,
        // 4. 前端红绿灯状态
        isUnlocked: isStrictlyUnlocked, 
      };
    });

    return NextResponse.json({
      success: true,
      data: processedLogs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('[delivery-logs] GET error:', error)
    return NextResponse.json({ error: '获取投递记录失败' }, { status: 500 })
  }
}