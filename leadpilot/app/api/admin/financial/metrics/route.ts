import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminRole } from '@/lib/admin-auth'

/**
 * 获取财务指标数据（按日期）
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminRole(['SUPER_ADMIN', 'FINANCE'])
    if (!auth.ok) return auth.response

    const { searchParams } = request.nextUrl
    const range = searchParams.get('range') || '30days'

    // 计算日期范围
    const now = new Date()
    let startDate = new Date()
    let days = 30
    
    switch (range) {
      case '7days':
        startDate.setDate(now.getDate() - 7)
        days = 7
        break
      case '30days':
        startDate.setDate(now.getDate() - 30)
        days = 30
        break
      case '90days':
        startDate.setDate(now.getDate() - 90)
        days = 90
        break
      default:
        startDate = new Date('2020-01-01')
        days = 365
    }

    // 生成日期数组
    const metrics = []
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate)
      date.setDate(date.getDate() + i)
      const dateStr = date.toISOString().split('T')[0]

      // 该日期的订单
      const dayOrders = await prisma.order.findMany({
        where: {
          createdAt: {
            gte: new Date(dateStr),
            lt: new Date(new Date(dateStr).getTime() + 24 * 60 * 60 * 1000)
          },
          status: 'PAID'
        }
      })

      // 该日期的退款
      const dayRefunds = await prisma.order.findMany({
        where: {
          createdAt: {
            gte: new Date(dateStr),
            lt: new Date(new Date(dateStr).getTime() + 24 * 60 * 60 * 1000)
          },
          status: 'REFUNDED'
        }
      })

      const revenue = dayOrders.reduce((sum, order) => sum + order.amount, 0)
      const refunds = dayRefunds.length

      metrics.push({
        date: dateStr,
        revenue,
        orders: dayOrders.length,
        refunds
      })
    }

    return NextResponse.json(metrics)
  } catch (error: any) {
    console.error('❌ [财务指标API] 错误:', error)
    return NextResponse.json({ 
      error: error?.message || '获取财务指标失败'
    }, { status: 500 })
  }
}
