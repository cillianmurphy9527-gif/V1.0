import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

const HARDCODED_SEEDS_IDS = ['dev-admin-super', 'dev-user-dashboard', 'dev-admin-001']

export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request as any, secret: process.env.NEXTAUTH_SECRET })
    if (!token?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { brand } = await request.json()
    if (!brand || brand.trim().length < 2) {
      return NextResponse.json({ error: '品牌名太短' }, { status: 400 })
    }

    const base = brand.trim().toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 18) || 'brand'

    // 尝试调用 DeepSeek 生成域名
    const deepseekKey = process.env.DEEPSEEK_API_KEY
    const geminiKey   = process.env.GEMINI_API_KEY

    if (deepseekKey) {
      try {
        const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${deepseekKey}` },
          body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [
              {
                role: 'system',
                content: 'You are a domain name expert. Return ONLY a JSON array of 5 domain name objects with keys: domain (string, e.g. "getbrand.com"), hint (string, short marketing tagline in Chinese, <= 12 chars). No explanation, no markdown, only raw JSON array.',
              },
              {
                role: 'user',
                content: `Brand: "${base}". Generate 5 diverse, commercially appealing domain names. Mix suffixes: .com .net .io .co .app .hq .b2b .pro. Vary prefixes: get, try, use, go, my, join. Return JSON array only.`,
              },
            ],
            temperature: 0.9,
            max_tokens: 300,
          }),
          signal: AbortSignal.timeout(8000),
        })
        if (res.ok) {
          const data = await res.json()
          const text = data.choices?.[0]?.message?.content?.trim() || ''
          const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
          const parsed = JSON.parse(cleaned)
          if (Array.isArray(parsed) && parsed.length > 0) {
            return NextResponse.json({ suggestions: parsed.slice(0, 5) })
          }
        }
      } catch (e) {
        console.warn('[suggest] DeepSeek failed, fallback:', e)
      }
    }

    // Fallback: 本地多样化生成
    const suggestions = [
      { domain: `get${base}.com`,   hint: '主推 · .com 优先' },
      { domain: `${base}hq.com`,    hint: '商务感 · 总部形象' },
      { domain: `${base}-b2b.com`,  hint: 'B2B 专属通道' },
      { domain: `use${base}.io`,    hint: '科技感 · .io' },
      { domain: `${base}app.co`,    hint: '简洁 · 国际范' },
    ]
    return NextResponse.json({ suggestions })
  } catch (error: any) {
    console.error('[suggest]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
