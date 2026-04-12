'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Zap, X, Loader2, Rocket, AlertTriangle, TrendingUp, Users, Cpu, Shield } from 'lucide-react'
import Link from 'next/link'

interface CampaignEstimateModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (estimatedLeads: number) => Promise<void>
  currentTokenBalance: number
  subscriptionTier: string
}

const COST_PER_LEAD = 120  // ~120 tokens per client

function InsufficientState({ balance }: { balance: number }) {
  return (
    <div className="flex flex-col items-center text-center py-6">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-20 h-20 rounded-full bg-gradient-to-br from-red-500/20 to-orange-500/20 border-2 border-red-500/40 flex items-center justify-center mb-5"
      >
        <AlertTriangle className="w-10 h-10 text-red-400" />
      </motion.div>
      <h3 className="text-lg font-bold text-white mb-2">算力枯竭</h3>
      <p className="text-slate-400 text-sm leading-relaxed mb-1">
        当前余额仅剩 <span className="text-red-400 font-bold">{balance.toLocaleString()}</span> tokens，
      </p>
      <p className="text-slate-400 text-sm">
        无法支撑至少一次完整的客户开发。
      </p>
      <Link
        href="/billing"
        className="mt-6 w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-500/20"
      >
        <Zap className="w-4 h-4" />
        前往充值算力
      </Link>
    </div>
  )
}

function SufficientState({
  balance,
  maxLeads,
  onConfirm,
  loading,
}: {
  balance: number
  maxLeads: number
  onConfirm: () => void
  loading: boolean
}) {
  const usagePct = Math.min((maxLeads * COST_PER_LEAD) / balance, 1)

  return (
    <div className="space-y-5">
      {/* 主结论区 */}
      <div className="relative rounded-2xl overflow-hidden">
        {/* 背景光效 */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-purple-600/5 to-slate-900" />
        <div className="absolute inset-0 border border-white/8 rounded-2xl" />

        {/* 顶部分隔线 */}
        <div
          className="h-0.5 w-full"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(139,92,246,0.8), rgba(59,130,246,0.8), transparent)',
          }}
        />

        <div className="relative px-5 py-5">
          {/* 顶部小标签 */}
          <div className="flex items-center gap-2 mb-4">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
              <Cpu className="w-2.5 h-2.5" />
              AUTO-ESTIMATE
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Shield className="w-2.5 h-2.5" />
              余额充足
            </span>
          </div>

          {/* 核心数字 */}
          <div className="text-center mb-4">
            <p className="text-sm text-slate-400 mb-1">基于您当前的</p>
            <div className="inline-flex items-baseline gap-1">
              <span className="text-4xl font-extrabold text-white tabular-nums">
                {balance.toLocaleString()}
              </span>
              <span className="text-sm text-slate-400">tokens</span>
            </div>
            <p className="text-sm text-slate-300 mt-2">
              本次任务全速运转预计最多可深度触达
            </p>
            <div className="mt-2 inline-flex items-baseline gap-1">
              <motion.span
                key={maxLeads}
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-blue-400 tabular-nums"
                style={{
                  textShadow: '0 0 40px rgba(139,92,246,0.4)',
                }}
              >
                {maxLeads.toLocaleString()}
              </motion.span>
              <span className="text-lg font-bold text-slate-300">个</span>
            </div>
            <p className="text-sm text-slate-300 mt-1">目标客户</p>
          </div>

          {/* 消耗进度条 */}
          <div className="rounded-xl bg-slate-800/60 p-3 border border-slate-700/50">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-slate-500 font-medium">本次任务预计消耗</span>
              <span className="text-[10px] font-mono text-slate-400">
                {(maxLeads * COST_PER_LEAD).toLocaleString()} / {balance.toLocaleString()} tokens
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.round(usagePct * 100)}%` }}
                transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
                className="h-full rounded-full"
                style={{
                  background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
                  boxShadow: '0 0 8px rgba(139,92,246,0.6)',
                }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[9px] text-slate-600">0</span>
              <span className="text-[9px] text-slate-600">剩余 {(balance - maxLeads * COST_PER_LEAD).toLocaleString()} tokens</span>
            </div>
          </div>
        </div>
      </div>

      {/* 战术情报卡 */}
      <div className="grid grid-cols-3 gap-2">
        {[
          {
            icon: <Users className="w-3.5 h-3.5" />,
            label: '目标触达',
            value: `~${maxLeads} 人`,
            color: 'text-blue-400',
            bg: 'bg-blue-500/10 border-blue-500/20',
          },
          {
            icon: <Cpu className="w-3.5 h-3.5" />,
            label: '单客消耗',
            value: `~${COST_PER_LEAD} tokens`,
            color: 'text-purple-400',
            bg: 'bg-purple-500/10 border-purple-500/20',
          },
          {
            icon: <TrendingUp className="w-3.5 h-3.5" />,
            label: '预计消耗',
            value: `~${(maxLeads * COST_PER_LEAD).toLocaleString()}`,
            color: 'text-emerald-400',
            bg: 'bg-emerald-500/10 border-emerald-500/20',
          },
        ].map((card) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border ${card.bg}`}
          >
            <div className={`${card.color} opacity-70`}>{card.icon}</div>
            <span className={`text-sm font-bold ${card.color} tabular-nums`}>{card.value}</span>
            <span className="text-[10px] text-slate-500">{card.label}</span>
          </motion.div>
        ))}
      </div>

      {/* 底部 CTA */}
      <motion.button
        onClick={onConfirm}
        disabled={loading}
        whileHover={!loading ? { scale: 1.01 } : {}}
        whileTap={!loading ? { scale: 0.98 } : {}}
        className="w-full py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold text-base flex items-center justify-center gap-3 transition-all shadow-xl shadow-blue-500/25 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            点火中...
          </>
        ) : (
          <>
            <Rocket className="w-5 h-5" />
            满载启动 Nova
          </>
        )}
      </motion.button>

      {/* 底部提示 */}
      <p className="text-center text-[11px] text-slate-600 leading-relaxed">
        Nova 将基于知识库和配置的决策人画像，为每位客户生成<strong className="text-slate-500">高度个性化</strong>的开发信。
        <br />任务运行期间可安全关闭页面，云端持续执行。
      </p>
    </div>
  )
}

export function CampaignEstimateModal({
  isOpen,
  onClose,
  onConfirm,
  currentTokenBalance,
  subscriptionTier,
}: CampaignEstimateModalProps) {
  const maxLeads = Math.floor(currentTokenBalance / COST_PER_LEAD)
  const insufficient = maxLeads < 1

  const handleConfirm = async () => {
    if (insufficient) return
    try {
      await onConfirm(maxLeads)
      onClose()
    } catch (_e) {
      // error handled by caller
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-md z-[100]"
          />
          {/* Modal */}
          <div className="fixed inset-0 flex items-center justify-center z-[100] p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.88, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.88, y: 24 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              className="relative max-w-md w-full pointer-events-auto"
            >
              {/* 外发光 */}
              <div className="absolute -inset-1 bg-gradient-to-br from-blue-600/30 via-purple-600/20 to-slate-900/0 rounded-3xl blur-xl opacity-60" />

              <div className="relative bg-slate-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden">

                {/* 顶部分隔线 */}
                <div
                  className="h-0.5 w-full"
                  style={{
                    background: 'linear-gradient(90deg, transparent, rgba(139,92,246,0.7), rgba(59,130,246,0.7), transparent)',
                  }}
                />

                {/* Header */}
                <div className="flex items-center justify-between px-6 pt-5 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
                      <Zap className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-white leading-tight">Nova 战术确认</h2>
                      <p className="text-xs text-slate-500">AI 任务启动前评估</p>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 flex items-center justify-center transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* 套餐标签 */}
                {subscriptionTier && subscriptionTier !== '未订阅' && (
                  <div className="mx-6 mb-4">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-500/15 text-purple-400 border border-purple-500/25">
                      {subscriptionTier}
                    </span>
                  </div>
                )}

                {/* 主体内容 */}
                <div className="px-6 pb-6">
                  {insufficient ? (
                    <InsufficientState balance={currentTokenBalance} />
                  ) : (
                    <SufficientState
                      balance={currentTokenBalance}
                      maxLeads={maxLeads}
                      onConfirm={handleConfirm}
                      loading={false}
                    />
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
