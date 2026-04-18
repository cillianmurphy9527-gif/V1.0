import axios from 'axios';
// 引入您的通知服务（路径根据您的实际结构可能需要微调，比如 '@/lib/notification.service' 或 '@/services/NotificationService'）
import { NotificationService } from './NotificationService'; 

// ==========================================
// 🛡️ AI 引擎断路器全局状态 (Circuit Breaker)
// ==========================================
let deepSeekFailCount = 0;
const MAX_FAILS = 3; // 容忍极限：连续报错 3 次
const RESET_TIME = 1000 * 60 * 5; // 5分钟冷却时间，之后给 DeepSeek 重新表现的机会

export class LLMService {
  
  /**
   * 核心大模型调用出口（自带熔断与备用降级机制）
   */
  static async generateContent(prompt: string, systemPrompt?: string): Promise<string> {
    
    // 1. 【防线判断】检查是否已经处于“瘫痪熔断状态”
    if (deepSeekFailCount >= MAX_FAILS) {
      console.warn("⚠️ [AI 熔断器] 主心脏 DeepSeek 处于冷却期，直接走备用心肺 OpenAI (GPT-4o-mini)！");
      return await this.callOpenAI(prompt, systemPrompt);
    }

    try {
      // 2. 【正常突击】尝试使用主心脏 (DeepSeek)
      console.log("🧠 [AI 引擎] 正在呼叫主心脏 DeepSeek...");
      const result = await this.callDeepSeek(prompt, systemPrompt);
      
      // 成功！重置故障计数器
      deepSeekFailCount = 0; 
      return result;

    } catch (error: any) {
      deepSeekFailCount++;
      console.error(`❌ [AI 引擎] DeepSeek 罢工！(故障累积: ${deepSeekFailCount}/${MAX_FAILS}) - ${error.message}`);

      // 3. 【临界点报警】达到故障极限！
      if (deepSeekFailCount === MAX_FAILS) {
        console.log("🚨 [AI 熔断器] 达到故障极限！触发飞书报警并强行切换备用引擎！");
        
        // 📡 呼叫飞书机器人 (异步发送，不阻塞主流程)
        NotificationService.sendSystemAlert(
          `🚨 **LeadPilot 引擎熔断报警**\n` +
          `**事件**: DeepSeek API 连续崩溃 ${MAX_FAILS} 次！\n` +
          `**状态**: 系统已自动无缝切换至 OpenAI (GPT-4o-mini)，业务 0 中断。\n` +
          `**建议**: 请老板检查 DeepSeek 账户余额或官方接口是否宕机。`
        ).catch(e => console.error("飞书报警发送失败:", e));

        // 设置定时器，5分钟后冷却完毕，恢复 DeepSeek 试探
        setTimeout(() => {
          deepSeekFailCount = 0;
          console.log("🔄 [AI 熔断器] 5分钟冷却完毕，重新尝试唤醒主心脏 DeepSeek...");
        }, RESET_TIME);
      }

      // 4. 【保底降级】不管怎样，活儿不能停，立刻用备用心肺顶上！
      console.log("🚑 [AI 引擎] 启动备用方案，呼叫 OpenAI...");
      return await this.callOpenAI(prompt, systemPrompt);
    }
  }

  // ================= 底层真实 API 调用 =================

  /**
   * 呼叫 DeepSeek (主引擎：极其便宜，但偶尔 502)
   */
  private static async callDeepSeek(prompt: string, systemPrompt?: string): Promise<string> {
    const messages: any[] = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: prompt });

    const res = await axios.post('https://api.deepseek.com/v1/chat/completions', {
      model: 'deepseek-chat',
      messages: messages,
      temperature: 0.7
    }, {
      headers: { 'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}` },
      timeout: 15000 // 🛡️ 强制 15 秒超时！防死等！
    });

    return res.data.choices[0].message.content;
  }

  /**
   * 呼叫 OpenAI (备用引擎：贵一点点，但永远不宕机)
   */
  private static async callOpenAI(prompt: string, systemPrompt?: string): Promise<string> {
    const messages: any[] = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: prompt });

    const res = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4o-mini', // 使用最新极速低成本模型
      messages: messages,
      temperature: 0.7
    }, {
      headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
      timeout: 20000 
    });

    return res.data.choices[0].message.content;
  }
}