'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useWorkbench } from '@/contexts/WorkbenchContext'
import type { ActiveConfig } from '@/contexts/WorkbenchContext'
import { useToast } from '@/components/ui/use-toast'
import {
  X, Search, Sparkles, Send, Brain, Shield, ShoppingCart,
  ChevronRight, Check, AlertCircle, Info, Zap, Lock, Cpu,
  Globe, Clock, Database, ArrowUpCircle, Crown, ZapOff,
  FileText, Layers, TrendingUp, Download, Key, Users,
  MessageSquare, Radio, Package, CreditCard, BarChart3,
  Infinity, Headphones, UserCheck, Timer, Star,
  Mail, Briefcase, Code,
} from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
//  Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

// Drawer 临时配置 Context（用于在 Tab 间共享临时状态）
const DrawerTempConfigContext = React.createContext<{
  tempConfig: ActiveConfig
  updateTempConfig: (updates: Partial<ActiveConfig>) => void
} | null>(null)

export function useDrawerConfig() {
  const ctx = React.useContext(DrawerTempConfigContext)
  if (!ctx) throw new Error('useDrawerConfig must be used within NovaDrawer')
  return ctx
}

type PlanWeight = 1 | 2 | 3;
const PLAN_WEIGHT: Record<string, PlanWeight> = { STARTER: 1, PRO: 2, MAX: 3 };
const TIER_LABELS: Record<number, string> = { 1: '试运营版', 2: '增长版', 3: '规模化版' };
const TIER_COLORS: Record<number, string> = { 1: 'text-slate-400', 2: 'text-purple-400', 3: 'text-amber-400' };

// 真实商品 SKU 对齐
const ADDON_ENERGY_PACK   = 'token-10w';
const ADDON_DOMAIN_PACK   = 'domain-1'; // 仅做标志位判断，具体数量通过 reduce 计算
const ADDON_LEADS_PACK    = 'lead-1000';
const ADDON_DEDICATED_IP  = 'service-ip';
const ADDON_API_WEBHOOK   = 'service-api';
const ADDON_FOLLOW_UP     = 'strategy-followup';
const ADDON_EXEC_STRATEGY = 'strategy-executive';
const ADDON_AI_INDUSTRY   = 'ai-custom-industry';
const ADDON_VIP_SERVICE   = 'service-onboarding';

// Toast shorthand
function useLockedToast() {
  const { toast } = useToast()
  return (featureName: string) => {
    toast({
      title: `🔒 ${featureName}`,
      description: '当前套餐暂不支持，请前往商城补充或升级',
      variant: 'destructive',
    })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Primitives
// ─────────────────────────────────────────────────────────────────────────────

function LockBadge({ label, minWeight }: { label: string; minWeight: number }) {
  return (
    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full border border-slate-700/60 bg-slate-800/40">
      <Lock className="w-2.5 h-2.5 text-amber-500" />
      <span className="text-[10px] text-slate-500">{label}</span>
      <span className={`text-[9px] font-semibold ${TIER_COLORS[minWeight] || 'text-slate-500'}`}>{TIER_LABELS[minWeight] || label}</span>
    </div>
  )
}

function QuotaBar({
  used, total, label, unit = '', showWarning = true,
}: {
  used: number; total: number; label: string; unit?: string; showWarning?: boolean
}) {
  const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0
  const color = pct > 80 ? '#ef4444' : pct > 50 ? '#f59e0b' : '#10b981'
  const warning = pct > 80

  return (
    <div className="rounded-xl p-3" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)' }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-xs text-slate-400">{label}</span>
        </div>
        <span className="text-xs font-mono">
          <span className={warning ? 'text-red-400 font-bold' : 'text-slate-300 font-bold'}>{used.toLocaleString()}</span>
          <span className="text-slate-600"> / {total.toLocaleString()}{unit}</span>
        </span>
      </div>
      <div className="h-2 bg-slate-800 rounded-full overflow-hidden mb-1">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
      {showWarning && (
        <p className="text-[10px] text-slate-600">
          {warning
            ? '⚠️ 额度即将用尽，建议升级套餐'
            : `剩余 ${(total - used).toLocaleString()}${unit} 可用`}
        </p>
      )}
    </div>
  )
}

function TierSwitch({
  options, value, onChange,
}: {
  options: { value: string; label: string; badge?: string; lockedMinWeight?: number; desc?: string }[]
  value: string; onChange: (v: string) => void
}) {
  const lockedToast = useLockedToast()
  const { userPlan } = useWorkbench()
  const weight = PLAN_WEIGHT[String(userPlan ?? '')] || 1

  return (
    <div className="grid grid-cols-3 gap-1.5">
      {options.map(opt => {
        const isLocked = opt.lockedMinWeight !== undefined && weight < opt.lockedMinWeight
        const active = value === opt.value
        return (
          <button
            key={opt.value}
            disabled={isLocked}
            onClick={() => {
              if (isLocked) { lockedToast(opt.label); return }
              onChange(opt.value)
            }}
            className={`relative flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl text-xs font-medium border transition-all duration-150 ${
              isLocked
                ? 'border-slate-800 bg-slate-900/60 text-slate-600 cursor-not-allowed opacity-50'
                : active
                ? 'bg-purple-600/25 border-purple-500/50 text-purple-300 shadow-sm shadow-purple-500/20'
                : 'border-slate-700/70 bg-slate-800/40 text-slate-400 hover:border-slate-600 hover:text-slate-200 cursor-pointer'
            }`}
          >
            {isLocked && <Lock className="w-2.5 h-2.5 text-slate-600 absolute top-1.5 right-1.5" />}
            <span className="text-center leading-tight">{opt.label}</span>
            {opt.badge && (
              <span className="text-[8px] font-bold text-amber-400 bg-amber-500/15 px-1 rounded border border-amber-500/20">
                {opt.badge}
              </span>
            )}
            {opt.desc && !isLocked && (
              <span className="text-[9px] text-slate-600">{opt.desc}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

function StrategyToggle({
  label, description, checked, onChange, addonKey,
}: {
  label: string; description: string; checked: boolean; onChange: (v: boolean) => void; addonKey: string
}) {
  const { assets } = useWorkbench()
  const purchased = (assets.addons_purchased || []).includes(addonKey)
  const isLocked = !purchased
  const lockedToast = useLockedToast()

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium text-slate-200">{label}</p>
          {isLocked ? (
            <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] bg-amber-500/15 border border-amber-500/30 text-amber-400">
              <ShoppingCart className="w-2.5 h-2.5" /> 购买解锁
            </span>
          ) : (
            <Check className="w-3 h-3 text-emerald-400" />
          )}
        </div>
        <p className="text-xs text-slate-500 mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        onClick={() => {
          if (isLocked) { lockedToast(label); return }
          onChange(!checked)
        }}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-0 ${
          checked ? 'bg-purple-600' : 'bg-slate-700'
        } ${isLocked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
        role="switch"
        aria-checked={checked}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ease-in-out ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  )
}

function SectionHeader({ icon, title, description }: {
  icon: React.ReactNode; title: string; description?: string
}) {
  return (
    <div className="flex items-start gap-3 pb-3 border-b border-white/5">
      <div className="flex-shrink-0 mt-0.5 text-slate-400">{icon}</div>
      <div>
        <p className="text-sm font-semibold text-white">{title}</p>
        {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
      </div>
    </div>
  )
}

function NumberInput({
  label, value, min, max, unit, onChange, addonKey, addonMax,
}: {
  label: string; value: number; min: number; max: number; unit: string
  onChange: (v: number) => void; addonKey?: string; addonMax?: number
}) {
  const { assets } = useWorkbench()
  const hasAddon = addonKey ? (assets.addons_purchased || []).includes(addonKey) : false
  const effectiveMax = addonMax && hasAddon ? max + addonMax : max
  const lockedToast = useLockedToast()

  const handleDecrement = () => {
    if (value > min) onChange(value - 1)
  }

  const handleIncrement = () => {
    if (value >= effectiveMax) {
      if (!hasAddon && value >= max) {
        lockedToast('额外域名位')
      }
      return
    }
    onChange(value + 1)
  }

  return (
    <div className="rounded-xl p-3" style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.05)' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Globe className="w-3.5 h-3.5 text-slate-500" />
          <p className="text-sm font-medium text-slate-200">{label}</p>
        </div>
        <div className="flex items-center gap-1.5">
          {addonKey && !hasAddon && <Lock className="w-3 h-3 text-amber-500" />}
          {addonKey && hasAddon && <span className="text-[9px] text-emerald-400">+{addonMax} 已解锁</span>}
          <span className="text-xs font-mono text-slate-400">{value} / {effectiveMax}{unit}</span>
        </div>
      </div>
      <div className="flex items-center justify-center">
        <button
          type="button"
          onClick={handleDecrement}
          disabled={value <= min}
          className={`w-10 h-10 rounded-l-xl border border-r-0 border-slate-700 flex items-center justify-center transition-all ${
            value <= min
              ? 'bg-slate-800 text-slate-700 cursor-not-allowed'
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white cursor-pointer'
          }`}
        >
          <span className="text-lg font-bold">−</span>
        </button>
        <div className="h-10 px-4 border-y border-slate-700 bg-slate-900/60 flex items-center justify-center">
          <span className="text-lg font-mono font-bold text-white">{value}</span>
          <span className="text-xs text-slate-500 ml-1">{unit}</span>
        </div>
        <button
          type="button"
          onClick={handleIncrement}
          disabled={value >= effectiveMax}
          className={`w-10 h-10 rounded-r-xl border border-l-0 border-slate-700 flex items-center justify-center transition-all ${
            value >= effectiveMax
              ? 'bg-slate-800 text-slate-700 cursor-not-allowed'
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white cursor-pointer'
          }`}
        >
          <span className="text-lg font-bold">+</span>
        </button>
      </div>
      {addonKey && !hasAddon && (
        <p className="text-[10px] text-slate-600 mt-2 text-center">
          基础套餐上限 {max} 个 | 购买域名扩展包可解锁 +{addonMax} 个
        </p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  Tab 1: 🔍 线索挖掘
// ─────────────────────────────────────────────────────────────────────────────

function TabLeads() {
  const { userPlan, assets } = useWorkbench()
  const { tempConfig, updateTempConfig } = useDrawerConfig()
  const weight = PLAN_WEIGHT[String(userPlan ?? '')] || 1
  const purchasedLeadsPack = (assets.addons_purchased || []).includes(ADDON_LEADS_PACK)

  const quotaLimits: Record<number, number> = { 1: 300, 2: 1000, 3: 3000 };
  const baseLimit = quotaLimits[weight] || 300
  const totalLimit = baseLimit
  const used = assets.leads
  const remaining = Math.max(0, totalLimit - used)

  const fileLimit = weight >= 3 ? 100 : weight >= 2 ? 20 : 3;
  const uploadedFiles = tempConfig?.knowledgeBaseIds?.length || 0

  return (
    <div className="space-y-5">
      <SectionHeader
        icon={<Search className="w-4 h-4" />}
        title="线索挖掘"
        description="搜客额度与知识库检索模式"
      />

      {/* 搜客额度 QuotaBar */}
      <QuotaBar
        used={used}
        total={totalLimit}
        label="当月剩余搜客额度"
      />

      {/* 知识库文件存储 */}
      <div className="rounded-xl p-3" style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-xs text-slate-400">知识库文件存储</span>
            {weight < 3 && <Lock className="w-3 h-3 text-amber-500" />}
          </div>
          <span className="text-xs font-mono">
            <span className={uploadedFiles >= (typeof fileLimit === 'number' ? fileLimit * 0.9 : 100) ? 'text-amber-400 font-bold' : 'text-slate-300 font-bold'}>
              {uploadedFiles}
            </span>
            <span className="text-slate-600"> / {weight >= 3 ? '∞ 无限制' : `${fileLimit} 文件`}</span>
          </span>
        </div>
        <p className="text-[10px] text-slate-600 mt-1">
          {weight >= 3 ? '规模化版无限制文件存储' : weight >= 2 ? '增长版 20 文件上限' : '试运营版 3 文件上限'}
          {typeof fileLimit === 'number' && uploadedFiles >= fileLimit && ' ⚠️ 已达上限'}
        </p>
      </div>

      {/* 知识库检索模式 */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-slate-500" />
          <p className="text-sm font-medium text-slate-200">知识库检索模式</p>
        </div>
        <TierSwitch
          value={tempConfig.enrichmentDepth || 'basic'}
          onChange={v => updateTempConfig({ enrichmentDepth: v as 'basic' | 'standard' | 'deep' })}
          options={[
            { value: 'basic',    label: '基础检索', desc: '全系可用' },
            { value: 'standard', label: '进阶检索', badge: '推荐', lockedMinWeight: 2 },
            { value: 'deep',    label: '向量深度', badge: 'AI增强', lockedMinWeight: 3 },
          ]}
        />
      </div>

      {/* 升级提示 */}
      {weight < 3 && (
        <div className="flex items-start gap-2 rounded-xl p-3" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
          <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs text-amber-300 font-medium">进阶/深度检索需升级套餐</p>
            <p className="text-[10px] text-amber-500/70 mt-0.5">
              {weight < 2 ? '增长版解锁进阶检索' : '规模化版解锁向量深度检索'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  Tab 2: ✍️ AI 创作大脑
// ─────────────────────────────────────────────────────────────────────────────

function TabAIBrain() {
  const { userPlan, assets } = useWorkbench()
  const { tempConfig, updateTempConfig } = useDrawerConfig()
  const weight = PLAN_WEIGHT[String(userPlan ?? '')] || 1
  const purchased = assets.addons_purchased || []

  const tokenLimit = weight >= 3 ? 500000 : weight >= 2 ? 200000 : 50000;
  const usedTokens = Math.max(0, tokenLimit - assets.tokens)
  const tokenPct = tokenLimit > 1000 ? Math.min((usedTokens / tokenLimit) * 100, 100) : (assets.tokens <= 500 ? 95 : 20)
  const tokenColor = tokenPct > 80 ? '#ef4444' : tokenPct > 50 ? '#f59e0b' : '#10b981'

  const langLevel = weight >= 3 ? 'global' : weight >= 2 ? '8lang' : 'enonly'
  const langLabels = {
    enonly: '仅英语',
    '8lang': '8 大语种',
    global: '40+ 语种',
  }

  return (
    <div className="space-y-5">
      <SectionHeader
        icon={<Sparkles className="w-4 h-4" />}
        title="AI 创作大脑"
        description="算力水箱、多语种引擎与专家策略"
      />

      {/* AI 算力水箱 */}
      <div className="rounded-xl p-3" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Cpu className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-xs text-slate-400">月度 AI 算力水箱</span>
          </div>
          <span className="text-[10px] font-mono">
            {tokenLimit > 1000
              ? <span className="text-purple-300">Token 剩余充足</span>
              : <span className={assets.tokens <= 500 ? 'text-red-400' : 'text-amber-400'}>
                  仅剩 {assets.tokens.toLocaleString()} Tokens
                </span>
            }
          </span>
        </div>
        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{
              background: weight >= 3
                ? 'linear-gradient(90deg,#f59e0b,#ef4444)'
                : weight >= 2
                ? 'linear-gradient(90deg,#8b5cf6,#3b82f6)'
                : tokenColor,
              width: weight >= 3 ? '100%' : weight >= 2 ? '65%' : `${Math.min(100 - tokenPct, 100)}%`,
            }}
            initial={{ width: 0 }}
            animate={{ width: weight >= 3 ? '100%' : weight >= 2 ? '65%' : `${Math.min(100 - tokenPct, 100)}%` }}
            transition={{ duration: 1 }}
          />
        </div>
        <div className="flex justify-between mt-1">
          {[
            { label: '试运营版', w: 1, cls: 'text-slate-500' },
            { label: '增长版', w: 2, cls: weight >= 2 ? 'text-purple-400' : 'text-slate-600' },
            { label: '规模化版', w: 3, cls: weight >= 3 ? 'text-amber-400' : 'text-slate-600' },
          ].map(s => (
            <span key={s.label} className={`text-[9px] font-mono ${s.cls}`}>{s.label}</span>
          ))}
        </div>
        {assets.tokens <= 500 && (
          <p className="text-[10px] text-red-400 mt-1">⚠️ Token 即将耗尽，请购买算力补充包</p>
        )}
      </div>

      {/* 多语种引擎 */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <Globe className="w-3.5 h-3.5 text-slate-500" />
          <p className="text-sm font-medium text-slate-200">多语种引擎</p>
          {langLevel === 'enonly' && <LockBadge label="8语种" minWeight={2} />}
          {langLevel === '8lang' && <LockBadge label="40+语种" minWeight={3} />}
          {langLevel === 'global' && (
            <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              ✅ 全语言解锁
            </span>
          )}
        </div>
        <div className="rounded-xl p-3 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="text-center">
            <span className={`text-2xl font-bold ${TIER_COLORS[weight]}`}>
              {weight >= 3 ? '40+' : weight >= 2 ? '8' : '1'}
            </span>
            <p className="text-xs text-slate-500 mt-1">
              {langLabels[langLevel as keyof typeof langLabels]}
            </p>
            <p className="text-[10px] text-slate-600 mt-0.5">
              {weight >= 3 ? '覆盖全球主流与小语种市场' : weight >= 2 ? '英/中/日/韩/德/法/西/葡' : '仅支持英语创作'}
            </p>
          </div>
        </div>
        {weight < 2 && (
          <p className="text-[10px] text-amber-500/70">💡 升级增长版解锁 8 大语种，规模化版解锁全球 40+ 语种</p>
        )}
      </div>

      {/* 专家策略模块 */}
      <div className="space-y-3">
        <div className="flex items-center gap-1.5">
          <Star className="w-3.5 h-3.5 text-slate-500" />
          <p className="text-sm font-medium text-slate-200">专家策略模块</p>
          <span className="text-[10px] text-slate-600">购买增值包解锁</span>
        </div>
        <div className="rounded-xl p-3 space-y-3" style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <StrategyToggle
            label="跟进序列策略包"
            description="购买后解锁，套用多触点跟进流程"
            checked={tempConfig.followUpSequence}
            onChange={v => updateTempConfig({ followUpSequence: v })}
            addonKey={ADDON_FOLLOW_UP}
          />
          <StrategyToggle
            label="高管成交策略包"
            description="购买后解锁，C-Level 破冰话术"
            checked={tempConfig.execStrategy}
            onChange={v => updateTempConfig({ execStrategy: v })}
            addonKey={ADDON_EXEC_STRATEGY}
          />
          <StrategyToggle
            label="行业专属定制模型"
            description="购买后解锁，深度行业微调"
            checked={tempConfig.industryModel}
            onChange={v => updateTempConfig({ industryModel: v })}
            addonKey={ADDON_AI_INDUSTRY}
          />
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  Tab 3: 🚀 发信引擎
// ─────────────────────────────────────────────────────────────────────────────

function TabSender() {
  const { userPlan, assets } = useWorkbench()
  const { tempConfig, updateTempConfig } = useDrawerConfig()
  const weight = PLAN_WEIGHT[String(userPlan ?? '')] || 1
  const lockedToast = useLockedToast()
  const hasDedicatedIP = (assets.addons_purchased || []).includes(ADDON_DEDICATED_IP)

  const domainBase: Record<number, number> = { 1: 1, 2: 3, 3: 10 };
  const domainMax = domainBase[weight] || 1;
  const extraDomains = (assets.addons_purchased || []).reduce((acc: number, key: string) => {
    if (key === 'domain-1') return acc + 1;
    if (key === 'domain-3') return acc + 3;
    if (key === 'domain-5') return acc + 5;
    return acc;
  }, 0);
  const effectiveMax = domainMax + extraDomains;

  return (
    <div className="space-y-5">
      <SectionHeader
        icon={<Send className="w-4 h-4" />}
        title="发信引擎"
        description="域名配置与并发发送模式"
      />

      {/* 出动域名数 */}
      <NumberInput
        label="出动域名数"
        value={tempConfig.activeDomains || 1}
        min={1}
        max={effectiveMax}
        unit=" 个"
        addonKey={undefined}
        addonMax={undefined}
        onChange={v => updateTempConfig({ activeDomains: v })}
      />

      {/* 发信并发模式 */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-slate-500" />
          <p className="text-sm font-medium text-slate-200">发信并发模式</p>
        </div>
        <TierSwitch
          value={tempConfig.sendSpeed || 'standard'}
          onChange={v => updateTempConfig({ sendSpeed: v as 'standard' | 'fast' | 'turbo' })}
          options={[
            { value: 'standard', label: '标准速率', desc: '默认', lockedMinWeight: undefined },
            { value: 'fast',     label: '加速模式', badge: '2并发', lockedMinWeight: 2 },
            { value: 'turbo',    label: '极速模式', badge: '10并发', lockedMinWeight: 3 },
          ]}
        />
      </div>

      {/* 启用官方高信誉 IP 专线 (免预热) */}
      <div className="rounded-xl p-3" style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-medium text-slate-200">启用官方高信誉 IP 专线</p>
              {!hasDedicatedIP ? (
                <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] bg-amber-500/15 border border-amber-500/30 text-amber-400">
                  <Lock className="w-2.5 h-2.5" /> 购买解锁
                </span>
              ) : (
                <Check className="w-3 h-3 text-emerald-400" />
              )}
            </div>
            <p className="text-[10px] text-slate-600 mt-0.5">
              接管底层路由，调用官方高优 IP 池发信，无视新域名预热期限制。
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (!hasDedicatedIP) { lockedToast('官方高信誉 IP 专线'); return }
              updateTempConfig({ dedicatedIP: !tempConfig.dedicatedIP })
            }}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              tempConfig.dedicatedIP ? 'bg-purple-600' : 'bg-slate-700'
            } ${!hasDedicatedIP ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
            role="switch"
            aria-checked={tempConfig.dedicatedIP}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ease-in-out ${
                tempConfig.dedicatedIP ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* 升级提示 */}
      {weight < 3 && !hasDedicatedIP && (
        <div className="flex items-start gap-2 rounded-xl p-3" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
          <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs text-amber-300">加速/极速并发需升级增长版/规模化版</p>
            <p className="text-[10px] text-amber-500/70 mt-0.5">独立 IP 路由需购买专属增值包</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  Tab 4: 🧠 意图商机
// ─────────────────────────────────────────────────────────────────────────────

function TabIntent() {
  const { userPlan, assets } = useWorkbench()
  const { tempConfig, updateTempConfig } = useDrawerConfig()
  const weight = PLAN_WEIGHT[String(userPlan ?? '')] || 1
  const lockedToast = useLockedToast()
  const { toast } = useToast()
  const purchased = assets.addons_purchased || []
  const hasExportPack = purchased.includes('addon_export_pack')
  const hasAPIWebhook = purchased.includes(ADDON_API_WEBHOOK)

  return (
    <div className="space-y-5">
      <SectionHeader
        icon={<Brain className="w-4 h-4" />}
        title="意图商机"
        description="AI 意图识别与商机评分"
      />

      {/* AI 深度意图标签 */}
      <div className="rounded-xl p-3" style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              {weight < 2 && (
                <Lock className="w-3 h-3 text-slate-500 flex-shrink-0" />
              )}
              <p className={`text-sm font-medium ${weight < 2 ? 'text-slate-400' : 'text-slate-200'}`}>
                AI 深度意图标签
              </p>
              <span className={`text-[9px] ${weight < 2 ? 'text-slate-600' : 'text-slate-600'} bg-slate-800/60 px-1.5 py-0.5 rounded`}>
                生效于: 统一收件箱
              </span>
              {weight < 2 && (
                <span className="text-[9px] text-purple-400 bg-purple-500/15 border border-purple-500/30 px-1.5 py-0.5 rounded font-medium">
                  增长版解锁
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">自动识别回复中的购买/拒绝/观望等意图</p>
          </div>
          <button
            type="button"
            disabled={weight < 2}
            onClick={() => {
              if (weight < 2) {
                toast({
                  title: '🔒 AI 深度意图标签',
                  description: 'AI 意图识别为增长版特权，请升级套餐解锁',
                  variant: 'destructive',
                })
                return
              }
              updateTempConfig({ aiIntentTags: !tempConfig.aiIntentTags })
            }}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              tempConfig.aiIntentTags ? 'bg-purple-600' : 'bg-slate-700'
            } ${weight < 2 ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
            role="switch"
            aria-checked={tempConfig.aiIntentTags}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ease-in-out ${
                tempConfig.aiIntentTags ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* AI 商机智能评分与置顶 */}
      <div className="rounded-xl p-3" style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-medium text-slate-200">AI 商机智能评分与置顶</p>
              <span className="text-[9px] text-slate-600 bg-slate-800/60 px-1.5 py-0.5 rounded">生效于: 统一收件箱</span>
              {weight < 3 && <LockBadge label="规模化版" minWeight={3} />}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">基于多维度 AI 模型进行商机评分与高价值置顶</p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (weight < 3) { lockedToast('AI 商机智能评分'); return }
              updateTempConfig({ leadScoring: tempConfig.leadScoring === 'ml' ? 'standard' : 'ml' })
            }}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              tempConfig.leadScoring === 'ml' ? 'bg-purple-600' : 'bg-slate-700'
            } ${weight < 3 ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
            role="switch"
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ease-in-out ${
                tempConfig.leadScoring === 'ml' ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* AI 智能回复接管 */}
      <div className="rounded-xl p-3 space-y-2" style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex items-center gap-1.5">
          <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
          <p className="text-sm font-medium text-slate-200">AI 智能回复接管</p>
          <span className="text-[9px] text-slate-600 bg-slate-800/60 px-1.5 py-0.5 rounded">生效于: 统一收件箱</span>
          {weight < 2 && <LockBadge label="增长版" minWeight={2} />}
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { value: 'locked',  label: '锁定',      weightLabel: '1', minWeight: 1, locked: true },
            { value: 'preset',  label: '预设指令',   weightLabel: '2', minWeight: 2, locked: weight < 2 },
            { value: 'custom',  label: '自定义+批量', weightLabel: '3', minWeight: 3, locked: weight < 3 },
          ].map(opt => {
            const isLocked = opt.locked
            const currentLevel = weight >= 3 ? 'custom' : weight >= 2 ? 'preset' : 'locked'
            const isActive = currentLevel === opt.value
            return (
              <button
                key={opt.value}
                disabled={isLocked}
                onClick={() => {
                  if (isLocked) { lockedToast('AI 智能回复'); return }
                  updateTempConfig({ autoReply: opt.value !== 'locked' })
                }}
                className={`relative flex flex-col items-center gap-0.5 px-2 py-2 rounded-xl text-xs font-medium border transition-all duration-150 ${
                  isLocked
                    ? 'border-slate-800 bg-slate-900/60 text-slate-600 cursor-not-allowed opacity-50'
                    : isActive
                    ? 'bg-purple-600/25 border-purple-500/50 text-purple-300'
                    : 'border-slate-700/70 bg-slate-800/40 text-slate-400 hover:border-slate-600 cursor-pointer'
                }`}
              >
                {isLocked && <Lock className="w-2.5 h-2.5 text-slate-600 absolute top-1.5 right-1.5" />}
                <span>{opt.label}</span>
                <span className="text-[9px] text-slate-600">{opt.weightLabel}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* 数据导出与外溢阀门 */}
      <div className="rounded-xl p-3" style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <p className="text-sm font-medium text-slate-200">数据导出与外溢阀门</p>
            {weight < 2 && !hasExportPack && <LockBadge label="增长版" minWeight={2} />}
          </div>
        </div>
        <div className="space-y-1.5">
          {[
            { value: 'none', label: '锁定', locked: weight < 2 && !hasExportPack, weightLabel: '1' },
            { value: 'csv', label: 'CSV / Excel', locked: weight < 2 && !hasExportPack, weightLabel: '2' },
            { value: 'full', label: '全格式 + API', locked: weight < 3 && !hasAPIWebhook, weightLabel: '3' },
          ].map(opt => (
            <div key={opt.value} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs ${
              opt.locked
                ? 'border-slate-800 bg-slate-900/40 text-slate-600 opacity-50'
                : tempConfig.autoSegment === (opt.value === 'csv' || opt.value === 'full')
                ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300'
                : 'border-slate-700/50 bg-slate-800/30 text-slate-400'
            }`}>
              {opt.locked ? <Lock className="w-3 h-3 flex-shrink-0" /> : <Check className="w-3 h-3 flex-shrink-0" />}
              <span className="flex-1">{opt.label}</span>
              <span className="text-[9px] text-slate-600">{opt.weightLabel}</span>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-slate-600 mt-2">
          {hasAPIWebhook ? '✅ API 与 Webhook 已解锁，全格式导出' :
           hasExportPack ? '✅ 高阶数据导出包已激活，CSV/Excel 可用' :
           weight >= 3 ? '规模化版开放 API 接入' :
           weight >= 2 ? '增长版开放 CSV/Excel 导出' : '试运营版暂不支持'}
        </p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  Tab 5: 🛡️ 系统底层保障（纯只读展示）
// ─────────────────────────────────────────────────────────────────────────────

function TabSystem() {
  const { userPlan } = useWorkbench()
  const weight = PLAN_WEIGHT[String(userPlan ?? '')] || 1

  const dataRetention: Record<number, { days: number; label: string; desc: string }> = {
    1:  { days: 7,   label: '7 天',  desc: '试运营版基础保留' },
    2:  { days: 90,  label: '90 天', desc: '增长版中级保留' },
    3:  { days: 36500, label: '永久',  desc: '规模化版永久留存' },
  }

  const slaPriority: Record<number, { time: string; desc: string }> = {
    1:  { time: '24h',     desc: '标准响应' },
    2:  { time: '4h',      desc: '优先通道' },
    3:  { time: '2h',      desc: '专属顾问' },
  }

  const ret = dataRetention[weight]
  const sla = slaPriority[weight]

  return (
    <div className="space-y-5">
      <SectionHeader
        icon={<Shield className="w-4 h-4" />}
        title="系统底层保障"
        description="纯只读展示 · SLA 与数据保留承诺"
      />

      {/* 历史任务留存周期 */}
      <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex items-center gap-2 mb-1">
          <Database className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-xs text-slate-400 font-medium">历史任务留存周期</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {([
            { days: 7,   label: '7 天',  w: 1 as number },
            { days: 90,  label: '90 天', w: 2 as number },
            { days: 36500, label: '永久',  w: 3 as number },
          ] as const).map(opt => {
            const active = ret.days === opt.days
            const locked = weight < opt.w
            return (
              <div key={opt.days} className={`rounded-xl p-3 text-center border transition-all ${
                locked ? 'border-slate-800 bg-slate-900/60 opacity-40' :
                active ? 'border-cyan-500/40 bg-cyan-500/10' :
                'border-slate-700/70 bg-slate-800/40'
              }`}>
                {locked && <Lock className="w-2.5 h-2.5 text-slate-600 mx-auto mb-1" />}
                <p className={`text-sm font-bold ${locked ? 'text-slate-600' : active ? 'text-cyan-300' : 'text-slate-400'}`}>
                  {opt.label}
                </p>
                <p className="text-[9px] text-slate-600 mt-0.5">
                  {weight >= opt.w ? '已解锁' : `升级${TIER_LABELS[opt.w]}`}
                </p>
              </div>
            )
          })}
        </div>
      </div>

      {/* 专属服务 SLA 通道 */}
      <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex items-center gap-2 mb-1">
          <Headphones className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-xs text-slate-400 font-medium">专属服务 SLA 通道</span>
        </div>
        <div className="space-y-2">
          {([
            { weightKey: 1 as number, time: '24h',     desc: '标准响应', icon: Timer },
            { weightKey: 2 as number, time: '4h',      desc: '优先通道', icon: UserCheck },
            { weightKey: 3 as number, time: '2h',     desc: '专属顾问', icon: Crown },
          ] as const).map(s => {
            const Icon = s.icon
            const active = weight >= s.weightKey
            return (
              <div key={s.weightKey} className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                  active ? 'border-emerald-500 bg-emerald-500/20' : 'border-slate-700 bg-transparent'
                }`}>
                  {active && <div className="w-full h-full rounded-full bg-emerald-400 animate-ping opacity-60" />}
                </div>
                <div className="flex-1 h-px bg-slate-800" />
                <div className="flex items-center gap-2">
                  <Icon className={`w-3.5 h-3.5 ${active ? 'text-emerald-400' : 'text-slate-700'}`} />
                  <span className={`text-xs font-medium ${active ? 'text-slate-200' : 'text-slate-600'}`}>
                    {s.time}
                  </span>
                  <span className="text-xs text-slate-600">{s.desc}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 当前套餐状态 */}
      <div className="rounded-xl p-3" style={{ background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.15)' }}>
        <div className="flex items-center gap-2">
          <Check className="w-4 h-4 text-indigo-400" />
          <p className="text-xs text-indigo-300">
            当前套餐 <span className={`font-bold ${TIER_COLORS[weight]}`}>{TIER_LABELS[weight]}</span> 已激活
          </p>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className={`px-2 py-0.5 rounded text-[10px] border ${weight >= 1 ? 'border-cyan-500/30 text-cyan-400' : 'border-slate-700 text-slate-600'}`}>
            数据保留 {ret.label}
          </span>
          <span className={`px-2 py-0.5 rounded text-[10px] border ${weight >= 1 ? 'border-cyan-500/30 text-cyan-400' : 'border-slate-700 text-slate-600'}`}>
            SLA {sla.time} {sla.desc}
          </span>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  Tab 6: 🛒 增值与外挂（真实 SKU 映射）
// 与 Store 保持完全对齐的增值服务列表
// ─────────────────────────────────────────────────────────────────────────────

interface AddonItem {
  key: string
  name: string
  icon: React.ReactNode
  description: string
  price: number
  minWeight: number
  tag?: string
  category: 'strategy' | 'premium'
}

const PERMANENT_ADDONS: AddonItem[] = [
  {
    key: 'strategy-followup',
    name: '跟进序列策略包',
    icon: <Mail className="w-4 h-4" />,
    description: '7 步自动化跟进邮件模板，从首封到逼单全覆盖',
    price: 249,
    minWeight: 2,
    category: 'strategy',
  },
  {
    key: 'strategy-executive',
    name: '高管成交策略包',
    icon: <TrendingUp className="w-4 h-4" />,
    description: '针对 C-level 的高转化话术库，平均回复率提升 3 倍',
    price: 299,
    minWeight: 2,
    tag: '热门',
    category: 'strategy',
  },
  {
    key: 'template-mechanical',
    name: '行业模板包 · 机械制造',
    icon: <Briefcase className="w-4 h-4" />,
    description: '50 套开发信模板，覆盖工业设备与零配件',
    price: 199,
    minWeight: 1,
    category: 'strategy',
  },
  {
    key: 'template-electronics',
    name: '行业模板包 · 电子元器件',
    icon: <Briefcase className="w-4 h-4" />,
    description: '50 套开发信模板，覆盖 PCB/芯片/连接器',
    price: 199,
    minWeight: 1,
    category: 'strategy',
  },
  {
    key: 'template-furniture',
    name: '行业模板包 · 家居家具',
    icon: <Briefcase className="w-4 h-4" />,
    description: '50 套开发信模板，覆盖实木/软体/户外家居',
    price: 199,
    minWeight: 1,
    category: 'strategy',
  },
  {
    key: 'template-textile',
    name: '行业模板包 · 纺织面料',
    icon: <Briefcase className="w-4 h-4" />,
    description: '50 套开发信模板，覆盖梭织/针织/功能性面料',
    price: 199,
    minWeight: 1,
    tag: '热门',
    category: 'strategy',
  },
  {
    key: 'ai-custom-industry',
    name: 'AI 专属定制行业开发信与策略包',
    icon: <Sparkles className="w-4 h-4" />,
    description: 'AI 深度介入，为您生成独家私有化拓客矩阵',
    price: 999,
    minWeight: 2,
    tag: '独家定制',
    category: 'strategy',
  },
]

const PRIVILEGE_ADDONS: AddonItem[] = [
  {
    key: 'service-ip',
    name: '独立发信预热池与高信誉 IP',
    icon: <Shield className="w-4 h-4" />,
    description: '独享高信誉 IP 通道，防封号，送达率提升 40%',
    price: 499,
    minWeight: 1,
    tag: 'MAX',
    category: 'premium',
  },
  {
    key: 'service-api',
    name: 'API 与 Webhook 自动化集成包',
    icon: <Code className="w-4 h-4" />,
    description: '打通飞书/钉钉/HubSpot，实现全自动数据流转',
    price: 999,
    minWeight: 3,
    tag: '热门',
    category: 'premium',
  },
]

function TabAddons() {
  const { userPlan, assets } = useWorkbench()
  const { tempConfig, updateTempConfig } = useDrawerConfig()
  const weight = PLAN_WEIGHT[String(userPlan ?? '')] || 1
  const { toast } = useToast()

  const isPurchased = (key: string) => (assets.addons_purchased || []).includes(key)
  const isActive = (key: string) => (tempConfig as any)[key] === true

  const handleGoToStore = (item: AddonItem) => {
    toast({
      title: '🛒 请前往商城购买',
      description: `「${item.name}」需在商城完成支付解锁，功能将自动生效`,
      variant: 'default',
    })
  }

  const handleToggleActive = (item: AddonItem) => {
    if (!isPurchased(item.key)) {
      handleGoToStore(item)
      return
    }
    updateTempConfig({ [item.key]: !isActive(item.key) } as any)
  }

  const categories = [
    { id: 'strategy', label: '永久资产', icon: <Package className="w-3 h-3" />, items: PERMANENT_ADDONS },
    { id: 'premium', label: '高级特权', icon: <Star className="w-3 h-3" />, items: PRIVILEGE_ADDONS },
  ] as const

  return (
    <div className="space-y-4">
      <SectionHeader
        icon={<ShoppingCart className="w-4 h-4" />}
        title="增值与外挂"
        description="真实 SKU · 激活后全局功能立即解锁"
      />

      {(assets.addons_purchased || []).filter(k =>
        [...PERMANENT_ADDONS, ...PRIVILEGE_ADDONS].some(a => a.key === k)
      ).length > 0 && (
        <div className="rounded-xl p-3 space-y-2" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)' }}>
          <p className="text-xs text-emerald-400 font-semibold flex items-center gap-1.5">
            <Check className="w-3 h-3" /> 已激活的增值包
          </p>
          <div className="flex flex-wrap gap-1.5">
            {(assets.addons_purchased || []).map(key => {
              const item = [...PERMANENT_ADDONS, ...PRIVILEGE_ADDONS].find(a => a.key === key)
              return item ? (
                <span key={key} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/20 border border-emerald-500/30 text-emerald-300">
                  {item.name}
                </span>
              ) : null
            })}
          </div>
        </div>
      )}

      {categories.map(cat => {
        const items = cat.items
        return (
          <div key={cat.id} className="space-y-2">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500">{cat.icon}</span>
              <p className="text-xs font-semibold text-slate-300">{cat.label}</p>
              <div className="flex-1 h-px bg-slate-800" />
            </div>
            <div className="rounded-xl overflow-hidden border border-white/5 divide-y divide-white/5">
              {items.map(item => {
                const purchased = isPurchased(item.key)
                const active = isActive(item.key)
                const locked = weight < item.minWeight

                return (
                  <div key={item.key} className="p-3 space-y-2" style={{ background: 'rgba(0,0,0,0.2)' }}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5 flex-1 min-w-0">
                        <div className={`flex-shrink-0 mt-0.5 ${locked ? 'text-slate-600' : 'text-slate-400'}`}>
                          {item.icon}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className={`text-sm font-medium ${locked ? 'text-slate-600' : 'text-slate-200'}`}>
                              {item.name}
                            </p>
                            {item.tag && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                {item.tag}
                              </span>
                            )}
                            {purchased && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                已购
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{item.description}</p>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                        {purchased ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-emerald-500 font-semibold">{active ? '已激活' : '未启用'}</span>
                            <button
                              onClick={() => handleToggleActive(item)}
                              className={`relative inline-flex h-5 w-9 rounded-full border-2 border-transparent transition-colors ${
                                active ? 'bg-purple-600' : 'bg-slate-700'
                              }`}
                            >
                              <span
                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                                  active ? 'translate-x-4' : 'translate-x-0'
                                }`}
                              />
                            </button>
                          </div>
                        ) : locked ? (
                          <div className="flex items-center gap-1">
                            <Lock className="w-3 h-3 text-amber-500" />
                            <span className="text-[10px] text-amber-400">{TIER_LABELS[item.minWeight]}</span>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleGoToStore(item)}
                            className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold transition-all bg-purple-600/20 border border-purple-500/40 text-purple-300 hover:bg-purple-600/30 hover:border-purple-400"
                          >
                            <ArrowUpCircle className="w-3 h-3" />
                            ¥{item.price}
                          </button>
                        )}
                      </div>
                    </div>

                    {locked && (
                      <div className="flex items-center gap-1.5 pl-8">
                        <Lock className="w-2.5 h-2.5 text-amber-500/60" />
                        <span className="text-[10px] text-amber-500/70">
                          需要 {TIER_LABELS[item.minWeight]} 及以上。立即
                          <button
                            onClick={() => toast({ title: '正在跳转到商城...', description: '升级套餐页面即将到来' })}
                            className="underline ml-1 hover:text-amber-400"
                          >升级</button>
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  VIP 全托管浮窗
// ─────────────────────────────────────────────────────────────────────────────

function VIPFloatingButton() {
  const { assets } = useWorkbench()
  const { toast } = useToast()
  const hasVIP = (assets.addons_purchased || []).includes(ADDON_VIP_SERVICE)

  if (!hasVIP) return null

  const handleClick = () => {
    toast({ title: '👑 VIP 全托管通道', description: '专属顾问正在为您服务，请稍候...' })
  }

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      className="fixed bottom-24 right-6 z-[60]"
    >
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="relative flex items-center gap-2 px-4 py-3 rounded-2xl text-white shadow-2xl"
        style={{
          background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 50%, #b45309 100%)',
          boxShadow: '0 8px 32px rgba(245,158,11,0.5), inset 0 1px 0 rgba(255,255,255,0.3)',
        }}
        onClick={handleClick}
      >
        <span className="absolute inset-0 rounded-2xl animate-ping opacity-30" style={{ background: 'rgba(245,158,11,0.5)' }} />

        <div className="relative">
          <Crown className="w-5 h-5" />
          <motion.div
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity as any }}
            className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-300 rounded-full"
          />
        </div>

        <div className="relative text-left">
          <p className="text-sm font-bold">👑 VIP 全托管</p>
          <p className="text-[10px] opacity-80">专属顾问在线</p>
        </div>

        <div
          className="absolute top-0 left-0 w-full h-full rounded-2xl opacity-20"
          style={{
            background: 'linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.5) 50%, transparent 70%)',
            animation: 'shimmer 2s infinite',
          }}
        />
      </motion.button>

      <style jsx>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%) skewX(-20deg); }
          100% { transform: translateX(200%) skewX(-20deg); }
        }
      `}</style>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  Tab definitions
// ─────────────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'leads',   icon: <Search className="w-3.5 h-3.5" />, label: '🔍 线索挖掘', color: 'text-cyan-400',   bg: 'bg-cyan-500/10' },
  { id: 'ai',      icon: <Sparkles className="w-3.5 h-3.5" />, label: '✍️ AI大脑', color: 'text-purple-400', bg: 'bg-purple-500/10' },
  { id: 'sender',  icon: <Send className="w-3.5 h-3.5" />,   label: '🚀 发信引擎', color: 'text-blue-400',    bg: 'bg-blue-500/10' },
  { id: 'intent',  icon: <Brain className="w-3.5 h-3.5" />,   label: '🧠 意图商机', color: 'text-amber-400',   bg: 'bg-amber-500/10' },
  { id: 'system',  icon: <Shield className="w-3.5 h-3.5" />, label: '🛡️ 系统保障', color: 'text-red-400',    bg: 'bg-red-500/10' },
  { id: 'addons',  icon: <ShoppingCart className="w-3.5 h-3.5" />, label: '🛒 增值', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
]

const TAB_CONTENT: Record<string, React.ReactNode> = {
  leads:  <TabLeads />,
  ai:     <TabAIBrain />,
  sender: <TabSender />,
  intent: <TabIntent />,
  system: <TabSystem />,
  addons: <TabAddons />,
}

// ─────────────────────────────────────────────────────────────────────────────
//  Main Drawer Component
// ─────────────────────────────────────────────────────────────────────────────

export function NovaDrawer() {
  const { drawerOpen, closeDrawer, initialDrawerTab, openDrawerToTab, setInitialDrawerTab, userPlan, activeConfig, updateConfig } = useWorkbench() as any
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState('leads')
  const weight = PLAN_WEIGHT[String(userPlan ?? '')] || 1

  const [tempConfig, setTempConfig] = useState<ActiveConfig>(activeConfig)

  useEffect(() => {
    if (drawerOpen) {
      setTempConfig(activeConfig)
      setActiveTab('leads')
    }
  }, [drawerOpen, activeConfig])

  const effectiveTab = initialDrawerTab || activeTab

  const updateTempConfig = useCallback((updates: Partial<ActiveConfig>) => {
    setTempConfig(prev => ({ ...prev, ...updates }))
  }, [])

  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
    setInitialDrawerTab?.(null)
  }

  const handleApplyConfig = () => {
    updateConfig(tempConfig)
    toast({
      title: '✅ 战术配置已更新生效',
      description: '您的配置已保存，下次使用时自动加载',
    })
    closeDrawer()
  }

  const handleCancel = () => {
    setTempConfig(activeConfig)
    closeDrawer()
  }

  const handleBackdropClose = () => {
    handleCancel()
  }

  return (
    <>
      <VIPFloatingButton />

      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-md"
              onClick={handleBackdropClose}
            />

            <motion.div
              key="drawer"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 32, mass: 0.8 }}
              className="fixed right-0 top-0 bottom-0 z-50 flex"
            >
              <div
                className="relative flex flex-col w-[360px] xl:w-[400px] h-full"
                style={{
                  background: 'linear-gradient(180deg, rgba(15,20,40,0.98) 0%, rgba(10,13,28,0.99) 100%)',
                  borderLeft: '1px solid rgba(139,92,246,0.2)',
                  boxShadow: '-20px 0 60px rgba(0,0,0,0.6), inset 1px 0 0 rgba(255,255,255,0.05)',
                }}
              >
                <div
                  className="h-0.5 w-full flex-shrink-0"
                  style={{ background: 'linear-gradient(90deg, transparent, rgba(139,92,246,0.8), rgba(59,130,246,0.8), transparent)' }}
                />

                <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 flex-shrink-0">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-white">高级配置</h2>
                      <span className={`text-xs font-semibold ${TIER_COLORS[weight]} bg-current/10 px-2 py-0.5 rounded-full border border-current/20`}
                        style={{ color: weight >= 3 ? '#fbbf24' : weight >= 2 ? '#a78bfa' : '#94a3b8' }}>
                        {TIER_LABELS[weight]}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">Pro Mode — 功能分级与 SKU 矩阵</p>
                  </div>
                  <button
                    onClick={handleCancel}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/10 transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="px-4 py-2.5 border-b border-white/5 flex-shrink-0" style={{ background: 'rgba(0,0,0,0.2)' }}>
                  <div className="grid grid-cols-3 gap-1">
                    {TABS.map(tab => {
                      const active = effectiveTab === tab.id
                      return (
                        <button
                          key={tab.id}
                          onClick={() => handleTabChange(tab.id)}
                          className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-150 ${
                            active
                              ? `${tab.bg} ${tab.color} border border-current/25`
                              : 'text-slate-500 border border-transparent hover:text-slate-300 hover:bg-white/5'
                          }`}
                        >
                          <span className="flex-shrink-0">{tab.icon}</span>
                          <span className="hidden 2xl:inline truncate">{tab.label}</span>
                          <span className="2xl:hidden truncate text-[10px]">{tab.label.split(' ')[1]}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={effectiveTab}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.15 }}
                  >
                    <DrawerTempConfigContext.Provider value={{ tempConfig, updateTempConfig }}>
                      {TAB_CONTENT[effectiveTab]}
                    </DrawerTempConfigContext.Provider>
                  </motion.div>
                </AnimatePresence>
                </div>

                <div className="px-5 py-4 border-t border-white/5 flex-shrink-0 space-y-2" style={{ background: 'rgba(0,0,0,0.3)' }}>
                  <div className="flex gap-2">
                    <button
                      onClick={handleCancel}
                      className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-400 border border-slate-700 hover:bg-white/5 hover:text-white transition-all"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleApplyConfig}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white"
                      style={{
                        background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                        boxShadow: '0 4px 12px rgba(124,58,237,0.35)',
                      }}
                    >
                      <Check className="w-4 h-4" />
                      应用配置
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}