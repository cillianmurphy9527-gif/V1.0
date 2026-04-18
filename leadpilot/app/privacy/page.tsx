import Link from "next/link"
import { Sparkles, LockKeyhole } from "lucide-react"

export const metadata = {
  title: "隐私政策 - LeadPilot",
  description: "LeadPilot 数据隐私与安全政策",
}

const SECTIONS = [
  {
    title: "1. 概述",
    content: `LeadPilot（以下简称“我们”）高度重视企业与用户的隐私和数据安全。本《隐私政策》旨在说明我们在您使用 LeadPilot 平台时，如何收集、使用、存储和保护您的个人及业务信息。使用本平台即表示您同意本隐私政策的全部内容。`
  },
  {
    title: "2. 我们收集的信息",
    content: `为提供核心的 B2B 拓客与发信服务，我们可能收集以下类型的信息：\n\n• 账户与认证信息：注册时提供的手机号、邮箱、企业名称及职位等。\n• 业务与客户数据：您主动上传的知识库文档、产品资料、以及目标客户的联系人列表（邮箱、姓名等）。\n• 使用与设备数据：功能使用记录、系统日志、IP 地址及浏览器设备特征。\n• 财务信息：交易记录与账单信息（我们不直接存储您的完整信用卡号，支付由第三方合规支付网关处理）。`
  },
  {
    title: "3. 信息的使用目的",
    content: `我们收集的数据仅用于以下目的：\n\n• 提供、维护和改善平台的 AI 邮件生成与发送服务；\n• 根据您的知识库，驱动 AI 模型生成高度个性化的营销内容；\n• 处理交易订单、发送服务通知与技术预警；\n• 监控系统安全，防范欺诈、滥用及网络攻击；\n• 履行法律合规义务。`
  },
  {
    title: "4. 信息共享与披露",
    content: `我们秉持“用户数据归用户所有”的原则，绝不出售您的任何数据。我们仅在以下必要情况共享数据：\n\n• 经您明确授权同意的情况；\n• 提供服务所必需的底层供应商（如 OpenAI 等 AI 引擎、AWS/阿里云等云存储提供商、邮件发送通道网关），且供应商均受严格的数据保密协议约束；\n• 依据法律法规、法院命令或政府监管机构的强制性要求。`
  },
  {
    title: "5. 数据安全保护",
    content: `我们采用金融级的安全标准保护您的数据：\n\n• 传输安全：所有数据传输均强制使用 TLS/SSL 加密协议。\n• 存储安全：静态敏感数据采用 AES-256 算法加密存储于符合等级保护要求的云端环境中。\n• 访问控制：实行严格的内部权限隔离与零信任架构，任何技术人员未经授权无法访问您的业务数据。`
  },
  {
    title: "6. 您的权利（GDPR 参照）",
    content: `我们尊重并保障您对自身数据的控制权：\n\n• 访问与更正权：您可随时在后台查看并修改您的账户及业务数据。\n• 删除权（被遗忘权）：您有权要求注销账户并彻底删除业务数据。\n• 导出权：您可要求以标准 CSV/Excel 格式导出您的联系人及发送日志。\n• 拒绝权：您可随时退订我们的产品营销邮件。`
  },
  {
    title: "7. Cookie 与追踪技术",
    content: `我们使用必要的 Cookie 及类似技术来维持您的登录状态、记住您的界面偏好，并进行基础的性能统计。我们不使用侵入式的第三方广告追踪 Cookie。您可通过浏览器设置随时清除或拒绝 Cookie。`
  },
  {
    title: "8. 数据保留期限",
    content: `在您的账户活跃期间，我们将持续保留您的数据以提供服务。当您主动注销账户后，系统将在 30 个自然日内彻底且不可逆地删除您的所有业务数据（因法律税务要求必须留存的财务账单数据除外）。`
  },
  {
    title: "9. 联系我们",
    content: `如您对本隐私政策或数据安全有任何疑问、投诉或建议，请通过以下方式联系我们的数据合规官：\n\n隐私专线：privacy@leadpilot.cn\n客户服务：support@leadpilot.cn`
  },
]

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <nav className="border-b border-white/5 bg-slate-950/80 sticky top-0 z-50 backdrop-blur-xl">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-xl font-bold text-white">
            <Sparkles className="w-5 h-5 text-purple-400" />LeadPilot
          </Link>
          <Link href="/register" className="text-slate-400 hover:text-white text-sm transition-colors">
            ← 返回注册
          </Link>
        </div>
      </nav>

      <main className="container mx-auto px-6 py-16 max-w-3xl">
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
              <LockKeyhole className="w-5 h-5 text-purple-400" />
            </div>
            <span className="text-xs font-semibold text-purple-400 uppercase tracking-widest">Privacy Policy</span>
          </div>
          <h1 className="text-4xl font-bold mb-3">隐私政策</h1>
          <p className="text-slate-500 text-sm mb-2">生效日期：2026年3月1日 · 版本 v1.1</p>
          <div className="mt-6 p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl text-sm text-purple-300 leading-relaxed">
            保护您的商业机密是我们的生命线。LeadPilot 承诺您的客户名单、知识库和开发信模板绝不会用于训练公共 AI 模型，也绝不会泄露给任何第三方。
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
            <Link href="/refund-policy" className="hover:text-white transition-colors">退款政策</Link>
          </div>
        </div>
      </main>
    </div>
  )
}