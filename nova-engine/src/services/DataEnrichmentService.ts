/**
 * DataEnrichmentService - 工业级 SPOP 数据漏斗
 * 流程：Apollo(模糊) / 精确匹配 -> Hunter(并发推算) -> ZeroBounce(并发验证)
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
  searchMode?: 'FUZZY' | 'EXACT';
  targetCompany?: string;
  fileData?: any[];
}

// ─── 1. Apollo 模糊搜索 ────────────────────────────────
export async function fetchFromApollo(params: DiscoveryParams, retryCount = 0): Promise<ApolloPerson[]> {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) {
    log('Apollo', '❌ 缺少 APOLLO_API_KEY');
    return [];
  }

  const { country, industry, titles, targetCount } = params;
  log('Apollo', `🔍 开始寻源，目标: ${targetCount} 条`);

  try {
    const requestBody: any = {
      api_key: apiKey,
      page: 1,
      per_page: Math.min(targetCount * 3, 100),
    };
    if (industry) requestBody.q_keywords = industry;
    if (country) requestBody.person_locations = [country];
    if (titles && titles.length > 0) requestBody.person_titles = titles;

    const response = await axios.post(
      'https://api.apollo.io/v1/mixed_people/search',
      requestBody,
      {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache', 'X-Api-Key': apiKey },
        timeout: 20000,
      }
    );

    const people = response.data?.people || [];
    if (people.length === 0) return [];

    const validPeople = people.filter((p: any) => {
      const domain = p.organization?.primary_domain;
      return domain && domain.includes('.');
    });

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
      log('Apollo', '⚠️ 触发限流，等待 10 秒后重试...');
      await new Promise(resolve => setTimeout(resolve, 10000));
      return fetchFromApollo(params, retryCount + 1);
    }
    log('Apollo', `❌ API 失败: ${e.message}`);
    return [];
  }
}

// ─── 2. 精确目标格式化（跳过 Apollo） ──────────────────
export async function formatExactTargets(params: DiscoveryParams): Promise<ApolloPerson[]> {
  log('ExactSearch', `🎯 执行精确匹配模式，目标公司：${params.targetCompany || 'Excel批量'}`);

  if (params.targetCompany) {
    let domain = params.targetCompany.toLowerCase().replace(/\s+/g, '') + '.com';
    return [{
      first_name: '',
      last_name: '',
      organization_name: params.targetCompany,
      organization_domain: domain,
      title: 'Decision Maker',
      city: '',
      country: '',
    }];
  }
  return [];
}

// ─── 3. Hunter 邮箱挖掘 ────────────────────────────────
export async function enrichWithHunter(
  domain: string,
  fullName: string,
  retryCount = 0
): Promise<{ email: string; confidence: number; firstName: string; lastName: string; position: string } | null> {
  const apiKey = process.env.HUNTER_API_KEY;
  if (!apiKey) return null;

  try {
    const nameParts = fullName.trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    // 精确搜索模式下没有名字，使用域名泛搜
    if (!firstName && !lastName) {
      const response = await axios.get('https://api.hunter.io/v2/domain-search', {
        params: { domain, limit: 1, api_key: apiKey },
        timeout: 15000,
      });
      const emails = response.data?.data?.emails;
      if (!emails || emails.length === 0) return null;
      const target = emails[0];
      return {
        email: target.value,
        confidence: target.confidence || 0,
        firstName: target.first_name || '',
        lastName: target.last_name || '',
        position: target.position || 'Contact'
      };
    }

    // 模糊搜索使用 email-finder
    const response = await axios.get('https://api.hunter.io/v2/email-finder', {
      params: { domain, first_name: firstName, last_name: lastName, api_key: apiKey },
      timeout: 15000,
    });

    const data = response.data?.data;
    if (!data?.email) return null;

    return {
      email: data.email,
      confidence: data.score || 0,
      firstName: firstName,
      lastName: lastName,
      position: 'Decision Maker'
    };
  } catch (e: any) {
    if (e.response?.status === 429 && retryCount < 1) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      return enrichWithHunter(domain, fullName, retryCount + 1);
    }
    return null;
  }
}

// ─── 4. ZeroBounce 验证 ────────────────────────────────
export async function verifyWithZeroBounce(email: string): Promise<{ valid: boolean; status: string; catch_all: boolean }> {
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

// ─── 5. 主管道（分轨精确/模糊） ─────────────────────────
export async function runDataPipeline(
  params: DiscoveryParams,
  checkLocalCacheCallback: (domain: string, fullName: string) => Promise<EnrichedLead | null>,
  webhookCallback: (lead: EnrichedLead) => Promise<void>
): Promise<{ total: number; verified: number; failed: number }> {
  const { targetCount, searchMode } = params;
  let total = 0, verified = 0, failed = 0;

  // 🌟 根据模式选择数据源
  const sourceResults = searchMode === 'EXACT'
    ? await formatExactTargets(params)
    : await fetchFromApollo(params);

  if (sourceResults.length === 0) return { total: 0, verified: 0, failed: 0 };

  const CONCURRENCY_LIMIT = 3;

  for (let i = 0; i < sourceResults.length; i += CONCURRENCY_LIMIT) {
    if (verified >= targetCount) break;

    const chunk = sourceResults.slice(i, i + CONCURRENCY_LIMIT);

    await Promise.all(chunk.map(async (person) => {
      await new Promise(res => setTimeout(res, Math.floor(Math.random() * 500) + 200));

      if (verified >= targetCount) return;

      total++;
      const fullName = `${person.first_name} ${person.last_name}`.trim();
      const domain = person.organization_domain;
      if (!domain) { failed++; return; }

      try {
        const cachedLead = await checkLocalCacheCallback(domain, fullName);
        if (cachedLead) {
          log('Cache', `♻️ [命中缓存] ${cachedLead.email}`);
          await webhookCallback(cachedLead);
          verified++;
          return;
        }
      } catch (e) {}

      const hunterResult = await enrichWithHunter(domain, fullName);
      if (!hunterResult) { failed++; return; }

      if (verified >= targetCount) return;

      const zbResult = await verifyWithZeroBounce(hunterResult.email);
      if (!zbResult.valid || zbResult.catch_all) {
        log('Pipeline', `🚫 [风控拦截] ${hunterResult.email}`);
        failed++;
        return;
      }

      const enrichedLead: EnrichedLead = {
        email: hunterResult.email,
        firstName: hunterResult.firstName || person.first_name,
        lastName: hunterResult.lastName || person.last_name,
        contactName: (hunterResult.firstName || hunterResult.lastName) ? `${hunterResult.firstName} ${hunterResult.lastName}`.trim() : fullName,
        companyName: person.organization_name,
        website: `https://${domain}`,
        position: hunterResult.position || person.title,
        jobTitle: hunterResult.position || person.title,
        country: person.country || params.country || '',
        industry: params.industry || '',
        domain: domain,
        status: 'VERIFIED',
      };

      try {
        await webhookCallback(enrichedLead);
        verified++;
        log('Pipeline', `🚀 [极速出口] ${hunterResult.email} 验证通过！(${verified}/${targetCount})`);
      } catch (e) { failed++; }
    }));
  }

  log('Pipeline', `🏁 引擎结束 | 总量: ${total} | 达标: ${verified} | 拦截: ${failed}`);
  return { total, verified, failed };
}

export async function validateSingleEmail(email: string): Promise<boolean> {
  const result = await verifyWithZeroBounce(email);
  return result.valid && !result.catch_all;
}