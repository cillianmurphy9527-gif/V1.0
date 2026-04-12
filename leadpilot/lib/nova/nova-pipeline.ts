/**
 * Nova 完整流水线 - 整合所有组件
 * 
 * 流水线执行顺序：
 * 1. 瀑布流线索挖掘 (Waterfall Enrichment)
 * 2. AI 邮件生成 (Model Router)
 * 3. 邮件发送 (Resend)
 */

import { prisma } from '@/lib/prisma'
import { withQuotaCheck } from '@/lib/services/quota'
import { enrichLead, EnrichedLead } from '@/lib/enrichment/waterfall'
import { generateOutreachEmail } from '@/lib/ai/model-router'
import { sendEmailViaResend, buildEmailHtml } from '@/lib/email/resend'
import { createLog } from './anti-detection'

// ─── 流水线配置 ───────────────────────────────────────
export const PIPELINE_CONFIG = {
  // 是否启用发送（调试时可关闭）
  ENABLE_SEND: process.env.NOVA_ENABLE_SEND === 'true',
  
  // 每个域名最大尝试次数
  MAX_RETRIES_PER_DOMAIN: 3,
  
  // 批次间延迟
  BATCH_DELAY_MS: {
    MIN: 2000,
    MAX: 5000,
  },
}

// ─── 流水线结果 ───────────────────────────────────────
export interface PipelineResult {
  domain: string
  success: boolean
  enriched?: EnrichedLead
  emailGenerated?: {
    subject: string
    body: string
    preview: string
    aiCost: number
  }
  emailSent?: {
    messageId: string
  }
  error?: string
  quotaDeducted: boolean
  stepsCompleted: string[]
}

// ─── 获取用户配置 ─────────────────────────────────────
async function getUserConfig(userId: string): Promise<{
  name: string
  companyName: string
  businessDesc: string
  knowledgeBaseIds: string[]
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      companyName: true,
      businessDesc: true,
    },
  })

  // 获取用户的知识库内容
  const knowledgeBases = await prisma.knowledgeBase.findMany({
    where: { userId, parseStatus: 'READY' },
    select: {
      chunks: {
        take: 10,
        orderBy: { chunkIndex: 'asc' },
        select: { content: true },
      },
    },
  })

  const knowledgeBaseIds = knowledgeBases.map(kb => kb.chunks.map(c => c.content)).flat()

  return {
    name: user?.name || '销售团队',
    companyName: user?.companyName || 'LeadPilot',
    businessDesc: user?.businessDesc || '',
    knowledgeBaseIds: knowledgeBaseIds as any,
  }
}

// ─── 完整流水线执行 ───────────────────────────────────
/**
 * Nova 完整流水线：搜客 → 写信 → 发信
 * 
 * @param jobId - Nova Job ID
 * @param userId - 用户 ID
 * @param domains - 目标域名列表
 */
export async function executeFullPipeline(
  jobId: string,
  userId: string,
  domains: string[]
): Promise<PipelineResult[]> {
  const results: PipelineResult[] = []
  
  // 获取用户配置
  const userConfig = await getUserConfig(userId)

  for (const domain of domains) {
    const domainResult: PipelineResult = {
      domain,
      success: false,
      quotaDeducted: false,
      stepsCompleted: [],
    }

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

      // ─── Step 2: AI 邮件生成 ─────────────────────────
      const { subject, body, preview, cost } = await generateOutreachEmail(userId, {
        companyName: domainResult.enriched.company.companyName || domain,
        contactName: domainResult.enriched.contact.name || domainResult.enriched.contact.email.split('@')[0],
        jobTitle: domainResult.enriched.contact.jobTitle || '',
        knowledgeBase: userConfig.businessDesc,
      })

      domainResult.emailGenerated = {
        subject,
        body,
        preview,
        aiCost: cost,
      }
      domainResult.stepsCompleted.push('ai_generation')

      // ─── Step 3: 邮件发送 ────────────────────────────
      if (PIPELINE_CONFIG.ENABLE_SEND) {
        const htmlBody = buildEmailHtml({
          subject,
          body,
          senderName: userConfig.name,
          senderCompany: userConfig.companyName,
        })

        const sendResult = await sendEmailViaResend({
          to: domainResult.enriched.contact.email,
          subject,
          body: htmlBody,
          userId,
          campaignId: jobId,
        })

        if (sendResult.success) {
          domainResult.emailSent = {
            messageId: sendResult.messageId!,
          }
          domainResult.stepsCompleted.push('email_sent')
          domainResult.success = true
        } else {
          domainResult.error = sendResult.error
          domainResult.stepsCompleted.push('send_failed')
        }
      } else {
        // 调试模式：模拟发送成功
        domainResult.success = true
        domainResult.emailSent = {
          messageId: `debug_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        }
        domainResult.stepsCompleted.push('email_sent (debug)')
      }

    } catch (error) {
      domainResult.error = error instanceof Error ? error.message : '流水线执行异常'
      domainResult.stepsCompleted.push('error')
    }

    results.push(domainResult)

    // 批次间延迟（防封）
    const delay = Math.floor(
      Math.random() * (PIPELINE_CONFIG.BATCH_DELAY_MS.MAX - PIPELINE_CONFIG.BATCH_DELAY_MS.MIN)
    ) + PIPELINE_CONFIG.BATCH_DELAY_MS.MIN
    await new Promise(resolve => setTimeout(resolve, delay))
  }

  return results
}

// ─── 轻量流水线（仅挖掘不发送）─────────────────────────
/**
 * 仅执行线索挖掘，不生成邮件和发送
 * 用于快速填充 leads_cache
 */
export async function executeEnrichmentOnly(
  userId: string,
  domains: string[],
  onProgress?: (completed: number, total: number, result: { domain: string; success: boolean }) => void
): Promise<{
  total: number
  successful: number
  failed: number
  quotaUsed: number
}> {
  let successful = 0
  let failed = 0
  let quotaUsed = 0

  for (let i = 0; i < domains.length; i++) {
    const domain = domains[i]
    
    try {
      const result = await enrichLead(userId, domain)
      
      if (result.success) {
        successful++
        if (result.costIncurred) quotaUsed++
      } else {
        failed++
      }

      onProgress?.(i + 1, domains.length, { domain, success: result.success })
    } catch (error) {
      failed++
      console.error(`[Enrichment] Failed for ${domain}:`, error)
    }

    // 批次延迟
    if (i < domains.length - 1) {
      const delay = Math.floor(Math.random() * 3000) + 2000
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  return { total: domains.length, successful, failed, quotaUsed }
}

// ─── 获取用户线索列表 ─────────────────────────────────
/**
 * 从 leads_cache 获取用户已挖掘的线索
 */
export async function getUserEnrichedLeads(
  userId: string,
  options?: {
    page?: number
    pageSize?: number
    isValid?: boolean
  }
) {
  const page = options?.page || 1
  const pageSize = options?.pageSize || 20
  const skip = (page - 1) * pageSize

  const [leads, total] = await Promise.all([
    prisma.leadsCache.findMany({
      where: {
        userId,
        ...(options?.isValid !== undefined && { isValid: options.isValid }),
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.leadsCache.count({
      where: {
        userId,
        ...(options?.isValid !== undefined && { isValid: options.isValid }),
      },
    }),
  ])

  return {
    leads,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  }
}
