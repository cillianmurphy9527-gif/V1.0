import axios from 'axios';
import { CostService } from '@/lib/services/CostService';

let deepSeekFailCount = 0;
const MAX_FAILS = 3;
const RESET_TIME = 1000 * 60 * 5;

export class LLMService {

  static async generateEmail(systemPrompt: string, websiteData: any): Promise<string> {
    const deepseekKey = process.env.DEEPSEEK_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    const messages = [
      { role: 'system', content: systemPrompt || 'You are a professional B2B sales expert. Write highly customized cold emails.' },
      {
        role: 'user',
        content: `请根据以下客户真实数据，写一封简短有力的英文B2B开发信。必须在信中提到他们的公司名和职位。\n客户数据: ${JSON.stringify(websiteData)}`
      },
    ];

    try {
      if (!deepseekKey) throw new Error("缺少 DEEPSEEK_API_KEY");
      console.log(`🧠 [AI] 正在呼叫 DeepSeek 为 ${websiteData.companyName || '客户'} 写信...`);

      const response = await axios.post(
        'https://api.deepseek.com/chat/completions',
        { model: 'deepseek-chat', messages: messages, temperature: 0.7 },
        { headers: { 'Authorization': `Bearer ${deepseekKey}`, 'Content-Type': 'application/json' }, timeout: 15000 }
      );

      const emailContent = response.data.choices[0].message.content;
      console.log(`✅ [AI] DeepSeek 写信成功！`);
      return emailContent;

    } catch (dsError: any) {
      console.error(`⚠️ [AI] DeepSeek 引擎报错: ${dsError.response?.data?.error?.message || dsError.message}`);
      console.log(`🔄 [AI] 启动容灾机制，切换至 OpenAI 备用引擎...`);

      try {
        if (!openaiKey) throw new Error("缺少 OPENAI_API_KEY 备用通道");

        const openaiRes = await axios.post(
          'https://api.openai.com/v1/chat/completions',
          { model: 'gpt-4o-mini', messages: messages, temperature: 0.7 },
          { headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' }, timeout: 20000 }
        );

        console.log(`✅ [AI] OpenAI 备用引擎写信成功！`);

        try {
          CostService.logCost({
            provider: 'OPENAI', feature: 'LLM_GENERATION', userId: undefined,
            usageAmount: openaiRes.data.usage?.total_tokens || 0, usageUnit: 'TOKEN' as any
          }).catch(() => {});
        } catch (e) {}

        return openaiRes.data.choices[0].message.content;

      } catch (oaError: any) {
        console.error(`❌ [AI] 双引擎全部瘫痪: ${oaError.response?.data?.error?.message || oaError.message}`);
        throw new Error("AI 生成失败，停止投递");
      }
    }
  }

  static async answerWithContext(question: string, context: string): Promise<string> {
    const systemPrompt = `你是一个专业的智能业务助理。请严格根据以下[参考信息]回答。
如果信息中没有答案，请说"知识库中未找到相关内容"，不要编造。

[参考信息]：
${context}`;
    return await this.generateContent(question, systemPrompt);
  }

  static async generateContent(prompt: string, systemPrompt?: string, userId?: string): Promise<string> {
    if (deepSeekFailCount >= MAX_FAILS) {
      return await this.callOpenAI(prompt, systemPrompt, userId);
    }
    try {
      console.log("🧠 [AI] 呼叫 DeepSeek...");
      const result = await this.callDeepSeek(prompt, systemPrompt, userId);
      deepSeekFailCount = 0;
      return result;
    } catch (error: any) {
      deepSeekFailCount++;
      console.error(`❌ [AI] DeepSeek 异常: ${error.message}`);
      return await this.callOpenAI(prompt, systemPrompt, userId);
    }
  }

  private static async callDeepSeek(prompt: string, systemPrompt?: string, userId?: string): Promise<string> {
    const messages: any[] = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: prompt });
    const res = await axios.post('https://api.deepseek.com/v1/chat/completions', {
      model: 'deepseek-chat', messages: messages, temperature: 0.7
    }, { headers: { 'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}` }, timeout: 15000 });
    return res.data.choices[0].message.content;
  }

  private static async callOpenAI(prompt: string, systemPrompt?: string, userId?: string): Promise<string> {
    const messages: any[] = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: prompt });
    const res = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4o-mini', messages: messages, temperature: 0.7
    }, { headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` }, timeout: 20000 });
    try {
      CostService.logCost({
        provider: 'OPENAI', feature: 'LLM_GENERATION', userId: userId,
        usageAmount: res.data.usage?.total_tokens || 0, usageUnit: 'TOKEN' as any
      }).catch(() => {});
    } catch (e) {}
    return res.data.choices[0].message.content;
  }
}