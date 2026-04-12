import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminRole } from '@/lib/admin-auth'

/**
 * 获取财务统计数据
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
    
    switch (range) {
      case '7days':
        startDate.setDate(now.getDate() - 7)
        break
      case '30days':
        startDate.setDate(now.getDate() - 30)
        break
      case '90days':
        startDate.setDate(now.getDate() - 90)
        break
      default:
        startDate = new Date('2020-01-01')
    }

    // 统计订单数据
    const orders = await prisma.order.findMany({
      where: {
        createdAt: { gte: startDate },
        status: 'PAID'
      }
    })

    const refunds = await prisma.order.findMany({
      where: {
        createdAt: { gte: startDate },
        status: 'REFUNDED'
      }
    })

    const totalRevenue = orders.reduce((sum, order) => sum + order.amount, 0)
    const totalRefundAmount = refunds.reduce((sum, order) => sum + order.amount, 0)
    const totalOrders = orders.length
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0

    // 本月收入
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthOrders = await prisma.order.findMany({
      where: {
        createdAt: { gte: monthStart },
        status: 'PAID'
      }
    })
    const monthlyRevenue = monthOrders.reduce((sum, order) => sum + order.amount, 0)

    // 待审核退款
    const pendingRefunds = await prisma.order.count({
      where: {
        refundStatus: 'REQUESTED'
      }
    })

    return NextResponse.json({
      totalRevenue,
      totalOrders,
      totalRefunds: refunds.length,
      averageOrderValue,
      monthlyRevenue,
      pendingRefunds
    })
  } catch (error: any) {
    console.error('❌ [财务API] 错误:', error)
    return NextResponse.json({ 
      error: error?.message || '获取财务数据失败'
    }, { status: 500 })
  }
}
