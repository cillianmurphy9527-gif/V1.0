/**
 * AI 每日简报 · Vercel Cron 触发器（财务级升级版）
 *
 * 触发方式：Vercel Cron Job，每天 UTC 00:00（北京时间 08:00）自动 GET 此接口。
 * 安全防御：Authorization: Bearer <CRON_SECRET>
 *
 * ─── 财务对齐说明 ──────────────────────────────────────────────────────
 * 收入计算：与 /api/admin/financial/stats 完全一致
 *   - 已付款收入：Order.status = 'PAID'
 *   - 退款扣减：  Order.status = 'REFUNDED'
 *   - 净营收     = 已付款收入 - 退款金额
 *
 * 成本计算（基于系统实际消耗量 × 平台费率）：
 *   - AI 推理成本：TokenTransaction 表昨日实际消耗 tokens（amount < 0 的记录）
 *                  × AI_COST_PER_1K_TOKENS（默认 ¥0.001/千tokens，可通过环境变量覆盖）
 *   - 邮件投递成本：SendingLog 表昨日投递成功邮件数
 *                   × EMAIL_COST_PER_SEND（默认 ¥0.007/封，可通过环境变量覆盖）
 *
 * 净利润 = 净营收 - AI 推理成本 - 邮件投递成本
 * 利润率 = 净利润 / 净营收 × 100%
 * ──────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { notificationService } from '@/lib/notification.service'
import { llmService } from '@/services/LLMService'

// ─── 成本费率常量（可通过环境变量覆盖）────────────────────────────────
// AI 推理成本：¥0.001 / 1000 tokens（DeepSeek-chat 官方定价，含容灾 Gemini 加权均值）
const AI_COST_PER_1K_TOKENS = parseFloat(process.env.AI_COST_PER_1K_TOKENS || '0.001')
// 邮件投递成本：¥0.007 / 封（Resend 按量计费，约 $0.001/email × 7.1 汇率）
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

// ─── 辅助：格式化金额（保留两位小数）───────────────────────────────
function fmt(amount: number): string {
  return amount.toFixed(2)
}

// ─── GET handler ────────────────────────────────────────────────────
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
  console.log(
    `[DailyBriefing] 开始生成 ${label} 简报，时间范围：${start.toISOString()} ~ ${end.toISOString()}`
  )

  try {
    // ══════════════════════════════════════════════════════════════
    // 2. 财务数据聚合（与 /api/admin/financial/stats 逻辑严格对齐）
    // ══════════════════════════════════════════════════════════════

    // 2-a. 昨日已付款收入（对齐 financial/stats：status='PAID'）
    const paidOrderAgg = await prisma.order.aggregate({
      where: {
        status: 'PAID',
        createdAt: { gte: start, lte: end },
      },
      _sum: { amount: true },
      _count: { id: true },
    })
    const grossRevenue = paidOrderAgg._sum.amount ?? 0
    const paidOrderCount = paidOrderAgg._count.id ?? 0

    // 2-b. 昨日退款金额（对齐 financial/stats：status='REFUNDED'）
    const refundAgg = await prisma.order.aggregate({
      where: {
        status: 'REFUNDED',
        createdAt: { gte: start, lte: end },
      },
      _sum: { amount: true },
      _count: { id: true },
    })
    const totalRefundAmount = refundAgg._sum.amount ?? 0
    const refundCount = refundAgg._count.id ?? 0

    // 2-c. 净营收 = 已付款收入 - 退款金额
    const netRevenue = grossRevenue - totalRefundAmount

    // 2-d. 订阅收入 vs 增值服务收入（分类拆解）
    const revenueByType = await prisma.order.groupBy({
      by: ['orderType'],
      where: {
        status: 'PAID',
        createdAt: { gte: start, lte: end },
      },
      _sum: { amount: true },
    })
    const subscriptionRevenue =
      revenueByType.find((r) => r.orderType === 'SUBSCRIPTION')?._sum.amount ?? 0
    const addonRevenue =
      revenueByType.find((r) => r.orderType === 'ADDON')?._sum.amount ?? 0

    // ══════════════════════════════════════════════════════════════
    // 3. 成本计算（基于实际消耗量 × 平台费率）
    // ══════════════════════════════════════════════════════════════

    // 3-a. AI 推理成本
    //   数据源：TokenTransaction.amount（负数 = 扣减；正数 = 充值，不计入成本）
    //   仅统计昨日消耗（amount < 0）的绝对值总和
    const tokenConsumptionAgg = await prisma.tokenTransaction.aggregate({
      where: {
        amount: { lt: 0 },
        createdAt: { gte: start, lte: end },
      },
      _sum: { amount: true },
      _count: { id: true },
    })
    // amount 为负数，取绝对值得到实际消耗量
    const totalTokensConsumed = Math.abs(tokenConsumptionAgg._sum.amount ?? 0)
    const tokenTransactionCount = tokenConsumptionAgg._count.id ?? 0
    // AI 成本 = 消耗 tokens ÷ 1000 × 单千token成本
    const aiInferenceCost = (totalTokensConsumed / 1000) * AI_COST_PER_1K_TOKENS

    // 3-b. 邮件投递成本
    //   数据源：SendingLog，昨日成功投递的邮件数
    //   计入成功状态：SENT / OPENED / CLICKED / REPLIED（实际投递即产生费用）
    //   不计入：BOUNCED / UNSUBSCRIBED（退信退订已含在平台基础费中，不额外计费）
    const deliveredEmailCount = await prisma.sendingLog.count({
      where: {
        status: { in: ['SENT', 'OPENED', 'CLICKED', 'REPLIED'] },
        sentAt: { gte: start, lte: end },
      },
    })
    const emailDeliveryCost = deliveredEmailCount * EMAIL_COST_PER_SEND

    // 3-c. 总成本 & 净利润 & 利润率
    const totalCost = aiInferenceCost + emailDeliveryCost
    const netProfit = netRevenue - totalCost
    const profitMarginPct =
      netRevenue > 0 ? ((netProfit / netRevenue) * 100).toFixed(2) : '0.00'

    // ══════════════════════════════════════════════════════════════
    // 4. 运营数据聚合
    // ══════════════════════════════════════════════════════════════

    // 4-a. 用户增长
    const newUserCount = await prisma.user.count({
      where: { createdAt: { gte: start, lte: end } },
    })
    const totalUserCount = await prisma.user.count()

    // 4-b. 工单状况
    const newTicketCount = await prisma.ticket.count({
      where: { createdAt: { gte: start, lte: end } },
    })
    const openTicketCount = await prisma.ticket.count({
      where: {
        status: { in: ['OPEN', 'IN_PROGRESS'] },
        createdAt: { gte: start, lte: end },
      },
    })

    // 4-c. 发信指标（bounced 不计入投递成本，但计入退信率分析）
    const bouncedEmailCount = await prisma.sendingLog.count({
      where: {
        status: 'BOUNCED',
        sentAt: { gte: start, lte: end },
      },
    })
    const totalEmailAttempts = deliveredEmailCount + bouncedEmailCount
    const bounceRate =
      totalEmailAttempts > 0
        ? ((bouncedEmailCount / totalEmailAttempts) * 100).toFixed(2)
        : '0.00'

    // 4-d. Campaign & Lead
    const runningCampaignCount = await prisma.campaign.count({
      where: {
        status: 'RUNNING',
        updatedAt: { gte: start, lte: end },
      },
    })
    const filteredLeadCount = await prisma.lead.count({
      where: {
        status: 'FILTERED_LOW_INTENT',
        createdAt: { gte: start, lte: end },
      },
    })

    // ══════════════════════════════════════════════════════════════
    // 5. 组装精确财务 JSON 数据快照（作为 Prompt 数据源）
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
        ai_tokens_consumed: totalTokensConsumed,
        ai_token_transactions: tokenTransactionCount,
        ai_cost_rate: `CNY ${AI_COST_PER_1K_TOKENS}/per-1k-tokens`,
        email_delivery_cost_cny: fmt(emailDeliveryCost),
        email_delivered_count: deliveredEmailCount,
        email_cost_rate: `CNY ${EMAIL_COST_PER_SEND}/per-email`,
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
- 如果净利润为负数，必须在第一行用「⚠️ 今日亏损」显眼标注
- 如果退信率超过 5%，必须标注「🔴 退信率异常」并给出整改建议
- 如果有未解决工单，必须给出预计影响和处理优先级
- 禁止编造任何数据快照中没有提及的信息
- 输出纯 Markdown，不要包含代码块语法围栏（不要用 \`\`\` 包裹整个输出）

【章节结构】
## 💰 财务大盘
（营收：总收入、退款、净营收、订阅 vs 增值；成本：AI推理成本、邮件成本、总成本；利润：净利润、利润率）

## 📈 运营概览
（新增用户、累计用户、发信量、退信率、拓客任务、AI过滤线索）

## ⚠️ 风险与建议
（最多 3 条，每条一句话结论 + 一句话行动建议）`

    const userPrompt = `以下是 ${label} 的精确业务数据（JSON 格式，所有金额单位为人民币 CNY）：

${JSON.stringify(financialSnapshot, null, 2)}

请严格基于以上数据，输出符合上述格式要求的 CEO 每日简报。`

    // ══════════════════════════════════════════════════════════════
    // 7. 调用 LLM 生成简报（含降级处理：无 API Key 时使用固定测试文案）
    // ══════════════════════════════════════════════════════════════
    const hasAiKey =
      !!(process.env.DEEPSEEK_API_KEY || process.env.GEMINI_API_KEY)

    let aiReport: string

    if (!hasAiKey) {
      // ── 降级模式：无 API Key，使用写死的 Markdown 测试文案 ──────
      // 目的：验证飞书 Webhook 链路是否通畅，不依赖 AI 服务
      console.warn(
        '[DailyBriefing] ⚠️ 未检测到 AI API Key（DEEPSEEK_API_KEY / GEMINI_API_KEY），' +
        '已降级为固定测试文案推送，请配置 Key 后切换至真实 AI 模式。'
      )
      aiReport = [
        `> ⚙️ **测试模式**：当前未配置 AI API Key，以下为固定测试数据，用于验证 Webhook 链路。`,
        '',
        '## 💰 财务大盘',
        '',
        `| 指标 | 数值 |`,
        `|:---|:---|`,
        `| 总收入（已付款） | **¥5,000.00** |`,
        `| 退款扣减 | ¥0.00 |`,
        `| 净营收 | **¥5,000.00** |`,
        `| 其中：订阅收入 | ¥3,800.00 |`,
        `| 其中：增值服务收入 | ¥1,200.00 |`,
        `| AI 推理成本 | ¥38.50 |`,
        `| 邮件投递成本 | ¥21.00 |`,
        `| 总成本 | ¥59.50 |`,
        `| **净利润** | **¥4,940.50** |`,
        `| 利润率 | **98.81%** |`,
        '',
        '## 📈 运营概览',
        '',
        `| 指标 | 数值 |`,
        `|:---|:---|`,
        `| 新增用户 | **120 人** |`,
        `| 累计用户总数 | 1,580 人 |`,
        `| 邮件投递成功 | 3,000 封 |`,
        `| 邮件退信数 | 45 封（退信率 1.47%） |`,
        `| 活跃拓客任务 | 8 个 |`,
        `| AI 过滤低意向线索 | 320 条 |`,
        `| 新建工单 | 5 条 |`,
        `| 未解决工单 | 2 条 |`,
        '',
        '## ⚠️ 风险与建议',
        '',
        '1. **退信率（1.47%）处于安全区间**，建议继续监控，阈值预警线为 5%。',
        '2. **有 2 条工单未解决**，建议今日内完成响应，避免影响用户满意度。',
        '3. **利润率 98.81% 表现优秀**，建议加大拓客任务投入，扩大规模效应。',
      ].join('\n')
    } else {
      // ── 正常模式：调用 LLM 生成简报（含双引擎容灾）──────────────
      console.log('[DailyBriefing] 正在调用 AI 生成 CFO 简报...')
      aiReport = await llmService.complete(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        0.4  // 财务简报用较低温度，确保数字准确不跑偏
      )
    }

    console.log('[DailyBriefing] 简报内容已就绪，正在推送 Webhook...')

    // ══════════════════════════════════════════════════════════════
    // 8. 推送每日简报（含财务高亮）
    // ══════════════════════════════════════════════════════════════
    await notificationService.sendDailyReport(aiReport, {
      netRevenue: netRevenue,
      netProfit: netProfit,
      profitMarginPct: profitMarginPct,
    })

    console.log(`[DailyBriefing] ✅ ${label} 财务级简报推送完成`)

    return NextResponse.json({
      success: true,
      date: label,
      financials: {
        grossRevenue: fmt(grossRevenue),
        totalRefundAmount: fmt(totalRefundAmount),
        netRevenue: fmt(netRevenue),
        subscriptionRevenue: fmt(subscriptionRevenue),
        addonRevenue: fmt(addonRevenue),
        aiInferenceCost: fmt(aiInferenceCost),
        emailDeliveryCost: fmt(emailDeliveryCost),
        totalCost: fmt(totalCost),
        netProfit: fmt(netProfit),
        profitMarginPct: `${profitMarginPct}%`,
      },
      operations: {
        newUserCount,
        totalUserCount,
        paidOrderCount,
        refundCount,
        newTicketCount,
        openTicketCount,
        deliveredEmailCount,
        bouncedEmailCount,
        bounceRate: `${bounceRate}%`,
        runningCampaignCount,
        filteredLeadCount,
        totalTokensConsumed,
      },
      message: 'CFO daily briefing generated and sent successfully.',
    })
  } catch (error: any) {
    const errorMessage = error?.message || String(error)
    console.error('[DailyBriefing] ❌ 简报生成失败：', error)

    // ── 9. 异常报警 ────────────────────────────────────────────
    await notificationService.sendUrgentAlert(
      `CFO 每日简报生成失败（${label}）`,
      error
    )

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}
