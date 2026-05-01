/**
 * Nova 瀑布流线索挖掘流水线 (Waterfall Enrichment)
 * * 核心逻辑：
 * 第 0 步：全局 & 本地缓存双重查询（零成本，终极白嫖）
 * 第 1 步：Proxycurl/Google 粗筛公司信息
 * 第 2 步：Hunter.io/Snov.io 高管邮箱
 * 第 3 步：SMTP 验证 (ZeroBounce)
 * 第 4 步：结算 - 有效数据入库（并反哺全局缓存池）+ 扣费
 */

import { prisma } from '@/lib/prisma'
import { withQuotaCheck } from '@/lib/services/quota'
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
  validationSource: 'LOCAL_CACHE' | 'GLOBAL_CACHE' | 'VERIFIED' | 'UNVERIFIED'
}

export interface EnrichmentResult {
  success: boolean
  lead?: EnrichedLead
  error?: string
  stepsCompleted: number[]
  costIncurred: boolean // 是否产生成本
}

enum EnrichmentStep {
  CACHE_CHECK = 0,
  COMPANY_SCRAPE = 1,
  CONTACT_FIND = 2,
  EMAIL_VALIDATE = 3,
  SETTLEMENT = 4,
}

// ─── Step 0: 终极缓存查询 (本地 + 全局) ─────────────────────────────
async function checkCaches(domain: string, userId: string): Promise<EnrichedLead | null> {
  // 1. 先查用户的私有缓存 (最快)
  const localCached = await prisma.leadsCache.findFirst({
    where: { userId, domain, isValid: true },
    orderBy: { createdAt: 'desc' },
  })

  if (localCached) {
    return {
      domain: localCached.domain,
      company: { domain: localCached.domain, companyName: localCached.companyName || undefined },
      contact: { email: localCached.contactEmail, jobTitle: localCached.jobTitle || undefined },
      isValid: true,
      validationSource: 'LOCAL_CACHE',
    }
  }

  // 🌟 2. 再查全系统共享的全局验证缓存池 (GlobalLeadCache) - 省钱核心！
  const globalCached = await prisma.globalLeadCache.findFirst({
    where: { domain },
    orderBy: { confidence: 'desc' }, // 取置信度最高的
  })

  if (globalCached) {
    return {
      domain: globalCached.domain,
      company: { domain: globalCached.domain, companyName: globalCached.companyName || undefined },
      contact: { 
        email: globalCached.contactEmail, 
        name: globalCached.firstName ? `${globalCached.firstName} ${globalCached.lastName || ''}`.trim() : undefined,
        jobTitle: globalCached.jobTitle || undefined 
      },
      isValid: true,
      validationSource: 'GLOBAL_CACHE',
    }
  }

  return null
}

// ─── Step 1: 公司信息粗筛 ─────────────────────────────
async function scrapeCompanyInfo(domain: string, userId: string): Promise<CompanyInfo | null> {
  const apiKey = process.env.PROXYCURL_API_KEY
  if (!apiKey) {
    return { domain, companyName: `${domain.split('.')[0].toUpperCase()} Corp`, industry: 'Technology', size: '50-200', description: 'Technology company' }
  }
  try {
    const response = await fetch(`https://nubela.co/proxycurl/api/v2/company?name=${encodeURIComponent(domain)}`, { headers: { 'Authorization': `Bearer ${apiKey}` } })
    if (!response.ok) return null
    CostService.logCost({ provider: 'PROXYCURL', feature: 'COMPANY_SCRAPE', userId: userId, usageAmount: 1, usageUnit: 'CALL' }).catch(() => {});
    const data = await response.json()
    return { domain, companyName: data.name || data.legal_name, industry: data.industry, size: data.number_of_employees, description: data.description, linkedinUrl: data.linkedin_url, logo: data.logo_url }
  } catch (error) { return null }
}

// ─── Step 2: 联系人查找 ───────────────────────────────
async function findContacts(domain: string, userId: string): Promise<ContactInfo[]> {
  const apiKey = process.env.HUNTER_API_KEY
  if (!apiKey) {
    return [ { email: `ceo@${domain}`, name: 'John CEO', jobTitle: 'CEO', seniority: 'C-Level' } ]
  }
  try {
    const response = await fetch(`https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&limit=5&api_key=${apiKey}`)
    if (!response.ok) return []
    CostService.logCost({ provider: 'HUNTER', feature: 'CONTACT_SEARCH', userId: userId, usageAmount: 1, usageUnit: 'CALL' }).catch(() => {});
    const data = await response.json()
    return (data.data.emails || []).map((email: any) => ({
      email: email.value,
      name: email.first_name ? `${email.first_name} ${email.last_name || ''}`.trim() : undefined,
      jobTitle: email.position,
      linkedinUrl: email.linkedin,
      seniority: classifySeniority(email.position),
      department: email.department,
    }))
  } catch (error) { return [] }
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
async function validateEmail(email: string, userId: string): Promise<{ isValid: boolean, deliverable?: boolean, risk?: 'low' | 'medium' | 'high' }> {
  const apiKey = process.env.EMAIL_VALIDATION_API_KEY
  if (!apiKey) {
    const basicValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    return { isValid: basicValid, deliverable: basicValid, risk: basicValid ? 'low' : 'high' }
  }
  try {
    const response = await fetch('https://api.usebouncer.com/v1/email/verify', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey }, body: JSON.stringify({ email }) })
    if (!response.ok) return { isValid: false, risk: 'high' }
    CostService.logCost({ provider: 'ZEROBOUNCE', feature: 'EMAIL_VALIDATE', userId: userId, usageAmount: 1, usageUnit: 'CALL' }).catch(() => {});
    const data = await response.json()
    return { isValid: data.deliverable && data.status !== 'risky', deliverable: data.deliverable, risk: data.status === 'deliverable' ? 'low' : data.status === 'risky' ? 'medium' : 'high' }
  } catch (error) { return { isValid: false, risk: 'high' } }
}

// ─── Step 4: 结算与入库 ─────────────────────────────────────
async function settleLead(userId: string, lead: EnrichedLead): Promise<{ success: boolean; error?: string }> {
  // 如果是缓存命中的，不需要重新扣费，直接放行
  if (lead.validationSource === 'LOCAL_CACHE' || lead.validationSource === 'GLOBAL_CACHE') {
      return { success: true }
  }

  if (lead.validationSource !== 'VERIFIED') return { success: false, error: '邮箱未通过验证' }

  try {
    await withQuotaCheck(userId, async () => {
      // 1. 存入用户私有缓存池
      await prisma.leadsCache.upsert({
        where: { contactEmail: lead.contact.email },
        update: { userId, domain: lead.domain, companyName: lead.contact.name || lead.company.companyName, jobTitle: lead.contact.jobTitle, isValid: true },
        create: { userId, domain: lead.domain, companyName: lead.contact.name || lead.company.companyName, contactEmail: lead.contact.email, jobTitle: lead.contact.jobTitle, isValid: true },
      })
      
      // 🌟 2. 反哺全系统：只要是真实验证过的，静默存入全局公用缓存池
      await prisma.globalLeadCache.upsert({
          where: { contactEmail: lead.contact.email },
          update: { lastVerified: new Date() },
          create: {
              domain: lead.domain,
              contactEmail: lead.contact.email,
              companyName: lead.company.companyName,
              jobTitle: lead.contact.jobTitle,
              firstName: lead.contact.name?.split(' ')[0],
              lastName: lead.contact.name?.split(' ').slice(1).join(' '),
              source: 'AUTO_ENRICHMENT'
          }
      }).catch(e => console.log("[GlobalCache] 存入失败, 忽略")); // 缓存存入失败不影响主流程
    })
    return { success: true }
  } catch (error) {
    if (error instanceof Error && error.message.includes('不足')) return { success: false, error: '线索余额不足' }
    throw error
  }
}

// ─── 瀑布流主函数 ─────────────────────────────────────
export async function enrichLead(userId: string, domain: string): Promise<EnrichmentResult> {
  const stepsCompleted: number[] = []

  try {
    // 🌟 Step 0: 全局与本地双重缓存拦截
    const cachedLead = await checkCaches(domain, userId)
    if (cachedLead) {
      stepsCompleted.push(EnrichmentStep.CACHE_CHECK)
      // 如果中了全局缓存，不仅不需要扣 API 费用，而且连查代理信息的步骤都省了！
      return { success: true, lead: cachedLead, stepsCompleted, costIncurred: false }
    }

    const companyInfo = await scrapeCompanyInfo(domain, userId)
    if (!companyInfo) return { success: false, error: '无法获取公司信息', stepsCompleted: [EnrichmentStep.CACHE_CHECK, EnrichmentStep.COMPANY_SCRAPE], costIncurred: false }
    stepsCompleted.push(EnrichmentStep.COMPANY_SCRAPE)

    const contacts = await findContacts(domain, userId)
    if (contacts.length === 0) return { success: false, error: '未找到联系人', stepsCompleted: [...stepsCompleted, EnrichmentStep.CONTACT_FIND], costIncurred: false }
    stepsCompleted.push(EnrichmentStep.CONTACT_FIND)

    const priorityOrder: ContactInfo['seniority'][] = ['C-Level', 'VP', 'Director', 'Manager', 'IC']
    contacts.sort((a, b) => (priorityOrder.indexOf(a.seniority || 'IC')) - (priorityOrder.indexOf(b.seniority || 'IC')))

    for (const contact of contacts) {
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

      const settleResult = await settleLead(userId, enrichedLead)
      stepsCompleted.push(EnrichmentStep.SETTLEMENT)

      if (settleResult.success) return { success: true, lead: enrichedLead, stepsCompleted, costIncurred: true }
      else if (settleResult.error?.includes('余额不足')) return { success: false, error: settleResult.error, stepsCompleted, costIncurred: true }
    }
    return { success: false, error: '所有邮箱验证失败', stepsCompleted, costIncurred: false }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '未知错误', stepsCompleted, costIncurred: false }
  }
}

export async function enrichLeadsBatch(userId: string, domains: string[], onProgress?: (completed: number, total: number, lead: EnrichedLead) => void) {
  const results: EnrichmentResult[] = []
  let successful = 0, failed = 0
  for (let i = 0; i < domains.length; i++) {
    const result = await enrichLead(userId, domains[i])
    results.push(result)
    if (result.success && result.lead) { successful++; onProgress?.(i + 1, domains.length, result.lead) } 
    else { failed++ }
    if (i < domains.length - 1) await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * 3000) + 2000))
  }
  return { total: domains.length, successful, failed, results }
}