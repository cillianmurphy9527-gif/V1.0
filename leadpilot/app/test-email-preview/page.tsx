"use client"

import { useState } from 'react'
import { buildLeadInviteEmail, buildSupplyChainEmail } from '@/lib/email/templates'
import { motion } from 'framer-motion'
import { Mail, Eye, ArrowLeft, Globe } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

type TemplateId = 'lead-invite' | 'supply-chain'

const TEST_RECIPIENT = 'test.recipient@example.com'
const TEST_NAME = 'Alex Thompson'

export default function TestEmailPreviewPage() {
  const [active, setActive] = useState<TemplateId>('lead-invite')
  const [recipientName, setRecipientName] = useState(TEST_NAME)
  const [recipientEmail, setRecipientEmail] = useState(TEST_RECIPIENT)

  const templates: Record<TemplateId, { subject: string; html: string }> = {
    'lead-invite': buildLeadInviteEmail({
      recipientName,
      recipientEmail,
    }),
    'supply-chain': buildSupplyChainEmail({
      recipientName,
      recipientEmail,
    }),
  }

  const { subject, html } = templates[active]

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-slate-900/80 backdrop-blur border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Mail className="w-5 h-5 text-blue-400" />
            <h1 className="text-lg font-semibold">邮件模板预览舱</h1>
            <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded-full">TEST ENV</span>
          </div>
          <Link href="/profile">
            <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
              <ArrowLeft className="w-4 h-4 mr-2" />返回
            </Button>
          </Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-3 gap-8">

          {/* Left panel — controls */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-5">
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">预览参数</h2>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">收件人姓名</label>
                <input
                  value={recipientName}
                  onChange={e => setRecipientName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">收件人邮箱</label>
                <input
                  value={recipientEmail}
                  onChange={e => setRecipientEmail(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-2 border-t border-slate-800">
                <label className="block text-xs font-medium text-slate-500 mb-3">选择模板</label>
                <div className="space-y-2">
                  {([
                    ['lead-invite', '📬 开发信邀请模板', 'LeadPilot 平台邀请·含功能介绍'],
                    ['supply-chain', '🔗 供应链合作模板', '外贸供应链合作·合作邀约'],
                  ] as [TemplateId, string, string][]).map(([id, title, desc]) => (
                    <button
                      key={id}
                      onClick={() => setActive(id)}
                      className={`w-full text-left rounded-xl p-3 border transition-all ${active === id
                          ? 'bg-blue-600/20 border-blue-500/50 text-white'
                          : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600'
                        }`}
                    >
                      <div className="text-sm font-medium">{title}</div>
                      <div className="text-xs mt-0.5 opacity-70">{desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800 space-y-3">
                <div>
                  <div className="text-xs font-medium text-slate-500 mb-1">邮件主题</div>
                  <div className="text-xs text-slate-300 bg-slate-800 rounded-lg px-3 py-2 break-all">{subject}</div>
                </div>
                <div>
                  <div className="text-xs font-medium text-slate-500 mb-1">Unsubscribe 链接</div>
                  <div className="text-xs text-emerald-400 bg-slate-800 rounded-lg px-3 py-2 break-all">
                    /api/unsubscribe?email={encodeURIComponent(recipientEmail)}
                  </div>
                </div>
              </div>
            </div>

            {/* Unsubscribe test */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">退订功能测试</h2>
              <a
                href={`/api/unsubscribe?email=${encodeURIComponent(recipientEmail)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" className="w-full border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10">
                  <Globe className="w-4 h-4 mr-2" />
                  模拟退订请求（新标签页打开）
                </Button>
              </a>
              <p className="text-xs text-slate-600 mt-3">点击后在浏览器新标签页中查看退订成功页面</p>
            </div>
          </motion.div>

          {/* Right panel — email render */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-2"
          >
            <div className="sticky top-24">
              {/* Preview header */}
              <div className="flex items-center gap-3 mb-4">
                <Eye className="w-4 h-4 text-slate-500" />
                <span className="text-sm text-slate-500">邮件渲染预览（桌面端）</span>
                <div className="flex-1 h-px bg-slate-800" />
                <span className="text-xs text-slate-600">仅供测试 · 请勿用于生产</span>
              </div>

              {/* Email iframe */}
              <div className="bg-white rounded-2xl overflow-hidden shadow-2xl border border-slate-800"
                style={{ minHeight: 600 }}
              >
                <iframe
                  srcDoc={`<!DOCTYPE html>${html.split('<!DOCTYPE html>')[1] ?? html}`}
                  title="Email Preview"
                  style={{ width: '100%', minHeight: 700, border: 'none', display: 'block' }}
                />
              </div>
            </div>
          </motion.div>

        </div>
      </div>
    </div>
  )
}
