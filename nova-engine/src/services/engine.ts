import axios from 'axios';
import { runDataPipeline, EnrichedLead } from './DataEnrichmentService';

const log = (tag: string, msg: string) => console.log(`[${tag}] ${msg}`);

export async function runEngine(
  rawKeyword: string,
  campaignId: string,
  targetCount: number = 10,
  searchMode: 'FUZZY' | 'EXACT' = 'FUZZY',
  targetCompany?: string,
  fileData?: any[]
) {
  log('Engine', `🚀 [真·实战引擎] 启动 | 模式: ${searchMode} | 目标: ${rawKeyword || targetCompany || 'Excel上传'} | 数量: ${targetCount}`);

  try {
    let country = '';
    let industry = '';

    // 只有模糊模式才需要解析关键词
    if (searchMode === 'FUZZY' && rawKeyword) {
      const parts = rawKeyword.trim().split(/\s+/);
      const hasChinese = /[\u4e00-\u9fa5]/.test(rawKeyword);
      if (hasChinese) {
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
        industry = parts[parts.length - 1];
        country = parts.slice(0, -1).join(' ');
      }
    }

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

    // 🌟 传递 searchMode 等参数给数据管道
    const result = await runDataPipeline(
      { 
        country, 
        industry, 
        targetCount, 
        searchMode, 
        targetCompany, 
        fileData 
      },
      async (domain, fullName) => {
        return null;
      },
      webhookCallback
    );

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