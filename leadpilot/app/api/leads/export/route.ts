import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return '—'
  const date = typeof d === 'string' ? new Date(d) : d
  if (isNaN(date.getTime())) return '—'
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${day} ${h}:${min}`
}

function val(v: string | null | undefined): string {
  if (!v || v.trim() === '') return '—'
  return v
}

const SOURCE_LABEL: Record<string, string> = {
  NOVA: 'Nova 挖掘',
  IMPORT: '手动导入',
  CAMPAIGN: '活动生成',
}

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
    const count: number = typeof body.count === 'number' ? body.count : 0

    if (count <= 0) {
      return NextResponse.json({ error: '导出数量必须大于 0' }, { status: 400 })
    }

    // 只查询已解锁的线索（已解锁 = 明文邮箱，无需脱敏）
    // 解锁线索导出不再扣费（解锁时已扣费）
    const leads = await prisma.userLead.findMany({
      where: {
        userId: user.id,
        isUnlocked: true,
      },
      orderBy: { createdAt: 'desc' },
      take: count,
    })

    if (leads.length === 0) {
      return NextResponse.json({
        error: 'NO_UNLOCKED_LEADS',
        message: '当前没有已解锁的线索可导出，请先解锁目标线索',
      }, { status: 400 })
    }

    console.log(`[leads/export] user=${user.email} count=${leads.length} (unlocked only, no quota deduction)`)

    // 构建 Excel 行数据
    const rows = leads.map((l, idx) => [
      idx + 1,
      val(l.companyName),
      val(l.contactName),
      val(l.jobTitle),
      val(l.country),
      l.email, // 已解锁，明文邮箱
      val(l.phone),
      val(l.industry),
      val(l.website),
      val(l.linkedIn),
      val(l.aiSummary),
      SOURCE_LABEL[l.source] || l.source,
      fmtDate(l.createdAt),
    ])

    console.log(`[leads/export] fetched ${leads.length} leads, first: ${JSON.stringify(leads[0] ?? null)}`)

    const wsData = [
      ['序号', '公司名称', '联系人', '职位', '国家', '邮箱', '电话', '行业', '官网', '领英', 'AI 画像摘要', '来源', '入库时间'],
      ...rows,
    ]

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet(wsData)

    ws['!cols'] = [
      { wch: 6 },   // 序号
      { wch: 28 },  // 公司名称
      { wch: 16 },  // 联系人
      { wch: 20 },  // 职位
      { wch: 10 },  // 国家
      { wch: 30 },  // 邮箱
      { wch: 18 },  // 电话
      { wch: 20 },  // 行业
      { wch: 32 },  // 官网
      { wch: 38 },  // 领英
      { wch: 50 },  // AI 画像摘要
      { wch: 12 },  // 来源
      { wch: 20 },  // 入库时间
    ]

    XLSX.utils.book_append_sheet(wb, ws, '线索库')

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    console.log(`[leads/export] xlsx buffer: ${buf.length} bytes`)

    const filename = `线索库-${new Date().toISOString().split('T')[0]}.xlsx`

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="leads.xlsx"',
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack : ''
    console.error(`[leads/export] FATAL: ${msg}\n${stack}`)
    return NextResponse.json({ error: `导出失败：${msg}` }, { status: 500 })
  }
}
