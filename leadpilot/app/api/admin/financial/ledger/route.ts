/**
 * GET /api/admin/financial/ledger
 * CFO 级财务聚合 API
 *
 * 返回：
 *   kpi         — totalRevenue / totalRefunds / totalCosts / netProfit
 *   costBreakdown — aiCost / emailCost / aiTokens / emailCount
 *   ledger      — 资金流水明细（收入 + 退款），按时间倒序
 *
 * 成本费率（与 cron/daily-briefing 严格对齐）：
 *   AI  ¥0.001 / 千 tokens（TokenTransaction.amount < 0 的绝对值）
 *   邮件 ¥0.007 / 封（SendingLog.status IN SENT/OPENED/CLICKED/REPLIED）
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminRole } from '@/lib/admin-auth'

const AI_COST_PER_1K     = parseFloat(process.env.AI_COST_PER_1K_TOKENS   || '0.001')
const EMAIL_COST_EACH    = parseFloat(process.env.EMAIL_COST_PER_SEND     || '0.007')

// ── 静态成本配置（可通过 .env 覆盖，未来迁移到配置表）────────────
// 获客与通信：Apollo/Hunter 数据源 + ZeroBounce 验箱
const APOLLO_MONTHLY     = parseFloat(process.env.APOLLO_MONTHLY_CNY       || '0')    // 月订阅摊销
const ZEROBOUNCE_PER     = parseFloat(process.env.ZEROBOUNCE_COST_PER_VERIFY || '0.007') // 每次验箱
// 云基建与网络（月度固定摊销）
const INFRA_SERVER_MO    = parseFloat(process.env.INFRA_SERVER_MONTHLY_CNY  || '980')  // ECS/Vercel
const INFRA_DB_MO        = parseFloat(process.env.INFRA_DB_MONTHLY_CNY      || '280')  // RDS/Neon
const INFRA_PROXY_MO     = parseFloat(process.env.INFRA_PROXY_MONTHLY_CNY   || '420')  // SmartProxy
const INFRA_CDN_MO       = parseFloat(process.env.INFRA_CDN_MONTHLY_CNY     || '120')  // CDN
// 支付通道手续费率
const PAYMENT_RATE       = parseFloat(process.env.PAYMENT_FEE_RATE           || '0.036') // 3.6%

function fmtDate(d: Date) {
  return d.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminRole(['SUPER_ADMIN', 'FINANCE'])
    if (!auth.ok) return auth.response

    const { searchParams } = new URL(request.url)
    const range = searchParams.get('range') || '30days'

    // ── 日期范围 ────────────────────────────────────────────────
    const now   = new Date()
    let startDate: Date | undefined
    if (range === '7days')  { startDate = new Date(now); startDate.setDate(now.getDate() - 7) }
    if (range === '30days') { startDate = new Date(now); startDate.setDate(now.getDate() - 30) }
    if (range === '90days') { startDate = new Date(now); startDate.setDate(now.getDate() - 90) }
    // 'all' → startDate = undefined → no filter

    const dateFilter = startDate ? { gte: startDate } : undefined

    // ════════════════════════════════════════════════════════════
    // 1. 收入聚合（PAID 订单）
    // ════════════════════════════════════════════════════════════
    const paidAgg = await prisma.order.aggregate({
      where: { status: 'PAID', ...(dateFilter ? { createdAt: dateFilter } : {}) },
      _sum:   { amount: true },
      _count: { id: true },
    })
    const totalRevenue   = paidAgg._sum.amount ?? 0
    const totalPaidCount = paidAgg._count.id    ?? 0

    // ════════════════════════════════════════════════════════════
    // 2. 退款聚合（REFUNDED 订单）
    // ════════════════════════════════════════════════════════════
    const refundAgg = await prisma.order.aggregate({
      where: { status: 'REFUNDED', ...(dateFilter ? { createdAt: dateFilter } : {}) },
      _sum:   { amount: true },
      _count: { id: true },
    })
    const totalRefunds      = refundAgg._sum.amount ?? 0
    const totalRefundCount  = refundAgg._count.id   ?? 0

    // ════════════════════════════════════════════════════════════
    // 3. AI 推理成本（TokenTransaction.amount < 0）
    // ════════════════════════════════════════════════════════════
    const tokenAgg = await prisma.tokenTransaction.aggregate({
      where: {
        amount: { lt: 0 },
        ...(dateFilter ? { createdAt: dateFilter } : {}),
      },
      _sum: { amount: true },
    })
    const totalTokensConsumed = Math.abs(tokenAgg._sum.amount ?? 0)
    const aiCost = (totalTokensConsumed / 1000) * AI_COST_PER_1K

    // ════════════════════════════════════════════════════════════
    // 4. 邮件投递成本（SendingLog 成功投递记录）
    // ════════════════════════════════════════════════════════════
    const emailCount = await prisma.sendingLog.count({
      where: {
        status: { in: ['SENT', 'OPENED', 'CLICKED', 'REPLIED'] },
        ...(dateFilter ? { sentAt: dateFilter } : {}),
      },
    })
    const emailCost  = emailCount * EMAIL_COST_EACH

    // ════════════════════════════════════════════════════════════
    // 5. 获客与通信成本（邮件 + 动态 FixedCost DATA 类）
    // ════════════════════════════════════════════════════════════
    const daysInPeriod = startDate
      ? Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
      : 30

    // 从数据库读取所有启用的固定成本
    const fixedCosts = await prisma.fixedCost.findMany({ where: { isActive: true } })

    // 计算每条固定成本的期间摊销金额
    function amortize(fc: { amount: number; billingCycle: string }): number {
      const monthlyAmount = fc.billingCycle === 'YEARLY' ? fc.amount / 12 : fc.amount
      return (monthlyAmount / 30) * daysInPeriod
    }

    // 获客数据源（DATA 类：Apollo、ZeroBounce 等）
    const dataFixed   = fixedCosts.filter(fc => fc.category === 'DATA')
    const apolloCost  = dataFixed.reduce((sum, fc) => sum + amortize(fc), 0)
    const zerobounceCost = emailCount * ZEROBOUNCE_PER  // ZeroBounce 按发信量计，仍动态计算
    const outreachCost = emailCost + apolloCost + zerobounceCost

    // ════════════════════════════════════════════════════════════
    // 6. 云基建与网络成本（INFRA 类动态摊销）
    // ════════════════════════════════════════════════════════════
    const infraFixed = fixedCosts.filter(fc => fc.category === 'INFRA')
    const infraCost  = infraFixed.length > 0
      ? infraFixed.reduce((sum, fc) => sum + amortize(fc), 0)
      : ((INFRA_SERVER_MO + INFRA_DB_MO + INFRA_PROXY_MO + INFRA_CDN_MO) / 30) * daysInPeriod // fallback to env

    // OTHER 类成本（其他固定成本）
    const otherFixed = fixedCosts.filter(fc => fc.category === 'OTHER')
    const otherCost  = otherFixed.reduce((sum, fc) => sum + amortize(fc), 0)

    // ════════════════════════════════════════════════════════════
    // 7. 支付通道手续费（PAID 订单总额 × 费率）
    // ════════════════════════════════════════════════════════════
    const paymentFee = totalRevenue * PAYMENT_RATE

    // ════════════════════════════════════════════════════════════
    // 8. 总成本 & 净利润
    // ════════════════════════════════════════════════════════════
    const totalCosts = aiCost + outreachCost + infraCost + paymentFee + otherCost
    const netProfit  = totalRevenue - totalRefunds - totalCosts

    // ════════════════════════════════════════════════════════════
    // 6. 流水明细：PAID 订单（收入）+ REFUNDED 订单（退款）
    // ════════════════════════════════════════════════════════════
    const [paidOrders, refundedOrders] = await Promise.all([
      prisma.order.findMany({
        where: { status: 'PAID', ...(dateFilter ? { createdAt: dateFilter } : {}) },
        orderBy: { createdAt: 'desc' },
        take: 200,
        select: {
          id: true, tradeNo: true, amount: true, plan: true,
          orderType: true, createdAt: true,
          user: { select: { email: true } },
        },
      }),
      prisma.order.findMany({
        where: { status: 'REFUNDED', ...(dateFilter ? { createdAt: dateFilter } : {}) },
        orderBy: { createdAt: 'desc' },
        take: 200,
        select: {
          id: true, tradeNo: true, amount: true, plan: true,
          orderType: true, createdAt: true, refundReason: true,
          user: { select: { email: true } },
        },
      }),
    ])

    // 合并并按时间倒序排列
    const ledger = [
      ...paidOrders.map(o => ({
        id:        o.id,
        tradeNo:   o.tradeNo || o.id,
        type:      'INCOME' as const,
        amount:    o.amount,
        plan:      o.plan,
        orderType: o.orderType,
        userEmail: o.user?.email || '—',
        createdAt: fmtDate(o.createdAt),
        _ts:       o.createdAt.getTime(),
      })),
      ...refundedOrders.map(o => ({
        id:        o.id,
        tradeNo:   o.tradeNo || o.id,
        type:      'REFUND' as const,
        amount:    o.amount,
        plan:      o.plan,
        orderType: o.orderType,
        userEmail: o.user?.email || '—',
        createdAt: fmtDate(o.createdAt),
        _ts:       o.createdAt.getTime(),
      })),
    ].sort((a, b) => b._ts - a._ts).map(({ _ts, ...rest }) => rest)

    // ════════════════════════════════════════════════════════════
    // 9. 每日趋势（最近 30 天，固定不受 range 影响）
    // ════════════════════════════════════════════════════════════
    const trendStart = new Date(now)
    trendStart.setDate(now.getDate() - 29)
    trendStart.setHours(0, 0, 0, 0)

    const dailyFixedCost = fixedCosts.reduce((sum, fc) => {
      const monthly = fc.billingCycle === 'YEARLY' ? fc.amount / 12 : fc.amount
      return sum + monthly / 30
    }, 0)

    const [trendPaid, trendRefunded, trendTokens, trendEmails] = await Promise.all([
      prisma.order.findMany({ where: { status: 'PAID', createdAt: { gte: trendStart } }, select: { amount: true, createdAt: true } }),
      prisma.order.findMany({ where: { status: 'REFUNDED', createdAt: { gte: trendStart } }, select: { amount: true, createdAt: true } }),
      prisma.tokenTransaction.findMany({ where: { amount: { lt: 0 }, createdAt: { gte: trendStart } }, select: { amount: true, createdAt: true } }),
      prisma.sendingLog.findMany({ where: { status: { in: ['SENT','OPENED','CLICKED','REPLIED'] }, sentAt: { gte: trendStart } }, select: { sentAt: true } }),
    ])

    const dailyTrend = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(trendStart)
      d.setDate(trendStart.getDate() + i)
      const dateStr = d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
      const dayStart = new Date(d); dayStart.setHours(0,0,0,0)
      const dayEnd   = new Date(d); dayEnd.setHours(23,59,59,999)

      const revenue  = trendPaid.filter(o => o.createdAt >= dayStart && o.createdAt <= dayEnd).reduce((s,o) => s+o.amount, 0)
      const refund   = trendRefunded.filter(o => o.createdAt >= dayStart && o.createdAt <= dayEnd).reduce((s,o) => s+o.amount, 0)
      const aiDay    = Math.abs(trendTokens.filter(t => t.createdAt >= dayStart && t.createdAt <= dayEnd).reduce((s,t) => s+t.amount, 0)) / 1000 * AI_COST_PER_1K
      const emailDay = trendEmails.filter(e => e.sentAt >= dayStart && e.sentAt <= dayEnd).length * EMAIL_COST_EACH
      const cost     = parseFloat((aiDay + emailDay + dailyFixedCost).toFixed(2))
      const rev      = parseFloat(revenue.toFixed(2))
      return { date: dateStr, revenue: rev, cost, profit: parseFloat((rev - refund - cost).toFixed(2)) }
    })

    return NextResponse.json({
      kpi: {
        totalRevenue:  parseFloat(totalRevenue.toFixed(2)),
        totalRefunds:  parseFloat(totalRefunds.toFixed(2)),
        totalCosts:    parseFloat(totalCosts.toFixed(2)),
        netProfit:     parseFloat(netProfit.toFixed(2)),
        totalPaidCount,
        totalRefundCount,
      },
      // 保留旧字段确保向后兼容
      costBreakdown: {
        aiCost:              parseFloat(aiCost.toFixed(2)),
        emailCost:           parseFloat(emailCost.toFixed(2)),
        totalTokensConsumed,
        emailCount,
        aiCostRate:          `¥${AI_COST_PER_1K}/千tokens`,
        emailCostRate:       `¥${EMAIL_COST_EACH}/封`,
      },
      // 四大成本中心（供 OpexDashboard 使用）
      costCenters: {
        total: parseFloat(totalCosts.toFixed(2)),
        ai: {
          label: 'AI 与算力',
          cost: parseFloat(aiCost.toFixed(2)),
          pct: totalCosts > 0 ? parseFloat(((aiCost / totalCosts) * 100).toFixed(1)) : 0,
          items: [
            { label: 'Token 消耗', value: `${totalTokensConsumed.toLocaleString()} tokens`, cost: parseFloat(aiCost.toFixed(2)) },
            { label: '费率', value: `¥${AI_COST_PER_1K}/千 tokens`, cost: null },
          ],
        },
        outreach: {
          label: '获客与通信',
          cost: parseFloat(outreachCost.toFixed(2)),
          pct: totalCosts > 0 ? parseFloat(((outreachCost / totalCosts) * 100).toFixed(1)) : 0,
          items: [
            { label: 'Resend 邮件投递', value: `${emailCount.toLocaleString()} 封`, cost: parseFloat(emailCost.toFixed(2)) },
            ...dataFixed.map(fc => ({ label: fc.vendor ? `${fc.name}(${fc.vendor})` : fc.name, value: fc.billingCycle === 'YEARLY' ? '年付摊销' : '月付摊销', cost: parseFloat(amortize(fc).toFixed(2)) })),
            { label: 'ZeroBounce 验箱', value: `${emailCount.toLocaleString()} 次`, cost: parseFloat(zerobounceCost.toFixed(2)) },
          ],
        },
        infra: {
          label: '云基建与网络',
          cost: parseFloat(infraCost.toFixed(2)),
          pct: totalCosts > 0 ? parseFloat(((infraCost / totalCosts) * 100).toFixed(1)) : 0,
          items: infraFixed.length > 0
            ? infraFixed.map(fc => ({ label: fc.vendor ? `${fc.name}(${fc.vendor})` : fc.name, value: fc.billingCycle === 'YEARLY' ? '年付摊销' : '月付摊销', cost: parseFloat(amortize(fc).toFixed(2)) }))
            : [
                { label: 'ECS / Vercel', value: `¥${INFRA_SERVER_MO}/月 (env)`, cost: parseFloat(((INFRA_SERVER_MO / 30) * daysInPeriod).toFixed(2)) },
                { label: 'RDS / Neon DB', value: `¥${INFRA_DB_MO}/月 (env)`, cost: parseFloat(((INFRA_DB_MO / 30) * daysInPeriod).toFixed(2)) },
                { label: 'SmartProxy', value: `¥${INFRA_PROXY_MO}/月 (env)`, cost: parseFloat(((INFRA_PROXY_MO / 30) * daysInPeriod).toFixed(2)) },
                { label: 'CDN 流量', value: `¥${INFRA_CDN_MO}/月 (env)`, cost: parseFloat(((INFRA_CDN_MO / 30) * daysInPeriod).toFixed(2)) },
              ],
        },
        payment: {
          label: '支付通道',
          cost: parseFloat(paymentFee.toFixed(2)),
          pct: totalCosts > 0 ? parseFloat(((paymentFee / totalCosts) * 100).toFixed(1)) : 0,
          items: [
            { label: '手续费率', value: `${(PAYMENT_RATE * 100).toFixed(1)}%`, cost: null },
            { label: '应付手续费', value: `基于 ¥${totalRevenue.toFixed(2)} 入账`, cost: parseFloat(paymentFee.toFixed(2)) },
          ],
        },
      },
      ledger,
      dailyTrend,
    })
  } catch (error: any) {
    console.error('[Financial Ledger] Error:', error)
    return NextResponse.json({ error: error?.message || '获取财务数据失败' }, { status: 500 })
  }
}
