export default function RefundPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-6">
      <div className="max-w-2xl w-full">
        <h1 className="text-3xl font-bold mb-6">退款政策 (Refund Policy)</h1>
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-8 text-slate-300 leading-relaxed">
          <p className="text-lg">
            虚拟算力与域名服务一经售出，产生不可逆硬性成本，概不退款。请优先使用 7 天免费试用评估我们的服务。极端故障请联系人工客服。
          </p>
          <p className="mt-6 text-sm text-slate-500">
            如需联系客服，请发送邮件至 <a href="mailto:support@leadpilot.com" className="text-blue-400 underline">support@leadpilot.com</a>
          </p>
        </div>
        <a href="/" className="inline-block mt-6 text-sm text-slate-500 hover:text-slate-300 transition-colors">← 返回首页</a>
      </div>
    </div>
  )
}
