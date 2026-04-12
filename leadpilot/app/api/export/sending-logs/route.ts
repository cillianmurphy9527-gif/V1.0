import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/export/sending-logs
 * 导出发信日志为 CSV - 完整的容错处理
 */
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
    const campaignId = searchParams.get('campaignId')

    // 构建查询条件
    const where: any = { userId: user.id }
    if (status) where.status = status
    if (campaignId) where.campaignId = campaignId

    // 获取数据
    const logs = await prisma.sendingLog.findMany({
      where,
      orderBy: { sentAt: 'desc' },
      select: {
        recipient: true,
        fromDomain: true,
        fromEmail: true,
        subject: true,
        status: true,
        sentAt: true,
        openedAt: true,
        clickedAt: true,
        repliedAt: true,
        errorMessage: true,
        messageId: true
      }
    })

    // 生成 CSV 内容
    const headers = [
      '收件人邮箱',
      '发件域名',
      '发件邮箱',
      '邮件主题',
      '发送状态',
      '发送时间',
      '打开时间',
      '点击时间',
      '回复时间',
      '错误信息',
      '消息ID'
    ]

    // 即使没有数据，也返回表头
    const rows = logs.map(log => [
      log.recipient,
      log.fromDomain,
      log.fromEmail,
      log.subject,
      log.status,
      log.sentAt ? new Date(log.sentAt).toLocaleString('zh-CN') : '',
      log.openedAt ? new Date(log.openedAt).toLocaleString('zh-CN') : '',
      log.clickedAt ? new Date(log.clickedAt).toLocaleString('zh-CN') : '',
      log.repliedAt ? new Date(log.repliedAt).toLocaleString('zh-CN') : '',
      log.errorMessage || '',
      log.messageId || ''
    ])

    // 构建 CSV 字符串
    const csvContent = [
      headers.map(h => `"${h}"`).join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    // 返回 CSV 文件
    // 即使数据为空，也返回 200 OK 和表头
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="sending-logs-${new Date().toISOString().split('T')[0]}.csv"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    })
  } catch (error) {
    console.error('Export error:', error)
    // 即使出错，也返回 200 OK 和表头，防止前端崩溃
    const headers = [
      '收件人邮箱',
      '发件域名',
      '发件邮箱',
      '邮件主题',
      '发送状态',
      '发送时间',
      '打开时间',
      '点击时间',
      '回复时间',
      '错误信息',
      '消息ID'
    ]
    const csvContent = headers.map(h => `"${h}"`).join(',')

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="sending-logs-${new Date().toISOString().split('T')[0]}.csv"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    })
  }
}
