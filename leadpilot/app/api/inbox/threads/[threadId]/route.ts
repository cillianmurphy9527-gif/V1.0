import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * 获取单个线程的所有消息
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { threadId: string } }
) {
  try {
    console.log('📧 [线程详情API] 1️⃣ API 被调用，threadId:', params.threadId)

    const session = await getServerSession(authOptions)
    console.log('📧 [线程详情API] 2️⃣ Session 获取结果:', {
      hasSession: !!session,
      userId: session?.user?.id,
    })
    
    if (!session?.user?.id) {
      console.error('❌ [线程详情API] Session 验证失败')
      return NextResponse.json({ 
        error: 'Unauthorized - No user session',
        details: 'Session exists but no userId found'
      }, { status: 401 })
    }

    console.log('📧 [线程详情API] 3️⃣ 开始查询 Prisma，threadId:', params.threadId)

    const thread = await prisma.emailThread.findUnique({
      where: { id: params.threadId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    console.log('📧 [线程详情API] 4️⃣ Prisma 查询完成，thread:', thread ? '找到' : '未找到')

    if (!thread) {
      console.error('❌ [线程详情API] 线程不存在，threadId:', params.threadId)
      return NextResponse.json({ 
        error: 'Thread not found',
        details: `No thread found with id: ${params.threadId}`
      }, { status: 404 })
    }

    // 验证权限
    if (thread.userId !== session.user.id) {
      console.error('❌ [线程详情API] 权限验证失败，thread.userId:', thread.userId, 'session.userId:', session.user.id)
      return NextResponse.json({ 
        error: 'Forbidden - Access denied',
        details: 'User does not have permission to access this thread'
      }, { status: 403 })
    }

    console.log('📧 [线程详情API] 5️⃣ 权限验证通过，消息数:', thread.messages.length)

    return NextResponse.json({ 
      thread: {
        id: thread.id,
        targetEmail: thread.targetEmail,
        targetName: thread.targetName,
        subject: thread.subject,
        status: thread.status,
        updatedAt: thread.updatedAt.toISOString(),
        messages: thread.messages.map(m => ({
          id: m.id,
          from: m.from,
          to: m.to,
          subject: m.subject,
          body: m.body,
          sentAt: m.sentAt.toISOString(),
          isFromUser: m.isFromUser,
        })),
      }
    })
  } catch (error: any) {
    console.error('❌ [线程详情API] 严重崩溃！错误详情：')
    console.error('   错误类型:', error?.constructor?.name)
    console.error('   错误消息:', error?.message)
    console.error('   错误堆栈:', error?.stack)
    console.error('   完整错误对象:', error)

    return NextResponse.json({ 
      error: error?.message || '未知内部错误',
      details: String(error),
      errorType: error?.constructor?.name,
      timestamp: new Date().toISOString(),
    }, { status: 500 })
  }
}
