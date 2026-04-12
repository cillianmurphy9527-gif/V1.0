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

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    // 构建查询条件
    const where: any = { userId: user.id }
    if (status) {
      where.status = status
    }

    // 获取所有日志
    const logs = await prisma.sendingLog.findMany({
      where,
      orderBy: { sentAt: 'desc' }
    })

    // 生成 CSV
    const headers = ['发送时间', '收件人', '发信域名', '发件邮箱', '主题', '状态', '错误信息']
    const rows = logs.map(log => [
      new Date(log.sentAt).toLocaleString('zh-CN'),
      log.recipient,
      log.fromDomain,
      log.fromEmail,
      log.subject,
      log.status,
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
