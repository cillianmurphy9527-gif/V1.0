import { CheckCircle2, AlertCircle, Brain, Mail, CreditCard, Database, RefreshCw } from "lucide-react"

interface RadarNode {
  key: string
  label: string
  envKey: string
  active: boolean
  description: string
}

interface RadarCategory {
  id: string
  title: string
  gradient: string
  nodes: RadarNode[]
}

export default function AdminMonitoringPage() {
  const categories: RadarCategory[] = [
    {
      id: 'ai',
      title: '🧠 双核 AI 引擎',
      gradient: 'from-blue-500 to-cyan-500',
      nodes: [
        { key: 'deepseek', label: 'DeepSeek 主力大脑', envKey: 'DEEPSEEK_API_KEY', active: !!process.env.DEEPSEEK_API_KEY, description: '主力 LLM 引擎 · Nova 核心大脑' },
        { key: 'gemini', label: 'Google Gemini 备用大脑', envKey: 'GEMINI_API_KEY', active: !!process.env.GEMINI_API_KEY, description: '备用 LLM 引擎 · 高峰期分流' },
      ],
    },
    {
      id: 'leads',
      title: '🕵️ 双源获客雷达',
      gradient: 'from-purple-500 to-pink-500',
      nodes: [
        { key: 'apollo', label: 'Apollo B2B 数据源', envKey: 'APOLLO_API_KEY', active: !!process.env.APOLLO_API_KEY, description: '主力 B2B 企业数据库' },
        { key: 'hunter', label: 'Hunter.io 替补数据源', envKey: 'HUNTER_API_KEY', active: !!process.env.HUNTER_API_KEY, description: '邮箱发现与验证服务' },
      ],
    },
    {
      id: 'outreach',
      title: '✉️ 触达与防风控集群',
      gradient: 'from-emerald-500 to-teal-500',
      nodes: [
        { key: 'workspace', label: 'Google Workspace 发信池', envKey: 'WORKSPACE_API_KEY', active: !!process.env.WORKSPACE_API_KEY, description: '企业级发信域名池' },
        { key: 'namecheap', label: 'Namecheap 域名自动购买', envKey: 'NAMECHEAP_API_KEY', active: !!process.env.NAMECHEAP_API_KEY, description: '自动化域名采购与配置' },
        { key: 'zerobounce', label: 'ZeroBounce 邮箱清洗', envKey: 'ZEROBOUNCE_API_KEY', active: !!process.env.ZEROBOUNCE_API_KEY, description: '邮箱有效性验证 · 降低退信率' },
        { key: 'resend', label: 'Resend 系统通知', envKey: 'RESEND_API_KEY', active: !!process.env.RESEND_API_KEY, description: '系统邮件通知服务' },
      ],
    },
    {
      id: 'payment',
      title: '💰 交易与安全风控',
      gradient: 'from-amber-500 to-orange-500',
      nodes: [
        { key: 'wechat', label: '微信支付网关', envKey: 'WECHAT_PAY_SECRET', active: !!process.env.WECHAT_PAY_SECRET, description: '微信支付 · 国内主力收款' },
        { key: 'alipay', label: '支付宝电脑网站支付', envKey: 'ALIPAY_PRIVATE_KEY', active: !!process.env.ALIPAY_PRIVATE_KEY, description: '支付宝 PC 端支付网关' },
        { key: 'aliyun_sms', label: '阿里云短信服务', envKey: 'ALIYUN_SMS_KEY', active: !!process.env.ALIYUN_SMS_KEY, description: '注册验证码发送通道' },
        { key: 'turnstile', label: 'Cloudflare Turnstile 防人机', envKey: 'NEXT_PUBLIC_TURNSTILE_SITE_KEY', active: !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY, description: '注册/登录人机验证防护' },
      ],
    },
    {
      id: 'infra',
      title: '🗄️ 底层高可用基建',
      gradient: 'from-slate-500 to-slate-600',
      nodes: [
        { key: 'database', label: 'PostgreSQL 核心数据库', envKey: 'DATABASE_URL', active: !!process.env.DATABASE_URL, description: '主数据库连接 · Prisma ORM' },
        { key: 'redis', label: 'Redis 队列缓存', envKey: 'REDIS_URL', active: !!process.env.REDIS_URL, description: '任务队列 · 会话缓存' },
        { key: 'oss', label: '阿里云 OSS / CDN', envKey: 'OSS_ACCESS_KEY', active: !!process.env.OSS_ACCESS_KEY, description: '文件存储与 CDN 加速' },
        { key: 'sentry', label: 'Sentry 异常监控', envKey: 'NEXT_PUBLIC_SENTRY_DSN', active: !!process.env.NEXT_PUBLIC_SENTRY_DSN, description: '生产环境错误追踪' },
      ],
    },
  ]

  const totalNodes = categories.reduce((s, c) => s + c.nodes.length, 0)
  const activeNodes = categories.reduce((s, c) => s + c.nodes.filter(n => n.active).length, 0)
  const pendingNodes = totalNodes - activeNodes
  const readiness = totalNodes > 0 ? Math.round((activeNodes / totalNodes) * 100) : 0

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2">🔭 基础设施雷达图</h1>
          <p className="text-slate-400">实时检测所有集成服务的环境变量配置状态</p>
        </div>
        <div className="flex items-center gap-2 text-slate-500 text-sm">
          <RefreshCw className="w-4 h-4" /><span>每次请求实时读取</span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: '总监控节点', value: totalNodes, color: 'text-white' },
          { label: '✅ 已对接', value: activeNodes, color: 'text-emerald-400' },
          { label: '⚠️ 待配置', value: pendingNodes, color: 'text-amber-400' },
          { label: '系统就绪率', value: `${readiness}%`, color: readiness >= 80 ? 'text-emerald-400' : readiness >= 50 ? 'text-amber-400' : 'text-red-400' },
        ].map((s, i) => (
          <div
            key={i}
            className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 text-center"
          >
            <div className={`text-3xl font-black mb-1 ${s.color}`}>{s.value}</div>
            <div className="text-xs text-slate-500">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="space-y-6">
        {categories.map((cat, ci) => (
          <div
            key={cat.id}
            className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6"
          >
            <div className="flex items-center gap-3 mb-5">
              <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${cat.gradient} flex items-center justify-center`}>
                <span className="text-white text-sm">●</span>
              </div>
              <h2 className="text-lg font-bold text-white">{cat.title}</h2>
              <span className="ml-auto text-xs text-slate-500">{cat.nodes.filter(n => n.active).length} / {cat.nodes.length} 已对接</span>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              {cat.nodes.map((node, ni) => (
                <div
                  key={node.key}
                  className={`relative rounded-xl border p-4 transition-all ${
                    node.active ? 'bg-emerald-500/5 border-emerald-500/30 hover:border-emerald-500/50' : 'bg-slate-800/30 border-slate-700/50 opacity-60'
                  }`}
                >
                  <div className="absolute top-3 right-3">
                    {node.active ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.3)]">
                        <CheckCircle2 className="w-2.5 h-2.5" /> ACTIVE
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <AlertCircle className="w-2.5 h-2.5" /> PENDING
                      </span>
                    )}
                  </div>
                  <div className="pr-20">
                    <p className={`font-semibold text-sm mb-0.5 ${node.active ? 'text-white' : 'text-slate-500'}`}>{node.label}</p>
                    <p className="text-xs text-slate-600">{node.description}</p>
                    <p className="text-[10px] font-mono text-slate-700 mt-1">{node.envKey}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-start gap-3">
        <Database className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
        <p className="text-slate-400 text-sm">
          所有检测基于服务端 <code className="text-blue-300 font-mono text-xs">process.env</code> 实时读取，页面刷新即更新。
          环境变量为空时优雅降级为 PENDING 状态，<strong className="text-white">绝不崩溃</strong>。
        </p>
      </div>
    </div>
  )
}
