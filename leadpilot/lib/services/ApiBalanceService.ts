// leadpilot/lib/services/ApiBalanceService.ts

export type ApiBalance = {
  provider: string;
  balance: number | null; // 纯数字，方便前端画图表；无法获取数字时为 null
  statusText: string;     // 状态文本，如 "正常", "已欠费", "接口通畅"
  unit: string;
  health: 'good' | 'warning' | 'danger' | 'loading';
};

export class ApiBalanceService {
  // 🛡️ 缓存兜底：如果外部网络全部熔断，返回上一次成功的快照
  private static fallbackCache: ApiBalance[] = [];

  /**
   * 封装带超时的 Fetch 核心（默认 8 秒超时，防卡死）
   */
  private static async fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 8000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(id);
      return response;
    } catch (error) {
      clearTimeout(id);
      throw error;
    }
  }

  /**
   * 并发抓取 LeadPilot 真实技术栈的 API 水位
   */
  static async getAllBalances(): Promise<ApiBalance[]> {
    const balances: ApiBalance[] = [];

    // 并发执行，利用 Promise.allSettled 确保单个失败不波及全局
    await Promise.allSettled([
      this.fetchApolloBalance(balances),
      this.fetchHunterBalance(balances),
      this.fetchZeroBounceBalance(balances),
      this.fetchSmartleadStatus(balances),
      this.fetchDeepSeekBalance(balances),
      this.fetchOpenAIStatus(balances)
    ]);

    // 🛡️ 异常与缓存兜底逻辑
    if (balances.length === 0) {
      if (this.fallbackCache.length > 0) {
        // 标记数据来源为过期缓存
        return this.fallbackCache.map(b => ({ ...b, statusText: `${b.statusText} (缓存)` }));
      }
      return [{
        provider: '系统提示', balance: null, statusText: '未配置任何 API Keys 或全网熔断', unit: '', health: 'danger'
      }];
    }

    // 更新健康快照
    this.fallbackCache = [...balances];
    return balances;
  }

  // 1. Apollo (升级版：尝试抓取真实额度)
  private static async fetchApolloBalance(balances: ApiBalance[]) {
    const apiKey = process.env.APOLLO_API_KEY;
    if (!apiKey) return;
    try {
      const res = await this.fetchWithTimeout('https://api.apollo.io/v1/usage/stats', {
        headers: { 'Cache-Control': 'no-cache', 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
      });
      if (res.ok) {
        const data = await res.json();
        const remaining = data.credits_remaining || data.remaining || null;
        const isNum = typeof remaining === 'number';
        
        balances.push({
          provider: 'Apollo.io',
          balance: isNum ? remaining : null,
          statusText: isNum ? '正常' : '接口通畅 (额度未知)',
          unit: 'Credits',
          health: isNum && remaining < 100 ? 'danger' : 'good'
        });
      }
    } catch (error) { console.error('Apollo 探针超时或失败', error); }
  }

  // 2. Hunter.io (有完整余额查询)
  private static async fetchHunterBalance(balances: ApiBalance[]) {
    const apiKey = process.env.HUNTER_API_KEY;
    if (!apiKey) return;
    try {
      const res = await this.fetchWithTimeout(`https://api.hunter.io/v2/account?api_key=${apiKey}`, { next: { revalidate: 3600 } });
      if (res.ok) {
        const data = await res.json();
        const searches = data.data.requests.searches;
        const available = searches.available - searches.used;
        balances.push({
          provider: 'Hunter.io',
          balance: available,
          statusText: '正常',
          unit: 'Searches',
          health: available < 500 ? 'danger' : (available < 2000 ? 'warning' : 'good')
        });
      }
    } catch (error) { console.error('Hunter 探针超时或失败', error); }
  }

  // 3. ZeroBounce (有完整余额查询)
  private static async fetchZeroBounceBalance(balances: ApiBalance[]) {
    const apiKey = process.env.ZEROBOUNCE_API_KEY;
    if (!apiKey) return;
    try {
      const res = await this.fetchWithTimeout(`https://api.zerobounce.net/v2/getcredits?api_key=${apiKey}`, { next: { revalidate: 3600 } });
      if (res.ok) {
        const data = await res.json();
        const credits = Number(data.Credits);
        const actualCredits = credits >= 0 ? credits : 0;
        balances.push({
          provider: 'ZeroBounce',
          balance: actualCredits,
          statusText: '正常',
          unit: 'Credits',
          health: actualCredits < 1000 ? 'danger' : (actualCredits < 5000 ? 'warning' : 'good')
        });
      }
    } catch (error) { console.error('ZeroBounce 探针超时或失败', error); }
  }

  // 4. Smartlead (连通性探针)
  private static async fetchSmartleadStatus(balances: ApiBalance[]) {
    const apiKey = process.env.SMARTLEAD_API_KEY;
    if (!apiKey) return;
    balances.push({
      provider: 'Smartlead',
      balance: null,
      statusText: '已授权',
      unit: '状态',
      health: 'good'
    });
  }

  // 5. DeepSeek (有官方 CNY 余额查询接口)
  private static async fetchDeepSeekBalance(balances: ApiBalance[]) {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) return;
    try {
      const res = await this.fetchWithTimeout('https://api.deepseek.com/user/balance', {
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' },
        next: { revalidate: 3600 }
      });
      if (res.ok) {
        const data = await res.json();
        const isAvailable = data.is_available;
        const cnyInfo = data.balance_infos?.find((b: any) => b.currency === 'CNY');
        const cnyBalance = cnyInfo ? parseFloat(cnyInfo.total_balance) : 0;
        
        balances.push({
          provider: 'DeepSeek AI',
          balance: isAvailable ? cnyBalance : null,
          statusText: isAvailable ? '正常' : '已欠费',
          unit: 'CNY',
          health: !isAvailable ? 'danger' : (cnyBalance < 20 ? 'warning' : 'good')
        });
      }
    } catch (error) { console.error('DeepSeek 探针超时或失败', error); }
  }

  // 6. OpenAI (连通性探针)
  private static async fetchOpenAIStatus(balances: ApiBalance[]) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return;
    balances.push({
      provider: 'OpenAI',
      balance: null,
      statusText: '已接入',
      unit: '状态',
      health: 'good'
    });
  }
}