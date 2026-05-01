import axios from 'axios';
import { runDataPipeline, EnrichedLead } from './DataEnrichmentService';

const log = (tag: string, msg: string) => console.log(`[${tag}] ${msg}`);

// 1. 引擎主进程 - 支持 targetCount 参数
export async function runEngine(
  rawKeyword: string,
  campaignId: string,
  targetCount: number = 10
) {
  log('Engine', `🚀 [真·实战引擎] 启动 | 关键词: ${rawKeyword} | 目标数量: ${targetCount}`);

  try {
    // 解析关键词：支持 "法国 机械" 或 "France Manufacturing" 格式
    const parts = rawKeyword.trim().split(/\s+/);
    let country = '';
    let industry = '';

    // 简单启发式判断：中文字符视为中文指令
    const hasChinese = /[\u4e00-\u9fa5]/.test(rawKeyword);
    if (hasChinese) {
      // 中文格式：国家在前，行业在后
      // 例如 "法国 机械" -> country: France, industry: Manufacturing
      const countryMap: Record<string, string> = {
        '法国': 'France', '德国': 'Germany', '美国': 'United States', '英国': 'United Kingdom',
        '日本': 'Japan', '中国': 'China', '意大利': 'Italy', '西班牙': 'Spain',
        '加拿大': 'Canada', '澳大利亚': 'Australia', '巴西': 'Brazil', '印度': 'India',
      };
      const industryMap: Record<string, string> = {
        '机械': 'Manufacturing', '汽车': 'Automotive', '科技': 'Technology', '金融': 'Finance',
        '医疗': 'Healthcare', '能源': 'Energy', '化工': 'Chemical', '食品': 'Food & Beverage',
      };
      country = countryMap[parts[0]] || parts[0];
      industry = industryMap[parts[1]] || parts.slice(1).join(' ');
    } else {
      // 英文格式
      industry = parts[parts.length - 1];
      country = parts.slice(0, -1).join(' ');
    }

    // Webhook 回调函数
    const webhookCallback = async (lead: EnrichedLead) => {
      await axios.post(
        'http://localhost:3000/api/nova/webhook',
        {
          event: 'LEAD_SYNC',
          campaignId,
          lead: {
            email: lead.email,
            companyName: lead.companyName || '',
            contactName: lead.contactName || '',
            firstName: lead.firstName || '',
            lastName: lead.lastName || '',
            position: lead.jobTitle || '',
            country: lead.country || '',
            industry: lead.industry || '',
            website: lead.website || '',
          },
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.NOVA_SECRET_KEY || 'leadpilot_dev_secret_123'}`,
          },
        }
      );
      log('Engine', `🎯 线索已回传 Webhook: ${lead.email}`);
    };

    // 启动数据漏斗管道
    const result = await runDataPipeline(
      { country, industry, targetCount },
      // 🌟 新增：这是为了给你省钱加的本地缓存查询拦截器
      async (domain, fullName) => {
        // TODO: 这里后续可以发个请求去主站查数据库有没有这条线索
        // 目前先默认返回 null（表示没查到，继续走后续的收费 API）
        return null;
      },
      webhookCallback
    );

    // 发送任务完成信号，唤醒 Worker
    await axios.post(
      'http://localhost:3000/api/nova/webhook',
      { event: 'TASK_COMPLETED', campaignId, total: result.verified },
      {
        headers: {
          'Authorization': `Bearer ${process.env.NOVA_SECRET_KEY || 'leadpilot_dev_secret_123'}`,
        },
      }
    );

    log('Engine', `🎉 任务圆满结束 | 验证通过: ${result.verified}/${result.total} | 丢弃: ${result.failed}`);
  } catch (error: any) {
    log('Engine', `🚨 致命异常: ${error.message}`);
  }
}
