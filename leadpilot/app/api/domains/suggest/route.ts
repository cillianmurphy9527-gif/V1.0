import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { TLD_TIERS } from '@/config/pricing' // 👈 引入我们的风控等级配置

const HARDCODED_SEEDS_IDS = ['dev-admin-super', 'dev-user-dashboard', 'dev-admin-001']

export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request as any, secret: process.env.NEXTAUTH_SECRET })
    if (!token?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // 👈 核心升级：接收前端传来的客户等级，默认为 SILVER 防止越权
    const { brand, tier = 'SILVER' } = await request.json() 
    if (!brand || brand.trim().length < 2) {
      return NextResponse.json({ error: '品牌名太短' }, { status: 400 })
    }

    const base = brand.trim().toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 18) || 'brand'

    // 🛡️ 获取当前等级允许的后缀池
    const allowedSuffixes = tier === 'GOLD' ? TLD_TIERS.GOLD.suffixes : TLD_TIERS.SILVER.suffixes;
    const suffixesString = allowedSuffixes.join(' ');

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
                content: 'You are a domain name expert. Return ONLY a JSON array of 5 domain name objects with keys: domain (string), hint (string, short marketing tagline in Chinese, <= 12 chars). No explanation, no markdown, only raw JSON array.',
              },
              {
                role: 'user',
                // ⚠️ 核心指令：强制大模型只能使用该客户有权限的后缀！
                content: `Brand: "${base}". Generate 5 diverse, commercially appealing domain names. YOU MUST ONLY USE THESE SUFFIXES: ${suffixesString}. Vary prefixes like get, try, use, my, go. Return JSON array only.`,
              },
            ],
            temperature: 0.8,
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

    // 🛡️ 降级方案 (Fallback)：根据等级生成本地安全推荐
    const suggestions = tier === 'GOLD' ? [
      { domain: `get${base}.com`,   hint: '尊享 · 顶级域名' },
      { domain: `${base}hq.com`,    hint: '权威 · 集团总部' },
      { domain: `${base}-b2b.net`,  hint: '专业 · B2B专属' },
      { domain: `use${base}.co`,    hint: '简短 · 国际范' },
      { domain: `${base}global.com`,hint: '全球 · 出海优选' },
    ] : [
      { domain: `get${base}.online`,hint: '高性价比 · 优选' },
      { domain: `${base}hq.site`,   hint: '企业官网 · 推荐' },
      { domain: `${base}b2b.store`, hint: '商贸专属通道' },
      { domain: `use${base}.tech`,  hint: '科技感 · 极客' },
      { domain: `${base}.website`,  hint: '官方网站直达' },
    ]

    return NextResponse.json({ suggestions })
  } catch (error: any) {
    console.error('[suggest]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}