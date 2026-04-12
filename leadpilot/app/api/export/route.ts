/**
 * API: 数据导出统一入口
 *
 * 套餐权限矩阵：
 * - STARTER : 403 拦截，提示升级
 * - PRO/MAX : 支持 CSV 和 XLSX 两种格式
 *
 * 请求体：
 * { format: 'csv' | 'xlsx', type: 'leads' | 'campaigns' | 'threads' }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { checkFeatureAccess, FeatureGateError } from '@/lib/feature-gate'
import { prisma } from '@/lib/prisma'

// ─── CSV 转换 ────────────────────────────────────────────
function toCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0])
  const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  return [
    headers.map(escape).join(','),
    ...rows.map(r => headers.map(h => escape(r[h])).join(',')),
  ].join('\n')
}

// ─── 简易 XLSX（纯 XML SpreadsheetML，无需第三方库）───────
function toXLSX(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return buildXLSXXML([])
  return buildXLSXXML(rows)
}

function xmlEscape(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildXLSXXML(rows: Record<string, unknown>[]): string {
  const headers = rows.length > 0 ? Object.keys(rows[0]) : []
  const headerRow = headers.map(h => `<c t="inlineStr"><is><t>${xmlEscape(h)}</t></is></c>`).join('')
  const dataRows = rows
    .map(
      r =>
        `<row>${headers
          .map(h => `<c t="inlineStr"><is><t>${xmlEscape(r[h])}</t></is></c>`)
          .join('')}</row>`
    )
    .join('')

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets>
</workbook>
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    <row>${headerRow}</row>
    ${dataRows}
  </sheetData>
</worksheet>`
}

// ─── 从数据库查询导出数据 ────────────────────────────────
async function fetchExportData(
  userId: string,
  type: string
): Promise<Record<string, unknown>[]> {
  switch (type) {
    case 'leads': {
      const campaigns = await prisma.campaign.findMany({
        where: { userId },
        include: {
          leads: {
            select: {
              id: true,
              email: true,
              aiScore: true,
              status: true,
              createdAt: true,
            },
          },
        },
      })
      return campaigns.flatMap(c =>
        c.leads.map(l => ({
          campaignId: c.id,
          campaignName: c.name,
          email: l.email,
          aiScore: l.aiScore ?? '',
          status: l.status,
          createdAt: l.createdAt.toISOString(),
        }))
      )
    }
    case 'campaigns': {
      const campaigns = await prisma.campaign.findMany({
        where: { userId },
        select: { id: true, name: true, status: true, createdAt: true, updatedAt: true },
      })
      return campaigns.map(c => ({
        id: c.id,
        name: c.name,
        status: c.status,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      }))
    }
    case 'threads': {
      const threads = await prisma.emailThread.findMany({
        where: { userId },
        select: {
          id: true,
          targetEmail: true,
          subject: true,
          status: true,
          createdAt: true,
        },
      })
      return threads.map(t => ({
        id: t.id,
        targetEmail: t.targetEmail,
        subject: t.subject,
        status: t.status,
        createdAt: t.createdAt.toISOString(),
      }))
    }
    default:
      return []
  }
}

export async function POST(request: NextRequest) {
  try {
    // ─── 1. 鉴权 ───────────────────────────────────────────
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
    }

    const userId = session.user.id
    const body = await request.json()
    const { format = 'csv', type = 'leads' } = body

    if (!['csv', 'xlsx'].includes(format)) {
      return NextResponse.json({ error: 'format must be csv or xlsx' }, { status: 400 })
    }
    if (!['leads', 'campaigns', 'threads'].includes(type)) {
      return NextResponse.json({ error: 'type must be leads, campaigns, or threads' }, { status: 400 })
    }

    // ─── 2. 功能门控：入门版直接拦截 ──────────────────────
    const gateResult = await checkFeatureAccess(userId, 'DATA_EXPORT')
    if (!gateResult.allowed) {
      const statusCode = gateResult.error === FeatureGateError.UPGRADE_REQUIRED ? 403 : 429
      return NextResponse.json(
        {
          error: gateResult.message,
          code: gateResult.error,
          hint: '数据导出功能需要专业版或旗舰版，请升级套餐',
        },
        { status: statusCode }
      )
    }

    // ─── 3. 从数据库查询真实数据 ───────────────────────────
    const rows = await fetchExportData(userId, type)

    if (rows.length === 0) {
      return NextResponse.json({ error: 'No data to export' }, { status: 404 })
    }

    // ─── 4. 生成对应格式文件 ───────────────────────────────
    const timestamp = new Date().toISOString().split('T')[0]
    const fileName = `${type}_${timestamp}`

    if (format === 'csv') {
      const bom = '\uFEFF'
      const csv = bom + toCSV(rows)
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${fileName}.csv"`,
        },
      })
    } else {
      // XLSX
      const xlsxContent = toXLSX(rows)
      return new NextResponse(xlsxContent, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${fileName}.xlsx"`,
        },
      })
    }
  } catch (error) {
    console.error('[Export] Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
