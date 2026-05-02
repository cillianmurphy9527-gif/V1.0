import { prisma } from '@/lib/prisma'

// 💰 核心单价配置池 (全网最全，完全根据您的《采购清单》折算)
const UNIT_COSTS = {
  // === 🧠 AI 算力成本 ===
  OPENAI_INPUT_1K: 0.035,      // OpenAI 极速版输入约 0.035元/千Token
  OPENAI_OUTPUT_1K: 0.105,     // OpenAI 极速版输出约 0.105元/千Token
  DEEPSEEK_INPUT_1K: 0.001,    // DeepSeek API 极低 (约1元/百万Token)
  DEEPSEEK_OUTPUT_1K: 0.002,   // DeepSeek API 极低

  // === 🕵️ 数据挖掘与清洗成本 ===
  APOLLO_SEARCH: 0.02,         // 补充：Apollo.io 模糊搜索调用成本 (约合 $0.003/次)
  PROXYCURL_PROFILE: 0.07,     // Proxycurl (单次领英企业/高管抓取约 $0.01)
  HUNTER_SEARCH: 0.14,         // Hunter.io (找邮箱约 $0.02)
  SNOV_SEARCH: 0.20,           // Snov.io (备用线路找邮箱)
  PROSPEO_SEARCH: 0.27,        // Prospeo (硬解高管邮箱约 $0.039)
  ZEROBOUNCE_CHECK: 0.03,      // ZeroBounce/UseBouncer (清洗邮箱，降低退信率防封)

  // === ✉️ 触达与基建自动采买成本 ===
  NAMECHEAP_DOMAIN: 70.0,      // Namecheap 自动采购一个普通后缀域名的均价
  RESEND_EMAIL: 0.007,         // Resend 免费额度超标后单封系统邮件成本
  ALIYUN_SMS: 0.045,           // 阿里云国内发一条验证码短信
}

interface LogApiCostParams {
  provider: 'OPENAI' | 'DEEPSEEK' | 'PROXYCURL' | 'APOLLO' | 'HUNTER' | 'SNOV' | 'PROSPEO' | 'ZEROBOUNCE' | 'NAMECHEAP' | 'RESEND' | 'ALIYUN_SMS' | 'OTHER';
  feature: string;
  userId?: string;  // 强烈建议传入！能算出哪个客户给公司赚了多少钱 (LTV)
  usageAmount: number;
  usageUnit: 'TOKEN_INPUT' | 'TOKEN_OUTPUT' | 'CALL' | 'EMAIL' | 'SMS' | 'DOMAIN';
}

export class CostService {
  /**
   * 记录系统真实发生成本 (权责发生制)
   */
  static async logCost(params: LogApiCostParams) {
    let costCny = 0;

    // 根据不用服务商，自动换算真实人民币消耗
    switch (params.provider) {
      case 'OPENAI':
        costCny = (params.usageAmount / 1000) * (params.usageUnit === 'TOKEN_INPUT' ? UNIT_COSTS.OPENAI_INPUT_1K : UNIT_COSTS.OPENAI_OUTPUT_1K);
        break;
      case 'DEEPSEEK':
        costCny = (params.usageAmount / 1000) * (params.usageUnit === 'TOKEN_INPUT' ? UNIT_COSTS.DEEPSEEK_INPUT_1K : UNIT_COSTS.DEEPSEEK_OUTPUT_1K);
        break;
      case 'APOLLO':
        costCny = params.usageAmount * UNIT_COSTS.APOLLO_SEARCH;
        break;
      case 'PROXYCURL':
        costCny = params.usageAmount * UNIT_COSTS.PROXYCURL_PROFILE;
        break;
      case 'HUNTER':
        costCny = params.usageAmount * UNIT_COSTS.HUNTER_SEARCH;
        break;
      case 'SNOV':
        costCny = params.usageAmount * UNIT_COSTS.SNOV_SEARCH;
        break;
      case 'PROSPEO':
        costCny = params.usageAmount * UNIT_COSTS.PROSPEO_SEARCH;
        break;
      case 'ZEROBOUNCE':
        costCny = params.usageAmount * UNIT_COSTS.ZEROBOUNCE_CHECK;
        break;
      case 'NAMECHEAP':
        costCny = params.usageAmount * UNIT_COSTS.NAMECHEAP_DOMAIN;
        break;
      case 'RESEND':
        costCny = params.usageAmount * UNIT_COSTS.RESEND_EMAIL;
        break;
      case 'ALIYUN_SMS':
        costCny = params.usageAmount * UNIT_COSTS.ALIYUN_SMS;
        break;
    }

    // 只要发生了真金白银的消耗，就异步静默写入，绝不卡顿主业务
    if (costCny > 0) {
      try {
        await prisma.systemCostLog.create({
          data: {
            provider: params.provider,
            feature: params.feature,
            userId: params.userId,
            usageAmount: params.usageAmount,
            usageUnit: params.usageUnit,
            costCny: Number(costCny.toFixed(6)),
          }
        });
      } catch (error) {
        console.error('⚠️ [计费探头] 写入失败:', error);
      }
    }
  }
}