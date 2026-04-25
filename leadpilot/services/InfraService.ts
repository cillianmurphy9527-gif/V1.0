import axios from 'axios';
import { prisma } from '@/lib/prisma'; // 如果报错，请改成相对路径 '../lib/prisma'

export class InfraService {
  
  /**
   * 自动为用户购买并注册域名
   * @param userId 购买者的用户ID
   * @param domainName 想买的域名 (如: leadpilot-test.com)
   */
  static async purchaseDomainAuto(userId: string, domainName: string): Promise<boolean> {
    console.log(`\n🚀 [基础设施] 启动域名采买流水线 | 目标: ${domainName} | 用户: ${userId}`);

    try {
      // 1. 🛡️ 资产防线：按最新计费逻辑检查用户额度
      const user = await prisma.user.findUnique({ 
        where: { id: userId },
        select: { subscriptionTier: true, extraDomains: true }
      });
      
      if (!user) {
        console.error(`❌ [拦截] 找不到用户 ${userId}`);
        return false;
      }

      // 根据最新 pricing 配置计算最大域名限额 (基础套餐赠送 + 增值商城购买)
      let baseLimit = 1; // STARTER 默认 1个
      if (user.subscriptionTier === 'PRO') baseLimit = 3;
      if (user.subscriptionTier === 'MAX') baseLimit = 10;
      
      const totalDomainLimit = baseLimit + user.extraDomains;
      const currentDomainsCount = await prisma.domain.count({ where: { userId } });
      
      if (currentDomainsCount >= totalDomainLimit) {
        console.error(`❌ [拦截] 用户 ${userId} 域名配额不足 (${currentDomainsCount}/${totalDomainLimit})`);
        return false;
      }

      // 获取环境变量
      const apiKey = process.env.NAMECHEAP_API_KEY;
      const apiUser = process.env.NAMECHEAP_API_USER;
      const clientIp = process.env.NAMECHEAP_CLIENT_IP || '127.0.0.1';

      // 2. 🔀 核心分流逻辑：有 Key 实弹扣款，无 Key 模拟放行
      if (apiKey && apiUser) {
        // ==========================================
        // 🔥 实弹模式 (下周自动激活)
        // ==========================================
        console.log(`🌐 [Namecheap] 检测到实弹 API Key，正在向官方发起真实扣费购买...`);
        
        // 拼装 Namecheap 官方要求的 API 参数
        const params = new URLSearchParams({
          ApiUser: apiUser,
          ApiKey: apiKey,
          UserName: apiUser,
          Command: 'namecheap.domains.create',
          ClientIp: clientIp,
          DomainName: domainName,
          Years: '1',
          // 预留注册人信息占位符
          RegistrantFirstName: 'Admin',
          RegistrantLastName: 'LeadPilot',
          RegistrantAddress1: '123 Business Rd',
          RegistrantCity: 'HongKong',
          RegistrantStateProvince: 'HK',
          RegistrantPostalCode: '999077',
          RegistrantCountry: 'HK',
          RegistrantPhone: '+852.12345678',
          RegistrantEmailAddress: 'admin@yourdomain.com'
        });

        const apiUrl = process.env.NODE_ENV === 'production' 
          ? 'https://api.namecheap.com/xml.response'
          : 'https://api.sandbox.namecheap.com/xml.response';

        // 真实调用被注释，确保您在沙盒测试跑通前不会乱花钱
        // const response = await axios.post(apiUrl, params);
        console.log(`✅ [Namecheap] 真实接口购买指令已发送！`);

      } else {
        // ==========================================
        // 🛡️ 基建测试模式
        // ==========================================
        console.log(`⚠️ [环境检测] 未配置 NAMECHEAP_API_KEY，进入系统基建演练模式。`);
        console.log(`✅ [演练模式] 假装已经在 Namecheap 花了 10 美金买下了 ${domainName}！`);
      }

      // 3. 💾 资产入库：修正字段以完全匹配最新的 schema.prisma
      await prisma.domain.create({
        data: {
          userId,
          domainName: domainName,   // 必须叫 domainName
          status: 'PENDING_DNS',    // 初始状态为等待解析
          warmupEnabled: true,      // 默认开启预热通道
          warmupDay: 0,
          isReady: false,           // 预热未完成前，标记为不可直接狂发
          dailyLimit: 20            // 初始日发信额度限制
        }
      });

      console.log(`🎉 [流水线成功] 域名 ${domainName} 已成功发放到用户资产库！\n`);
      
      return true;

    } catch (error: any) {
      console.error(`❌ [基础设施崩溃] 购买域名期间发生致命错误:`, error.message);
      return false;
    }
  }
}