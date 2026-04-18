import fs from 'fs';
import path from 'path';
import { 
  PLANS, QUOTA_ADDONS, DOMAIN_ADDONS, 
  TEMPLATE_ASSETS, PREMIUM_SERVICES 
} from '@/config/pricing';

const STORE_PATH = path.join(process.cwd(), 'pricing_store.json');

export function getDynamicPricing() {
  let data: any = {};
  
  if (fs.existsSync(STORE_PATH)) {
    try {
      data = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
      if (data.groups) return data; // 如果已经是新版结构，直接返回
    } catch (e) {
      console.error("读取定价文件失败");
    }
  }

  // 🚀 智能修复与文案提取补丁
  const injectAndHeal = (staticArr: any[]) => {
    return staticArr.map(item => {
      let finalDetail = item.modalDetail;
      if (!finalDetail || finalDetail === item.subtitle) {
        if (item.features) finalDetail = item.features.map((f:any) => `• ${f.label}：${f.value}`).join('\n');
        else finalDetail = item.shortDesc || item.subtitle || '';
      }
      return { ...item, status: 'active', modalDetail: finalDetail };
    });
  };

  // 🚀 核心大重构：拆分为完全独立的“动态分组 (Groups)”
  const initialStore = {
    groups: [
      { id: 'g_plan', name: '升级订阅方案', desc: '选择适合阶段的套餐，每月自动续期，随时可升级', icon: 'Crown', cardType: 'plan', items: injectAndHeal(PLANS) },
      { id: 'g_token', name: '算力补充', desc: 'AI 算力永久有效，不过期，可叠加', icon: 'Zap', cardType: 'quota', items: injectAndHeal(QUOTA_ADDONS.filter(a=>a.tokens)) },
      { id: 'g_email', name: '发信额度', desc: '额外发信配额，当月有效', icon: 'Mail', cardType: 'quota', items: injectAndHeal(QUOTA_ADDONS.filter(a=>a.emails)) },
      { id: 'g_lead', name: '线索额度', desc: '额外线索挖掘配额，当月有效', icon: 'Target', cardType: 'quota', items: injectAndHeal(QUOTA_ADDONS.filter(a=>a.leads)) },
      { id: 'g_domain', name: '域名扩展包', desc: '增加发信域名数量，提升并发能力，降低封号风险', icon: 'Globe', cardType: 'domain', items: injectAndHeal(DOMAIN_ADDONS) },
      { id: 'g_template', name: '永久资产与行业模板', desc: '专属行业话术 + AI 定制化策略包', icon: 'Package', cardType: 'template', items: injectAndHeal(TEMPLATE_ASSETS) },
      { id: 'g_premium', name: '高级特权与服务', desc: '面向成长型团队的高级增值服务', icon: 'Star', cardType: 'premium', items: injectAndHeal(PREMIUM_SERVICES) }
    ]
  };

  saveToDisk(initialStore);
  return initialStore;
}

// 🚀 暴力覆盖保存接口（让 CMS 自由控制一切）
export function updateFullStore(data: any) {
  saveToDisk(data);
  return true;
}

function saveToDisk(data: any) {
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error("写入文件失败", e);
  }
}