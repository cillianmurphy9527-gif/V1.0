/**
 * 企业级通知与报警服务 (Webhook 版) — 双机器人架构
 */

export interface WebhookPayload {
  msgtype: string
  markdown?: {
    title: string
    text: string
  }
  content?: {
    title: string
    text: string
  }
}

export interface FinancialHighlight {
  netRevenue: number
  netProfit: number
  profitMarginPct: string
}

class NotificationService {
  constructor() {
    // 移除这里读 process.env，改到发请求的时候读，保证 100% 读到
  }

  private async sendWebhook(
    webhookUrl: string,
    urlEnvName: string,
    title: string,
    markdownBody: string
  ): Promise<void> {
    if (!webhookUrl) {
      console.warn(`[NotificationService] ${urlEnvName} 未配置，跳过推送。摘要：${title}`)
      return
    }

    try {
      const payload = {
        msg_type: 'interactive',
        card: {
          config: { wide_screen_mode: true },
          header: {
            template: title.includes('报警') ? 'red' : 'blue',
            title: { tag: 'plain_text', content: title },
          },
          elements: [
            { tag: 'markdown', content: markdownBody },
          ],
        },
      }

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => '(无法读取响应体)')
        console.error(`[NotificationService] 推送失败 [HTTP ${response.status}]: ${errorText.slice(0, 200)}`)
        return
      }

      console.log(`[NotificationService] ✅ Webhook 推送成功：${title}`)
    } catch (fetchError) {
      console.error(`[NotificationService] Webhook 异常，不阻塞主进程：`, fetchError)
    }
  }

  async sendUrgentAlert(title: string, errorDetails: any): Promise<void> {
    const alertWebhookUrl = process.env.ALERT_WEBHOOK_URL || ''
    const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })

    let errorText: string
    if (errorDetails instanceof Error) {
      errorText = `${errorDetails.message}\n\`\`\`\n${errorDetails.stack || '（无堆栈信息）'}\n\`\`\``
    } else if (typeof errorDetails === 'object' && errorDetails !== null) {
      try {
        errorText = '```json\n' + JSON.stringify(errorDetails, null, 2).slice(0, 800) + '\n```'
      } catch {
        errorText = String(errorDetails)
      }
    } else {
      errorText = String(errorDetails)
    }

    // 修复：移除不兼容的 <font> 标签，使用标准飞书 Markdown
    const markdownBody = [
      '## 🚨 紧急报警',
      '',
      `**报警标题：${title}**`,
      `**触发时间：** ${now}`,
      `**服务环境：** ${process.env.NODE_ENV || 'unknown'}`,
      '',
      '---',
      '',
      '### 错误详情',
      '',
      errorText,
      '',
      '---',
      '',
      '> ⚠️ 请立即排查，避免影响业务！',
    ].join('\n')

    await this.sendWebhook(
      alertWebhookUrl,
      'ALERT_WEBHOOK_URL',
      `【报警】🚨 ${title}`,
      markdownBody
    )
  }

  async sendDailyReport(
    markdownContent: string,
    financialHighlight?: FinancialHighlight
  ): Promise<void> {
    const reportWebhookUrl = process.env.REPORT_WEBHOOK_URL || ''
    const now = new Date().toLocaleString('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })

    const financialBanner: string[] = []
    if (financialHighlight) {
      const { netRevenue, netProfit, profitMarginPct } = financialHighlight
      // 修复：改用通用表情包标注状态，飞书百分百支持
      const profitStatusLabel = netProfit >= 0 ? `🟢 今日盈利` : `🔴 今日亏损`
      const profitStr = netProfit > 0 ? `+¥${netProfit.toFixed(2)}` : `¥${netProfit.toFixed(2)}`

      financialBanner.push(
        '### 📊 财务快速看板',
        '',
        `| 指标 | 数值 |`,
        `|:---|:---|`,
        `| 净营收 | **¥${netRevenue.toFixed(2)}** |`,
        `| 净利润 | **${profitStr}** |`,
        `| 利润率 | **${profitMarginPct}%** |`,
        `| 状态 | **${profitStatusLabel}** |`,
        '',
        '---',
        ''
      )
    }

    const markdownBody = [
      `## 📊 LeadPilot · AI 每日运营简报`,
      `**报告日期：** ${now}　　**生成方式：** AI CFO 智能分析`,
      '',
      '---',
      '',
      ...financialBanner,
      markdownContent,
      '',
      '---',
      '',
      '> 本报告由 LeadPilot 每日简报系统自动生成，数据截至昨日 23:59。财务数据与 Admin 后台财务大盘严格对齐。',
    ].join('\n')

    await this.sendWebhook(
      reportWebhookUrl,
      'REPORT_WEBHOOK_URL',
      `【简报】📊 LeadPilot 每日简报 · ${now}`,
      markdownBody
    )
  }
}

export const notificationService = new NotificationService()