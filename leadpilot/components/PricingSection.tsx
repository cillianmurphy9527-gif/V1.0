"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Shield } from "lucide-react"
import { PricingCards } from "@/components/billing/PricingCards"
import Link from "next/link"

type BillingCycle = 'monthly' | 'quarterly' | 'yearly'

export function PricingSection() {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly')

  const billingOptions = [
    { id: 'monthly' as const, label: '按月', description: '随时取消' },
    { id: 'quarterly' as const, label: '按季', description: '省 15%', badge: true },
    { id: 'yearly' as const, label: '按年', description: '省 30%', badge: true }
  ]

  const handleSelectPlan = (planId: string) => {
    // 跳转到注册页面
    window.location.href = `/register?plan=${planId}&cycle=${billingCycle}`
  }

  return (
    <div className="text-center mb-16">
      <motion.h2 
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-5xl font-bold text-white mb-4"
      >
        按阶段选择，按结果付费
      </motion.h2>
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.1 }}
        className="text-slate-400 text-lg mb-2"
      >
        三个成长阶段，每个阶段都有明确的核心成果
      </motion.p>
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.15 }}
        className="text-slate-500 text-sm mb-8"
      >
        新手团队建议直接从「增长版」起步，7 天内即可看到可量化的回复数据
      </motion.p>

      {/* 计费周期切换器 */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.2 }}
        className="inline-flex items-center gap-2 p-1.5 bg-gradient-to-r from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-full backdrop-blur-sm mb-12"
      >
        {billingOptions.map(option => (
          <motion.button
            key={option.id}
            onClick={() => setBillingCycle(option.id)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`relative px-6 py-2.5 rounded-full text-sm font-semibold transition-all duration-300 ${
              billingCycle === option.id
                ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {option.label}
            {option.badge && (
              <span className={`ml-2 text-xs font-bold ${
                billingCycle === option.id ? 'text-blue-100' : 'text-emerald-400'
              }`}>
                {option.description}
              </span>
            )}
          </motion.button>
        ))}
      </motion.div>

      {/* 使用共享的定价卡片组件 */}
      <PricingCards 
        currentPlan={null}
        onSelectPlan={handleSelectPlan}
        showCTA={true}
        ctaText="立即订阅"
      />

      {/* Trust Badge */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center mt-16"
      >
        <p className="text-slate-500 text-sm">
          <Shield className="w-4 h-4 inline mr-2" />
          企业级数据安全 · 符合 GDPR 标准 · 7×24 技术支持
        </p>
      </motion.div>
    </div>
  )
}
