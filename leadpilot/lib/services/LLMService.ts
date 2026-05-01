import axios from 'axios';

export class LLMService {
  /**
   * 生成开发信 (商用级双引擎容灾版)
   * @param systemPrompt 系统提示词
   * @param websiteData 客户数据
   */
  static async generateEmail(systemPrompt: string, websiteData: any): Promise<string> {
    const deepseekKey = process.env.DEEPSEEK_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    // 强迫大模型必须读取真实的数据
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
        {
          model: 'deepseek-chat',
          messages: messages,
          temperature: 0.7,
        },
        {
          headers: {
            'Authorization': `Bearer ${deepseekKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        }
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
          {
            model: 'gpt-4o-mini', // 便宜又快的模型
            messages: messages,
            temperature: 0.7
          },
          {
            headers: {
              'Authorization': `Bearer ${openaiKey}`,
              'Content-Type': 'application/json',
            },
            timeout: 20000 
          }
        );

        console.log(`✅ [AI] OpenAI 备用引擎写信成功！`);
        return openaiRes.data.choices[0].message.content;

      } catch (oaError: any) {
        console.error(`❌ [AI] 双引擎全部瘫痪: ${oaError.response?.data?.error?.message || oaError.message}`);
        // 绝不妥协：严禁返回假模板！直接抛出报错，让上层 Worker 把任务标记为失败。
        throw new Error("AI 生成失败，停止投递");
      }
    }
  }
}