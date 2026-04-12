import { NextRequest, NextResponse } from 'next/server'

// ══════════════════════════════════════════════════════════════════════════════
//  AI 回复生成接口 /api/ai/reply
//
//  请求体（POST JSON）：
//    { emailContent, tone, senderName, language }
//  响应体（JSON）：
//    { original: string, zh: string }
//
//  切换逻辑：
//    1. 若未配置 AI_API_KEY → 进入 MOCK 模式（2 秒模拟延迟，返回双语硬编码）
//    2. 若配置了 AI_API_KEY → 进入真实 OpenAI 兼容调用（预留结构，注释引导）
// ══════════════════════════════════════════════════════════════════════════════

const USE_REAL_API = !!process.env.AI_API_KEY

// ── Mock 数据：按语气风格返回极其逼真的外贸回复 ──────────────────────────────

const MOCK_RESPONSES: Record<string, { original: string; zh: string }> = {
  positive: {
    original: `Hi {{senderName}},

Thank you for reaching out and for your interest in our outdoor LED display panels. It's great to connect with a leading systems integrator in Dubai.

For a stadium project of 500 sq meters, our P3.91 series is indeed an excellent choice, offering high brightness (≥6,500 nits) and superior weather resistance (IP65), making it ideal for outdoor stadium environments.

I have attached our latest catalog and technical specs for your review. Regarding the FOB pricing for this bulk order, I am preparing a detailed quotation and will send it over by tomorrow morning. Our standard lead time for this volume is typically 15-20 business days.

Could we schedule a quick 10-minute call this Thursday to discuss the project requirements in detail?

Best regards,
[Your Name]`,
    zh: `{{senderName}} 您好，

非常感谢您的来信，以及对我们户外 LED 显示屏产品的关注。很高兴能与迪拜领先的系统集成商建立联系。

对于 500 平方米的体育场项目，我们的 P3.91 系列是绝佳选择，亮度高达 ≥6,500 尼特，防护等级 IP65，完美适配户外体育场环境。

我已随信附上最新产品目录和技术规格供您审阅。关于该大宗订单的 FOB 报价，我正在准备详细报价单，将于明日上午发送给您。此等规模的交货期一般为 15-20 个工作日。

本周四我们能否安排一次简短的 10 分钟通话，详细讨论项目需求？

此致敬礼
[您的姓名]`,
  },
  negative: {
    original: `Hi {{senderName}},

Thank you for reaching out and for taking the time to contact us regarding your outdoor LED display project.

After careful review of your requirements, we regret to inform you that we are currently unable to proceed with this specific project at this stage. The P3.91 outdoor series requires a minimum order quantity that exceeds what you have indicated, and our production schedule is fully committed for the next two quarters.

We truly appreciate your interest in our products and would be glad to revisit this opportunity when your project timeline or volume requirements align with our capacity. Please feel free to reach out again in the future — we would be happy to assist.

We wish you the best of luck with your stadium project.

Warm regards,
[Your Name]`,
    zh: `{{senderName}} 您好，

感谢您的来信，以及抽出宝贵时间就您的户外 LED 显示屏项目与我们联系。

经过仔细评估您的需求，我们遗憾地通知您，目前我们暂时无法承接本阶段此特定项目。P3.91 户外系列产品有最低起订量要求，超出了您目前的指示数量，同时我们的生产排期已全部排至下两个季度。

我们非常珍视您对我司产品的关注。当您的项目时间表或数量需求与我们的产能相匹配时，我们非常乐意重新评估此次合作机会。欢迎您随时再来询问。

祝您的体育场项目一切顺利！

此致敬礼
[您的姓名]`,
  },
  question: {
    original: `Hi {{senderName}},

Thank you for your inquiry regarding our outdoor LED display panels for your stadium project.

To provide you with the most accurate quotation and technical recommendation, I have a few clarifying questions:

1. What is the exact installation location? (Indoor under canopy, or fully outdoor?)
2. Do you have a target budget range for this project?
3. What is the expected delivery timeline from contract signing?
4. Are there any specific certifications required for the destination market? (CE, UL, GCC?)
5. Do you have a preferred control system or should we recommend one?

Once I have the above information, I can prepare a tailored proposal with detailed pricing and specifications within 24 hours.

Looking forward to your response.

Best regards,
[Your Name]`,
    zh: `{{senderName}} 您好，

感谢您就体育场项目选购我们的户外 LED 显示屏与我们接洽。

为向您提供最准确的报价和技术建议，我有几个问题需要确认：

1. 具体安装位置是哪里？（室内檐下，还是完全户外？）
2. 您的项目预算目标范围是多少？
3. 合同签订后的预期交货时间要求？
4. 目的市场是否需要特定认证？（CE、UL、GCC？）
5. 您是否有指定的控制系统，或需要我们推荐？

一旦收到以上信息，我将在 24 小时内为您准备一份定制化方案，包含详细报价和规格参数。

期待您的回复。

此致敬礼
[您的姓名]`,
  },
  custom: {
    original: `Hi {{senderName}},

Thank you for reaching out.

I am writing to acknowledge receipt of your inquiry. I will review your requirements in detail and get back to you with a comprehensive response shortly.

Best regards,
[Your Name]`,
    zh: `{{senderName}} 您好，

感谢您的来信。

我已收到您的询盘，将仔细审阅您的需求，并尽快给您详细的回复。

此致敬礼
[您的姓名]`,
  },
}

function interpolateTemplate(template: string, senderName: string): string {
  return template.replace(/\{\{\s*senderName\s*\}\}/g, senderName)
}

// ── POST Handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { emailContent, tone = 'positive', senderName = 'there', language = 'auto' } = body

    if (!emailContent) {
      return NextResponse.json(
        { error: 'emailContent is required' },
        { status: 400 }
      )
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  真实 API 路径（当 AI_API_KEY 已配置时启用）
    //  兼容：OpenAI / Kimi (Moonshot) / 智谱 GLM 等所有 OpenAI-compatible 接口
    // ══════════════════════════════════════════════════════════════════════════
    if (USE_REAL_API) {
      const TONE_PROMPTS: Record<string, string> = {
        positive:
          'You are a professional B2B export sales representative. Write a warm, enthusiastic, and professional reply email in the sender\'s language. Include specific product benefits, a detailed quotation offer, and propose a next-step call. Keep it concise (under 200 words).',
        negative:
          'You are a professional B2B export sales representative. Write a polite, diplomatic decline reply in the sender\'s language. Express regret, give a reasonable business reason, and leave the door open for future cooperation. Keep it concise (under 150 words).',
        question:
          'You are a professional B2B export sales representative. Write a reply in the sender\'s language that asks 4-5 key clarifying questions about the project requirements, budget, timeline, certifications, and preferences. Be polite and show genuine interest. Keep it concise (under 180 words).',
        custom:
          'You are a professional B2B export sales representative. Write a brief professional acknowledgment reply in the sender\'s language.',
      }

      const systemPrompt = `You are an expert B2B export sales assistant. Your client has sent an inquiry email. Your task is to generate a professional reply email.

IMPORTANT RULES:
1. ALWAYS write the reply in the SAME language as the sender's email.
2. Be professional, concise, and action-oriented.
3. For positive tone: show enthusiasm, provide value, and push toward next steps.
4. For negative tone: be polite, give a clear reason, and keep the door open.
5. For question tone: ask specific, relevant qualifying questions.
6. Use standard email format with greeting, body, and closing.
7. Output ONLY a JSON object with exactly two fields: { "original": "...", "zh": "..." }
   - "original": the reply email in the sender's language
   - "zh": the Chinese (Simplified) translation of the reply`

      const userPrompt = `Sender's name: ${senderName}
Sender's email:\n${emailContent}\n\nTone: ${tone}\n\n${TONE_PROMPTS[tone] || TONE_PROMPTS.custom}`

      const apiKey = process.env.AI_API_KEY!
      const apiBase = process.env.AI_BASE_URL || 'https://api.openai.com/v1'
      const model = process.env.AI_MODEL || 'gpt-4o-mini'

      const aiResponse = await fetch(`${apiBase}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 800,
          response_format: { type: 'json_object' },
        }),
      })

      if (!aiResponse.ok) {
        const errText = await aiResponse.text()
        return NextResponse.json(
          { error: `AI API error: ${aiResponse.status}`, details: errText },
          { status: 502 }
        )
      }

      const data = await aiResponse.json()
      const rawContent = data.choices?.[0]?.message?.content

      if (!rawContent) {
        return NextResponse.json({ error: 'Empty response from AI' }, { status: 500 })
      }

      let parsed: { original: string; zh: string }
      try {
        parsed = JSON.parse(rawContent)
      } catch {
        return NextResponse.json(
          { error: 'AI response was not valid JSON', raw: rawContent },
          { status: 500 }
        )
      }

      return NextResponse.json(parsed)
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  MOCK 模式（AI_API_KEY 未配置时）
    //  模拟 2 秒网络请求延迟，返回按语气风格的双语数据
    // ══════════════════════════════════════════════════════════════════════════
    await new Promise((resolve) => setTimeout(resolve, 2000))

    const mockData = MOCK_RESPONSES[tone] || MOCK_RESPONSES.positive
    const original = interpolateTemplate(mockData.original, senderName)
    const zh = interpolateTemplate(mockData.zh, senderName)

    return NextResponse.json({ original, zh })
  } catch (err) {
    console.error('[/api/ai/reply]', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
