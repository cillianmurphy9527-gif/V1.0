import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminRole } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const auth = await requireAdminRole(['SUPER_ADMIN', 'FINANCE', 'OPS'])
    if (!auth.ok) return auth.response

    const now = new Date()
    
    // ─── 1. 精确定义时间窗口 (严格使用 近1天 / 近7天 / 近30天) ───
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    
    const startOf7Days = new Date(startOfToday)
    startOf7Days.setDate(startOf7Days.getDate() - 6) // 包含今天在内共7天
    
    const startOf30Days = new Date(startOfToday)
    startOf30Days.setDate(startOf30Days.getDate() - 29) // 包含今天在内共30天

    // ─── 2. 计算动态营收与 API 真实消耗 ───
    const getFinancials = async (startDate: Date) => {
      // 算收入与退款
      const orders = await prisma.order.findMany({ where: { createdAt: { gte: startDate }, status: 'PAID' } })
      const refunds = await prisma.order.findMany({ where: { createdAt: { gte: startDate }, status: 'REFUNDED' } })
      const revenue = orders.reduce((sum, o) => sum + o.amount, 0)
      
      // 算真实 API 消耗（按实际发生时间）
      const apiLogs = await prisma.systemCostLog.aggregate({
        where: { createdAt: { gte: startDate } },
        _sum: { costCny: true }
      })
      const apiCost = apiLogs._sum.costCny || 0

      return { revenue, ordersCount: orders.length, refundsCount: refunds.length, apiCost }
    }

    const [todayData, weekData, monthData] = await Promise.all([
      getFinancials(startOfToday),
      getFinancials(startOf7Days),
      getFinancials(startOf30Days)
    ])

    // ─── 3. 精确计算固定基建摊销 ───
    const fixedCostsList = await prisma.fixedCost.findMany({ where: { isActive: true } })
    
    // 计算所有资产加起来的“日均消耗总量”
    let exactDailyFixedCost = 0
    fixedCostsList.forEach(cost => {
      const daily = cost.billingCycle === 'YEARLY' ? (cost.amount / 365) : (cost.amount / 30);
      exactDailyFixedCost += daily;
    })

    // 严格按照滚动天数相乘！绝不再受“今天是几号/周几”的干扰！
    const todayFixed = exactDailyFixedCost * 1
    const weekFixed = exactDailyFixedCost * 7
    const monthFixed = exactDailyFixedCost * 30

    // ─── 4. 组装三维报表 ───
    const buildReport = (data: any, fixed: number) => {
      const totalCost = data.apiCost + fixed
      const grossProfit = data.revenue - totalCost
      return {
        revenue: Number(data.revenue.toFixed(2)),
        ordersCount: data.ordersCount,
        refundsCount: data.refundsCount,
        apiCost: Number(data.apiCost.toFixed(2)),
        fixedCost: Number(fixed.toFixed(2)),
        totalCost: Number(totalCost.toFixed(2)),
        grossProfit: Number(grossProfit.toFixed(2)),
        profitMargin: data.revenue > 0 ? Number(((grossProfit / data.revenue) * 100).toFixed(1)) : 0
      }
    }

    return NextResponse.json({
      today: buildReport(todayData, todayFixed),
      week: buildReport(weekData, weekFixed),
      month: buildReport(monthData, monthFixed)
    })

  } catch (error: any) {
    return NextResponse.json({ error: error.message || '获取财务数据失败' }, { status: 500 })
  }
}