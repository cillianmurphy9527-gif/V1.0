import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const leadIds: string[] = Array.isArray(body.leadIds) ? body.leadIds : []

    if (leadIds.length === 0) {
      return NextResponse.json({ error: '请选择要解锁的线索' }, { status: 400 })
    }

    // 幂等性保护：只统计真正需要解锁且未解锁的线索
    const leadsToUnlock = await prisma.userLead.findMany({
      where: {
        id: { in: leadIds },
        userId: user.id,
        isUnlocked: false,
      },
      select: { id: true },
    })

    const count = leadsToUnlock.length

    if (count === 0) {
      return NextResponse.json({ error: '所选线索均已解锁，无需重复操作' }, { status: 400 })
    }

    const totalCost = count

    if (user.exportQuota < totalCost) {
      return NextResponse.json({
        error: 'INSUFFICIENT_QUOTA',
        message: `解锁 ${count} 条线索需要 ${totalCost} 额度，当前剩余 ${user.exportQuota} 额度`,
      }, { status: 403 })
    }

    // 事务：原子性扣费 + 解锁
    const [updatedUser, updatedLeads] = await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { exportQuota: { decrement: totalCost } },
      }),
      prisma.userLead.updateMany({
        where: {
          id: { in: leadsToUnlock.map(l => l.id) },
          userId: user.id,
          isUnlocked: false,
        },
        data: { isUnlocked: true },
      }),
    ])

    console.log(`[leads/unlock] user=${user.email} unlocked=${updatedLeads.count} remainingQuota=${updatedUser.exportQuota}`)

    return NextResponse.json({
      success: true,
      unlockedCount: updatedLeads.count,
      remainingQuota: updatedUser.exportQuota,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error(`[leads/unlock] FATAL: ${msg}`)
    return NextResponse.json({ error: `解锁失败：${msg}` }, { status: 500 })
  }
}
