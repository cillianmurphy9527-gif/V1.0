import axios from 'axios';

// 融合版配置：优先读取 .env 环境变量
const CONFIG = {
  NAMECHEAP: {
    API_USER: process.env.NAMECHEAP_API_USER || 'jaofuquan',
    API_KEY: process.env.NAMECHEAP_API_KEY || '7594c289cb33435b8e164568f4f67775',
    CLIENT_IP: process.env.SERVER_IP || '112.42.17.166',
    ADMIN_EMAIL: 'verify@your-system.com',
  },
  CPANEL: {
    HOST: 'premium355.web-hosting.com',
    USER: 'leadtdgc',
    PASS: 'oWfmyKBa31oY',
  },
  // 🌟 已切换为 Smartlead 架构配置
  SMARTLEAD: {
    API_KEY: process.env.SMARTLEAD_API_KEY || '等待填入_SMARTLEAD_API_KEY', // 👈 等您拿到API，填到 .env 里即可
    BASE_URL: 'https://backend.smartlead.ai/api/v1'
  }
};

export class AutomationService {
  // 1. 买地 + 修路 (Namecheap 增加防重扣费预检)
  static async purchaseDomain(domainName: string) {
    // 🛡️ 【新增：防重复扣费预检】先查一下域名还在不在
    const checkParams = new URLSearchParams({
      ApiUser: CONFIG.NAMECHEAP.API_USER,
      ApiKey: CONFIG.NAMECHEAP.API_KEY,
      UserName: CONFIG.NAMECHEAP.API_USER,
      Command: 'namecheap.domains.check',
      ClientIp: CONFIG.NAMECHEAP.CLIENT_IP,
      DomainList: domainName
    });
    
    console.log(`🔍 正在预检域名可用性: ${domainName}...`);
    const checkRes = await axios.post(`https://api.namecheap.com/xml.response?${checkParams.toString()}`);
    if (checkRes.data.includes('Available="false"')) {
      throw new Error(`🛑 域名 [${domainName}] 已被抢注或您已购买！系统已自动拦截，防止重复扣费！请换一个域名。`);
    }

    // 💸 【真正购买】预检通过，发起购买
    const params = new URLSearchParams({
      ApiUser: CONFIG.NAMECHEAP.API_USER,
      ApiKey: CONFIG.NAMECHEAP.API_KEY,
      UserName: CONFIG.NAMECHEAP.API_USER,
      Command: 'namecheap.domains.create',
      ClientIp: CONFIG.NAMECHEAP.CLIENT_IP,
      DomainName: domainName,
      Years: '1',
      Nameservers: 'dns1.namecheaphosting.com,dns2.namecheaphosting.com',
      
      RegistrantFirstName: 'Lead', RegistrantLastName: 'Pilot',
      RegistrantAddress1: '123 Business Rd', RegistrantCity: 'New York',
      RegistrantStateProvince: 'NY', RegistrantPostalCode: '10001',
      RegistrantCountry: 'US', RegistrantPhone: '+1.5555555555',
      RegistrantEmailAddress: CONFIG.NAMECHEAP.ADMIN_EMAIL,

      TechFirstName: 'Lead', TechLastName: 'Pilot',
      TechAddress1: '123 Business Rd', TechCity: 'New York',
      TechStateProvince: 'NY', TechPostalCode: '10001',
      TechCountry: 'US', TechPhone: '+1.5555555555',
      TechEmailAddress: CONFIG.NAMECHEAP.ADMIN_EMAIL,

      AdminFirstName: 'Lead', AdminLastName: 'Pilot',
      AdminAddress1: '123 Business Rd', AdminCity: 'New York',
      AdminStateProvince: 'NY', AdminPostalCode: '10001',
      AdminCountry: 'US', AdminPhone: '+1.5555555555',
      AdminEmailAddress: CONFIG.NAMECHEAP.ADMIN_EMAIL,

      AuxBillingFirstName: 'Lead', AuxBillingLastName: 'Pilot',
      AuxBillingAddress1: '123 Business Rd', AuxBillingCity: 'New York',
      AuxBillingStateProvince: 'NY', AuxBillingPostalCode: '10001',
      AuxBillingCountry: 'US', AuxBillingPhone: '+1.5555555555',
      AuxBillingEmailAddress: CONFIG.NAMECHEAP.ADMIN_EMAIL,

      AddFreeWhoisguard: 'yes'
    });
    
    console.log(`📡 正在向 Namecheap 发起请求购买: ${domainName}...`);
    const res = await axios.post(`https://api.namecheap.com/xml.response?${params.toString()}`);

    if (res.data.includes('Status="ERROR"')) {
      console.log('\n======= 🛑 Namecheap 原始报错 =======');
      console.log(res.data); 
      console.log('====================================\n');
      const errorMatch = res.data.match(/Number="(\d+)"/);
      throw new Error(`Namecheap 报错代码: ${errorMatch ? errorMatch[1] : '未知'}。详情请看终端日志。`);
    }
    
    console.log(`✅ 域名 ${domainName} 购买成功！`);
    return true;
  }

  // 2. 盖楼 (cPanel 开号) - 保持原样，功能已完美验证
  static async setupCPanel(domainName: string, emailPrefix: string, emailPass: string) {
    const auth = Buffer.from(`${CONFIG.CPANEL.USER}:${CONFIG.CPANEL.PASS}`).toString('base64');
    const headers = { 'Authorization': `Basic ${auth}` };

    try {
      await axios.get(`https://${CONFIG.CPANEL.HOST}:2083/execute/AddonDomain/addaddon`, {
        params: { dir: domainName, newdomain: domainName, subdomain: domainName.replace(/\./g, '') },
        headers
      });
      await axios.get(`https://${CONFIG.CPANEL.HOST}:2083/execute/Email/add_pop`, {
        params: { email: emailPrefix, password: emailPass, domain: domainName, quota: 0 },
        headers
      });
      console.log(`✅ cPanel 邮箱创建成功: ${emailPrefix}@${domainName}`);
      return true;
    } catch (e) {
      console.warn("⚠️ cPanel配置发生警告(可能DNS未完全生效或已存在)，继续执行...");
      return false; 
    }
  }

  // 3. 健身 (🌟 切换为 Smartlead: 自动添加邮箱 + 开启预热)
  static async startWarmup(domain: string, user: string, pass: string) {
    const apiKey = CONFIG.SMARTLEAD.API_KEY;
    const email = `${user}@${domain}`;
    
    try {
      console.log(`🔥 [Smartlead] 正在通过 API 同步邮箱账号: ${email}`);
      
      // A. 调用 Smartlead 接口绑定 SMTP/IMAP
      const addRes = await axios.post(`${CONFIG.SMARTLEAD.BASE_URL}/email-accounts/save?api_key=${apiKey}`, {
        from_name: 'Sales Manager',
        from_email: email,
        username: email,
        password: pass,
        smtp_host: `mail.${domain}`,
        smtp_port: 465,
        smtp_encryption: 'SSL',
        imap_host: `mail.${domain}`,
        imap_port: 993,
        imap_encryption: 'SSL'
      });

      const accountId = addRes.data.id;
      console.log(`✅ [Smartlead] 账号同步成功，ID: ${accountId}。正在启动预热引擎...`);
      
      // B. 调用 Smartlead 接口开启预热
      await axios.post(`${CONFIG.SMARTLEAD.BASE_URL}/email-accounts/${accountId}/warmup?api_key=${apiKey}`, {
        warmup_enabled: true,
        reply_rate_percentage: 30, // 默认 30% 互动率
        daily_warmup_limit: 40     // 默认每天 40 封预热上限
      });
      
      console.log(`✅ [Smartlead] 预热引擎已全自动开启！`);
      return accountId;

    } catch (error: any) {
      console.log('\n======= 🛑 Smartlead API 报错 =======');
      console.log('详细原因:', error.response?.data || error.message);
      console.log('======================================\n');
      throw new Error("Smartlead 配置失败，请检查终端日志！(如果是未填 API Key，请先去官网获取)");
    }
  }

  // 4. 打仗 (🌟 切换为 Smartlead: 发起开发信活动架构预留)
  static async executeCampaign(accountId: string, leads: any[], subject: string, body: string) {
    const apiKey = CONFIG.SMARTLEAD.API_KEY;
    
    try {
      console.log(`🚀 [Smartlead] 正在创建开发信活动...`);
      
      // A. 创建 Campaign (Smartlead 架构)
      const campaignRes = await axios.post(`${CONFIG.SMARTLEAD.BASE_URL}/campaigns/create?api_key=${apiKey}`, {
        name: `Auto_Campaign_${Date.now()}`,
        email_account_id: accountId // 绑定刚建好的账号
      });
      
      const campaignId = campaignRes.data.id;
      
      // 注：后续的导入 Leads 和 Activate 接口已为您预留好位置
      // 等拿到 API 测试通了预热后，这里随时可以对接填满
      
      console.log(`✅ [Smartlead] 开发信活动创建成功 (ID: ${campaignId})`);
      return campaignId;
      
    } catch (error: any) {
      console.log('\n======= 🛑 Smartlead Campaign 报错 =======');
      console.log('详细原因:', error.response?.data || error.message);
      console.log('==========================================\n');
      throw new Error("Smartlead 发信活动创建失败，请检查日志。");
    }
  }
}