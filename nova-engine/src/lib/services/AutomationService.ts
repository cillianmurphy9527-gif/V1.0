import axios from 'axios';

// 🔴 调试模式：请确保这里的 IP 和你在百度查到的一致
const CONFIG = {
  NAMECHEAP: {
    API_USER: process.env.NAMECHEAP_API_USER || 'jiaofuquan',
    API_KEY: process.env.NAMECHEAP_API_KEY || 'f43b3c4cff4244e2acb8df2898be76f5',
    CLIENT_IP: process.env.SERVER_IP || '103.172.81.132', 
    ADMIN_EMAIL: 'verify@your-system.com',
  },
  CPANEL: {
    HOST: 'premium355.web-hosting.com',
    USER: 'leadtdgc',
    PASS: 'oWfmyKBa31oY',
  },
  SUCCESS_AI: {
    API_KEY: '8a750a5c9c36fbc2ce44ca55d7bd',
    BASE_URL: 'https://api.success.ai/v1'
  }
};

export class AutomationService {
  /**
   * 1. 买地 + 修路 (Namecheap) - 已增加原始日志抓取
   */
  static async purchaseDomain(domainName: string) {
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
      AddFreeWhoisguard: 'yes'
    });
    
    console.log(`📡 正在向 Namecheap 发起请求: ${domainName}...`);
    const res = await axios.post(`https://api.namecheap.com/xml.response?${params.toString()}`);

    // ==========================================
    // 🔍 调试核心：捕获原始报错原件
    // ==========================================
    if (res.data.includes('Error')) {
      console.log('\n--- 🛑 Namecheap API 原始报错详情开始 ---');
      console.log(res.data); // 这里的 XML 会详细告诉你错误代码 (ErrorNumber)
      console.log('--- 🛑 Namecheap API 原始报错详情结束 ---\n');
      
      // 提取关键错误代码（粗略提取供提示用）
      const errorMsg = res.data.split('<Error ')[1]?.split('>')[0] || '未知错误';
      throw new Error(`Namecheap 报错信息: ${errorMsg}`);
    }

    console.log(`✅ 域名 ${domainName} 购买指令已成功送达！`);
    return true;
  }

  /**
   * 2. 盖楼 (cPanel 开号)
   */
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
      return true;
    } catch (e) {
      console.warn("⚠️ cPanel配置警告，继续执行...");
      return false;
    }
  }

  /**
   * 3. 健身 (Success.ai 预热)
   */
  static async startWarmup(domain: string, user: string, pass: string) {
    const headers = { 'Authorization': `Bearer ${CONFIG.SUCCESS_AI.API_KEY}` };
    const res = await axios.post(`${CONFIG.SUCCESS_AI.BASE_URL}/accounts`, {
      email: `${user}@${domain}`,
      password: pass,
      smtp_host: `mail.${domain}`, smtp_port: 465, smtp_encryption: 'ssl',
      imap_host: `mail.${domain}`, imap_port: 993, imap_encryption: 'ssl',
      first_name: 'Sales', last_name: 'Agent'
    }, { headers });

    const accountId = res.data.id;
    await axios.post(`${CONFIG.SUCCESS_AI.BASE_URL}/accounts/${accountId}/warmup/enable`, {}, { headers });
    return accountId;
  }

  /**
   * 4. 打仗 (Success.ai 发起活动)
   */
  static async executeCampaign(accountId: string, leads: any[], subject: string, body: string) {
    const headers = { 'Authorization': `Bearer ${CONFIG.SUCCESS_AI.API_KEY}` };
    const campaign = await axios.post(`${CONFIG.SUCCESS_AI.BASE_URL}/campaigns`, {
      name: `Auto_Campaign_${Date.now()}`,
      account_ids: [accountId],
      sequences: [{ subject, body }]
    }, { headers });

    await axios.post(`${CONFIG.SUCCESS_AI.BASE_URL}/campaigns/${campaign.data.id}/leads`, {
      leads: leads.map(l => ({ email: l.email, first_name: l.name }))
    }, { headers });

    await axios.post(`${CONFIG.SUCCESS_AI.BASE_URL}/campaigns/${campaign.data.id}/activate`, {}, { headers });
    return campaign.data.id;
  }
}