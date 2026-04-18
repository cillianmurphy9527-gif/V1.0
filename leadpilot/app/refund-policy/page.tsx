import Link from "next/link"
import { Sparkles, Receipt } from "lucide-react"

export const metadata = {
  title: "退款政策 - LeadPilot",
  description: "LeadPilot 服务退款与售后政策",
}

const SECTIONS = [
  {
    title: "1. 概述与基本原则",
    content: `LeadPilot 致力于为企业提供稳定、高效的 AI 自动化拓客服务。由于 B2B SaaS 服务的特殊性，以及我们在 AI 算力调用、独立域名注册、高信誉 IP 维护等方面均需向上游支付不可逆的硬性成本，因此我们制定了严格且透明的退款政策。\n\n我们强烈建议所有用户在正式订阅前，充分利用「免费试用版本」评估我们的功能是否满足您的业务需求。`
  },
  {
    title: "2. 核心订阅套餐退款",
    content: `2.1 首次订阅：自您首次付款订阅「试运营版/增长版/规模化版」之日起的 7 个自然日内，如果您遭遇了严重的、无法修复的系统技术故障导致服务完全无法使用，您可以联系客服申请全额退款。申请时需提供可复现的错误凭证。\n\n2.2 正常取消：超过 7 日犹豫期，或非因平台核心技术故障原因（例如：因您自身业务调整、不会使用操作、主观认为效果未达预期等），不支持无理由退款。但您可以随时取消下个月的自动续费。\n\n2.3 额度消耗限制：即使在 7 日内，若您已经消耗了该套餐中所含 AI 算力、发信额度或线索挖掘额度的 50% 以上，即视为服务已深度交付，不支持退款。`
  },
  {
    title: "3. 增值服务与虚拟资产（概不退款）",
    content: `以下增值服务一经售出及开通，即刻产生硬性消耗，在任何情况下均【概不退款】：\n\n• 算力补充包与额度包：额外购买的 AI tokens、发信额度包、线索挖掘包等。\n• 独立发信域名与 IP：为您单独注册配置的域名、高信誉独立 IP 预热服务。\n• 行业模板与策略包：数字内容资产一旦解锁即视为交付完毕。\n• 实施与定制服务：官方实施专家 1 对 1 托管服务、API 接口授权、私有化行业定制等人工介入服务。`
  },
  {
    title: "4. 因违规导致封号的处理（无退款）",
    content: `为维护整个平台发信通道的信誉，我们对滥用行为采取“零容忍”态度。若您的账户因以下违规行为被系统风控拦截或人工封禁，您支付的【所有费用均不予退还】：\n\n• 发送欺诈、钓鱼、色情、博彩等违法违规内容；\n• 遭遇大量海外收件人投诉（Spam 标记率严重超标）；\n• 伪造发件人身份或使用恶意技术手段绕过平台频率限制；\n• 违反《服务条款》中明确规定的其他严禁行为。`
  },
  {
    title: "5. 账单争议与退款流程",
    content: `5.1 流程：如果您符合退款条件，请使用注册邮箱发送邮件至 support@leadpilot.cn，邮件标题注明“退款申请 - [您的注册邮箱/订单号]”，并附上故障截图或说明。\n\n5.2 审核时效：我们的财务与技术团队将在 1-3 个工作日内完成审核。\n\n5.3 退款路径：审核通过后，退款将原路返回至您的支付账户（微信/支付宝/信用卡）。具体到账时间依赖于第三方支付网关（通常为 3-7 个工作日）。`
  },
]

export default function RefundPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <nav className="border-b border-white/5 bg-slate-950/80 sticky top-0 z-50 backdrop-blur-xl">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-xl font-bold text-white">
            <Sparkles className="w-5 h-5 text-emerald-400" />LeadPilot
          </Link>
          <Link href="/register" className="text-slate-400 hover:text-white text-sm transition-colors">
            ← 返回注册
          </Link>
        </div>
      </nav>

      <main className="container mx-auto px-6 py-16 max-w-3xl">
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
              <Receipt className="w-5 h-5 text-emerald-400" />
            </div>
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-widest">Financial Policy</span>
          </div>
          <h1 className="text-4xl font-bold mb-3">退款与售后政策</h1>
          <p className="text-slate-500 text-sm mb-2">生效日期：2026年3月1日 · 版本 v1.0</p>
          <div className="mt-6 p-4 bg-slate-900 border border-slate-700 rounded-xl text-sm text-slate-300 leading-relaxed">
             LeadPilot 深知企业级采购的谨慎。我们承诺账单清晰透明，绝不设立隐藏扣费。对于符合退款规则的请求，我们绝不推诿，保障您的资金安全。
          </div>
        </div>

        <div className="space-y-10 text-slate-300 leading-relaxed">
          {SECTIONS.map((s, i) => (
            <section key={i}>
              <h2 className="text-xl font-bold text-white mb-4 pb-2 border-b border-slate-800">{s.title}</h2>
              <p className="whitespace-pre-line text-sm leading-8">{s.content}</p>
            </section>
          ))}
        </div>

        <div className="mt-16 pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-600">© 2026 LeadPilot. 保留一切权利。</p>
          <div className="flex items-center gap-6 text-xs text-slate-500">
            <Link href="/terms" className="hover:text-white transition-colors">服务条款</Link>
            <Link href="/privacy" className="hover:text-white transition-colors">隐私政策</Link>
          </div>
        </div>
      </main>
    </div>
  )
}