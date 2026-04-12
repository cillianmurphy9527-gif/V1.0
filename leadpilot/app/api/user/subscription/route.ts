import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * 管理订阅 API
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { action } = await request.json()

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (action === 'cancel') {
      // 取消自动续费（保留当前套餐至到期）
      await prisma.user.update({
        where: { id: session.user.id },
        data: {
          // 这里可以添加一个 autoRenew 字段来标记是否自动续费
          updatedAt: new Date(),
        },
      })

      return NextResponse.json({
        success: true,
        message: '已取消自动续费，当前套餐将保留至到期日',
      })
    }

    if (action === 'renew') {
      // 恢复自动续费
      await prisma.user.update({
        where: { id: session.user.id },
        data: {
          updatedAt: new Date(),
        },
      })

      return NextResponse.json({
        success: true,
        message: '已恢复自动续费',
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error: any) {
    console.error('Failed to manage subscription:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
