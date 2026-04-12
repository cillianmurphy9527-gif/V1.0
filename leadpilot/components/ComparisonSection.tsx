"use client"

import React from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, XCircle, Zap, Target, Mail, Globe, TrendingUp, Users } from 'lucide-react'

// ═══════════════════════════════════════════════════════════════════
// 核心对比数据
// ═══════════════════════════════════════════════════════════════════

const COMPARISON_ITEMS = [
  {
    icon: Target,
    dimension: '目标挖掘',
    traditional: '人工搜索黄页，每天枯燥收集 50 家',
    leadpilot: '全域数据源无感刮取，每天轻松提纯 5000+ 家',
  },
  {
    icon: Zap,
    dimension: '内容生产',
    traditional: '单一模板盲目群发，极易被判垃圾邮件',
    leadpilot: 'AI 深度抓取官网痛点，千人千面，100% 独立撰写',
  },
  {
    icon: Globe,
    dimension: '发信基建',
    traditional: '单域名发信，封号即业务停摆',
    leadpilot: '多域名轮换发信矩阵，自动预热与频率熔断',
  },
  {
    icon: TrendingUp,
    dimension: '跟进转化',
    traditional: '建表格设闹钟手动跟进，线索易流失',
    leadpilot: 'AI 意图自动打标，7 步自动化跟进序列逼单',
  },
  {
    icon: Users,
    dimension: '运营成本',
    traditional: '至少需雇佣 1 名全职外贸业务员（¥8000+/月）',
    leadpilot: '每天仅需几块钱算力成本，等于一个 24 小时无休的销冠',
  },
]

// ═══════════════════════════════════════════════════════════════════
// 主组件
// ═══════════════════════════════════════════════════════════════════

export function ComparisonSection() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="py-20"
    >
      <div className="max-w-6xl mx-auto">
        {/* 标题 */}
        <div className="text-center mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-bold text-white mb-4"
          >
            告别低效外贸拓客
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-slate-400 text-lg md:text-xl"
          >
            LeadPilot 如何在每个环节碾压传统方式
          </motion.p>
        </div>

        {/* 双列对比 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 左侧：传统方式 */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="relative"
          >
            {/* 发光效果 */}
            <div className="absolute inset-0 bg-gradient-to-br from-slate-900/80 via-slate-900/90 to-slate-900/80 rounded-3xl blur-xl opacity-50" />

            <div className="relative h-full bg-slate-900/60 border border-slate-700/50 rounded-3xl overflow-hidden backdrop-blur-sm">
              {/* 头部 */}
              <div className="p-6 border-b border-slate-800/80 bg-gradient-to-r from-slate-800/30 to-transparent">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center shadow-lg">
                    <span className="text-2xl opacity-50">🔧</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-300">传统人工 / 传统工具</h3>
                    <p className="text-red-400/70 text-sm">低效、高成本、高风险</p>
                  </div>
                </div>
              </div>

              {/* 对比内容 */}
              <div className="p-6 space-y-4">
                {COMPARISON_ITEMS.map((item, idx) => (
                  <motion.div
                    key={`traditional-${idx}`}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: idx * 0.05 }}
                    className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/30"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <XCircle className="w-4 h-4 text-red-400/60" />
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{item.dimension}</span>
                    </div>
                    <p className="text-slate-500 text-sm leading-relaxed">{item.traditional}</p>
                  </motion.div>
                ))}
              </div>

              {/* 底部成本标签 */}
              <div className="p-6 pt-0">
                <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                      <span className="text-lg">💸</span>
                    </div>
                    <div>
                      <p className="text-red-400/80 text-sm font-semibold">每月固定成本</p>
                      <p className="text-red-300 text-lg font-bold">¥8000+</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* 右侧：LeadPilot */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="relative"
          >
            {/* 发光效果 */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-cyan-500/10 to-purple-600/10 rounded-3xl blur-xl" />

            <div className="relative h-full bg-gradient-to-br from-blue-950/40 via-slate-900/90 to-slate-900 border border-blue-500/30 rounded-3xl overflow-hidden shadow-2xl shadow-blue-500/10">
              {/* 头部 */}
              <div className="p-6 border-b border-blue-500/20 bg-gradient-to-r from-blue-600/10 to-transparent">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
                    <span className="text-2xl">⚡</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">LeadPilot AI 自动化</h3>
                    <p className="text-blue-400 text-sm">智能、高效、安全可靠</p>
                  </div>
                </div>
              </div>

              {/* 对比内容 */}
              <div className="p-6 space-y-4">
                {COMPARISON_ITEMS.map((item, idx) => {
                  const IconComponent = item.icon
                  return (
                    <motion.div
                      key={`leadpilot-${idx}`}
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: idx * 0.05 }}
                      className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20 hover:border-blue-400/40 transition-all"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">{item.dimension}</span>
                        <IconComponent className="w-3.5 h-3.5 text-blue-400/60 ml-auto" />
                      </div>
                      <p className="text-emerald-300 text-sm leading-relaxed font-medium">{item.leadpilot}</p>
                    </motion.div>
                  )
                })}
              </div>

              {/* 底部成本标签 */}
              <div className="p-6 pt-0">
                <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                      <span className="text-lg">✨</span>
                    </div>
                    <div>
                      <p className="text-emerald-400/80 text-sm font-semibold">每月固定成本</p>
                      <p className="text-emerald-300 text-lg font-bold">¥299 起</p>
                    </div>
                    <span className="ml-auto px-2 py-0.5 bg-emerald-500/20 rounded text-emerald-400 text-xs font-bold">
                      省 96%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* 底部 CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="text-center mt-12"
        >
          <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/20">
            <span className="text-blue-400 text-sm font-medium">
              立即体验 AI 自动化带来的效率飞跃 →
            </span>
          </div>
        </motion.div>
      </div>
    </motion.div>
  )
}
