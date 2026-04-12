import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * 获取邮件线程列表
 */
export async function GET(request: NextRequest) {
  try {
    console.log('📧 [收件箱API] 1️⃣ API 被调用')

    const session = await getServerSession(authOptions)
    console.log('📧 [收件箱API] 2️⃣ Session 获取结果:', {
      hasSession: !!session,
      userId: session?.user?.id,
      userEmail: session?.user?.email,
    })
    
    if (!session?.user?.id) {
      console.error('❌ [收件箱API] Session 验证失败：未找到 userId')
      return NextResponse.json({ 
        error: 'Unauthorized - No user session', 
        details: 'Session exists but no userId found'
      }, { status: 401 })
    }

    const userId = session.user.id
    console.log('📧 [收件箱API] 3️⃣ 开始查询 Prisma，userId:', userId)

    // 修复：确保查询的字段在 schema 中存在
    const threads = await prisma.emailThread.findMany({
      where: { userId },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
    })

    console.log('📧 [收件箱API] 4️⃣ Prisma 查询成功，找到', threads.length, '个线程')

    const result = threads.map(t => ({
      id: t.id,
      targetEmail: t.targetEmail,
      targetName: t.targetName || '',
      subject: t.subject,
      status: t.status,
      updatedAt: t.updatedAt.toISOString(),
    }))

    console.log('📧 [收件箱API] 5️⃣ 返回成功响应')
    return NextResponse.json({ threads: result })
  } catch (error: any) {
    console.error('❌ [收件箱API] 严重崩溃！错误详情：')
    console.error('   错误类型:', error?.constructor?.name)
    console.error('   错误消息:', error?.message)
    console.error('   错误堆栈:', error?.stack)
    console.error('   完整错误对象:', JSON.stringify(error, null, 2))

    return NextResponse.json({ 
      error: error?.message || '未知内部错误',
      details: String(error),
      errorType: error?.constructor?.name,
      timestamp: new Date().toISOString(),
    }, { status: 500 })
  }
}
