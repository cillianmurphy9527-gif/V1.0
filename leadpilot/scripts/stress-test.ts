/**
 * Phase 3 Chaos Stress Test
 *
 * 运行方式（推荐）：
 *   BASE_URL="http://localhost:3000" STRESS_COOKIE="next-auth.session-token=...; ..." npx tsx scripts/stress-test.ts
 *
 * 说明：
 * - 该脚本通过携带 NextAuth Cookie 来模拟“同一用户”高并发请求
 * - 需要你先在浏览器登录后，从请求头复制 Cookie 到 STRESS_COOKIE
 */

type Json = Record<string, any>

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
const COOKIE = process.env.STRESS_COOKIE || ''
const CONCURRENCY = Number(process.env.CONCURRENCY || 20)

function assertEnv() {
  if (!COOKIE) {
    throw new Error('缺少 STRESS_COOKIE（请从已登录浏览器复制 Cookie 字符串）')
  }
}

async function httpJson(method: string, path: string, body?: any) {
  const url = `${BASE_URL}${path}`
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Cookie: COOKIE,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json: Json | null = null
  try { json = text ? JSON.parse(text) : null } catch { json = { raw: text } }
  return { ok: res.ok, status: res.status, json }
}

async function runConcurrent<T>(n: number, fn: (i: number) => Promise<T>) {
  return await Promise.all(Array.from({ length: n }, (_, i) => fn(i)))
}

function summarizeStatuses(results: Array<{ status: number }>) {
  const map = new Map<number, number>()
  for (const r of results) map.set(r.status, (map.get(r.status) || 0) + 1)
  return Array.from(map.entries()).sort((a, b) => a[0] - b[0])
}

async function scenarioStartNovaSnowball() {
  console.log('\n=== 场景 1：并发雪崩测试（1 秒 20 次启动 Nova）===')
  const create = await httpJson('POST', '/api/campaigns/create', {
    name: 'StressTest Nova',
    systemPrompt: '请帮我为欧洲机械采购商撰写开发信。必须真实、不得捏造价格与折扣。',
  })
  if (!create.ok) {
    console.log('创建 Campaign 失败:', create.status, create.json)
    return
  }
  const campaignId = create.json?.campaign?.id
  console.log('CampaignId:', campaignId)

  const results = await runConcurrent(CONCURRENCY, async (i) => {
    // 同一 campaignId 被高并发 start：必须只有 1 个成功，其它 409/402 等
    const r = await httpJson('POST', '/api/campaigns/start', {
      campaignId,
      estimatedLeads: 10,
      enableDeepAnalysis: false,
    })
    return { i, status: r.status, ok: r.ok, json: r.json }
  })

  console.log('状态码分布:', summarizeStatuses(results.map(r => ({ status: r.status }))))
  const successCount = results.filter(r => r.ok).length
  console.log('成功次数:', successCount)
  if (successCount !== 1) {
    console.log('❌ 预期应当仅 1 次启动成功（其余应被幂等/并发拦截）')
  } else {
    console.log('✅ 并发幂等通过：仅 1 次成功')
  }
}

async function scenarioRechargeSnowball() {
  console.log('\n=== 场景 2：并发雪崩测试（1 秒 20 次充值下单）===')
  const results = await runConcurrent(CONCURRENCY, async (i) => {
    const r = await httpJson('POST', '/api/payment/recharge', {
      amount: 9,
      finalAmount: 9,
      tokenQty: 1,
      packageId: `stress-${i}`,
    })
    return { i, status: r.status, ok: r.ok, json: r.json }
  })

  console.log('状态码分布:', summarizeStatuses(results.map(r => ({ status: r.status }))))
  console.log('成功次数:', results.filter(r => r.ok).length)
}

async function scenarioAiOutageFailover() {
  console.log('\n=== 场景 3：AI 宕机模拟（验证 DeepSeek→Gemini 容灾）===')
  console.log('提示：请在服务端设置环境变量来强制故障，例如：CHAOS_DEEPSEEK_MODE=500 或 timeout。')

  const r = await httpJson('POST', '/api/generate-email', {
    language: 'English',
    estimatedTokens: 500,
    leadData: { email: 'test@example.com', websiteData: 'A company website snapshot...' },
    userContext: '我们提供 CNC 精密加工服务，交期快，质量稳定。',
    systemPrompt: '写一封简短专业的开发信。',
  })
  console.log('响应:', r.status, r.json?.success ? 'success' : r.json?.error)
  console.log('验收点：后端控制台应出现 “⚠️ [AI 容灾] DeepSeek 响应失败…” 等醒目日志（若触发切换）。')
}

async function scenarioHardBounceFuse() {
  console.log('\n=== 场景 4：退信熔断测试（10 次 Hard Bounce 触发暂停发信）===')
  const assetsBefore = await httpJson('GET', '/api/user/assets')
  const userId = assetsBefore.json?.id as string | undefined
  if (!userId) {
    console.log('无法获取 userId（/api/user/assets 未返回 id 或鉴权失败）')
    return
  }

  // /api/email/webhook 在 dev 下会跳过签名校验；生产请配置真实签名
  const events = Array.from({ length: 10 }, (_, i) => ({
    type: 'bounce',
    email: `hardbounce-${i}@invalid-domain.zzz`,
    userId,
    reason: '550 mailbox not found hard bounce',
  }))

  const r = await fetch(`${BASE_URL}/api/email/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: COOKIE, 'x-webhook-signature': 'dev' },
    body: JSON.stringify(events),
  })
  const j = await r.json().catch(() => ({}))
  console.log('webhook:', r.status, j)

  const assets = await httpJson('GET', '/api/user/assets')
  console.log('当前用户熔断状态:', {
    bounceCount: assets.json?.bounceCount,
    isSendingSuspended: assets.json?.isSendingSuspended,
  })
}

async function main() {
  assertEnv()
  console.log('BASE_URL:', BASE_URL)
  console.log('CONCURRENCY:', CONCURRENCY)

  await scenarioStartNovaSnowball()
  await scenarioRechargeSnowball()
  await scenarioAiOutageFailover()
  await scenarioHardBounceFuse()

  console.log('\n全部场景执行完成。')
}

main().catch((e) => {
  console.error('Stress test failed:', e)
  process.exit(1)
})

