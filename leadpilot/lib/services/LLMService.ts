// 路径：lib/services/LLMService.ts
import { ChatOpenAI } from '@langchain/openai'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY
const OPENAI_API_KEY = process.env.OPENAI_API_KEY

export class LLMService {
  private static getDeepSeekClient() {
    return new ChatOpenAI({
      // 如果钥匙被删了，随便塞个假的，防止 LangChain 自动去偷拿 OpenAI 的钥匙
      apiKey: DEEPSEEK_API_KEY || 'sk-dummy-key-to-trigger-fallback',
      configuration: { baseURL: 'https://api.deepseek.com/v1' },
      modelName: 'deepseek-chat',
      temperature: 0.7,
      maxRetries: 0, // 🚨 失败 0 容忍，不行立刻切备胎
      timeout: 8000, // 8秒不回话直接当它死了
    })
  }

  private static getOpenAIClient() {
    return new ChatOpenAI({
      apiKey: OPENAI_API_KEY,
      modelName: 'gpt-4o-mini',
      temperature: 0.7,
      maxRetries: 1,
      timeout: 15000, // 🚨 最多等 15 秒过墙，过不去就放弃，绝不让用户等 36 秒！
      
      // 💡 如果您有购买 OpenAI 的国内中转接口（代理域名），取消下面这行注释并填入：
      // configuration: { baseURL: 'https://您的中转域名/v1' }
    })
  }

  public static async answerWithContext(question: string, context: string): Promise<string> {
    const systemPrompt = `你是一个外贸业务专家的AI助手。
请仔细阅读以下背景资料和文档片段，然后回答用户的问题。
回答要求：
1. 语气要像专业的客户成功经理，客观、礼貌。
2. 必须基于提供的文档内容回答，如果文档中没有相关信息，请明确回答“文档中未找到相关内容”。

【背景与文档内容】：
${context}`

    const messages = [new SystemMessage(systemPrompt), new HumanMessage(question)]

    try {
      console.log('[LLM] 🟢 正在调用主引擎 DeepSeek...')
      // 🚨 如果发现没有 DeepSeek 钥匙，直接人为引发熔断，一秒都不耽误
      if (!DEEPSEEK_API_KEY) {
        throw new Error('DeepSeek 密钥为空，触发主动熔断！')
      }

      const response = await this.getDeepSeekClient().invoke(messages)
      return response.content as string

    } catch (dsError: any) {
      console.warn(`⚠️ [LLM] DeepSeek 宕机/熔断！原因: ${dsError.message}。正在无缝切换 OpenAI...`)
      
      try {
        const fallbackResponse = await this.getOpenAIClient().invoke(messages)
        console.log('[LLM] 🟠 已通过 OpenAI 备擎成功返回数据。')
        return fallbackResponse.content as string

      } catch (oaError: any) {
        console.error('❌ [LLM] 灾难性故障：双引擎全部宕机！原因:', oaError.message)
        return "抱歉，AI 主大脑临时维护，且备用大脑（OpenAI）连接超时被墙拦截，请稍后再试。"
      }
    }
  }
}