import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * 获取用户列表（仅管理员）
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 验证管理员权限
    const role = session.user.role
    if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 获取用户列表
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        phone: true,
        subscriptionTier: true,
        tokenBalance: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    })

    const formattedUsers = users.map(u => ({
      id: u.id,
      email: u.email,
      phone: u.phone || '未设置',
      currentPlan: u.subscriptionTier === 'STARTER' ? '入门版' : 
                   u.subscriptionTier === 'PRO' ? '专业版' : 
                   u.subscriptionTier === 'MAX' ? '旗舰版' : '体验版',
      credits: u.tokenBalance,
      registeredAt: u.createdAt.toISOString().split('T')[0],
      status: 'active' as const
    }))

    return NextResponse.json({ users: formattedUsers })
  } catch (error: any) {
    console.error('[Admin Users List] Error:', error)
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 })
  }
}
