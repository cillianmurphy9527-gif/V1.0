/**
 * AI 每日简报 · Vercel Cron 触发器（财务级升级版）
 *
 * 触发方式：Vercel Cron Job，每天 UTC 00:00（北京时间 08:00）自动 GET 此接口。
 * 安全防御：Authorization: Bearer <CRON_SECRET>
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { notificationService } from '@/lib/notification.service'
import { LLMService } from '@/services/LLMService'

// ─── 成本费率常量（可通过环境变量覆盖）────────────────────────────────
const AI_COST_PER_1K_TOKENS = parseFloat(process.env.AI_COST_PER_1K_TOKENS || '0.001')
const EMAIL_COST_PER_SEND = parseFloat(process.env.EMAIL_COST_PER_SEND || '0.007')

// ─── 辅助：构建昨日时间范围 ─────────────────────────────────────────
function getYesterdayRange(): { start: Date; end: Date; label: string } {
  const now = new Date()
  const start = new Date(now)
  start.setDate(start.getDate() - 1)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setHours(23, 59, 59, 999)

  const label = start.toLocaleDateString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  return { start, end, label }
}

function fmt(amount: number): string {
  return amount.toFixed(2)
}

export async function GET(request: NextRequest) {
  // ── 1. 安全鉴权 ────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization') ?? ''
  const expectedBearer = `Bearer ${cronSecret}`

  if (!cronSecret || authHeader !== expectedBearer) {
    console.warn('[DailyBriefing] 鉴权失败，拒绝请求')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { start, end, label } = getYesterdayRange()
  console.log(`[DailyBriefing] 开始生成 ${label} 简报，时间范围：${start.toISOString()} ~ ${end.toISOString()}`)

  try {
    // ══════════════════════════════════════════════════════════════
    // 2. 财务数据聚合（收入端）
    // ══════════════════════════════════════════════════════════════
    const paidOrderAgg = await prisma.order.aggregate({
      where: { status: 'PAID', createdAt: { gte: start, lte: end } },
      _sum: { amount: true },
      _count: { id: true },
    })
    const grossRevenue = paidOrderAgg._sum.amount ?? 0
    const paidOrderCount = paidOrderAgg._count.id ?? 0

    const refundAgg = await prisma.order.aggregate({
      where: { status: 'REFUNDED', createdAt: { gte: start, lte: end } },
      _sum: { amount: true },
      _count: { id: true },
    })
    const totalRefundAmount = refundAgg._sum.amount ?? 0
    const refundCount = refundAgg._count.id ?? 0

    const netRevenue = grossRevenue - totalRefundAmount

    const revenueByType = await prisma.order.groupBy({
      by: ['orderType'],
      where: { status: 'PAID', createdAt: { gte: start, lte: end } },
      _sum: { amount: true },
    })
    const subscriptionRevenue = revenueByType.find((r) => r.orderType === 'SUBSCRIPTION')?._sum.amount ?? 0
    const addonRevenue = revenueByType.find((r) => r.orderType === 'ADDON')?._sum.amount ?? 0

    // ══════════════════════════════════════════════════════════════
    // 3. 成本计算（AI、邮件、及所有外部采购）
    // ══════════════════════════════════════════════════════════════
    
    // 3-a. AI 推理成本
    const tokenConsumptionAgg = await prisma.tokenTransaction.aggregate({
      where: { amount: { lt: 0 }, createdAt: { gte: start, lte: end } },
      _sum: { amount: true },
      _count: { id: true },
    })
    const totalTokensConsumed = Math.abs(tokenConsumptionAgg._sum.amount ?? 0)
    const tokenTransactionCount = tokenConsumptionAgg._count.id ?? 0
    const aiInferenceCost = (totalTokensConsumed / 1000) * AI_COST_PER_1K_TOKENS

    // 3-b. 邮件投递成本
    const deliveredEmailCount = await prisma.sendingLog.count({
      where: { status: { in: ['SENT', 'OPENED', 'CLICKED', 'REPLIED'] }, sentAt: { gte: start, lte: end } },
    })
    const emailDeliveryCost = deliveredEmailCount * EMAIL_COST_PER_SEND

    // 🌟 3-c. 外部采购成本 (Apollo, Hunter, ZeroBounce, Namecheap 等)
    const externalCosts = await prisma.systemCostLog.groupBy({
      by: ['provider'],
      where: { createdAt: { gte: start, lte: end } },
      _sum: { costCny: true }
    })

    let apolloCost = 0, hunterCost = 0, zeroBounceCost = 0, namecheapCost = 0, otherExternalCost = 0;
    
    externalCosts.forEach(item => {
      const cost = item._sum.costCny ?? 0;
      switch(item.provider) {
        case 'PROXYCURL': apolloCost += cost; break; // 系统用 PROXYCURL 作为 Apollo 平替
        case 'HUNTER': hunterCost += cost; break;
        case 'ZEROBOUNCE': zeroBounceCost += cost; break;
        case 'NAMECHEAP': namecheapCost += cost; break;
        default: 
          // 排除掉已经单独计算过的 AI 和 邮件服务
          if(item.provider !== 'OPENAI' && item.provider !== 'DEEPSEEK' && item.provider !== 'RESEND') {
             otherExternalCost += cost; 
          }
          break;
      }
    })
    const totalExternalCost = apolloCost + hunterCost + zeroBounceCost + namecheapCost + otherExternalCost;

    // 3-d. 总成本 & 净利润 & 利润率
    const totalCost = aiInferenceCost + emailDeliveryCost + totalExternalCost
    const netProfit = netRevenue - totalCost
    const profitMarginPct = netRevenue > 0 ? ((netProfit / netRevenue) * 100).toFixed(2) : '0.00'

    // ══════════════════════════════════════════════════════════════
    // 4. 运营数据聚合
    // ══════════════════════════════════════════════════════════════
    const newUserCount = await prisma.user.count({ where: { createdAt: { gte: start, lte: end } } })
    const totalUserCount = await prisma.user.count()
    const newTicketCount = await prisma.ticket.count({ where: { createdAt: { gte: start, lte: end } } })
    const openTicketCount = await prisma.ticket.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] }, createdAt: { gte: start, lte: end } } })
    const bouncedEmailCount = await prisma.sendingLog.count({ where: { status: 'BOUNCED', sentAt: { gte: start, lte: end } } })
    const totalEmailAttempts = deliveredEmailCount + bouncedEmailCount
    const bounceRate = totalEmailAttempts > 0 ? ((bouncedEmailCount / totalEmailAttempts) * 100).toFixed(2) : '0.00'
    const runningCampaignCount = await prisma.campaign.count({ where: { status: 'RUNNING', updatedAt: { gte: start, lte: end } } })
    const filteredLeadCount = await prisma.lead.count({ where: { status: 'FILTERED_LOW_INTENT', createdAt: { gte: start, lte: end } } })

    // ══════════════════════════════════════════════════════════════
    // 5. 组装精确财务 JSON 数据快照
    // ══════════════════════════════════════════════════════════════
    const financialSnapshot = {
      date: label,
      revenue: {
        gross_revenue_cny: fmt(grossRevenue),
        refund_deduction_cny: fmt(totalRefundAmount),
        net_revenue_cny: fmt(netRevenue),
        subscription_revenue_cny: fmt(subscriptionRevenue),
        addon_revenue_cny: fmt(addonRevenue),
        paid_order_count: paidOrderCount,
        refund_order_count: refundCount,
      },
      cost_breakdown: {
        ai_inference_cost_cny: fmt(aiInferenceCost),
        email_delivery_cost_cny: fmt(emailDeliveryCost),
        apollo_data_cost_cny: fmt(apolloCost),
        hunter_search_cost_cny: fmt(hunterCost),
        zerobounce_verify_cost_cny: fmt(zeroBounceCost),
        namecheap_domain_cost_cny: fmt(namecheapCost),
        other_procurement_cost_cny: fmt(otherExternalCost),
        total_cost_cny: fmt(totalCost),
      },
      profitability: {
        net_profit_cny: fmt(netProfit),
        profit_margin_pct: `${profitMarginPct}%`,
        is_profitable: netProfit >= 0,
      },
      operations: {
        new_users: newUserCount,
        total_users: totalUserCount,
        new_tickets: newTicketCount,
        open_unresolved_tickets: openTicketCount,
        emails_delivered: deliveredEmailCount,
        emails_bounced: bouncedEmailCount,
        bounce_rate_pct: `${bounceRate}%`,
        running_campaigns: runningCampaignCount,
        ai_filtered_leads: filteredLeadCount,
      },
    }

    // ══════════════════════════════════════════════════════════════
    // 6. CFO + COO 人设 Prompt
    // ══════════════════════════════════════════════════════════════
    const systemPrompt = `你是 LeadPilot 公司的 CFO 兼 COO，拥有十年 SaaS 公司财务与运营管理经验。
你的职责是每天早上向 CEO 提交一份极其专业、直接、有洞察力的每日运营简报。

【输出格式要求】
- 使用 Markdown 格式
- 分三个章节：【💰 财务大盘】【📈 运营概览】【⚠️ 风险与建议】
- 所有金额精确到小数点后两位，用 **加粗** 标注关键数字
- 禁止模糊表达，必须直接给出数字和判断
- 【💰 财务大盘】必须详细列出总收入、退款、净营收，以及成本细项（AI、邮件、Apollo、Hunter、ZeroBounce、Namecheap等），最后算出总成本和净利润率。
- 如果净利润为负数，必须在第一行用「⚠️ 今日亏损」显眼标注
- 如果退信率超过 5%，必须标注「🔴 退信率异常」并给出整改建议
- 如果有未解决工单，必须给出预计影响和处理优先级
- 禁止编造任何数据快照中没有提及的信息`

    const userPrompt = `以下是 ${label} 的精确业务数据（JSON 格式，所有金额单位为人民币 CNY）：

${JSON.stringify(financialSnapshot, null, 2)}

请严格基于以上数据，输出符合上述格式要求的 CEO 每日简报。`

    // ══════════════════════════════════════════════════════════════
    // 7. 调用 LLM 生成简报 (修复底层方法调用)
    // ══════════════════════════════════════════════════════════════
    const hasAiKey = !!(process.env.DEEPSEEK_API_KEY || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY)
    let aiReport: string

    if (!hasAiKey) {
      console.warn('[DailyBriefing] ⚠️ 未检测到 AI API Key，已降级为固定文案。')
      aiReport = `⚠️ **测试模式**：当前未配置 AI API Key，无法生成智能战报。当前提取到的总成本为: ¥${fmt(totalCost)}，净利润: ¥${fmt(netProfit)}。`
    } else {
      console.log('[DailyBriefing] 正在调用 AI 生成 CFO 简报...')
      // 🌟 修复点：调用 LLMService.generateContent 替代原有的 llmService.complete
      aiReport = await LLMService.generateContent(
        JSON.stringify([
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ]),
        systemPrompt
      )
    }

    // ══════════════════════════════════════════════════════════════
    // 8. 推送每日简报
    // ══════════════════════════════════════════════════════════════
    await notificationService.sendDailyReport(aiReport, {
      netRevenue: netRevenue,
      netProfit: netProfit,
      profitMarginPct: profitMarginPct,
    })

    console.log(`[DailyBriefing] ✅ ${label} 财务级简报推送完成`)
    return NextResponse.json({ success: true, date: label })

  } catch (error: any) {
    const errorMessage = error?.message || String(error)
    console.error('[DailyBriefing] ❌ 简报生成失败：', error)
    await notificationService.sendUrgentAlert(`CFO 每日简报生成失败（${label}）`, error)
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 })
  }
}