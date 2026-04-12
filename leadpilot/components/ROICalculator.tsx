'use client'

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Calculator, TrendingUp, DollarSign, Mail, Zap } from 'lucide-react'

export function ROICalculator() {
  const [clientValue, setClientValue] = useState(5000)
  const [replyRate, setReplyRate] = useState(3)
  const [conversionRate, setConversionRate] = useState(20)

  const MONTHLY_EMAILS = 1000
  const PLAN_COST = 799
  const USD_TO_CNY = 7.2

  const results = useMemo(() => {
    const replies = Math.round(MONTHLY_EMAILS * (replyRate / 100))
    const inquiries = Math.round(replies * (conversionRate / 100))
    const revenueCNY = Math.round(inquiries * clientValue * USD_TO_CNY)
    const roi = PLAN_COST > 0 ? Math.round((revenueCNY - PLAN_COST) / PLAN_COST * 100) : 0
    const breakEven = clientValue > 0 ? Math.ceil(PLAN_COST / (clientValue * USD_TO_CNY)) : 0
    return { replies, inquiries, revenueCNY, roi, breakEven }
  }, [clientValue, replyRate, conversionRate])

  return (
    <section className="relative py-24 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-blue-950/30 to-slate-950" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-blue-500/8 blur-[120px] rounded-full pointer-events-none" />

      <div className="relative z-10 container mx-auto px-4 max-w-5xl">
        <motion.div initial={{ opacity:0, y:24 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }} className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-400 text-sm font-semibold mb-6">
            <Calculator className="w-4 h-4" />ROI 投资回报计算器
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">看看你能赚多少</h2>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">输入你的业务参数，实时预估每月通过 LeadPilot 带来的询盘价值与投资回报率</p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8 items-start">
          {/* 输入区 */}
          <motion.div initial={{ opacity:0, x:-24 }} whileInView={{ opacity:1, x:0 }} viewport={{ once:true }}
            className="bg-slate-900/80 backdrop-blur-xl border border-slate-700/60 rounded-3xl p-8">
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2"><Zap className="w-5 h-5 text-blue-400" />输入你的业务参数</h3>

            <div className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <label className="text-slate-300 text-sm font-medium flex items-center gap-1.5"><DollarSign className="w-4 h-4 text-emerald-400" />客单价（美元）</label>
                <span className="text-white font-bold text-lg">${clientValue.toLocaleString()}</span>
              </div>
              <input type="range" min="500" max="50000" step="500" value={clientValue} onChange={e => setClientValue(Number(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-full appearance-none cursor-pointer accent-emerald-400" />
              <div className="flex justify-between text-xs text-slate-600 mt-1"><span>$500</span><span>$50,000</span></div>
            </div>

            <div className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <label className="text-slate-300 text-sm font-medium flex items-center gap-1.5"><Mail className="w-4 h-4 text-blue-400" />预估邮件回复率</label>
                <span className="text-white font-bold text-lg">{replyRate}%</span>
              </div>
              <input type="range" min="1" max="20" step="0.5" value={replyRate} onChange={e => setReplyRate(Number(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-full appearance-none cursor-pointer accent-blue-400" />
              <div className="flex justify-between text-xs text-slate-600 mt-1"><span>1%</span><span className="text-blue-400 font-medium">行业均值 ~3%</span><span>20%</span></div>
            </div>

            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <label className="text-slate-300 text-sm font-medium flex items-center gap-1.5"><TrendingUp className="w-4 h-4 text-amber-400" />回复转询盘率</label>
                <span className="text-white font-bold text-lg">{conversionRate}%</span>
              </div>
              <input type="range" min="5" max="60" step="5" value={conversionRate} onChange={e => setConversionRate(Number(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-full appearance-none cursor-pointer accent-amber-400" />
              <div className="flex justify-between text-xs text-slate-600 mt-1"><span>5%</span><span>60%</span></div>
            </div>

            <div className="p-3 bg-slate-800/60 border border-slate-700/40 rounded-xl">
              <p className="text-xs text-slate-500">📌 固定参数：每月发送 <span className="text-slate-300 font-semibold">{MONTHLY_EMAILS.toLocaleString()} 封</span> · 平台费 <span className="text-slate-300 font-semibold">¥{PLAN_COST}/月</span> · 汇率 <span className="text-slate-300 font-semibold">¥{USD_TO_CNY}</span></p>
            </div>
          </motion.div>

          {/* 结果区 */}
          <motion.div initial={{ opacity:0, x:24 }} whileInView={{ opacity:1, x:0 }} viewport={{ once:true }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <motion.div key={results.replies} initial={{ scale:0.95 }} animate={{ scale:1 }} transition={{ type:'spring', stiffness:300 }}
                className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-5">
                <div className="text-3xl font-black text-blue-400 mb-1">{results.replies}</div>
                <div className="text-slate-400 text-xs font-medium">预估月回复数</div>
                <div className="text-slate-600 text-xs mt-1">{MONTHLY_EMAILS} 封 × {replyRate}%</div>
              </motion.div>
              <motion.div key={results.inquiries} initial={{ scale:0.95 }} animate={{ scale:1 }} transition={{ type:'spring', stiffness:300, delay:0.05 }}
                className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5">
                <div className="text-3xl font-black text-amber-400 mb-1">{results.inquiries}</div>
                <div className="text-slate-400 text-xs font-medium">预估月询盘数</div>
                <div className="text-slate-600 text-xs mt-1">回复 × {conversionRate}% 转化</div>
              </motion.div>
            </div>

            <motion.div key={results.roi} initial={{ scale:0.97 }} animate={{ scale:1 }} transition={{ type:'spring', stiffness:300, delay:0.1 }}
              className="relative overflow-hidden bg-gradient-to-br from-emerald-900/40 to-slate-900/80 border border-emerald-500/40 rounded-2xl p-6">
              <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/10 blur-3xl rounded-full" />
              <div className="relative">
                <div className="text-slate-400 text-sm mb-1">预估月度询盘价值</div>
                <div className="text-5xl font-black text-white mb-1">¥{results.revenueCNY.toLocaleString()}</div>
                <div className="text-slate-500 text-xs mb-4">= {results.inquiries} 个询盘 × ${clientValue.toLocaleString()}</div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-slate-700" /><span className="text-slate-500 text-xs">投资回报率</span><div className="flex-1 h-px bg-slate-700" />
                </div>
                <div className={`text-5xl font-black mt-3 ${results.roi >= 500 ? 'text-emerald-400' : results.roi >= 100 ? 'text-blue-400' : 'text-slate-300'}`}>
                  {results.roi > 0 ? `+${results.roi.toLocaleString()}%` : '0%'}
                </div>
                <p className="text-slate-500 text-xs mt-1">每成交 <span className="text-emerald-400 font-bold">{results.breakEven} 单</span> 即可回本平台费用</p>
              </div>
            </motion.div>

            <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl">
              <p className="text-slate-500 text-xs leading-relaxed">⚠️ 以上为预估数据。LeadPilot 用户平均回复率 <span className="text-blue-400 font-semibold">2.8%–6.5%</span>，高质量行业可达 <span className="text-emerald-400 font-semibold">12%+</span>。</p>
            </div>

            <a href="/register" className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl font-bold text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 shadow-xl shadow-blue-500/30 transition-all text-lg">
              免费试用，验证你的 ROI
            </a>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

