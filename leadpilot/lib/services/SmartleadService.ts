import axios from 'axios';
import { notificationService } from '@/lib/notification.service';

export interface SmartleadLeadParams {
  email: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  website?: string;
  industry?: string;
  position?: string;
  country?: string;
  aiIcebreaker?: string; 
}

export class SmartleadService {
  private static get apiKey() {
    return process.env.SMARTLEAD_API_KEY || '';
  }

  private static get baseUrl() {
    return 'https://api.smartlead.ai/api/v1';
  }

  /**
   * 🌟 真实商用：全自动为用户创建专属发信任务 (Campaign)
   */
  static async createCampaign(campaignName: string, userId: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error("Missing SMARTLEAD_API_KEY in .env");
    }

    try {
      const url = `${this.baseUrl}/campaigns/create?api_key=${this.apiKey}`;
      const response = await axios.post(url, {
        name: `${campaignName} (UID: ${userId.slice(-6)})`, 
        status: 'DRAFT' 
      }, {
        headers: { 'Content-Type': 'application/json' }
      });

      console.log(`✅ [Smartlead] 自动建仓成功！真实任务 ID: ${response.data.id}`);
      return response.data.id;
    } catch (error: any) {
      console.error(`❌ [Smartlead] 创建 Campaign 失败:`, error.response?.data || error.message);
      throw error; 
    }
  }

  /**
   * 🌟 真实商用：向专属发射井推送线索（批量）
   */
  static async pushLeadsToCampaign(
    smartleadCampaignId: string | number, 
    leads: SmartleadLeadParams[],
    userId?: string
  ): Promise<any> {
    if (!this.apiKey) {
      throw new Error("Missing SMARTLEAD_API_KEY in .env");
    }

    if (!leads || leads.length === 0) return null;

    try {
      const url = `${this.baseUrl}/campaigns/${smartleadCampaignId}/leads?api_key=${this.apiKey}`;
      const payload = {
        leadList: leads.map(lead => ({
          email: lead.email,
          first_name: lead.firstName || '',
          last_name: lead.lastName || '',
          company_name: lead.companyName || '',
          website: lead.website || '',
          custom_fields: {
            "Industry": lead.industry || 'N/A',
            "Job Title": lead.position || 'N/A',
            "Country": lead.country || 'N/A',
            "AI_Icebreaker": lead.aiIcebreaker || '' 
          }
        }))
      };

      const response = await axios.post(url, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 20000 
      });

      console.log(`✅ [Smartlead] 成功推送 ${leads.length} 条真实线索进入 Campaign [${smartleadCampaignId}]`);
      return response.data;
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message;
      console.error(`❌ [Smartlead] 真实推送失败:`, errorMsg);
      await notificationService.sendUrgentAlert(`Smartlead 推送失败`, `推入 Campaign [${smartleadCampaignId}] 报错: ${errorMsg}`);
      throw new Error(`Smartlead Push Failed: ${errorMsg}`);
    }
  }

  /**
   * 🌟 真实商用：查询任务统计数据（为未来 Dashboard 看板预留接口）
   */
  static async getCampaignAnalytics(smartleadCampaignId: string | number) {
    if (!this.apiKey) {
      throw new Error("Missing SMARTLEAD_API_KEY in .env");
    }

    try {
      const url = `${this.baseUrl}/campaigns/${smartleadCampaignId}/analytics?api_key=${this.apiKey}`;
      const response = await axios.get(url);
      return response.data;
    } catch (error: any) {
      console.error(`❌ [Smartlead] 获取统计数据失败:`, error.response?.data || error.message);
      return null;
    }
  }
}