/**
 * API: CSV 数据导出
 * 
 * 【核心功能】
 * 1. 专业版+ 权限检查
 * 2. 将 JSON 数据转换为标准 CSV 格式
 * 3. 设置正确的 Response Headers
 * 4. 触发浏览器下载
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { checkFeatureAccess, FeatureGateError } from '@/lib/feature-gate'

// ─── CSV 转换工具 ────────────────────────────────
function convertToCSV(data: any[]): string {
  if (data.length === 0) {
    return ''
  }

  // 获取所有列名
  const headers = Object.keys(data[0])
  
  // 创建 CSV 头行
  const csvHeaders = headers.map(h => `"${h}"`).join(',')
  
  // 创建数据行
  const csvRows = data.map(row => {
    return headers.map(header => {
      const value = row[header]
      
      // 处理特殊字符和换行
      if (value === null || value === undefined) {
        return '""'
      }
      
      const stringValue = String(value)
      
      // 如果包含逗号、引号或换行，需要用引号包裹
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`
      }
      
      return `"${stringValue}"`
    }).join(',')
  })
  
  return [csvHeaders, ...csvRows].join('\n')
}

// ─── 生成文件名 ────────────────────────────────
function generateFileName(type: string = 'leads'): string {
  const timestamp = new Date().toISOString().split('T')[0]
  return `${type}_${timestamp}.csv`
}

export async function POST(request: NextRequest) {
  try {
    // ─── 1. 验证登录状态 ──────────────────────────────
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      )
    }

    const userId = session.user.id
    const body = await request.json()
    const { data, fileName = 'export' } = body

    if (!data || !Array.isArray(data)) {
      return NextResponse.json(
        { error: 'Data array is required' },
        { status: 400 }
      )
    }

    // ─── 2. 【关键】权限检查 - 仅专业版+ ────────────
    const gateResult = await checkFeatureAccess(userId, 'DATA_EXPORT')
    
    if (!gateResult.allowed) {
      const statusCode = gateResult.error === FeatureGateError.UPGRADE_REQUIRED ? 403 : 429
      return NextResponse.json(
        {
          error: gateResult.message,
          code: gateResult.error,
        },
        { status: statusCode }
      )
    }

    // ─── 3. 转换为 CSV 格式 ────────────────────────
    const csvContent = convertToCSV(data)

    if (!csvContent) {
      return NextResponse.json(
        { error: 'No data to export' },
        { status: 400 }
      )
    }

    // ─── 4. 设置正确的 Response Headers ────────────
    const csvFileName = generateFileName(fileName)
    
    const headers = new Headers()
    headers.set('Content-Type', 'text/csv; charset=utf-8')
    headers.set('Content-Disposition', `attachment; filename="${csvFileName}"`)
    headers.set('Content-Length', Buffer.byteLength(csvContent).toString())
    
    // 添加 BOM（字节顺序标记）以支持 Excel 正确识别 UTF-8
    const bom = '\uFEFF'
    const csvWithBom = bom + csvContent

    // ─── 5. 返回 CSV 文件 ──────────────────────────
    return new NextResponse(csvWithBom, {
      status: 200,
      headers,
    })
  } catch (error) {
    console.error('[ExportCSV] Error:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
