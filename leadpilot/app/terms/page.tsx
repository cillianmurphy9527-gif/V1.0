import Link from "next/link"
import { Sparkles, ShieldCheck } from "lucide-react"

export const metadata = {
  title: "服务条款 - LeadPilot",
  description: "LeadPilot B2B SaaS 软件服务协议",
}

const SECTIONS = [
  {
    title: "1. 协议接受与适用范围",
    content: `本《软件服务协议》（以下简称「本协议」）由您（以下简称「用户」或「您」）与 LeadPilot（以下简称「我们」或「本平台」）之间订立。当您完成账号注册、点击「同意」按钮或以任何方式使用本平台服务时，即视为您已阅读、理解并同意受本协议全部条款的约束。\n\n若您代表某一企业或法人主体注册，则代表您有权代表该主体接受本协议，且该主体同意受本协议约束。如您不同意本协议的任何条款，请立即停止使用本平台服务。`
  },
  {
    title: "2. 账号注册规范",
    content: `2.1 真实信息：注册时您须提供真实、准确、完整的企业信息（包括但不限于企业名称、联系人、联系方式、业务邮箱）。\n\n2.2 账号安全：您有责任妥善保管账号密码，因密码泄露导致的一切损失由您自行承担。建议定期修改密码并启用二步验证。\n\n2.3 账号归属：账号仅限注册主体使用，不得转让、出租或授权第三方使用。一经发现，本平台有权立即封禁账号并不予退款。\n\n2.4 实名制要求：根据相关法律法规，本平台保留要求用户完成企业实名认证的权利。未完成认证的账号可能受到功能限制。`
  },
  {
    title: "3. 用户数据与隐私保护",
    content: `3.1 数据所有权：您上传至本平台的所有业务数据（包括知识库文件、客户联系人列表、邮件内容等）归您所有，本平台绝不会将您的数据出售给任何第三方。\n\n3.2 数据处理目的：本平台仅在提供服务所必要的范围内处理您的数据，包括：AI 邮件生成、线索匹配、发信任务调度、数据统计分析。\n\n3.3 数据存储安全：所有数据均存储于高安全级别的云服务器，传输过程全程 TLS 加密，静态数据 AES-256 加密存储。\n\n3.4 隐私政策：详细的数据收集与处理方式，请参阅我们的《隐私政策》。`
  },
  {
    title: "4. 合规发信要求（核心红线）",
    content: `4.1 反垃圾邮件承诺：您使用本平台发送的所有邮件必须符合目标收件国家或地区的反垃圾邮件法律法规，包括但不限于：美国 CAN-SPAM Act、欧盟 GDPR 等。\n\n4.2 严禁行为（违者立即封号，已付费用不予退还）：\n• 发送钓鱼邮件、诈骗邮件或任何欺骗性内容；\n• 伪造发件人身份（From 地址欺诈）；\n• 发送包含恶意软件、病毒或有害链接的邮件；\n• 违反 GDPR 等隐私法规收集或使用个人数据；\n• 发送侮辱性、歧视性或违法违规内容。\n\n4.3 退订机制：所有营销邮件必须包含有效的退订链接，您有义务及时停止向已退订用户发送邮件。\n\n4.4 频率与风控：本平台内置智能风控。若因用户违规高频发送导致域名或 IP 被国际反垃圾邮件组织拉黑，后果由用户自行承担。`
  },
  {
    title: "5. 知识产权",
    content: `5.1 平台版权：本平台的软件代码、UI 设计、AI 模型、算法及相关技术均归本平台所有，受著作权法保护。未经书面授权，不得复制、修改、反编译或商业使用。\n\n5.2 用户内容：您上传的产品资料、邮件模板等内容的知识产权归您所有。\n\n5.3 AI 生成内容：由 AI 基于您的知识库生成的邮件内容，其知识产权归您所有，本平台不主张任何权利。`
  },
  {
    title: "6. 免责声明",
    content: `6.1 服务可用性：本平台按「现状」提供服务。因不可抗力（政府行为、网络基础设施故障、第三方 API 中断）导致的服务中断，本平台不承担责任。\n\n6.2 发信效果：本平台不保证邮件的绝对进箱率、回复率或最终商业转化结果。营销效果受多重外部客观因素影响。\n\n6.3 间接损失：在任何情况下，本平台对用户因使用服务产生的间接损失、利润损失不承担赔偿责任。最高赔偿上限不超过用户最近三个月实际支付的平台服务费。`
  },
  {
    title: "7. 协议变更与终止",
    content: `7.1 协议更新：本平台保留随时修改本协议的权利。重大变更将通过站内通知或邮件提前告知。继续使用服务视为接受修改。\n\n7.2 服务终止：如您严重违反本协议（特别是合规发信条款），我们有权单方面立即终止服务并封禁账号。`
  },
  {
    title: "8. 联系我们",
    content: `如您对本协议有任何疑问，请联系：\n合规与法务：legal@leadpilot.cn\n客户支持：support@leadpilot.cn`
  },
]

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <nav className="border-b border-white/5 bg-slate-950/80 sticky top-0 z-50 backdrop-blur-xl">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-xl font-bold text-white">
            <Sparkles className="w-5 h-5 text-blue-400" />LeadPilot
          </Link>
          <Link href="/register" className="text-slate-400 hover:text-white text-sm transition-colors">
            ← 返回注册
          </Link>
        </div>
      </nav>

      <main className="container mx-auto px-6 py-16 max-w-3xl">
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-blue-400" />
            </div>
            <span className="text-xs font-semibold text-blue-400 uppercase tracking-widest">Legal Document</span>
          </div>
          <h1 className="text-4xl font-bold mb-3">LeadPilot 服务条款</h1>
          <p className="text-slate-500 text-sm mb-2">生效日期：2026年3月1日 · 版本 v1.2</p>
          <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/25 rounded-xl text-sm text-amber-300 leading-relaxed">
            ⚠️ 请在注册及购买前仔细阅读本协议。完成注册即表示您已阅读并同意本协议的全部条款，尤其是第 4 条关于「合规发信」的强制性红线要求。
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
            <Link href="/privacy" className="hover:text-white transition-colors">隐私政策</Link>
            <Link href="/refund-policy" className="hover:text-white transition-colors">退款政策</Link>
          </div>
        </div>
      </main>
    </div>
  )
}