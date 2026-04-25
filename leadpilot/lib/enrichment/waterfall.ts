/**
 * Nova 瀑布流线索挖掘流水线 (Waterfall Enrichment)
 * * 核心逻辑：
 * 第 0 步：本地缓存查询（免成本）
 * 第 1 步：Proxycurl/Google 粗筛公司信息
 * 第 2 步：Hunter.io/Snov.io 高管邮箱
 * 第 3 步：SMTP 验证
 * 第 4 步：结算 - 有效数据入库 + 扣费
 */

import { prisma } from '@/lib/prisma'
import { withQuotaCheck } from '@/lib/services/quota'
// 💰 引入全能财务探头
import { CostService } from '@/lib/services/CostService'

// ─── 类型定义 ─────────────────────────────────────────
export interface CompanyInfo {
  domain: string
  companyName?: string
  industry?: string
  size?: string
  description?: string
  linkedinUrl?: string
  logo?: string
}

export interface ContactInfo {
  email: string
  name?: string
  jobTitle?: string
  linkedinUrl?: string
  seniority?: 'C-Level' | 'VP' | 'Director' | 'Manager' | 'IC'
  department?: string
}

export interface EnrichedLead {
  domain: string
  company: CompanyInfo
  contact: ContactInfo
  isValid: boolean
  validationSource: 'CACHE' | 'VERIFIED' | 'UNVERIFIED'
}

export interface EnrichmentResult {
  success: boolean
  lead?: EnrichedLead
  error?: string
  stepsCompleted: number[]
  costIncurred: boolean // 是否产生成本
}

// ─── 步骤枚举 ─────────────────────────────────────────
enum EnrichmentStep {
  CACHE_CHECK = 0,
  COMPANY_SCRAPE = 1,
  CONTACT_FIND = 2,
  EMAIL_VALIDATE = 3,
  SETTLEMENT = 4,
}

// ─── Step 0: 本地缓存查询 ─────────────────────────────
/**
 * 查询本地 leads_cache（免成本）
 * 命中缓存 → 直接返回，不消耗 API 调用
 */
async function checkLocalCache(domain: string, userId: string): Promise<EnrichedLead | null> {
  const cached = await prisma.leadsCache.findFirst({
    where: { userId, domain, isValid: true },
    orderBy: { createdAt: 'desc' },
  })

  if (!cached) return null

  // 命中缓存，直接返回
  return {
    domain: cached.domain,
    company: {
      domain: cached.domain,
      companyName: cached.companyName || undefined,
    },
    contact: {
      email: cached.contactEmail,
      jobTitle: cached.jobTitle || undefined,
    },
    isValid: cached.isValid,
    validationSource: 'CACHE',
  }
}

// ─── Step 1: 公司信息粗筛 ─────────────────────────────
/**
 * 调用 Proxycurl API 获取公司信息
 */
async function scrapeCompanyInfo(domain: string, userId: string): Promise<CompanyInfo | null> {
  const apiKey = process.env.PROXYCURL_API_KEY
  
  if (!apiKey) {
    console.warn('[Enrichment] Proxycurl API key not configured, using mock data')
    return {
      domain,
      companyName: `${domain.split('.')[0].toUpperCase()} Corp`,
      industry: 'Technology',
      size: '50-200',
      description: 'Technology company',
    }
  }

  try {
    const response = await fetch(
      `https://nubela.co/proxycurl/api/v2/company?name=${encodeURIComponent(domain)}`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      }
    )

    if (!response.ok) {
      console.error(`[Enrichment] Proxycurl error: ${response.status}`)
      return null
    }

    // 💰 计费探头：Proxycurl 扣费
    CostService.logCost({
      provider: 'PROXYCURL',
      feature: 'COMPANY_SCRAPE',
      userId: userId,
      usageAmount: 1,
      usageUnit: 'CALL'
    }).catch(e => console.error("探头写入失败", e));

    const data = await response.json()

    return {
      domain,
      companyName: data.name || data.legal_name,
      industry: data.industry,
      size: data.number_of_employees,
      description: data.description,
      linkedinUrl: data.linkedin_url,
      logo: data.logo_url,
    }
  } catch (error) {
    console.error(`[Enrichment] Proxycurl fetch error:`, error)
    return null
  }
}

// ─── Step 2: 联系人查找 ───────────────────────────────
/**
 * 调用 Hunter.io API 查找高管邮箱
 */
async function findContacts(domain: string, userId: string): Promise<ContactInfo[]> {
  const apiKey = process.env.HUNTER_API_KEY
  
  if (!apiKey) {
    console.warn('[Enrichment] Hunter.io API key not configured, using mock data')
    return [
      { email: `ceo@${domain}`, name: 'John CEO', jobTitle: 'CEO', seniority: 'C-Level' },
      { email: `cto@${domain}`, name: 'Jane CTO', jobTitle: 'CTO', seniority: 'C-Level' },
    ]
  }

  try {
    const response = await fetch(
      `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&limit=5&api_key=${apiKey}`
    )

    if (!response.ok) {
      console.error(`[Enrichment] Hunter.io error: ${response.status}`)
      return []
    }

    // 💰 计费探头：Hunter 扣费
    CostService.logCost({
      provider: 'HUNTER',
      feature: 'CONTACT_SEARCH',
      userId: userId,
      usageAmount: 1,
      usageUnit: 'CALL'
    }).catch(e => console.error("探头写入失败", e));

    const data = await response.json()
    
    return (data.data.emails || []).map((email: any) => ({
      email: email.value,
      name: email.first_name ? `${email.first_name} ${email.last_name || ''}`.trim() : undefined,
      jobTitle: email.position,
      linkedinUrl: email.linkedin,
      seniority: classifySeniority(email.position),
      department: email.department,
    }))
  } catch (error) {
    console.error(`[Enrichment] Hunter.io fetch error:`, error)
    return []
  }
}

function classifySeniority(jobTitle?: string): ContactInfo['seniority'] {
  if (!jobTitle) return 'IC'
  
  const title = jobTitle.toLowerCase()
  if (title.includes('ceo') || title.includes('cto') || title.includes('cfo') || title.includes('coo') || title.includes('chief')) return 'C-Level'
  if (title.includes('vp') || title.includes('vice president')) return 'VP'
  if (title.includes('director') || title.includes('head of')) return 'Director'
  if (title.includes('manager')) return 'Manager'
  
  return 'IC'
}

// ─── Step 3: 邮箱验证 ─────────────────────────────────
/**
 * 调用 SMTP 验证 API 确认邮箱有效性
 */
async function validateEmail(email: string, userId: string): Promise<{
  isValid: boolean
  deliverable?: boolean
  risk?: 'low' | 'medium' | 'high'
}> {
  const apiKey = process.env.EMAIL_VALIDATION_API_KEY
  
  if (!apiKey) {
    console.warn('[Enrichment] Email validation API key not configured, using basic check')
    const basicValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    return { isValid: basicValid, deliverable: basicValid, risk: basicValid ? 'low' : 'high' }
  }

  try {
    const response = await fetch('https://api.usebouncer.com/v1/email/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({ email }),
    })

    if (!response.ok) {
      console.error(`[Enrichment] Email validation error: ${response.status}`)
      return { isValid: false, risk: 'high' }
    }

    // 💰 计费探头：ZeroBounce/UseBouncer 洗邮箱扣费
    CostService.logCost({
      provider: 'ZEROBOUNCE',
      feature: 'EMAIL_VALIDATE',
      userId: userId,
      usageAmount: 1,
      usageUnit: 'CALL'
    }).catch(e => console.error("探头写入失败", e));

    const data = await response.json()
    
    return {
      // 🛠️ 修复了原代码的语法错误 (原为 data deliverable)
      isValid: data.deliverable && data.status !== 'risky',
      deliverable: data.deliverable,
      risk: data.status === 'deliverable' ? 'low' : data.status === 'risky' ? 'medium' : 'high',
    }
  } catch (error) {
    console.error(`[Enrichment] Email validation fetch error:`, error)
    return { isValid: false, risk: 'high' }
  }
}

// ─── Step 4: 结算 ─────────────────────────────────────
async function settleLead(userId: string, lead: EnrichedLead): Promise<{ success: boolean; error?: string }> {
  if (lead.validationSource !== 'VERIFIED') {
    return { success: false, error: '邮箱未通过验证' }
  }

  try {
    await withQuotaCheck(userId, async () => {
      await prisma.leadsCache.upsert({
        where: { contactEmail: lead.contact.email },
        update: {
          userId,
          domain: lead.domain,
          companyName: lead.contact.name || lead.company.companyName,
          jobTitle: lead.contact.jobTitle,
          isValid: true,
        },
        create: {
          userId,
          domain: lead.domain,
          companyName: lead.contact.name || lead.company.companyName,
          contactEmail: lead.contact.email,
          jobTitle: lead.contact.jobTitle,
          isValid: true,
        },
      })
    })

    return { success: true }
  } catch (error) {
    if (error instanceof Error && error.message.includes('余额不足')) {
      return { success: false, error: '线索余额不足' }
    }
    throw error
  }
}

// ─── 瀑布流主函数 ─────────────────────────────────────
export async function enrichLead(userId: string, domain: string): Promise<EnrichmentResult> {
  const stepsCompleted: number[] = []

  try {
    // ─── Step 0: 本地缓存 ──────────────────────────────
    const cachedLead = await checkLocalCache(domain, userId)
    if (cachedLead) {
      stepsCompleted.push(EnrichmentStep.CACHE_CHECK)
      return { success: true, lead: cachedLead, stepsCompleted, costIncurred: false }
    }

    // ─── Step 1: 公司信息 ──────────────────────────────
    // 增加 userId 传参以支持记账
    const companyInfo = await scrapeCompanyInfo(domain, userId)
    if (!companyInfo) {
      return { success: false, error: '无法获取公司信息', stepsCompleted: [EnrichmentStep.CACHE_CHECK, EnrichmentStep.COMPANY_SCRAPE], costIncurred: false }
    }
    stepsCompleted.push(EnrichmentStep.COMPANY_SCRAPE)

    // ─── Step 2: 联系人查找 ────────────────────────────
    // 增加 userId 传参以支持记账
    const contacts = await findContacts(domain, userId)
    if (contacts.length === 0) {
      return { success: false, error: '未找到联系人', stepsCompleted: [...stepsCompleted, EnrichmentStep.CONTACT_FIND], costIncurred: false }
    }
    stepsCompleted.push(EnrichmentStep.CONTACT_FIND)

    const priorityOrder: ContactInfo['seniority'][] = ['C-Level', 'VP', 'Director', 'Manager', 'IC']
    contacts.sort((a, b) => 
      (priorityOrder.indexOf(a.seniority || 'IC')) - (priorityOrder.indexOf(b.seniority || 'IC'))
    )

    for (const contact of contacts) {
      // ─── Step 3: 邮箱验证 ────────────────────────────
      // 增加 userId 传参以支持记账
      const validation = await validateEmail(contact.email, userId)
      stepsCompleted.push(EnrichmentStep.EMAIL_VALIDATE)

      if (!validation.isValid || validation.risk === 'high') continue

      const enrichedLead: EnrichedLead = {
        domain,
        company: companyInfo,
        contact: { ...contact, seniority: contact.seniority || 'IC' },
        isValid: true,
        validationSource: validation.deliverable ? 'VERIFIED' : 'UNVERIFIED',
      }

      // ─── Step 4: 结算 ────────────────────────────────
      const settleResult = await settleLead(userId, enrichedLead)
      stepsCompleted.push(EnrichmentStep.SETTLEMENT)

      if (settleResult.success) {
        return { success: true, lead: enrichedLead, stepsCompleted, costIncurred: true }
      } else if (settleResult.error === '线索余额不足') {
        return { success: false, error: settleResult.error, stepsCompleted, costIncurred: true }
      }
    }

    return { success: false, error: '所有邮箱验证失败', stepsCompleted, costIncurred: false }

  } catch (error) {
    console.error('[Enrichment] Error:', error)
    return { success: false, error: error instanceof Error ? error.message : '未知错误', stepsCompleted, costIncurred: false }
  }
}

// ─── 批量瀑布流 ───────────────────────────────────────
export async function enrichLeadsBatch(
  userId: string,
  domains: string[],
  onProgress?: (completed: number, total: number, lead: EnrichedLead) => void
): Promise<{
  total: number
  successful: number
  failed: number
  results: EnrichmentResult[]
}> {
  const results: EnrichmentResult[] = []
  let successful = 0
  let failed = 0

  for (let i = 0; i < domains.length; i++) {
    const domain = domains[i]
    
    const result = await enrichLead(userId, domain)
    results.push(result)

    if (result.success && result.lead) {
      successful++
      onProgress?.(i + 1, domains.length, result.lead)
    } else {
      failed++
    }

    if (i < domains.length - 1) {
      const delay = Math.floor(Math.random() * 3000) + 2000 
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  return { total: domains.length, successful, failed, results }
}