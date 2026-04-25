import axios from 'axios';
// 💰 尝试引入成本计价器 (使用安全引入，防止崩溃)
import * as CostModule from '@/lib/services/CostService';

let deepSeekFailCount = 0;
const MAX_FAILS = 3;
const RESET_TIME = 1000 * 60 * 5;

export class LLMService {
  
  static async answerWithContext(question: string, context: string): Promise<string> {
    const systemPrompt = `你是一个专业的智能业务助理。请严格根据以下[参考信息]回答。
如果信息中没有答案，请说“知识库中未找到相关内容”，不要编造。

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
      model: 'deepseek-chat',
      messages: messages,
      temperature: 0.7
    }, {
      headers: { 'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}` },
      timeout: 15000
    });
    return res.data.choices[0].message.content;
  }

  private static async callOpenAI(prompt: string, systemPrompt?: string, userId?: string): Promise<string> {
    const messages: any[] = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: prompt });

    const res = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4o-mini',
      messages: messages,
      temperature: 0.7
    }, {
      headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
      timeout: 20000 
    });

    // 💰 安全记账：即使 CostService 不存在也不会崩溃
    try {
      const CostService = (CostModule as any).CostService || (CostModule as any).default;
      if (CostService && CostService.logCost && res.data?.usage) {
        CostService.logCost({
          provider: 'OPENAI', feature: 'LLM_GENERATION', userId: userId,            
          usageAmount: res.data.usage.total_tokens, usageUnit: 'TOKEN'
        }).catch(() => {});
      }
    } catch (e) {}

    return res.data.choices[0].message.content;
  }
}