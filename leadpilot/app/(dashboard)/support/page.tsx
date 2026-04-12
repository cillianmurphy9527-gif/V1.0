"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Clock, Mail, Phone, TrendingUp, HelpCircle, MessageCircle, ChevronDown, Zap, Shield, HeadphonesIcon, Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FAQ_CATEGORIES, ALL_FAQ_ITEMS } from "@/lib/faqData"

const SLA = [
  { pri:'账单 / 权益异常', time:'2 小时内', color:'text-red-400',    bar:'from-red-500 to-orange-500',    pct:95 },
  { pri:'功能异常 / Bug',  time:'4 小时内', color:'text-amber-400',  bar:'from-amber-500 to-yellow-400',  pct:80 },
  { pri:'普通咨询',        time:'24 小时内',color:'text-blue-400',   bar:'from-blue-500 to-cyan-400',     pct:50 },
  { pri:'功能建议',        time:'72 小时内',color:'text-slate-400',  bar:'from-slate-500 to-slate-400',   pct:25 },
]

export default function SupportPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [openModalFaq, setOpenModalFaq] = useState<number | null>(null)

  // 搜索过滤逻辑
  const filteredFAQ = ALL_FAQ_ITEMS.filter(faq => {
    if (!searchQuery.trim()) return true
    const query = searchQuery.toLowerCase()
    return (
      faq.q.toLowerCase().includes(query) ||
      faq.a.toLowerCase().includes(query) ||
      faq.tags.some(tag => tag.toLowerCase().includes(query))
    )
  })

  // 高亮搜索关键词
  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text
    const parts = text.split(new RegExp(`(${query})`, 'gi'))
    return parts.map((part, i) => 
      part.toLowerCase() === query.toLowerCase() 
        ? <mark key={i} className="bg-yellow-400/30 text-yellow-200 px-1 rounded">{part}</mark>
        : part
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="container mx-auto px-6 py-12 max-w-6xl">

        {/* 页头 */}
        <motion.div initial={{ opacity:0, y:-20 }} animate={{ opacity:1, y:0 }} className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium mb-6">
            <HeadphonesIcon className="w-4 h-4" />帮助与支持中心
          </div>
          <h1 className="text-5xl font-bold text-white mb-4 tracking-tight">我们随时在线</h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">专业的客服团队与 AI 系统全天候守护您的业务，遇到任何问题点击右下角客服按钮即可发起实时对话。</p>
        </motion.div>

        {/* 三大模块 Grid */}
        <div className="grid lg:grid-cols-3 gap-8 mb-12">

          {/* SLA 响应承诺 */}
          <motion.div initial={{ opacity:0, y:24 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.1 }}
            className="lg:col-span-1 relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/60 p-7"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl" />
            <div className="relative">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-2xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-blue-400" />
                </div>
                <div><h2 className="text-lg font-bold text-white">响应承诺</h2><p className="text-xs text-slate-500">SLA 服务级别协议</p></div>
              </div>
              <div className="space-y-5">
                {SLA.map((s,i) => (
                  <motion.div key={s.pri} initial={{ opacity:0,x:-16 }} animate={{ opacity:1,x:0 }} transition={{ delay:0.2+i*0.08 }}>
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-sm text-slate-300">{s.pri}</span>
                      <span className={`text-sm font-bold ${s.color}`}>{s.time}</span>
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <motion.div initial={{ width:0 }} animate={{ width:`${s.pct}%` }} transition={{ delay:0.4+i*0.1, duration:0.8, ease:'easeOut' }}
                        className={`h-full rounded-full bg-gradient-to-r ${s.bar}`}
                      />
                    </div>
                  </motion.div>
                ))}
              </div>
              <div className="mt-6 pt-5 border-t border-slate-800 flex items-center gap-2 text-xs text-slate-500">
                <Shield className="w-3.5 h-3.5 text-emerald-400" /><span>月度可用率承诺 ≥ 99.5%</span>
              </div>
            </div>
          </motion.div>

          {/* FAQ 分类折叠面板 */}
          <motion.div initial={{ opacity:0, y:24 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.15 }}
            className="lg:col-span-1 relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/60 p-7"
          >
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl" />
            <div className="relative">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
                  <HelpCircle className="w-5 h-5 text-purple-400" />
                </div>
                <div><h2 className="text-lg font-bold text-white">常见问题</h2><p className="text-xs text-slate-500">快速自助答案</p></div>
              </div>
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setOpenFaq(null) }}
                  placeholder="搜索关键词，如「退款」「算力」…"
                  className="w-full pl-10 pr-9 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50" />
                {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="w-4 h-4 text-slate-500 hover:text-white" /></button>}
              </div>
              {searchQuery.trim() ? (
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {filteredFAQ.length === 0 ? (
                    <div className="text-center py-10 text-slate-500">
                      <HelpCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">未找到相关问题</p>
                    </div>
                  ) : filteredFAQ.map((f, i) => (
                    <div key={i} className="border border-slate-700 rounded-xl overflow-hidden">
                      <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-800/50 transition-all">
                        <span className="text-sm font-medium text-white pr-2 leading-snug">{highlightText(f.q, searchQuery)}</span>
                        <motion.span animate={{ rotate: openFaq===i?180:0 }} transition={{ duration:0.2 }}>
                          <ChevronDown className="w-4 h-4 text-slate-500 flex-shrink-0" />
                        </motion.span>
                      </button>
                      <AnimatePresence>
                        {openFaq===i && (
                          <motion.div initial={{ height:0,opacity:0 }} animate={{ height:'auto',opacity:1 }} exit={{ height:0,opacity:0 }} className="overflow-hidden">
                            <p className="px-4 pb-4 pt-1 text-sm text-slate-400 leading-relaxed">{highlightText(f.a, searchQuery)}</p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {FAQ_CATEGORIES.map((cat, ci) => (
                    <div key={cat.id}>
                      <button onClick={() => setOpenFaq(openFaq === ci ? null : ci)}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-left transition-all ${
                          openFaq === ci ? 'bg-slate-800 border border-slate-600' : 'bg-slate-800/40 border border-slate-800 hover:bg-slate-800/70'
                        }`}>
                        <div className="flex items-center gap-2">
                          <span className="text-base">{cat.icon}</span>
                          <span className={`text-sm font-bold ${cat.color}`}>{cat.label}</span>
                          <span className="text-[10px] bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded-full">{cat.items.length}</span>
                        </div>
                        <motion.span animate={{ rotate: openFaq===ci?180:0 }} transition={{ duration:0.2 }}>
                          <ChevronDown className="w-4 h-4 text-slate-500" />
                        </motion.span>
                      </button>
                      <AnimatePresence>
                        {openFaq===ci && (
                          <motion.div initial={{ height:0,opacity:0 }} animate={{ height:'auto',opacity:1 }} exit={{ height:0,opacity:0 }} className="overflow-hidden">
                            <div className="mt-1 space-y-1 pl-2">
                              {cat.items.map((f, fi) => (
                                <div key={fi} className="border border-slate-800 rounded-xl overflow-hidden">
                                  <button onClick={() => setOpenModalFaq(openModalFaq === fi + ci*100 ? null : fi + ci*100)}
                                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-800/50 transition-all">
                                    <span className="text-sm text-white pr-2 leading-snug">{f.q}</span>
                                    <motion.span animate={{ rotate: openModalFaq===fi+ci*100?180:0 }} transition={{ duration:0.2 }}>
                                      <ChevronDown className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
                                    </motion.span>
                                  </button>
                                  <AnimatePresence>
                                    {openModalFaq===fi+ci*100 && (
                                      <motion.div initial={{ height:0,opacity:0 }} animate={{ height:'auto',opacity:1 }} exit={{ height:0,opacity:0 }} className="overflow-hidden">
                                        <p className="px-4 pb-4 pt-1 text-sm text-slate-400 leading-relaxed">{f.a}</p>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>

          {/* 联系我们 */}
          <motion.div initial={{ opacity:0, y:24 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.2 }}
            className="lg:col-span-1 relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/60 p-7"
          >
            <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/5 rounded-full blur-3xl" />
            <div className="relative">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                  <MessageCircle className="w-5 h-5 text-emerald-400" />
                </div>
                <div><h2 className="text-lg font-bold text-white">联系我们</h2><p className="text-xs text-slate-500">多渠道直达支持团队</p></div>
              </div>
              <div className="space-y-3">
                <a href="mailto:support@leadpilot.cn"
                  className="flex items-center gap-4 p-4 bg-slate-800/60 rounded-2xl border border-slate-700 hover:border-blue-500/40 hover:bg-slate-800 transition-all group">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0"><Mail className="w-5 h-5 text-blue-400" /></div>
                  <div><p className="text-xs text-slate-500 mb-0.5">官方支持邮箱</p><p className="text-sm font-semibold text-white group-hover:text-blue-400 transition-colors">support@leadpilot.cn</p></div>
                </a>
                <div className="flex items-center gap-4 p-4 bg-slate-800/60 rounded-2xl border border-slate-700">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0"><Phone className="w-5 h-5 text-emerald-400" /></div>
                  <div><p className="text-xs text-slate-500 mb-0.5">商务合作热线</p><p className="text-sm font-semibold text-slate-300">+86 400-xxx-xxxx</p><p className="text-xs text-slate-600">工作日 09:00–18:00</p></div>
                </div>
                <div className="flex items-center gap-4 p-4 bg-slate-800/60 rounded-2xl border border-slate-700">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center flex-shrink-0"><TrendingUp className="w-5 h-5 text-purple-400" /></div>
                  <div><p className="text-xs text-slate-500 mb-0.5">平均首次响应</p><p className="text-sm font-bold text-emerald-400">{'< 47 分钟'}</p></div>
                </div>
                <div className="mt-4 p-4 bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-2xl text-center">
                  <p className="text-sm text-slate-300 mb-1">需要实时帮助？</p>
                  <p className="text-xs text-slate-500">点击右下角客服按钮，发起实时对话</p>
                  <div className="mt-3 flex justify-center">
                    <motion.div animate={{ scale:[1,1.08,1] }} transition={{ duration:2, repeat:Infinity }}
                      className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/30"
                    >
                      <MessageCircle className="w-6 h-6 text-white" />
                    </motion.div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* 底部统计条 */}
        <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.5 }}
          className="grid grid-cols-3 gap-6"
        >
          {[
            { icon: Zap,          val:'99.5%', label:'月度可用率',     color:'text-yellow-400' },
            { icon: TrendingUp,   val:'{'+'<'+'} 47min',  label:'平均首次响应', color:'text-emerald-400' },
            { icon: Shield,       val:'24/7',  label:'AI 全天守护',   color:'text-blue-400' },
          ].map((s,i) => (
            <motion.div key={s.label} initial={{ opacity:0,y:16 }} animate={{ opacity:1,y:0 }} transition={{ delay:0.5+i*0.1 }}
              className="flex flex-col items-center p-6 rounded-2xl bg-slate-900/40 border border-slate-800"
            >
              <s.icon className={`w-6 h-6 mb-2 ${s.color}`} />
              <p className={`text-2xl font-bold ${s.color}`}>{s.val}</p>
              <p className="text-sm text-slate-500 mt-1">{s.label}</p>
            </motion.div>
          ))}
        </motion.div>

      </div>

    </div>
  )
}
