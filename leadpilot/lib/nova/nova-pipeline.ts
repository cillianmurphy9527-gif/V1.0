/**
 * Nova 完整流水线 - 整合所有组件
 * (已植入 Sprint 1 试用期阻隔机制：FREE 用户仅挖掘，不调用 AI 写信)
 */

import { prisma } from '@/lib/prisma'
import { QuotaManager } from '@/lib/services/quota'
import { enrichLead, EnrichedLead } from '@/lib/enrichment/waterfall'
import { generateOutreachEmail } from '@/lib/ai/model-router'
import { sendEmailViaResend, buildEmailHtml } from '@/lib/email/resend'
import { createLog } from './anti-detection'

export const PIPELINE_CONFIG = {
  ENABLE_SEND: process.env.NOVA_ENABLE_SEND === 'true',
  MAX_RETRIES_PER_DOMAIN: 3,
  BATCH_DELAY_MS: { MIN: 2000, MAX: 5000 },
}

export interface PipelineResult {
  domain: string
  success: boolean
  enriched?: EnrichedLead
  emailGenerated?: { subject: string; body: string; preview: string; aiCost: number }
  emailSent?: { messageId: string }
  error?: string
  quotaDeducted: boolean
  stepsCompleted: string[]
}

async function getUserConfig(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, companyName: true, businessDesc: true } })
  const knowledgeBases = await prisma.knowledgeBase.findMany({ where: { userId, parseStatus: 'READY' }, select: { chunks: { take: 10, orderBy: { chunkIndex: 'asc' }, select: { content: true } } } })
  return {
    name: user?.name || '销售团队',
    companyName: user?.companyName || 'LeadPilot',
    businessDesc: user?.businessDesc || '',
    knowledgeBaseIds: knowledgeBases.map(kb => kb.chunks.map(c => c.content)).flat(),
  }
}

export async function executeFullPipeline(jobId: string, userId: string, domains: string[]): Promise<PipelineResult[]> {
  const results: PipelineResult[] = []
  const userConfig = await getUserConfig(userId)
  
  // 🌟 检查用户是否处于试用/免费阶段
  const isFreeTrial = await QuotaManager.isFreeTier(userId);

  for (const domain of domains) {
    const domainResult: PipelineResult = { domain, success: false, quotaDeducted: false, stepsCompleted: [] }

    try {
      // ─── Step 1: 瀑布流线索挖掘 ──────────────────────
      const enrichmentResult = await enrichLead(userId, domain)
      domainResult.stepsCompleted.push('enrichment')

      if (!enrichmentResult.success || !enrichmentResult.lead) {
        domainResult.error = enrichmentResult.error || '线索挖掘失败'
        results.push(domainResult)
        continue
      }

      domainResult.enriched = enrichmentResult.lead
      domainResult.quotaDeducted = enrichmentResult.costIncurred

      // 🌟 核心拦截：如果是 FREE 用户，直接在这里截断流水线！
      if (isFreeTrial) {
          domainResult.success = true; // 算作任务成功（仅完成了搜索部分）
          domainResult.stepsCompleted.push('halt_for_free_tier');
          results.push(domainResult);
          console.log(`[Nova Pipeline] 用户 ${userId} 处于试用期，任务在寻源阶段完成，已阻断 AI 调用。`);
          continue; // 直接跳过这个域名的后续处理，进入下一个域名
      }

      // ─── Step 2: AI 邮件生成 ─────────────────────────
      const { subject, body, preview, cost } = await generateOutreachEmail(userId, {
        companyName: domainResult.enriched.company.companyName || domain,
        contactName: domainResult.enriched.contact.name || domainResult.enriched.contact.email.split('@')[0],
        jobTitle: domainResult.enriched.contact.jobTitle || '',
        knowledgeBase: userConfig.businessDesc,
      })

      domainResult.emailGenerated = { subject, body, preview, aiCost: cost }
      domainResult.stepsCompleted.push('ai_generation')

      // ─── Step 3: 邮件发送 ────────────────────────────
      if (PIPELINE_CONFIG.ENABLE_SEND) {
        const htmlBody = buildEmailHtml({ subject, body, senderName: userConfig.name, senderCompany: userConfig.companyName })
        const sendResult = await sendEmailViaResend({ to: domainResult.enriched.contact.email, subject, body: htmlBody, userId, campaignId: jobId })

        if (sendResult.success) {
          domainResult.emailSent = { messageId: sendResult.messageId! }
          domainResult.stepsCompleted.push('email_sent')
          domainResult.success = true
        } else {
          domainResult.error = sendResult.error
          domainResult.stepsCompleted.push('send_failed')
        }
      } else {
        domainResult.success = true
        domainResult.emailSent = { messageId: `debug_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` }
        domainResult.stepsCompleted.push('email_sent (debug)')
      }

    } catch (error) {
      domainResult.error = error instanceof Error ? error.message : '流水线执行异常'
      domainResult.stepsCompleted.push('error')
    }

    if (!isFreeTrial) results.push(domainResult) // 如果是试用用户，在上面已经 push 过了
    const delay = Math.floor(Math.random() * (PIPELINE_CONFIG.BATCH_DELAY_MS.MAX - PIPELINE_CONFIG.BATCH_DELAY_MS.MIN)) + PIPELINE_CONFIG.BATCH_DELAY_MS.MIN
    await new Promise(resolve => setTimeout(resolve, delay))
  }

  return results
}

export async function executeEnrichmentOnly(userId: string, domains: string[], onProgress?: (completed: number, total: number, result: { domain: string; success: boolean }) => void) {
  let successful = 0, failed = 0, quotaUsed = 0
  for (let i = 0; i < domains.length; i++) {
    try {
      const result = await enrichLead(userId, domains[i])
      if (result.success) { successful++; if (result.costIncurred) quotaUsed++ } else { failed++ }
      onProgress?.(i + 1, domains.length, { domain: domains[i], success: result.success })
    } catch (error) { failed++ }
    if (i < domains.length - 1) await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * 3000) + 2000))
  }
  return { total: domains.length, successful, failed, quotaUsed }
}

export async function getUserEnrichedLeads(userId: string, options?: { page?: number; pageSize?: number; isValid?: boolean }) {
  const page = options?.page || 1, pageSize = options?.pageSize || 20, skip = (page - 1) * pageSize
  const [leads, total] = await Promise.all([
    prisma.leadsCache.findMany({ where: { userId, ...(options?.isValid !== undefined && { isValid: options.isValid }) }, orderBy: { createdAt: 'desc' }, skip, take: pageSize }),
    prisma.leadsCache.count({ where: { userId, ...(options?.isValid !== undefined && { isValid: options.isValid }) } }),
  ])
  return { leads, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } }
}