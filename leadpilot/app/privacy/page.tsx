import Link from "next/link"
import { Sparkles } from "lucide-react"

export const metadata = {
  title: "隐私政策 - LeadPilot",
  description: "LeadPilot 隐私政策",
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <nav className="border-b border-white/5 bg-slate-950/80 sticky top-0 z-50 backdrop-blur-xl">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-xl font-bold text-white">
            <Sparkles className="w-5 h-5 text-blue-400" />LeadPilot
          </Link>
          <Link href="/" className="text-slate-400 hover:text-white text-sm transition-colors">
            ← 返回首页
          </Link>
        </div>
      </nav>

      <main className="container mx-auto px-6 py-16 max-w-3xl">
        <h1 className="text-4xl font-bold mb-3">LeadPilot 隐私政策</h1>
        <p className="text-slate-500 text-sm mb-12">最后更新日期：2026年3月1日</p>

        <div className="space-y-10 text-slate-300 leading-relaxed">

          <section>
            <h2 className="text-xl font-bold text-white mb-3">1. 概述</h2>
            <p>LeadPilot 高度重视用户隐私。本政策说明我们如何收集、使用、存储和保护您的个人信息。使用本平台即表示您同意本隐私政策。</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">2. 我们收集的信息</h2>
            <p>我们可能收集以下类型的信息：</p>
            <ul className="list-disc list-inside space-y-2 mt-3 pl-4">
              <li><strong className="text-white">账户信息：</strong>注册时提供的手机号、邮箱、公司名称等</li>
              <li><strong className="text-white">业务数据：</strong>上传的知识库文档、营销指令及目标客户数据</li>
              <li><strong className="text-white">使用数据：</strong>功能使用记录、日志、设备及浏览器信息</li>
              <li><strong className="text-white">支付信息：</strong>通过第三方支付渠道处理，我们不存储完整支付卡信息</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">3. 信息使用目的</h2>
            <ul className="list-disc list-inside space-y-2 pl-4">
              <li>提供、维护和改善平台服务</li>
              <li>处理订单、发送服务通知</li>
              <li>驱动 AI 模型生成个性化营销内容</li>
              <li>防范欺诈、滥用及安全威胁</li>
              <li>遵守法律义务</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">4. 信息共享</h2>
            <p>我们不会出售您的个人信息。仅在以下情况下共享：</p>
            <ul className="list-disc list-inside space-y-2 mt-3 pl-4">
              <li>经您明确授权</li>
              <li>与提供服务必需的第三方供应商（AI 引擎、云存储、支付渠道）</li>
              <li>依法律要求或监管机构要求</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">5. 数据安全</h2>
            <p>我们采用 TLS 传输加密、数据库加密存储、访问控制及定期安全审计等行业标准措施保护您的数据。</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">6. 您的权利（GDPR 合规）</h2>
            <p>您享有以下权利：</p>
            <ul className="list-disc list-inside space-y-2 mt-3 pl-4">
              <li><strong className="text-white">访问权：</strong>请求查阅我们持有的您的个人数据</li>
              <li><strong className="text-white">更正权：</strong>要求更正不准确的个人数据</li>
              <li><strong className="text-white">删除权：</strong>要求删除您的个人数据（被遗忘权）</li>
              <li><strong className="text-white">数据可携带权：</strong>以结构化格式导出您的数据</li>
              <li><strong className="text-white">退出营销：</strong>随时退订营销通信，回复邮件中的退订即可</li>
            </ul>
            <p className="mt-4">如需行使上述权利，请联系：<a href="mailto:privacy@leadpilot.ai" className="text-blue-400 hover:text-blue-300 underline">privacy@leadpilot.ai</a></p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">7. Cookie 与追踪技术</h2>
            <p>我们使用必要的 Cookie 维持登录状态和安全性。我们不使用第三方广告追踪 Cookie。您可通过浏览器设置管理 Cookie 偏好。</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">8. 数据保留</h2>
            <p>账户活跃期间我们保留您的数据。账户注销后，业务数据将在 30 天内删除，法律要求保留的数据除外。</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">9. 政策更新</h2>
            <p>我们可能定期更新本政策。重大变更将通过平台公告或邮件通知，继续使用视为接受更新。</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">10. 联系我们</h2>
            <p>隐私相关问题请联系：<a href="mailto:privacy@leadpilot.ai" className="text-blue-400 hover:text-blue-300 underline">privacy@leadpilot.ai</a></p>
          </section>

        </div>
      </main>

      <footer className="border-t border-white/5 py-8 mt-16">
        <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4 text-slate-500 text-sm">
          <span>© 2026 LeadPilot. All rights reserved.</span>
          <div className="flex gap-6">
            <Link href="/terms" className="hover:text-white transition-colors">用户协议</Link>
            <Link href="/privacy" className="hover:text-white transition-colors">隐私政策</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
