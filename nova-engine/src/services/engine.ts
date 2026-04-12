import { PrismaClient } from '@prisma/client';
import * as dns from 'dns';
import { Queue } from 'bullmq';
import axios from 'axios';

const prisma = new PrismaClient();

// 🚀 读取环境开关：是否开启真实扣费 API
const USE_REAL_API = process.env.NOVA_USE_REAL_API === 'true';

// 初始化连接到主系统的发信队列
const emailQueue = new Queue('email-delivery', {
  connection: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  }
});

// ══════════════════════════════════════════════════════════════
//  模拟数据库 (当 USE_REAL_API=false 时使用)
// ══════════════════════════════════════════════════════════════

interface MockLead {
  companyName: string;
  domain: string;
  website: string;
  linkedin: string;
  linkedinFollowers: number;
  person: { firstName: string; lastName: string; title: string };
}

const MOCK_LEADS: MockLead[] = [
  { companyName: 'SpaceX', domain: 'spacex.com', website: 'https://www.spacex.com', linkedin: 'https://linkedin.com/company/spacex', linkedinFollowers: 12000000, person: { firstName: 'Elon', lastName: 'Musk', title: 'CEO' } },
  { companyName: 'Tesla', domain: 'tesla.com', website: 'https://www.tesla.com', linkedin: 'https://linkedin.com/company/tesla-motors', linkedinFollowers: 10000000, person: { firstName: 'Elon', lastName: 'Musk', title: 'CEO' } },
  { companyName: 'OpenAI', domain: 'openai.com', website: 'https://www.openai.com', linkedin: 'https://linkedin.com/company/openai', linkedinFollowers: 5000000, person: { firstName: 'Sam', lastName: 'Altman', title: 'CEO' } }
];

const DISPOSABLE_DOMAINS = ['tempmail.com', 'guerrillamail.com', 'mailinator.com', '10minutemail.com'];

// ══════════════════════════════════════════════════════════════
//  工具函数
// ══════════════════════════════════════════════════════════════

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

function log(level: 'info' | 'warn' | 'error' | 'ok', tag: string, msg: string) {
  const icons = { info: '🔍', warn: '⚠️', error: '❌', ok: '✅' };
  console.log(`[${icons[level]}] [${tag}] ${msg}`);
}

// ══════════════════════════════════════════════════════════════
//  Step 1 — Discovery：双路搜客引擎
// ══════════════════════════════════════════════════════════════

interface DiscoveryResult {
  companyName: string; domain: string; website: string; linkedin: string; linkedinFollowers: number; isMock: boolean;
}

async function fetchCompanyData(keyword: string): Promise<DiscoveryResult[]> {
  if (!USE_REAL_API) {
    log('info', 'Step1', `[Mock] 模拟搜索关键词「${keyword}」`);
    await sleep(300);
    return MOCK_LEADS.map(l => ({ ...l, isMock: true }));
  }

  log('warn', 'Step1', `🔥 [实弹] 正在调用真实 Proxycurl API 搜索: ${keyword}`);
  const apiKey = process.env.PROXYCURL_API_KEY;
  if (!apiKey || apiKey === 'your_proxycurl_key_here') {
    log('error', 'Step1', `❌ 缺少 PROXYCURL_API_KEY！`);
    return [];
  }

  try {
    // 预留的真实 Proxycurl 公司搜索接口逻辑
    // const res = await axios.get(`https://nubela.co/proxycurl/api/linkedin/company/resolve...`, { headers: { Authorization: `Bearer ${apiKey}` } });
    log('warn', 'Step1', `⚠️ 已触达真实接口层，请在上线前补全 Proxycurl 具体 Endpoint`);
    return []; 
  } catch (err: any) {
    log('error', 'Step1', `❌ Proxycurl 请求失败: ${err.message}`);
    return [];
  }
}

// ══════════════════════════════════════════════════════════════
//  Step 2 — Enrichment：双路找邮引擎 (Hunter)
// ══════════════════════════════════════════════════════════════

interface EnrichResult { email: string | null; contactName: string; sourceApi: string; isMock: boolean; }

async function fetchHunterEmail(domain: string): Promise<EnrichResult | null> {
  if (!USE_REAL_API) {
    log('info', 'Step2', `[Mock] 模拟 Hunter 查询: ${domain}`);
    await sleep(300);
    const lead = MOCK_LEADS.find((l) => l.domain === domain);
    if (lead && Math.random() < 0.8) {
      return { email: `${lead.person.firstName.toLowerCase()}@${domain}`, contactName: `${lead.person.firstName} ${lead.person.lastName}`, sourceApi: 'Hunter', isMock: true };
    }
    return null;
  }

  log('warn', 'Step2', `🔥 [实弹] 正在调用真实 Hunter API: ${domain}`);
  const apiKey = process.env.HUNTER_API_KEY;
  if (!apiKey || apiKey === 'your_hunter_key_here') {
    log('error', 'Step2', `❌ 缺少 HUNTER_API_KEY！`);
    return null;
  }

  try {
    const response = await axios.get(`https://api.hunter.io/v2/domain-search`, {
      params: { domain: domain, limit: 1, type: 'personal', api_key: apiKey }
    });

    const emails = response.data?.data?.emails;
    if (emails && emails.length > 0) {
      const topEmail = emails[0];
      log('ok', 'Step2', `🎯 真实 Hunter 命中: ${topEmail.value}`);
      return {
        email: topEmail.value,
        contactName: `${topEmail.first_name || ''} ${topEmail.last_name || ''}`.trim() || 'There',
        sourceApi: 'Hunter',
        isMock: false,
      };
    }
    log('warn', 'Step2', `⚠️ 真实 Hunter 未找到该域名的邮箱`);
    return null;
  } catch (error: any) {
    log('error', 'Step2', `❌ 真实 Hunter API 报错: ${error.message}`);
    return null;
  }
}

async function step2_Enrichment(domain: string): Promise<EnrichResult | null> {
  log('info', 'Step2', `📧 Enrichment 开始: ${domain}`);
  const hunterResult = await fetchHunterEmail(domain);
  if (hunterResult?.email) return hunterResult;
  
  log('error', 'Step2', `❌ Enrichment API 均失败: ${domain}`);
  return null;
}

// ══════════════════════════════════════════════════════════════
//  Step 3 — SMTP Verification：真实过滤协议 (不花钱)
// ══════════════════════════════════════════════════════════════

type VerifyStatus = 'VALID' | 'INVALID' | 'UNKNOWN';

async function smtpVerify(email: string): Promise<VerifyStatus> {
  log('info', 'Step3', `🔬 SMTP DNS/格式验证中: ${email}`);
  const parts = email.split('@');
  if (parts.length !== 2) return 'INVALID';
  const [local, domain] = parts;
  if (DISPOSABLE_DOMAINS.some((d) => domain.toLowerCase().endsWith(d))) return 'INVALID';
  if (/^(noreply|no-reply|info|admin|test)/i.test(local)) return 'UNKNOWN';

  try {
    const mxRecords = await new Promise<dns.MxRecord[]>((resolve, reject) => {
      dns.resolveMx(domain, (err, addr) => { err ? reject(err) : resolve(addr ?? []); });
    });
    if (!mxRecords || mxRecords.length === 0) return 'INVALID';
    log('ok', 'Step3', `✅ MX 记录验证通过 → VALID`);
    return 'VALID';
  } catch {
    return 'UNKNOWN';
  }
}

// ══════════════════════════════════════════════════════════════
//  Step 4 & 5 — 入库与触发真实队列
// ══════════════════════════════════════════════════════════════

async function saveAndTriggerQueue(params: any): Promise<{ saved: boolean; queued: boolean }> {
  log('info', 'Step4', `💾 准备写入数据库: ${params.companyName}`);
  try {
    const testUser = await prisma.user.findFirst();
    if (!testUser) return { saved: false, queued: false };

    const record = await prisma.userLead.upsert({
      where: { userId_email: { userId: testUser.id, email: params.email } },
      update: { source: params.sourceApi, isUnlocked: true },
      create: { 
        userId: testUser.id, companyName: params.companyName, website: params.website, 
        email: params.email, contactName: params.contactName, linkedIn: params.linkedin, 
        source: params.sourceApi, isUnlocked: true 
      },
    });

    log('ok', 'Step4', `✅ 入库成功 (READY_FOR_OUTREACH)`);

    // 触发队列
    log('info', 'Step5', `📬 激活发信通道: 推入队列`);
    const activeDomain = await prisma.domain.findFirst({ where: { userId: testUser.id, status: 'ACTIVE' } });
    const usedDomain = activeDomain?.domainName || 'leadpilot.io';
    
    await emailQueue.add('cold-email-job', {
      userId: testUser.id,
      to: params.email,
      subject: `Quick question regarding ${params.companyName}`,
      body: `Hi,\n\nI noticed ${params.companyName} is growing rapidly...\n\nAlex`,
      html: `<p>Hi,</p><p>I noticed <b>${params.companyName}</b> is growing rapidly...</p><p>Alex</p>`,
      fromEmail: `alex@${usedDomain}`,
      fromDomain: usedDomain,
      domainIndex: 0
    });
    
    log('ok', 'Step5', `✅ 邮件已成功推入 BullMQ! 等待 Worker 发送。`);
    return { saved: true, queued: true };
  } catch (err: any) {
    if (err?.code !== 'P2002') log('error', 'Step4', `❌ 写入失败: ${err.message}`);
    return { saved: false, queued: false };
  }
}

// ══════════════════════════════════════════════════════════════
//  流水线执行总控
// ══════════════════════════════════════════════════════════════

export async function processLead(params: any) {
  console.log(`\n[Engine] ═════ 处理: ${params.companyName} ═════`);
  const enrich = await step2_Enrichment(params.domain);
  if (!enrich?.email) return { saved: false, queued: false };

  const verifyStatus = await smtpVerify(enrich.email);
  if (verifyStatus === 'INVALID') {
    log('warn', 'Engine', `⛔ 验证失败，丢弃（保护计费余额）`);
    return { saved: false, queued: false };
  }

  return await saveAndTriggerQueue({ ...params, email: enrich.email, contactName: enrich.contactName, sourceApi: enrich.sourceApi });
}

export async function runEngine(keyword: string) {
  log('info', 'Engine', `NOVA 清洗与发信衔接引擎启动 | 模式: ${USE_REAL_API ? '🔥实弹扣费' : '🛡️本地Mock'}`);
  const targets = await fetchCompanyData(keyword);
  for (const target of targets) { await processLead(target); }
  log('ok', 'Engine', `管道执行完毕。`);
  return [];
}