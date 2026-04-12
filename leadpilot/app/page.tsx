"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { motion } from "framer-motion"
import { useState } from "react"
import { Rocket, Sparkles, Shield, CheckCircle2, XCircle, LayoutDashboard } from "lucide-react"
import { PLANS } from "@/config/pricing"
import { useSession } from "next-auth/react"
import { ROICalculator } from "@/components/ROICalculator"
import { ComparisonSection } from "@/components/ComparisonSection"

// ─── 极简 ROI 计算器（内联，仅单笔客单价输入）──────────────────
function InlineROICalculator() {
  const [clientValue, setClientValue] = useState(5000)
  const MONTHLY_EMAILS = 1000
  const REPLY_RATE = 0.01
  const CLOSE_RATE = 0.5
  const PLAN_COST_USD = Math.round(799 / 7.2)

  const orders = Math.max(1, Math.round(MONTHLY_EMAILS * REPLY_RATE * CLOSE_RATE))
  const revenue = orders * clientValue
  const roi = Math.round((revenue - PLAN_COST_USD) / PLAN_COST_USD * 100)

  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="py-16 max-w-3xl mx-auto"
    >
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/15 via-cyan-500/10 to-purple-600/15 rounded-3xl blur-2xl" />
        <div className="relative bg-slate-900/90 border border-blue-500/20 rounded-3xl p-8 md:p-10 backdrop-blur-xl">
          {/* 标题 */}
          <div className="text-center mb-8">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-400 text-xs font-semibold mb-4">
              💰 ROI 投资回报计算器
            </span>
            <h3 className="text-2xl md:text-3xl font-bold text-white">你每月能多赚多少？</h3>
          </div>

          {/* 输入区 */}
          <div className="flex flex-col md:flex-row items-center gap-4 mb-8">
            <label className="text-slate-400 text-sm font-medium whitespace-nowrap">单笔成单利润（客单价）</label>
            <div className="relative flex-1 w-full">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg font-bold">$</span>
              <input
                type="number"
                min="100"
                step="100"
                value={clientValue}
                onChange={e => setClientValue(Math.max(100, Number(e.target.value) || 100))}
                className="w-full pl-8 pr-4 py-3.5 bg-slate-800/80 border border-slate-600 rounded-xl text-white text-xl font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          {/* 结论展示 */}
          <motion.div
            key={clientValue}
            initial={{ opacity: 0.6, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="bg-slate-950/60 border border-slate-700/60 rounded-2xl p-6 space-y-3"
          >
            <p className="text-slate-400 text-sm leading-relaxed">
              使用 LeadPilot 增长版，每月全自动发送<span className="text-white font-bold"> {MONTHLY_EMAILS.toLocaleString()} 封</span>精准开发信。<br />
              按行业保守<span className="text-white font-bold"> 1% 意向回复、0.5% 成交率</span>计算：
            </p>

            <div className="flex flex-col md:flex-row items-center md:items-end justify-between gap-4 pt-2">
              <div>
                <p className="text-slate-500 text-xs mb-1">每月预计新增订单</p>
                <p className="text-5xl font-black text-white">{orders} <span className="text-2xl text-slate-400 font-normal">单</span></p>
              </div>
              <div className="hidden md:block h-16 w-px bg-slate-700" />
              <div>
                <p className="text-slate-500 text-xs mb-1">预计带来额外营收</p>
                <p className="text-5xl font-black text-emerald-400">${revenue.toLocaleString()}</p>
              </div>
              <div className="hidden md:block h-16 w-px bg-slate-700" />
              <div>
                <p className="text-slate-500 text-xs mb-1">投资回报率 (ROI)</p>
                <p className="text-5xl font-black text-blue-400">+{roi.toLocaleString()}%</p>
              </div>
            </div>
          </motion.div>

          <p className="text-slate-600 text-xs text-center mt-4">* 基于行业平均数据的保守估算，实际结果因行业与话术质量而异</p>
        </div>
      </div>
    </motion.div>
  )
}

const fadeInUp = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6 }
}

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.1 } }
}

// ─── 静态定价卡片（固定月付，无周期切换）─────────────────────────
function StaticPricingCards() {
  return (
    <div className="grid md:grid-cols-3 gap-8 max-w-7xl mx-auto items-center">
      {PLANS.map((plan, idx) => {
        const isFeatured = plan.badge === '主推'
        return (
          <motion.div
            key={plan.id}
            initial={{ opacity: 0, y: isFeatured ? 20 : 0, x: idx === 0 ? -20 : idx === 2 ? 20 : 0 }}
            whileInView={{ opacity: 1, y: 0, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: idx * 0.1 }}
            whileHover={{ y: isFeatured ? -8 : -4, scale: isFeatured ? 1.02 : 1 }}
            className={`relative ${isFeatured ? 'md:scale-105' : ''}`}
          >
            {isFeatured && (
              <div className="absolute -top-5 left-1/2 -translate-x-1/2 z-10">
                <div className="bg-gradient-to-r from-yellow-400 to-orange-400 text-slate-900 px-6 py-2 rounded-full text-sm font-bold shadow-lg flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />{plan.badge}
                </div>
              </div>
            )}
            {isFeatured && <div className="absolute inset-0 bg-gradient-to-br from-blue-500/30 via-cyan-500/30 to-blue-600/30 rounded-3xl blur-2xl" />}
            <div className={`relative h-full rounded-3xl border backdrop-blur-xl transition-all duration-300 ${
              isFeatured
                ? 'bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 border-2 border-blue-400/50 shadow-2xl shadow-blue-500/20 p-10'
                : plan.id === 'MAX'
                  ? 'bg-slate-900/50 border-white/10 hover:border-amber-500/30 p-8'
                  : 'bg-slate-900/50 border-white/10 hover:border-white/20 p-8'
            }`}>
              {isFeatured && <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent rounded-3xl" />}
              <div className="relative mb-6">
                <h3 className={`font-bold text-white mb-1 ${isFeatured ? 'text-3xl' : 'text-2xl'}`}>{plan.name}</h3>
                <p className={`text-xs font-bold mb-1 ${isFeatured ? 'text-blue-300' : plan.id === 'MAX' ? 'text-amber-400' : 'text-emerald-400'}`}>✦ {plan.coreOutcome}</p>
                <p className={`text-sm ${isFeatured ? 'text-blue-300/70' : 'text-slate-500'}`}>{plan.subtitle}</p>
              </div>
              <div className="relative mb-8">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className={`font-bold ${isFeatured ? 'text-6xl bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent' : 'text-5xl text-white'}`}>
                    ¥{plan.price}
                  </span>
                  <span className={isFeatured ? 'text-blue-300' : 'text-slate-400'}>/月</span>
                </div>
              </div>
              <ul className="relative space-y-3 mb-8">
                {plan.features.map(f => (
                  <li key={f.label} className={`flex items-start gap-3 ${f.locked ? 'text-slate-500' : 'text-slate-300'}`}>
                    {f.locked
                      ? <XCircle className="w-5 h-5 text-slate-600 mt-0.5 flex-shrink-0" />
                      : <CheckCircle2 className={`w-5 h-5 mt-0.5 flex-shrink-0 ${isFeatured ? 'text-blue-400' : plan.id === 'MAX' ? 'text-amber-400' : 'text-emerald-400'}`} />
                    }
                    <span className={f.locked ? 'line-through' : ''}>
                      <span className="text-white font-bold">{f.label}：</span>{f.value}
                    </span>
                  </li>
                ))}
              </ul>
              <Link href={`/register?plan=${plan.id}`}>
                <button className={`w-full py-4 rounded-xl font-bold text-white transition-all shadow-lg ${
                  isFeatured
                    ? 'bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 shadow-blue-500/30'
                    : plan.id === 'MAX'
                      ? 'bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-500 hover:to-orange-400 shadow-amber-500/20'
                      : 'bg-slate-700 hover:bg-slate-600'
                }`}>
                  {plan.ctaText}
                </button>
              </Link>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}

// ─── 预期使用效果模块 ─────────────────────────────────────────────
function OutcomesSection() {
  const outcomes = [
    {
      value: '+300%', label: '询盘转化率',
      desc: 'AI 精准锁定高意向买家，每封邮件都命中痛点，告别广撒网',
      gradient: 'from-blue-500 to-cyan-400', glow: 'shadow-blue-500/20', border: 'border-blue-500/30', icon: '📈',
    },
    {
      value: '节省 90%', label: '人工时间',
      desc: '从找客户、写邮件到跟进管理，全流程自动化，解放你的双手',
      gradient: 'from-emerald-500 to-green-400', glow: 'shadow-emerald-500/20', border: 'border-emerald-500/30', icon: '⚡',
    },
    {
      value: '极低封号', label: '护航出海',
      desc: '10 域名矩阵轮换预热，进箱率稳定 >95%，永不因封号中断业务',
      gradient: 'from-purple-500 to-pink-400', glow: 'shadow-purple-500/20', border: 'border-purple-500/30', icon: '🛡️',
    },
    {
      value: '10–50x', label: '平均 ROI',
      desc: '月均成本 ¥299 起，已有数百家出海企业实现超高回报比',
      gradient: 'from-amber-500 to-orange-400', glow: 'shadow-amber-500/20', border: 'border-amber-500/30', icon: '🚀',
    },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="py-20 max-w-7xl mx-auto"
    >
      <div className="text-center mb-14">
        <h2 className="text-4xl font-bold text-white mb-4">使用 LeadPilot 能为您带来什么？</h2>
        <p className="text-slate-400 text-lg">数据驱动，真实案例，有据可查</p>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        {outcomes.map((item, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: idx * 0.1 }}
            whileHover={{ y: -6, scale: 1.03 }}
            className={`relative rounded-2xl bg-slate-900/70 border ${item.border} p-8 shadow-xl ${item.glow} transition-all duration-300 overflow-hidden`}
          >
            <div className={`absolute -top-8 -right-8 w-32 h-32 rounded-full bg-gradient-to-br ${item.gradient} opacity-10 blur-2xl`} />
            <div className="text-3xl mb-4">{item.icon}</div>
            <div className={`text-4xl font-black mb-1 bg-gradient-to-r ${item.gradient} bg-clip-text text-transparent leading-tight`}>
              {item.value}
            </div>
            <div className="text-lg font-bold text-white mb-3">{item.label}</div>
            <p className="text-slate-400 text-sm leading-relaxed">{item.desc}</p>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}

export default function MarketingPage() {
  const { data: session } = useSession()
  const isLoggedIn = !!session?.user
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)]" />
        <div className="absolute inset-0 bg-gradient-to-t from-blue-900/20 via-transparent to-transparent" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-blue-500/10 blur-[120px] rounded-full" />
      </div>

      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b border-white/5 backdrop-blur-xl bg-slate-950/80">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="text-2xl font-bold text-white flex items-center gap-2">
            <img src="/logo.png" alt="LeadPilot" className="w-10 h-10" />
            LeadPilot
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-x-4">
            {isLoggedIn ? (
              <Link href="/dashboard">
                <Button className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 shadow-lg shadow-blue-500/20">
                  <LayoutDashboard className="w-4 h-4 mr-2" />进入指挥中心
                </Button>
              </Link>
            ) : (
              <>
                <Link href="/login"><Button variant="ghost" className="text-white hover:text-white/80 hover:bg-white/5">登录</Button></Link>
                <Link href="/register"><Button className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 shadow-lg shadow-blue-500/20">开始使用</Button></Link>
              </>
            )}
          </motion.div>
        </div>
      </nav>

      <main className="relative z-10 container mx-auto px-4">

        {/* ── Hero ──────────────────────────────────────────────── */}
        <motion.div className="text-center max-w-5xl mx-auto pt-20 pb-16" initial="initial" animate="animate" variants={staggerContainer}>
          <motion.div variants={fadeInUp} className="inline-block mb-6">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-sm font-medium">
              <Sparkles className="w-4 h-4" />AI 驱动的智能外贸营销
            </span>
          </motion.div>

          <motion.h1 variants={fadeInUp} className="text-5xl md:text-6xl lg:text-7xl font-extrabold text-white tracking-tight text-balance mx-auto max-w-5xl leading-tight mb-6">
            LeadPilot：由AI Agent重新定义全球获客
          </motion.h1>

          <motion.p variants={fadeInUp} className="text-lg md:text-xl text-slate-400 mt-6 mb-12 mx-auto max-w-2xl text-center leading-relaxed font-medium">
            告别人工找客户 开启出海新时代
            <br className="hidden md:block" />
            让业务员 只负责成交
          </motion.p>

          {/* CTA 区域：促单徽章紧贴按钮上方 */}
          <motion.div variants={fadeInUp} className="flex flex-col items-center gap-3">
            <div className="relative inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500/15 via-green-500/10 to-emerald-500/15 border border-emerald-400/40 shadow-md shadow-emerald-500/10">
              <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-emerald-500/5 to-green-500/5 animate-pulse" />
              <span className="text-lg">🎁</span>
              <span className="relative text-emerald-300 font-semibold text-sm">
                立即加入，尊享 <span className="text-white font-bold">7 天全功能免费试用</span>（赠送 <span className="text-emerald-400 font-bold">50,000 AI 算力</span>）
              </span>
            </div>
            <Link href="/register">
              <Button size="lg" className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-lg px-10 py-7 shadow-2xl shadow-blue-500/30 hover:shadow-blue-500/50 transition-all duration-300">
                <Rocket className="w-5 h-5 mr-2" />开通专属算力
              </Button>
            </Link>

          </motion.div>
        </motion.div>

        {/* ── ROI 计算器（极简内联版）────────────────────────────── */}
        <InlineROICalculator />

        {/* ── 价格套餐 ──────────────────────────────────────────── */}
        <motion.div id="pricing" className="py-20" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}>
          <div className="text-center mb-12">
            <h2 className="text-5xl font-bold text-white mb-4">按阶段选择，按结果付费</h2>
            <p className="text-slate-400 text-lg">三个成长阶段，每个阶段都有明确的核心成果</p>
            <p className="text-slate-500 text-sm mt-2">新手团队建议直接从「增长版」起步，7 天内即可看到可量化回复数据</p>
          </div>
          <StaticPricingCards />
          <div className="text-center mt-12">
            <p className="text-slate-500 text-sm">
              <Shield className="w-4 h-4 inline mr-2" />
              企业级数据安全 · 符合 GDPR 标准 · 7×24 技术支持
            </p>
          </div>
        </motion.div>

        {/* ── 核心工作流 ────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="py-20 max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-4xl font-bold text-white mb-4">核心工作流</h2>
            <p className="text-slate-400 text-lg">四步全自动闭环，从挖掘到成交</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative">
            {[
              { step: '01', icon: '🛃', title: '合规海关数据抓取', desc: '基于全球真实贸易数据，精准定位有采购记录的高意向买家，完全合规、无封号风险。', color: 'from-blue-600 to-blue-500', border: 'border-blue-500/30', glow: 'shadow-blue-500/20' },
              { step: '02', icon: '🤖', title: 'AI 深度意图定开', desc: 'AI 分析客户官网、产品线和近期动态，生成母语级个性化开发信，回复率提升 10 倍。', color: 'from-cyan-600 to-cyan-500', border: 'border-cyan-500/30', glow: 'shadow-cyan-500/20' },
              { step: '03', icon: '📨', title: '独立域名矩阵高送达', desc: '多域名预热轮换发送，绕过垃圾邮件过滤，确保进箱率 >95%，全程透明溯源。', color: 'from-emerald-600 to-emerald-500', border: 'border-emerald-500/30', glow: 'shadow-emerald-500/20' },
              { step: '04', icon: '📥', title: '统一收件箱智能转化', desc: '所有客户回复自动汇聚一处，AI 智能分析客户意向并一键生成多语种跟进话术，轻松拿下海外大单。', color: 'from-purple-600 to-purple-500', border: 'border-purple-500/30', glow: 'shadow-purple-500/20' },
            ].map((item, idx) => (
              <motion.div key={idx} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: idx * 0.12 }}
                className={`relative z-10 bg-slate-900/80 border ${item.border} rounded-2xl p-8 shadow-xl ${item.glow} hover:scale-105 transition-all duration-300`}>
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center text-white font-black text-lg mb-4 shadow-lg`}>{item.step}</div>
                <div className="text-3xl mb-3">{item.icon}</div>
                <h3 className="text-xl font-bold text-white mb-3">{item.title}</h3>
                <p className="text-slate-400 leading-relaxed text-sm">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* ── 为什么选择 LeadPilot（6宫格）────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="py-20">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-4xl font-bold text-white text-center mb-16">为什么选择 LeadPilot？</h2>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                { icon: '🎯', title: '精准定位', desc: 'AI 深度分析客户网站，精准识别高意向客户，避免无效投放' },
                { icon: '🚀', title: '极速发送', desc: '日发 20000+ 封邮件，多域名轮换防封，确保进箱率' },
                { icon: '🌍', title: '多语言支持', desc: '40+ 语言自动生成，母语级别开发信，提升回复率' },
                { icon: '📊', title: '实时监控', desc: '完整的数据看板，实时追踪发送、打开、回复等关键指标' },
                { icon: '💬', title: '统一收件箱', desc: '所有客户回复汇聚一处，AI 自动分类，高效管理询盘' },
                { icon: '🔒', title: '企业级安全', desc: '符合 GDPR 标准，数据加密存储，7×24 技术支持' },
              ].map((feature, idx) => (
                <motion.div key={idx} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: idx * 0.1 }}
                  className="bg-slate-900/50 border border-white/10 rounded-2xl p-8 hover:border-blue-500/30 transition-all duration-300">
                  <div className="text-4xl mb-4">{feature.icon}</div>
                  <h3 className="text-xl font-bold text-white mb-3">{feature.title}</h3>
                  <p className="text-slate-400">{feature.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* ── LeadPilot vs 传统方式对比（新版独立组件）──────────────── */}
        <ComparisonSection />

        {/* ── 预期使用效果 ──────────────────────────────────────── */}
        <OutcomesSection />

        {/* ── 真实客户反馈（单列宽版）─────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="py-20">
          <h2 className="text-4xl font-bold text-white text-center mb-4">真实客户反馈</h2>
          <p className="text-slate-400 text-center mb-12">看看他们如何用 LeadPilot 实现业绩突破</p>
          <div className="max-w-4xl mx-auto flex flex-col gap-6 px-4">
            {[
              { name: "张总", role: "深圳 3C 电子厂创始人", avatar: "https://api.dicebear.com/7.x/initials/svg?seed=张&backgroundColor=0284c7&textColor=ffffff", content: "以前用企业邮箱群发，稍微发多一点就被封，整天跟网管扯皮。用了你们的多域名轮换，上个月发了5万封，稳如老狗。询盘虽然不是天天爆，但起码不断档了，这就够了。" },
              { name: "李经理", role: "宁波汽配 SOHO", avatar: "https://api.dicebear.com/7.x/initials/svg?seed=李&backgroundColor=059669&textColor=ffffff", content: "我是个纯SOHO，最缺的就是时间。现在每天睡前建好任务，第二天起来收件箱里就有几封带回复的邮件。AI 给的回复建议也挺地道，帮我省了查词典和琢磨语气的精力。" },
              { name: "王总监", role: "广州机械设备出口部", avatar: "https://api.dicebear.com/7.x/initials/svg?seed=王&backgroundColor=ea580c&textColor=ffffff", content: "说实话，刚开始不信 AI 能懂我们的机械参数。结果它爬了我们的英文官网和图册后，写出来的邮件比我招的英语专八应届生还专业。现在两个老业务员专心跟进它筛出来的意向客户，效率拉满了。" },
              { name: "陈老板", role: "义乌小商品工贸一体", avatar: "https://api.dicebear.com/7.x/initials/svg?seed=陈&backgroundColor=4f46e5&textColor=ffffff", content: "今年招人太难了，招来稍微教个半年就跑路。索性试了试 LeadPilot，本来也就是当个辅助工具，没想到它自动搜客户和发信的节奏控制得很稳。现在它就是我们公司的最佳『打工人』，从不请假。" },
              { name: "刘主管", role: "青岛五金工具外贸", avatar: "https://api.dicebear.com/7.x/initials/svg?seed=刘&backgroundColor=be123c&textColor=ffffff", content: "我们十几个域名，以前切来切去看回复能把人逼疯。现在全部统一到一个收件箱，还能让 AI 按客户意向打标签，终于不用在垃圾堆里找金子了。早点出这种工具就好了。" },
              { name: "赵合伙人", role: "东莞 LED 照明企业", avatar: "https://api.dicebear.com/7.x/initials/svg?seed=赵&backgroundColor=0284c7&textColor=ffffff", content: "做定制类产品的最怕群发模板，一发就死。这个系统最牛逼的是 RAG，能针对客户网站的特点自动改动开发信内容，千人千面。上周刚拿下一个德国老客户的打样费，就是靠 AI 抓住了他官网上提到的一个环保痛点。" },
              { name: "孙经理", role: "杭州纺织面料 B2B", avatar: "https://api.dicebear.com/7.x/initials/svg?seed=孙&backgroundColor=b45309&textColor=ffffff", content: "之前老是进垃圾箱，自己摸索买域名做 SPF/DKIM 配置头都大了。LeadPilot 把这些全包了，域名池管理简直是小白福音。上个月的有效送达率基本保持在 95% 以上。" },
              { name: "林女士", role: "厦门卫浴外贸大卖", avatar: "https://api.dicebear.com/7.x/initials/svg?seed=林&backgroundColor=0f766e&textColor=ffffff", content: "外贸工具买了一堆，能真正跑通『搜集-发信-防封-跟进』全链路的就这一个。最直观的改变是，团队现在不抱怨找不到精准客户了，精力全放在了报价和开视频会议上。" },
            ].map((t, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.06 }}
                className="flex flex-col md:flex-row gap-6 bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 hover:border-slate-700 transition-colors items-start"
              >
                {/* 左侧：头像 + 姓名 + 职位 */}
                <div className="flex flex-row md:flex-col items-center md:items-start gap-4 md:gap-3 md:w-36 flex-shrink-0">
                  <img
                    src={t.avatar}
                    alt={t.name}
                    className="w-14 h-14 rounded-full border border-slate-700 object-cover flex-shrink-0"
                  />
                  <div>
                    <p className="text-white font-semibold text-sm">{t.name}</p>
                    <p className="text-slate-500 text-xs mt-0.5 leading-snug">{t.role}</p>
                  </div>
                </div>
                {/* 右侧：星星 + 评价正文 */}
                <div className="flex-1 min-w-0">
                  <div className="flex gap-0.5 mb-3">
                    {[...Array(5)].map((_, i) => (
                      <span key={i} className="text-yellow-500 text-base">★</span>
                    ))}
                  </div>
                  <p className="text-slate-300 text-base md:text-lg leading-relaxed italic">&ldquo;{t.content}&rdquo;</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* ── 底部 CTA ─────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center py-20 mb-20">
          <div className="relative max-w-4xl mx-auto">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-3xl blur-3xl" />
            <div className="relative bg-gradient-to-br from-slate-900/90 to-slate-800/90 backdrop-blur-xl border border-white/10 rounded-3xl p-12">
              <h2 className="text-4xl font-bold text-white mb-4">准备好提升外贸效率了吗？</h2>
              <p className="text-slate-400 text-lg mb-8">加入数百家外贸企业，让 AI 为你筛选高意向客户</p>
              <Link href="/register">
                <Button size="lg" className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-lg px-12 py-7 shadow-2xl shadow-blue-500/30">
                  <Rocket className="w-5 h-5 mr-2" />立即开通专属算力
                </Button>
              </Link>
            </div>
          </div>
        </motion.div>

      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 py-12 backdrop-blur-xl">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2 text-slate-400">
              <img src="/logo.png" alt="LeadPilot" className="w-5 h-5" />
              <span className="font-semibold text-white">LeadPilot</span>
              <span className="text-slate-600 mx-2">·</span>
              <span className="text-sm">AI 驱动的外贸营销自动化平台</span>
            </div>
            <div className="flex items-center gap-6 text-slate-500 text-sm">
              <Link href="/terms" className="hover:text-slate-300 transition-colors">用户协议</Link>
              <Link href="/privacy" className="hover:text-slate-300 transition-colors">隐私政策</Link>
              <Link href="/refund-policy" className="hover:text-slate-300 transition-colors">退款政策</Link>
              <span>© 2026 LeadPilot. All rights reserved.</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
} 
