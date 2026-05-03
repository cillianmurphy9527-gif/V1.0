import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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

    const logs = await prisma.sendingLog.findMany({
      where: { userId: user.id },
      orderBy: { sentAt: 'desc' },
      select: {
        id: true,
        recipientEmail: true,    // 修正：recipient → recipientEmail
        senderDomain: true,      // 修正：fromDomain → senderDomain
        fromEmail: true,
        subject: true,
        status: true,
        sentAt: true,
        errorMessage: true,
        messageId: true
      }
    })

    const headers = ['ID', '收件人', '发信域名', '发件邮箱', '主题', '状态', '发送时间', '错误信息']
    const rows = logs.map(log => [
      log.id,
      log.recipientEmail,
      log.senderDomain,
      log.fromEmail,
      log.subject,
      log.status,
      new Date(log.sentAt).toLocaleString('zh-CN'),
      log.errorMessage || ''
    ])

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="sending-logs-${new Date().toISOString().split('T')[0]}.csv"`
      }
    })
  } catch (error) {
    console.error('Failed to export logs:', error)
    return NextResponse.json({ error: '导出失败' }, { status: 500 })
  }
}