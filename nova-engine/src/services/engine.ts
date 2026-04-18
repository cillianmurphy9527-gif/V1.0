import * as dns from 'dns';
import axios from 'axios';
import Redis from 'ioredis';

// 🚀 读取环境开关：是否开启真实扣费 API
const USE_REAL_API = process.env.NOVA_USE_REAL_API === 'true';

const redisClient = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
});

async function acquireNovaLock(key: string, ttl: number = 30) {
  try {
    const res = await redisClient.setnx(key, 'LOCKED');
    if (res === 1) { await redisClient.expire(key, ttl); return true; }
    return false;
  } catch { return true; }
}
async function releaseNovaLock(key: string) { try { await redisClient.del(key); } catch {} }

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
function log(level: 'info' | 'warn' | 'error' | 'ok', tag: string, msg: string) {
  const icons = { info: '🔍', warn: '⚠️', error: '❌', ok: '✅' };
  console.log(`[${icons[level]}] [${tag}] ${msg}`);
}

const MOCK_LEADS = [
  { companyName: 'SpaceX', domain: 'spacex.com', website: 'https://www.spacex.com', linkedin: 'https://linkedin.com/company/spacex', person: { firstName: 'Elon', lastName: 'Musk', title: 'CEO' } },
  { companyName: 'Tesla', domain: 'tesla.com', website: 'https://www.tesla.com', linkedin: 'https://linkedin.com/company/tesla-motors', person: { firstName: 'Elon', lastName: 'Musk', title: 'CEO' } }
];

// ══════════════════════════════════════════════════════════════
//  🛡️ 装甲 1：统一下载器 (自动挂载代理 IP + 10秒熔断)
// ══════════════════════════════════════════════════════════════
async function safeFetch(url: string, options: any = {}) {
  if (!USE_REAL_API) return axios(url, options); // Mock模式不走代理

  const proxyHost = process.env.SMARTPROXY_HOST;
  const proxyPort = parseInt(process.env.SMARTPROXY_PORT || '10000');
  const proxyUser = process.env.SMARTPROXY_USER;
  const proxyPass = process.env.SMARTPROXY_PASS;

  const axiosConfig: any = {
    url,
    ...options,
    timeout: 10000, // 🚨 10秒极速熔断，防止卡死整个队列
  };

  // 穿上隐身衣
  if (proxyHost && proxyUser && proxyPass) {
    axiosConfig.proxy = {
      protocol: 'http',
      host: proxyHost,
      port: proxyPort,
      auth: { username: proxyUser, password: proxyPass }
    };
  }
  return axios(axiosConfig);
}

// ══════════════════════════════════════════════════════════════
//  Step 1 — 搜客引擎 (并发锁 + 代理请求占位)
// ══════════════════════════════════════════════════════════════
async function fetchCompanyData(keyword: string): Promise<any[]> {
  const lockKey = `nova:lock:search:${keyword}`;
  const cacheKey = `nova:cache:search:${keyword}`;

  const cachedData = await redisClient.get(cacheKey);
  if (cachedData) {
    log('ok', 'Step1', `[缓存命中] 从内存极速白嫖数据: ${keyword}`);
    return JSON.parse(cachedData);
  }

  const gotLock = await acquireNovaLock(lockKey, 30);
  if (gotLock) {
    try {
      if (!USE_REAL_API) {
        log('info', 'Step1', `🟢 [抢锁成功] 挖掘先锋出发: ${keyword}`);
        await sleep(3000); 
        const data = MOCK_LEADS.map(l => ({ ...l, isMock: true }));
        await redisClient.set(cacheKey, JSON.stringify(data), 'EX', 86400);
        return data;
      }
      
      log('warn', 'Step1', `🔥 [实弹] 正在通过代理网络调用真实搜客 API...`);
      // 💡 下周填入 Key 后，解除这里的注释即可实弹起飞！
      /*
      const res = await safeFetch(`https://nubela.co/proxycurl/api/linkedin/company/search?keywords=${keyword}`, {
        headers: { 'Authorization': `Bearer ${process.env.PROXYCURL_API_KEY}` }
      });
      // await redisClient.set(cacheKey, JSON.stringify(res.data), 'EX', 86400);
      // return res.data;
      */
      return []; 
    } finally {
      await releaseNovaLock(lockKey); 
    }
  } else {
    log('warn', 'Step1', `🟡 [触发并发锁] 同行猛攻 ${keyword}！本车挂机等待...`);
    for (let i = 0; i < 15; i++) {
      await sleep(1000); 
      const freshCache = await redisClient.get(cacheKey);
      if (freshCache) return JSON.parse(freshCache);
    }
    return [];
  }
}

// ══════════════════════════════════════════════════════════════
//  Step 2 — 找邮引擎 (带超时熔断)
// ══════════════════════════════════════════════════════════════
async function step2_Enrichment(domain: string): Promise<any | null> {
  log('info', 'Step2', `📧 挖掘联系人: ${domain}`);
  if (!USE_REAL_API) {
    await sleep(300);
    const lead = MOCK_LEADS.find((l) => l.domain === domain);
    if (lead) return { email: `${lead.person.firstName.toLowerCase()}@${domain}`, contactName: `${lead.person.firstName} ${lead.person.lastName}` };
    return null;
  }
  // 💡 真实 Hunter API 占位
  /*
  const res = await safeFetch(`https://api.hunter.io/v2/domain-search?domain=${domain}&api_key=${process.env.HUNTER_API_KEY}`);
  if (res.data?.data?.emails?.length > 0) return { email: res.data.data.emails[0].value };
  */
  return null;
}

// ══════════════════════════════════════════════════════════════
//  🛡️ 装甲 2：ZeroBounce 真金白银洗信
// ══════════════════════════════════════════════════════════════
async function smtpVerify(email: string): Promise<string> {
  log('info', 'Step3', `🔬 ZeroBounce 洗信雷达扫描中: ${email}`);
  
  if (!USE_REAL_API) return 'VALID'; // Mock直接放行

  const zbKey = process.env.ZEROBOUNCE_API_KEY;
  if (!zbKey) {
    log('warn', 'Step3', '⚠️ 未配置 ZeroBounce Key，跳过洗信 (极度危险)');
    return 'VALID'; 
  }

  try {
    const res = await axios.get(`https://api.zerobounce.net/v2/validate?api_key=${zbKey}&email=${email}&ip_address=`);
    const status = res.data.status; 
    
    if (status === 'valid') {
        log('ok', 'Step3', `✅ 邮箱绝对安全 (Valid)`);
        return 'VALID';
    } else if (status === 'catch-all') {
        log('warn', 'Step3', `⚠️ 模糊邮箱 (Catch-all)，予以放行`);
        return 'VALID';
    } else {
        log('error', 'Step3', `❌ 剧毒邮箱，已拦截！(状态: ${status})`);
        return 'INVALID';
    }
  } catch (err: any) {
     log('error', 'Step3', `❌ 洗信接口异常: ${err.message}`);
     return 'UNKNOWN';
  }
}

// ══════════════════════════════════════════════════════════════
//  Step 4 — 跨国加密对讲机
// ══════════════════════════════════════════════════════════════
async function saveAndTriggerQueue(params: any) {
  log('info', 'Step4', `📡 发送加密战报: ${params.companyName}`);
  try {
    const mainStationUrl = process.env.MAIN_STATION_URL || 'http://localhost:3000';
    await axios.post(`${mainStationUrl}/api/nova/webhook`, { event: 'LEAD_PROCESSED', data: params }, {
      headers: { 'Authorization': `Bearer ${process.env.NOVA_SECRET_KEY}` },
      timeout: 10000 
    });
    log('ok', 'Step4', `✅ 战报已加密发送！(主站已接管发信任务)`);
    return true;
  } catch (err: any) {
    log('error', 'Step4', `❌ 战报发送失败: ${err.message}`);
    return false;
  }
}

export async function processLead(params: any) {
  console.log(`\n[Engine] ═════ 处理: ${params.companyName} ═════`);
  const enrich = await step2_Enrichment(params.domain);
  if (!enrich?.email) return false;

  const verifyStatus = await smtpVerify(enrich.email);
  if (verifyStatus === 'INVALID') {
    log('warn', 'Engine', `⛔ 邮箱有毒，果断丢弃（保护发信域名）`);
    return false;
  }
  return await saveAndTriggerQueue({ ...params, email: enrich.email, contactName: enrich.contactName });
}

export async function runEngine(keyword: string) {
  log('info', 'Engine', `NOVA 引擎启动 | 模式: ${USE_REAL_API ? '🔥实弹扣费' : '🛡️本地Mock'}`);
  const targets = await fetchCompanyData(keyword);
  for (const target of targets) { await processLead(target); }
  log('ok', 'Engine', `管道执行完毕。`);
  return [];
}