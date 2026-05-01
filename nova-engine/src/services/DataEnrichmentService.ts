/**
 * DataEnrichmentService - 工业级 SPOP 数据漏斗 (100分高并发终极版)
 * 流程：Apollo(精准筛选) -> 本地查重(极速过滤) -> Hunter(并发推算) -> ZeroBounce(并发验证)
 */

import axios from 'axios';

const log = (tag: string, msg: string) => console.log(`[${tag}] ${msg}`);

interface ApolloPerson {
  first_name: string;
  last_name: string;
  organization_name: string;
  organization_domain: string;
  title: string;
  city: string;
  country: string;
}

export interface EnrichedLead {
  email: string;
  firstName: string;
  lastName: string;
  contactName: string;
  companyName: string;
  website: string;
  position: string;
  jobTitle: string;
  country: string;
  industry: string;
  domain: string;
  status: 'PENDING' | 'VERIFIED' | 'INVALID';
}

interface DiscoveryParams {
  country?: string;
  industry?: string;
  titles?: string[];
  targetCount: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Apollo 适配器 (Top of Funnel - 已严格对齐官方规范)
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchFromApollo(params: DiscoveryParams, retryCount = 0): Promise<ApolloPerson[]> {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) {
    log('Apollo', '❌ 缺少 APOLLO_API_KEY 环境变量');
    return [];
  }

  const { country, industry, titles, targetCount } = params;
  log('Apollo', `🔍 开始寻源，目标: ${targetCount} 条 | 行业: ${industry || '不限'} | 职位: ${titles?.join(', ') || '不限'}`);

  try {
    const requestBody: any = {
      api_key: apiKey,
      page: 1,
      // 为应对淘汰率，Apollo 初次拉取数量可适当放大，保证漏斗底部能满足 targetCount
      per_page: Math.min(targetCount * 3, 100), 
    };

    if (industry) requestBody.q_keywords = industry;
    if (country) requestBody.person_locations = [country];
    if (titles && titles.length > 0) requestBody.person_titles = titles; 

    const response = await axios.post(
      'https://api.apollo.io/v1/mixed_people/search', 
      requestBody,
      {
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'X-Api-Key': apiKey 
        },
        timeout: 20000,
      }
    );

    const people = response.data?.people || [];
    if (people.length === 0) return [];

    const validPeople = people.filter((p: any) => {
      const domain = p.organization?.primary_domain;
      return domain && domain.includes('.');
    });

    log('Apollo', `✅ [Apollo] 提取到 ${validPeople.length} 条带域名的初筛数据`);

    return validPeople.map((p: any) => ({
      first_name: p.first_name || '',
      last_name: p.last_name || '',
      organization_name: p.organization?.name || '',
      organization_domain: p.organization?.primary_domain || '',
      title: p.title || 'Decision Maker',
      city: p.city || '',
      country: p.country || country || '',
    }));
  } catch (e: any) {
    if (e.response?.status === 429 && retryCount < 1) {
      log('Apollo', '⚠️ [Apollo] 触发限流，等待 10 秒后重试...');
      await new Promise(resolve => setTimeout(resolve, 10000));
      return fetchFromApollo(params, retryCount + 1);
    }
    log('Apollo', `❌ [Apollo] API 失败: ${e.response?.data?.error || e.message}`);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Hunter 适配器 (Enrichment)
// ─────────────────────────────────────────────────────────────────────────────
export async function enrichWithHunter(
  domain: string,
  fullName: string,
  retryCount = 0
): Promise<{ email: string; confidence: number } | null> {
  const apiKey = process.env.HUNTER_API_KEY;
  if (!apiKey) return null;

  try {
    const nameParts = fullName.trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    const response = await axios.get('https://api.hunter.io/v2/email-finder', {
      params: { domain, first_name: firstName, last_name: lastName, api_key: apiKey },
      timeout: 15000,
    });

    const data = response.data?.data;
    if (!data?.email) return null;

    return { email: data.email, confidence: data.score || 0 };
  } catch (e: any) {
    if (e.response?.status === 429 && retryCount < 1) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      return enrichWithHunter(domain, fullName, retryCount + 1);
    }
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. ZeroBounce 适配器 (Validation)
// ─────────────────────────────────────────────────────────────────────────────
export async function verifyWithZeroBounce(email: string): Promise<{
  valid: boolean;
  status: string;
  catch_all: boolean;
}> {
  const apiKey = process.env.ZEROBOUNCE_API_KEY;
  if (!apiKey) return { valid: true, status: 'unknown', catch_all: false };

  try {
    const response = await axios.get('https://api.zerobounce.net/v2/validate', {
      params: { api_key: apiKey, email: email, ip_address: '' },
      timeout: 15000, 
    });

    const result = response.data;
    if (result.error) return { valid: false, status: 'error', catch_all: false };

    const isValid = result.status === 'valid';
    const isCatchAll = result.status === 'catch-all' || result.sub_status === 'catch-all';

    return { valid: isValid, status: result.status || 'unknown', catch_all: isCatchAll };
  } catch (e: any) {
    return { valid: false, status: 'error', catch_all: false };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. 主管道 - 动态分块并发引擎 (Chunked Concurrency)
// ─────────────────────────────────────────────────────────────────────────────
export async function runDataPipeline(
  params: DiscoveryParams,
  checkLocalCacheCallback: (domain: string, fullName: string) => Promise<EnrichedLead | null>, 
  webhookCallback: (lead: EnrichedLead) => Promise<void>
): Promise<{ total: number; verified: number; failed: number }> {
  const { targetCount } = params;
  let total = 0, verified = 0, failed = 0;

  const apolloResults = await fetchFromApollo(params);
  if (apolloResults.length === 0) return { total: 0, verified: 0, failed: 0 };

  // 🚀 核心优化：并发控制常量（每次同时拉起 3 个任务，速度提升 3 倍）
  const CONCURRENCY_LIMIT = 3; 

  // 将百条数据切分成 3条一组 的并行任务块
  for (let i = 0; i < apolloResults.length; i += CONCURRENCY_LIMIT) {
    if (verified >= targetCount) break; // 主循环刹车：名额已满，停止后续批次

    const chunk = apolloResults.slice(i, i + CONCURRENCY_LIMIT);
    
    // 🔥 并行执行当前块的所有任务
    await Promise.all(chunk.map(async (person) => {
      // 🚨 并发防漏财机制 1：进入并发前，检查名额
      if (verified >= targetCount) return; 
      
      total++;
      const fullName = `${person.first_name} ${person.last_name}`.trim();
      const domain = person.organization_domain;
      if (!domain || !fullName) { failed++; return; }

      // 防线 1：极速查库
      try {
        const cachedLead = await checkLocalCacheCallback(domain, fullName);
        if (cachedLead) {
          log('Cache', `♻️ [命中缓存] ${cachedLead.email} (跳过计费API)`);
          await webhookCallback(cachedLead);
          verified++; 
          return;
        }
      } catch (e) { /* 继续 */ }

      // 防线 2：并发 Hunter
      const hunterResult = await enrichWithHunter(domain, fullName);
      if (!hunterResult) { failed++; return; }

      // 🚨 并发防漏财机制 2：在调用最贵的 ZeroBounce 前，再次检查名额是否被同批次其他线程抢占！
      if (verified >= targetCount) return; 

      // 防线 3：并发 ZeroBounce
      const zbResult = await verifyWithZeroBounce(hunterResult.email);
      if (!zbResult.valid || zbResult.catch_all) {
        log('Pipeline', `🚫 [风控拦截] ${hunterResult.email}`);
        failed++; return;
      }

      // 组装并推送
      const enrichedLead: EnrichedLead = {
        email: hunterResult.email,
        firstName: person.first_name,
        lastName: person.last_name,
        contactName: fullName,
        companyName: person.organization_name,
        website: `https://${domain}`,
        position: person.title,
        jobTitle: person.title,
        country: person.country || params.country || '',
        industry: params.industry || '',
        domain: domain,
        status: 'VERIFIED',
      };

      try {
        await webhookCallback(enrichedLead);
        verified++; // 计数累加
        log('Pipeline', `🚀 [极速出口] ${hunterResult.email} 验证通过！(${verified}/${targetCount})`);
      } catch (e) { failed++; }
    }));
  }

  log('Pipeline', `🏁 并发引擎结束 | 浏览总量: ${total} | 达标输出: ${verified} | 风控拦截: ${failed}`);
  return { total, verified, failed };
}

export async function validateSingleEmail(email: string): Promise<boolean> {
  const result = await verifyWithZeroBounce(email);
  return result.valid && !result.catch_all;
}