import axios from 'axios';
import { notificationService } from '@/lib/notification.service';

// 仅保留您已有的两个模型引擎
type LLMEngine = 'DEEPSEEK' | 'OPENAI';

export class LLMService {
  /**
   * 核心生成方法：带自动容灾 (Failover) 机制
   * 逻辑：DeepSeek (主) -> OpenAI (备)
   */
  static async generateContent(prompt: string, systemPrompt?: string): Promise<string> {
    const engines: LLMEngine[] = ['DEEPSEEK', 'OPENAI'];
    let lastError: any = null;

    for (const engine of engines) {
      try {
        const apiKey = this.getApiKey(engine);
        // 如果环境变量里没配这个 Key，直接跳过看下一个
        if (!apiKey) continue; 

        console.log(`[LLMService] 🤖 尝试使用引擎: ${engine}...`);
        
        // 执行真实请求
        const result = await this.callEngine(engine, prompt, systemPrompt, apiKey);
        
        if (result) {
          // 如果主引擎 DeepSeek 失败，成功切到了 OpenAI，给老板发报警
          if (engine === 'OPENAI') {
            await notificationService.sendUrgentAlert(
              `AI 引擎已自动切换至备用`,
              `主引擎 DeepSeek 响应失败，已自动切换至 OpenAI 完成当前任务。请检查 DeepSeek 状态或余额。`
            );
          }
          return result;
        }
      } catch (error: any) {
        lastError = error;
        console.error(`[LLMService] ❌ 引擎 ${engine} 报错:`, error.message);
        // 继续循环，尝试下一个
      }
    }

    // 如果两个都失败了
    const finalError = lastError?.message || 'DeepSeek 和 OpenAI 均不可用';
    await notificationService.sendUrgentAlert('🚨 AI 核心全线瘫痪', `尝试了所有配置的 AI 引擎均失败。错误详情: ${finalError}`);
    throw new Error(`AI 服务暂时不可用: ${finalError}`);
  }

  /**
   * 兼容写信逻辑入口
   */
  static async generateEmail(systemPrompt: string, websiteData: any): Promise<string> {
    const userPrompt = `请根据以下客户真实数据，写一封简短有力的英文B2B开发信。必须在信中提到他们的公司名和职位。\n客户数据: ${JSON.stringify(websiteData)}`;
    return this.generateContent(userPrompt, systemPrompt);
  }

  /**
   * 厂商 API 请求适配器
   */
  private static async callEngine(engine: LLMEngine, prompt: string, systemPrompt: string | undefined, apiKey: string): Promise<string> {
    let url = '';
    let model = '';
    
    if (engine === 'DEEPSEEK') {
      url = 'https://api.deepseek.com/chat/completions';
      model = 'deepseek-chat';
    } else {
      url = 'https://api.openai.com/v1/chat/completions';
      model = 'gpt-4o-mini';
    }

    const response = await axios.post(
      url,
      {
        model,
        messages: [
          { role: 'system', content: systemPrompt || 'You are a professional B2B sales expert.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: engine === 'DEEPSEEK' ? 15000 : 25000 
      }
    );

    return response.data.choices[0]?.message?.content || '';
  }

  /**
   * 环境变量读取
   */
  private static getApiKey(engine: LLMEngine): string {
    if (engine === 'DEEPSEEK') return process.env.DEEPSEEK_API_KEY || '';
    if (engine === 'OPENAI') return process.env.OPENAI_API_KEY || '';
    return '';
  }
}