/**
 * 企业级通知与报警服务 (Webhook 版) — 双机器人架构
 *
 * 架构说明：
 *   - sendDailyReport  → process.env.REPORT_WEBHOOK_URL（业务简报机器人）
 *   - sendUrgentAlert  → process.env.ALERT_WEBHOOK_URL（技术报警机器人）
 *
 * 飞书安全关键词适配：
 *   - 简报消息标题前缀：【简报】
 *   - 报警消息标题前缀：【报警】
 *
 * 金额高亮说明：
 *   - 钉钉 / 飞书：支持 <font color="#xx"> 标签
 *   - 数字统一使用 **加粗** + 颜色标签双保险，确保在各平台均醒目
 *
 * 使用方式：
 *   import { notificationService } from '@/lib/notification.service'
 *   await notificationService.sendUrgentAlert('数据库连接失败', error)
 *   await notificationService.sendDailyReport(markdownText, { netRevenue, netProfit, profitMarginPct })
 */

export interface WebhookPayload {
  msgtype: string
  markdown?: {
    title: string
    text: string
  }
  // 企业微信结构（备用字段，部分版本使用）
  content?: {
    title: string
    text: string
  }
}

/** 财务摘要数据，用于在简报头部生成高亮财务看板 */
export interface FinancialHighlight {
  /** 净营收（人民币，数字） */
  netRevenue: number
  /** 净利润（人民币，数字，可为负） */
  netProfit: number
  /** 利润率百分比字符串，如 "42.50" */
  profitMarginPct: string
}

/** 金额颜色工具：盈利绿色，亏损红色，中性蓝色 */
function colorAmount(amount: number): string {
  const formatted = `¥${Math.abs(amount).toFixed(2)}`
  if (amount > 0) {
    return `<font color="#00B96B">**+${formatted}**</font>`
  } else if (amount < 0) {
    return `<font color="#FF4D4F">**-${formatted}**</font>`
  } else {
    return `<font color="#1677FF">**${formatted}**</font>`
  }
}

class NotificationService {
  /** 业务简报机器人 Webhook URL */
  private reportWebhookUrl: string
  /** 技术报警机器人 Webhook URL */
  private alertWebhookUrl: string

  constructor() {
    this.reportWebhookUrl = process.env.REPORT_WEBHOOK_URL || ''
    this.alertWebhookUrl = process.env.ALERT_WEBHOOK_URL || ''
  }

  /**
   * 底层 Webhook 推送（防崩溃）
   *
   * @param webhookUrl  目标 Webhook 地址
   * @param urlEnvName  对应的环境变量名（用于警告提示）
   * @param title       消息标题
   * @param markdownBody Markdown 正文
   */
  private async sendWebhook(
    webhookUrl: string,
    urlEnvName: string,
    title: string,
    markdownBody: string
  ): Promise<void> {
    if (!webhookUrl) {
      console.warn(
        `[NotificationService] ${urlEnvName} 未配置，跳过 Webhook 推送。消息摘要：${title}`
      )
      return
    }

    try {
      // 飞书 interactive 卡片规范（官方唯一正确结构，避免静默吞消息）
      const payload = {
        msg_type: 'interactive',
        card: {
          config: { wide_screen_mode: true },
          header: {
            // 报警用红色卡片头，简报用蓝色卡片头
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
        console.error(
          `[NotificationService] Webhook 推送失败 [HTTP ${response.status}]: ${errorText.slice(0, 200)}`
        )
        return
      }

      console.log(`[NotificationService] ✅ Webhook 推送成功：${title}`)
    } catch (fetchError) {
      // 防崩溃：fetch 本身异常（网络超时、DNS 解析失败等）只记录日志，不向上抛出
      console.error(
        `[NotificationService] Webhook fetch 异常，不阻塞主进程：`,
        fetchError
      )
    }
  }

  /**
   * 发送紧急报警
   *
   * 使用 process.env.ALERT_WEBHOOK_URL 推送至技术报警机器人。
   * 标题前缀【报警】用于触发飞书安全关键词校验。
   *
   * @param title        报警标题，简明扼要（如 "每日简报生成失败"）
   * @param errorDetails 错误详情，可以是 Error 对象、字符串或任意可序列化值
   */
  async sendUrgentAlert(title: string, errorDetails: any): Promise<void> {
    const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })

    // 将 errorDetails 格式化为可读字符串
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

    const markdownBody = [
      '## 🚨 <font color="#FF0000">紧急报警</font>',
      '',
      `<font color="#FF4D4F">**报警标题：${title}**</font>`,
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

    // 使用 ALERT_WEBHOOK_URL，标题携带【报警】前缀触发飞书关键词
    await this.sendWebhook(
      this.alertWebhookUrl,
      'ALERT_WEBHOOK_URL',
      `【报警】🚨 ${title}`,
      markdownBody
    )
  }

  /**
   * 发送每日简报
   *
   * 使用 process.env.REPORT_WEBHOOK_URL 推送至业务简报机器人。
   * 标题前缀【简报】用于触发飞书安全关键词校验。
   * 如果传入 financialHighlight，将在正文前插入彩色财务看板摘要。
   *
   * @param markdownContent    由外部（通常是 AI）生成的 Markdown 正文
   * @param financialHighlight 可选：财务摘要数据，用于头部高亮看板
   */
  async sendDailyReport(
    markdownContent: string,
    financialHighlight?: FinancialHighlight
  ): Promise<void> {
    const now = new Date().toLocaleString('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })

    // ── 财务看板摘要行（仅当传入 financialHighlight 时显示）──────────
    const financialBanner: string[] = []
    if (financialHighlight) {
      const { netRevenue, netProfit, profitMarginPct } = financialHighlight

      // 利润状态标签
      const profitStatusLabel =
        netProfit >= 0
          ? `<font color="#00B96B">**● 今日盈利**</font>`
          : `<font color="#FF4D4F">**⚠️ 今日亏损**</font>`

      // 利润率颜色：>30% 绿色，10%~30% 蓝色，<10% 橙色，负数红色
      const marginNum = parseFloat(profitMarginPct)
      let marginColor = '#FF7A00'
      if (marginNum >= 30) marginColor = '#00B96B'
      else if (marginNum >= 10) marginColor = '#1677FF'
      else if (marginNum < 0) marginColor = '#FF4D4F'

      financialBanner.push(
        '### 📊 财务快速看板',
        '',
        `| 指标 | 数值 |`,
        `|:---|:---|`,
        `| 净营收 | <font color="#1677FF">**¥${netRevenue.toFixed(2)}**</font> |`,
        `| 净利润 | ${colorAmount(netProfit)} |`,
        `| 利润率 | <font color="${marginColor}">**${profitMarginPct}%**</font> |`,
        `| 状态 | ${profitStatusLabel} |`,
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

    // 使用 REPORT_WEBHOOK_URL，标题携带【简报】前缀触发飞书关键词
    await this.sendWebhook(
      this.reportWebhookUrl,
      'REPORT_WEBHOOK_URL',
      `【简报】📊 LeadPilot 每日简报 · ${now}`,
      markdownBody
    )
  }
}

/**
 * 单例导出，全局复用
 */
export const notificationService = new NotificationService()
