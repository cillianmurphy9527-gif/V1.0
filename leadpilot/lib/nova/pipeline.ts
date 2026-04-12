/**
 * Nova 线索流水线处理器
 * 
 * 执行流程：
 * 1. 搜客 (Search) - 从数据源获取目标客户
 * 2. 写信 (Generate) - 使用 RAG 上下文生成个性化邮件
 * 3. 发信 (Send) - 通过 BullMQ 队列发送邮件
 */

import { prisma } from '@/lib/prisma'
import { withQuotaCheck } from '@/lib/services/quota'
import { createLog, appendJobLog } from './anti-detection'

// ─── 流水线步骤 ───────────────────────────────────────
export interface PipelineStep {
  name: 'SEARCH' | 'GENERATE' | 'SEND'
  status: 'pending' | 'running' | 'completed' | 'failed'
  error?: string
}

// ─── 搜索结果 ─────────────────────────────────────────
export interface LeadData {
  domain: string
  companyName: string
  contactEmail: string
  jobTitle: string
  isValid: boolean
}

// ─── Step 1: 搜客 ─────────────────────────────────────
/**
 * 从数据源搜索目标客户
 * 【UI 测试模式】临时生成 3 条测试数据，用于验证投递流水 + 白底弹窗 + 唤醒弹窗
 * 生产上线前必须替换为真实数据源（Apollo / LinkedIn / 自建爬虫）
 */
async function searchLeads(
  userId: string,
  targetAudience: {
    country?: string
    industry?: string
    keywords?: string[]
  },
  limit: number
): Promise<LeadData[]> {
  // ─── 【UI 测试数据】临时注入 ───────────────────────────────
  const testLeads: LeadData[] = [
    {
      domain: 'uitestcorp.com',
      companyName: 'UI Test Corp',
      contactEmail: 'test@uitestcorp.com',
      jobTitle: 'Chief Marketing Officer',
      isValid: true,
    },
    {
      domain: 'novatest.io',
      companyName: 'Nova Test Solutions',
      contactEmail: 'alex@novatest.io',
      jobTitle: 'VP of Sales',
      isValid: true,
    },
    {
      domain: 'leadpilot-demo.com',
      companyName: 'LeadPilot Demo Ltd',
      contactEmail: 'sarah@leadpilot-demo.com',
      jobTitle: 'Head of Business Development',
      isValid: true,
    },
  ]
  // 返回测试数据（不超过 limit）
  return testLeads.slice(0, limit)
  // ─────────────────────────────────────────────────────────
}

// ─── Step 2: 写信 ─────────────────────────────────────
/**
 * 使用 RAG 上下文生成个性化邮件
 */
async function generateEmail(
  userId: string,
  lead: LeadData,
  knowledgeBaseIds: string[]
): Promise<{ subject: string; body: string }> {
  // 获取用户的 RAG 上下文
  let ragContext = ''
  
  if (knowledgeBaseIds && knowledgeBaseIds.length > 0) {
    const chunks = await prisma.documentChunk.findMany({
      where: {
        knowledgeBase: {
          id: { in: knowledgeBaseIds },
          userId,
        },
      },
      select: { content: true },
      take: 5, // 最多使用 5 个切片
      orderBy: { chunkIndex: 'asc' },
    })
    
    ragContext = chunks.map(c => c.content).join('\n\n')
  }

  // 获取用户配置
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      businessDesc: true,
      companyName: true,
      name: true,
    },
  })

  // TODO: 调用 AI 生成个性化邮件
  // 暂时使用模板生成
  const subject = `探索 ${lead.companyName} 的增长机会`
  const body = `
您好，

我是 ${user?.name || '销售团队'} 来自 ${user?.companyName || '我们的公司'}。

${ragContext ? `关于您的业务：
${ragContext.substring(0, 200)}...\n\n` : ''}
我们专注于帮助 ${lead.jobTitle} 提升业绩，希望有机会与您交流。

期待您的回复！

Best regards,
${user?.name || '销售团队'}
`.trim()

  return { subject, body }
}

// ─── Step 3: 发信 ─────────────────────────────────────
/**
 * 通过 BullMQ 队列发送邮件
 */
async function sendEmail(
  userId: string,
  campaignId: string,
  email: {
    to: string
    subject: string
    body: string
  }
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  // TODO: 接入真实的 BullMQ 邮件队列
  // const { addEmailJobsBatch } = await import('@/lib/queue-manager')
  
  try {
    // 模拟发送
    // await addEmailJobsBatch(userId, [{
    //   to: email.to,
    //   subject: email.subject,
    //   body: email.body,
    //   fromEmail: 'noreply@yourdomain.com',
    //   fromDomain: 'yourdomain.com',
    //   domainIndex: 0,
    // }], campaignId)

    return { success: true, messageId: `msg-${Date.now()}` }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '发送失败',
    }
  }
}

// ─── 流水线执行 ───────────────────────────────────────
/**
 * 执行完整的搜客→写信→发信流水线
 */
export async function executeLeadPipeline(
  jobId: string,
  userId: string,
  params: {
    targetAudience: {
      country?: string
      industry?: string
      keywords?: string[]
    }
    knowledgeBaseIds: string[]
    batchSize: number
  }
): Promise<{
  leadsFound: number
  leadsSaved: number
  emailsSent: number
  errors: string[]
}> {
  const result = {
    leadsFound: 0,
    leadsSaved: 0,
    emailsSent: 0,
    errors: [] as string[],
  }

  // Step 1: 搜客
  await appendJobLog(jobId, createLog('INFO', '开始搜索线索...', { 
    targetAudience: params.targetAudience,
    batchSize: params.batchSize,
  }))

  let leads: LeadData[] = []
  try {
    leads = await searchLeads(
      userId,
      params.targetAudience,
      params.batchSize
    )
    result.leadsFound = leads.length
    
    await appendJobLog(jobId, createLog('INFO', `搜索完成，找到 ${leads.length} 条线索`))
  } catch (error) {
    const errMsg = `搜索失败: ${error instanceof Error ? error.message : '未知错误'}`
    await appendJobLog(jobId, createLog('ERROR', errMsg))
    result.errors.push(errMsg)
    return result
  }

  // 过滤有效线索
  const validLeads = leads.filter(lead => lead.isValid)
  
  // 【开发模式】跳过配额检查，直接执行所有线索
  const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === undefined
  
  // Step 2-3: 写信 + 发信（对每条有效线索执行）
  for (const lead of validLeads) {
    try {
      if (isDev) {
        // 【开发模式】直接执行，跳过配额检查
        // 1. 生成邮件内容
        const emailContent = await generateEmail(
          userId,
          lead,
          params.knowledgeBaseIds
        )

        // 2. 保存线索到 leadsCache（可选缓存层）
        await prisma.leadsCache.upsert({
          where: { contactEmail: lead.contactEmail },
          update: {
            domain: lead.domain,
            companyName: lead.companyName,
            jobTitle: lead.jobTitle,
            isValid: lead.isValid,
          },
          create: {
            userId,
            domain: lead.domain,
            companyName: lead.companyName,
            contactEmail: lead.contactEmail,
            jobTitle: lead.jobTitle,
            isValid: lead.isValid,
          },
        })

        // 3. 创建 UserLead（必须在 DeliveryLog 之前先创建，才能被 FK 引用）
        const userLead = await prisma.userLead.upsert({
          where: {
            userId_email: { userId, email: lead.contactEmail }
          },
          update: {
            companyName: lead.companyName,
            jobTitle: lead.jobTitle,
            isUnlocked: false,
          },
          create: {
            userId,
            email: lead.contactEmail,
            companyName: lead.companyName,
            jobTitle: lead.jobTitle,
            isUnlocked: false,
            source: 'NOVA',
          },
        })

        // 4. 创建 DeliveryLog（状态：PENDING_PAYMENT）
        console.log(`[Pipeline] 📝 尝试为邮箱 ${lead.contactEmail} 创建 DeliveryLog...`)
        try {
          await prisma.deliveryLog.create({
            data: {
              userId,
              leadId: userLead.id,
              recipientEmail: lead.contactEmail,
              subject: emailContent.subject,
              status: 'PENDING_PAYMENT',
              sentAt: new Date(),
              senderDomain: 'noreply.leadpilot.io',
              companyName: lead.companyName,
              contactName: null,
            },
          })
          console.log(`[Pipeline] ✅ DeliveryLog 创建成功!`)
          result.leadsSaved++
        } catch (dbError) {
          console.error(`[Pipeline] ❌ [DB 致命错误] DeliveryLog 写入失败:`, dbError)
          result.errors.push(`DeliveryLog 创建失败: ${dbError instanceof Error ? dbError.message : String(dbError)}`)
        }

        await appendJobLog(jobId, createLog('DEBUG', `已处理线索: ${lead.contactEmail} [DEV MODE]`))
      } else {
        // 【生产模式】正常配额检查
        await withQuotaCheck(userId, async ({ newBalance }) => {
          // 生成邮件
          const emailContent = await generateEmail(
            userId,
            lead,
            params.knowledgeBaseIds
          )

          // 保存线索到缓存
          await prisma.leadsCache.upsert({
            where: { contactEmail: lead.contactEmail },
            update: {
              domain: lead.domain,
              companyName: lead.companyName,
              jobTitle: lead.jobTitle,
              isValid: lead.isValid,
            },
            create: {
              userId,
              domain: lead.domain,
              companyName: lead.companyName,
              contactEmail: lead.contactEmail,
              jobTitle: lead.jobTitle,
              isValid: lead.isValid,
            },
          })
          result.leadsSaved++

          await appendJobLog(jobId, createLog('DEBUG', `已处理线索: ${lead.contactEmail}`, {
            remainingBalance: newBalance,
          }))
        })
      }
    } catch (error) {
      // 配额不足或其他错误
      if (error instanceof Error && error.message.includes('余额不足')) {
        result.errors.push(`配额不足，停止处理`)
        await appendJobLog(jobId, createLog('WARN', '配额不足，任务暂停'))
        break
      }
      const errMsg = `处理 ${lead.contactEmail} 失败: ${error instanceof Error ? error.message : '未知错误'}`
      await appendJobLog(jobId, createLog('ERROR', errMsg))
      result.errors.push(errMsg)
    }
  }

  await appendJobLog(jobId, createLog('INFO', `批次完成: 找到 ${result.leadsFound}, 保存 ${result.leadsSaved}, 发送 ${result.emailsSent}`))

  return result
}
