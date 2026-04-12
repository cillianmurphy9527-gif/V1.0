'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Zap, Globe, Package, Crown, Loader2,
  CheckCircle2, Sparkles, Star, ShoppingBag,
  AlertCircle, Shield, Lock, Download
} from 'lucide-react'
import {
  PLANS, QUOTA_ADDONS, DOMAIN_ADDONS, TEMPLATE_ASSETS, PREMIUM_SERVICES,
  type Plan, type QuotaAddon, type DomainAddon, type TemplateAsset, type PremiumService
} from '@/config/pricing'
import { PaymentDialog, type PaymentDialogProduct } from '@/components/PaymentDialog'
import { IconRenderer, getIconById, type IconName } from '@/components/IconRenderer'
import { useToast } from '@/components/ui/use-toast'
import { useSession } from 'next-auth/react'

import { domainHealth } from '@/lib/dashboard/domain-health'
export { domainHealth }

// 判断用户是否有有效订阅
function hasValidSubscription(tier: string | undefined | null): boolean {
  if (!tier) return false
  return ['STARTER', 'PRO', 'MAX'].includes(tier.toUpperCase())
}

// ═══════════════════════════════════════════════════════════════════
// 扩展的产品数据结构
// ═══════════════════════════════════════════════════════════════════
interface ProductForDialog {
  id: string
  name: string
  price: number
  type?: string
  shortDesc?: string
  modalDetail?: string
  icon?: IconName
  badge?: string
  popular?: boolean
  isCustom?: boolean
  unitPrice?: number
  unitLabel?: string
  perPack?: number    // 每份包含的数量基数（如 300 家）
  maxQty?: number
  sets?: number
  credits?: number
  // 规格字段
  tokens?: number
  emails?: number
  leads?: number
  domainCount?: number
}

// ─── 区块标题 ─────────────────────────────────────────────────────
function SectionTitle({ icon, title, desc }: { icon: React.ReactNode; title: string; desc?: string }) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-1.5">
        <span className="text-slate-400">{icon}</span>
        <h2 className="text-base font-semibold text-white tracking-tight">{title}</h2>
      </div>
      {desc && <p className="text-slate-500 text-sm ml-9 leading-relaxed">{desc}</p>}
    </div>
  )
}

// ─── 区块A：订阅套餐卡片 ──────────────────────────────────────────
function PlanCard({ plan, onBuy, isBuying }: { plan: Plan; onBuy: () => void; isBuying: boolean }) {
  const isFeatured = plan.badge === '主推'
  const isMax = plan.id === 'MAX'

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      whileHover={{ y: isFeatured ? -6 : -4, scale: isFeatured ? 1.02 : 1.01 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className={`relative rounded-2xl border p-8 flex flex-col gap-6 ${
        isFeatured
          ? 'bg-slate-900/60 backdrop-blur-xl border-blue-500/30 shadow-[0_0_40px_rgba(59,130,246,0.1)]'
          : isMax
            ? 'bg-slate-900/50 backdrop-blur-xl border-amber-500/20 hover:border-amber-500/40'
            : 'bg-slate-900/40 backdrop-blur-xl border-white/5 hover:border-white/10'
      } transition-all duration-300`}
    >
      {/* Glow effect for featured */}
      {isFeatured && (
        <div className="absolute -inset-px bg-gradient-to-r from-blue-500/10 via-cyan-500/5 to-blue-500/10 rounded-3xl blur-xl -z-10" />
      )}

      {isFeatured && (
        <span className="absolute -top-4 left-1/2 -translate-x-1/2 px-5 py-1.5 bg-gradient-to-r from-blue-500 to-cyan-400 text-white text-xs font-bold rounded-full shadow-lg shadow-blue-500/30">
          <Sparkles className="w-3 h-3 inline mr-1" />主推
        </span>
      )}

      <div>
        <h3 className="text-xl font-bold text-white tracking-tight">{plan.name}</h3>
        <p className="text-sm text-slate-500 mt-1">{plan.subtitle}</p>
        <p className={`text-sm font-medium mt-2 ${
          isFeatured ? 'text-blue-400' : isMax ? 'text-amber-400' : 'text-emerald-400'
        }`}>✦ {plan.coreOutcome}</p>
      </div>

      <div className="flex items-baseline gap-1.5">
        <span className={`text-5xl font-black tracking-tight ${
          isFeatured
            ? 'bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent'
            : isMax
              ? 'bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent'
              : 'text-white'
        }`}>¥{plan.price}</span>
        <span className="text-slate-500 text-base">/月</span>
      </div>

      <ul className="space-y-3 flex-1">
        {plan.features.map(f => (
          <li key={f.label} className={`flex items-start gap-3 text-sm ${f.locked ? 'text-slate-600' : 'text-slate-400'}`}>
            <CheckCircle2 className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
              f.locked ? 'text-slate-700' : isFeatured ? 'text-blue-400' : isMax ? 'text-amber-400' : 'text-emerald-400'
            }`} />
            <span className={f.locked ? 'opacity-40' : ''}><span className="text-white/80 font-medium">{f.label}：</span>{f.value}</span>
          </li>
        ))}
      </ul>

      <button
        onClick={onBuy}
        disabled={isBuying}
        className={`w-full py-4 rounded-xl text-sm font-bold text-white transition-all duration-200 disabled:opacity-50 ${
          isFeatured
            ? 'bg-gradient-to-r from-blue-500 to-cyan-400 hover:from-blue-400 hover:to-cyan-300 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 hover:scale-[1.02] active:scale-[0.98]'
            : isMax
              ? 'bg-gradient-to-r from-amber-500 to-orange-400 hover:from-amber-400 hover:to-orange-300 shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30'
              : 'bg-slate-800/80 hover:bg-slate-700/80 border border-white/5'
        }`}
      >
        {isBuying ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : plan.ctaText}
      </button>
    </motion.div>
  )
}

// ─── 区块B：配额包卡片 ──────────────────────────────────────────
function QuotaCard({ addon, onBuy, isBuying, userHasSubscription }: { addon: QuotaAddon; onBuy: () => void; isBuying: boolean; userHasSubscription: boolean }) {
  const price = addon.price ?? 0
  const shortDesc = addon.shortDesc ?? addon.description ?? ''
  const iconName = addon.icon || 'Zap'
  const badge = addon.badge

  const getColorClass = () => {
    if (addon.tokens) return { accent: 'from-amber-500 to-orange-400', border: 'border-amber-500/20', hover: 'hover:border-amber-500/50', badge: 'from-amber-500 to-orange-400', glow: 'shadow-amber-500/10' }
    if (addon.emails) return { accent: 'from-emerald-500 to-teal-400', border: 'border-emerald-500/20', hover: 'hover:border-emerald-500/50', badge: 'from-emerald-500 to-teal-400', glow: 'shadow-emerald-500/10' }
    if (addon.leads) return { accent: 'from-cyan-500 to-blue-400', border: 'border-cyan-500/20', hover: 'hover:border-cyan-500/50', badge: 'from-cyan-500 to-blue-400', glow: 'shadow-cyan-500/10' }
    return { accent: 'from-amber-500 to-orange-400', border: 'border-amber-500/20', hover: 'hover:border-amber-500/50', badge: 'from-amber-500 to-orange-400', glow: 'shadow-amber-500/10' }
  }
  const colors = getColorClass()

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      whileHover={{ scale: userHasSubscription ? 1.02 : 1 }}
      className={`relative flex items-center gap-5 p-5 backdrop-blur-xl border ${colors.border} ${
        userHasSubscription ? colors.hover : 'opacity-50'
      } rounded-2xl bg-slate-900/40 transition-all duration-200`}
    >
      {badge && (
        <span className={`absolute -top-2.5 right-4 px-2.5 py-0.5 bg-gradient-to-r ${colors.badge} text-white text-xs font-bold rounded-full shadow-lg`}>
          {badge}
        </span>
      )}

      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${userHasSubscription ? colors.accent : 'from-slate-600 to-slate-700'} flex items-center justify-center shadow-lg ${userHasSubscription ? colors.glow : ''} flex-shrink-0`}>
        {userHasSubscription ? (
          <IconRenderer name={iconName} size={22} className="text-white" />
        ) : (
          <Lock size={22} className="text-white" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold text-sm tracking-tight">{addon.name}</p>
        <p className="text-slate-500 text-xs mt-0.5">{shortDesc}</p>
        <p className={`bg-gradient-to-r ${colors.accent} bg-clip-text text-transparent text-xs mt-1 font-medium`}>
          {addon.tokens ? `${addon.tokens.toLocaleString()} tokens` :
           addon.emails ? `${addon.emails.toLocaleString()} 封` :
           addon.leads ? `${addon.leads.toLocaleString()} 家` : addon.unit}
        </p>
      </div>

      <button
        onClick={onBuy}
        disabled={isBuying || !userHasSubscription}
        className={`flex-shrink-0 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all duration-200 hover:scale-105 active:scale-95 ${
          userHasSubscription
            ? `bg-gradient-to-r ${colors.accent} shadow-lg ${colors.glow}`
            : 'bg-slate-700/80 cursor-not-allowed border border-white/5'
        }`}
      >
        {isBuying ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : userHasSubscription ? (
          <span className="bg-gradient-to-r from-white to-white/90 bg-clip-text text-transparent">¥{price}</span>
        ) : (
          <span className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" />请先订阅
          </span>
        )}
      </button>
    </motion.div>
  )
}

// ─── 自定义数量增值包卡片 ─────────────────────────────────────────
interface CustomQuotaCardProps {
  id: string
  name: string
  shortDesc: string
  unitPrice: number      // 每份单价（元）
  unitLabel: string      // 每份包含的数量（如 "300 家"）
  perPack?: number       // 每份包含的数量基数（用于显示），默认 1
  step?: number          // 每次加减的步长（份数），默认 1
  modalDetail: string
  accentColor: string
  borderColor: string
  icon: IconName
  onBuy: (qty: number, total: number, product: ProductForDialog) => void
  isBuying: boolean
  maxQty?: number        // 最大份数
  userHasSubscription: boolean
}

function CustomQuotaCard({ id: _addonId, name, shortDesc, unitPrice, unitLabel, perPack = 1, step = 1, modalDetail, accentColor, borderColor, icon, onBuy, isBuying, maxQty = 100, userHasSubscription }: CustomQuotaCardProps) {
  // qty = 份数（默认 1 份起购）
  const [qty, setQty] = useState(1)
  // 每份包含的数量基数（如 300 家）
  const leadsPerPack = perPack
  // 实际线索总数
  const totalLeads = qty * leadsPerPack
  // 总价 = 份数 × 每份单价
  const totalPrice = qty * unitPrice

  const handleBuy = () => {
    if (!userHasSubscription) return
    const product: ProductForDialog = {
      id: _addonId,
      name: name,
      price: totalPrice,
      type: _addonId.includes('token') ? 'token' : _addonId.includes('email') ? 'email' : 'lead',
      shortDesc: shortDesc,
      modalDetail: modalDetail,
      icon: icon,
      isCustom: true,
      unitPrice: unitPrice,
      unitLabel: unitLabel,
      maxQty: maxQty,
      perPack: perPack,
    }
    onBuy(qty, totalPrice, product)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className={`relative p-5 backdrop-blur-xl border ${borderColor} rounded-2xl ${userHasSubscription ? 'hover:border-white/20' : 'opacity-50'} transition-all duration-200`}
    >
      <div className="flex items-center gap-4 mb-4">
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${userHasSubscription ? accentColor : 'from-slate-600 to-slate-700'} flex items-center justify-center shadow-lg flex-shrink-0`}>
          {userHasSubscription ? (
            <IconRenderer name={icon} size={22} className="text-white" />
          ) : (
            <Lock size={22} className="text-white" />
          )}
        </div>
        <div>
          <p className="text-white font-semibold text-sm tracking-tight">自定义数量</p>
          <p className="text-slate-500 text-xs mt-0.5">¥{unitPrice} / {unitLabel}</p>
        </div>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setQty(q => Math.max(1, q - step))}
            disabled={!userHasSubscription}
            className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold transition-colors flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
          >
            −
          </button>
          <input
            type="number"
            min={1}
            max={maxQty}
            value={qty}
            disabled={!userHasSubscription}
            onChange={e => setQty(Math.max(1, Math.min(parseInt(e.target.value) || 1, maxQty)))}
            className="w-16 text-center bg-white/5 border border-white/10 rounded-xl px-2 py-1.5 text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-40"
          />
          <button
            onClick={() => setQty(q => Math.min(q + step, maxQty))}
            disabled={!userHasSubscription}
            className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold transition-colors flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
          >
            +
          </button>
        </div>

        {/* 动态显示线索总数 */}
        <div className="flex flex-col">
          <span className="text-cyan-400 text-xs">共 {totalLeads.toLocaleString()} 家</span>
        </div>

        <div className="flex items-center gap-3 ml-auto">
          <span className="bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent font-black text-xl">¥{totalPrice}</span>
          <button
            onClick={handleBuy}
            disabled={isBuying || !userHasSubscription}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all duration-200 hover:scale-105 active:scale-95 ${
              userHasSubscription
                ? `bg-gradient-to-r ${accentColor} shadow-lg`
                : 'bg-slate-700/80 cursor-not-allowed border border-white/5'
            }`}
          >
            {isBuying ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : userHasSubscription ? (
              '购买'
            ) : (
              <span className="flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" />请先订阅
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <AlertCircle className="w-3.5 h-3.5 text-slate-500" />
        <span className="text-xs text-slate-500">单价固定 ¥{unitPrice}/{unitLabel}，无批量折扣</span>
      </div>
    </motion.div>
  )
}

// ─── 区块C：域名包卡片 ──────────────────────────────────────────
function DomainCard({ addon, onBuy, isBuying, userHasSubscription }: { addon: DomainAddon; onBuy: () => void; isBuying: boolean; userHasSubscription: boolean }) {
  const price = addon.price ?? 0
  const shortDesc = addon.shortDesc ?? addon.description ?? ''
  const iconName = addon.icon || 'Globe'
  const badge = addon.badge

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      whileHover={{ scale: userHasSubscription ? 1.02 : 1 }}
      className={`relative flex items-center gap-5 p-5 backdrop-blur-xl border border-blue-500/20 ${userHasSubscription ? 'hover:border-blue-500/50' : 'opacity-50'} rounded-2xl bg-slate-900/40 transition-all duration-200`}
    >
      {badge && (
        <span className="absolute -top-2.5 right-4 px-2.5 py-0.5 bg-gradient-to-r from-blue-500 to-cyan-400 text-white text-xs font-bold rounded-full shadow-lg">
          {badge}
        </span>
      )}

      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${userHasSubscription ? 'from-blue-500 to-cyan-400' : 'from-slate-600 to-slate-700'} flex items-center justify-center shadow-lg shadow-blue-500/10 flex-shrink-0`}>
        {userHasSubscription ? (
          <IconRenderer name={iconName} size={22} className="text-white" />
        ) : (
          <Lock size={22} className="text-white" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold text-sm tracking-tight">{addon.name}</p>
        <p className="text-slate-500 text-xs mt-0.5">{shortDesc}</p>
        <p className="text-blue-400/80 text-xs mt-1 font-medium">
          {addon.domainCount} 个发信域名配额 · {addon.validDays === -1 ? '永久有效' : `${addon.validDays}天`}
        </p>
      </div>

      <button
        onClick={onBuy}
        disabled={isBuying || !userHasSubscription}
        className={`flex-shrink-0 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all duration-200 hover:scale-105 active:scale-95 ${
          userHasSubscription
            ? 'bg-gradient-to-r from-blue-500 to-cyan-400 shadow-lg shadow-blue-500/20'
            : 'bg-slate-700/80 cursor-not-allowed border border-white/5'
        }`}
      >
        {isBuying ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : userHasSubscription ? (
          <span className="bg-gradient-to-r from-white to-white/90 bg-clip-text text-transparent">¥{price}</span>
        ) : (
          <span className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" />请先订阅
          </span>
        )}
      </button>
    </motion.div>
  )
}

// ─── 区块D：模板资产卡片 ─────────────────────────────────────────
function TemplateCard({ asset, onBuy, isBuying, userHasSubscription }: { asset: TemplateAsset; onBuy: () => void; isBuying: boolean; userHasSubscription: boolean }) {
  const price = asset.price ?? 0
  const shortDesc = asset.shortDesc ?? asset.description ?? ''
  const iconName = asset.icon || 'Briefcase'
  const isCustom = asset.isCustom

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      whileHover={{ scale: userHasSubscription ? 1.02 : 1 }}
      className={`relative flex flex-col gap-4 p-6 rounded-2xl backdrop-blur-xl border transition-all duration-200 ${
        isCustom
          ? `bg-gradient-to-br from-purple-950/40 to-slate-900/60 border-purple-500/30 ${userHasSubscription ? 'hover:border-purple-500/60' : ''} shadow-xl shadow-purple-500/5`
          : `bg-slate-900/40 border-purple-500/20 ${userHasSubscription ? 'hover:border-purple-500/50' : ''}`
      } ${!userHasSubscription ? 'opacity-50' : ''}`}
    >
      {/* 标签 */}
      <div className="flex items-center gap-2">
        {asset.badge && (
          <span className="px-2.5 py-0.5 bg-gradient-to-r from-purple-500 to-pink-400 text-white text-xs font-bold rounded-full shadow-lg">{asset.badge}</span>
        )}
        {asset.popular && !asset.badge && (
          <span className="px-2.5 py-0.5 bg-gradient-to-r from-amber-500 to-orange-400 text-white text-xs font-bold rounded-full shadow-lg">热门</span>
        )}
        <span className="px-2.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-full backdrop-blur-sm">永久有效</span>
      </div>

      <div className="flex items-start gap-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/10 flex-shrink-0 ${
          isCustom ? 'bg-gradient-to-br from-purple-500 to-pink-400' : 'bg-gradient-to-br from-purple-500 to-purple-400'
        }`}>
          {userHasSubscription ? (
            <IconRenderer name={iconName} size={22} className="text-white" />
          ) : (
            <Lock size={22} className="text-white" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm leading-snug tracking-tight">{asset.name}</p>
          <p className="text-slate-500 text-xs mt-1 leading-relaxed">{shortDesc}</p>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 mt-auto">
        <div>
          <span className={`text-2xl font-black tracking-tight ${
            isCustom ? 'bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent' : 'text-white'
          }`}>¥{price}</span>
          <span className="text-slate-500 text-xs ml-1.5">
            {asset.validDays === -1 ? '永久' : `${asset.validDays}天`}
            {asset.deliveryDays && ` · ${asset.deliveryDays}工作日交付`}
          </span>
        </div>
        <button
          onClick={onBuy}
          disabled={isBuying || !userHasSubscription}
          className={`px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all duration-200 hover:scale-105 active:scale-95 shadow-lg ${
            userHasSubscription
              ? isCustom
                ? 'bg-gradient-to-r from-purple-500 to-pink-400 shadow-purple-500/20'
                : 'bg-gradient-to-r from-purple-500 to-purple-400 shadow-purple-500/10'
              : 'bg-slate-700/80 cursor-not-allowed border border-white/5'
          }`}
        >
          {isBuying ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : !userHasSubscription ? (
            <span className="flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />请先订阅
            </span>
          ) : isCustom ? (
            '立即定制'
          ) : (
            '立即购买'
          )}
        </button>
      </div>
    </motion.div>
  )
}

// ─── 区块C2：高阶数据导出包卡片 ──────────────────────────────────
interface ExportPackageCardProps {
  sets: number
  credits: number
  originalPrice: number
  price: number
  badge?: string
  accentColor: string
  borderColor: string
  onBuy: () => void
  isBuying: boolean
  userHasSubscription: boolean
}

function ExportPackageCard({ sets, credits, originalPrice, price, badge, accentColor, borderColor, onBuy, isBuying, userHasSubscription }: ExportPackageCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      whileHover={{ scale: userHasSubscription ? 1.02 : 1 }}
      className={`relative flex flex-col gap-4 p-5 rounded-2xl backdrop-blur-xl border transition-all duration-200 ${
        badge ? `bg-gradient-to-br from-slate-900/60 to-slate-900/40 ${borderColor} shadow-xl` : `bg-slate-900/40 ${borderColor}`
      } ${!userHasSubscription ? 'opacity-50' : ''}`}
    >
      {badge && (
        <span className={`absolute -top-2.5 right-4 px-2.5 py-0.5 bg-gradient-to-r ${accentColor} text-white text-xs font-bold rounded-full shadow-lg`}>
          {badge}
        </span>
      )}

      <div className="flex items-start gap-4">
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${userHasSubscription ? accentColor : 'from-slate-600 to-slate-700'} flex items-center justify-center shadow-lg flex-shrink-0`}>
          {userHasSubscription ? (
            <Download size={22} className="text-white" />
          ) : (
            <Lock size={22} className="text-white" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm tracking-tight">{sets} 套装</p>
          <p className="text-slate-500 text-xs mt-0.5">{credits.toLocaleString()} 导出额度</p>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 mt-auto">
        <div>
          <span className={`text-2xl font-black tracking-tight ${
            badge ? `bg-gradient-to-r ${accentColor} bg-clip-text text-transparent` : 'text-white'
          }`}>¥{price}</span>
          <span className="text-slate-500 text-xs ml-1 line-through">¥{originalPrice}</span>
        </div>
        <button
          onClick={onBuy}
          disabled={isBuying || !userHasSubscription}
          className={`px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all duration-200 hover:scale-105 active:scale-95 shadow-lg ${
            userHasSubscription
              ? `bg-gradient-to-r ${accentColor} shadow-${badge ? 'blue' : 'purple'}-500/20`
              : 'bg-slate-700/80 cursor-not-allowed border border-white/5'
          }`}
        >
          {isBuying ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : !userHasSubscription ? (
            <span className="flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />请先订阅
            </span>
          ) : (
            '立即购买'
          )}
        </button>
      </div>
    </motion.div>
  )
}

// ─── 区块C2：自定义导出包卡片 ─────────────────────────────────────
interface ExportCustomCardProps {
  onBuy: (sets: number) => void
  isBuying: boolean
  userHasSubscription: boolean
}

function ExportCustomCard({ onBuy, isBuying, userHasSubscription }: ExportCustomCardProps) {
  const [sets, setSets] = useState(1)

  const total = calculateExportPrice(sets)
  const originalTotal = sets * 99 // 标准价

  const handleBuy = () => {
    if (!userHasSubscription) return
    onBuy(sets) // 只传 sets，总价由 calculateExportPrice 计算
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className={`relative p-5 rounded-2xl backdrop-blur-xl border border-blue-500/20 ${
        userHasSubscription ? 'hover:border-blue-500/50' : 'opacity-50'
      } transition-all duration-200`}
    >
      <div className="flex items-start gap-4 mb-4">
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${userHasSubscription ? 'from-blue-500 to-cyan-400' : 'from-slate-600 to-slate-700'} flex items-center justify-center shadow-lg flex-shrink-0`}>
          {userHasSubscription ? (
            <Download size={22} className="text-white" />
          ) : (
            <Lock size={22} className="text-white" />
          )}
        </div>
        <div>
          <p className="text-white font-semibold text-sm tracking-tight">自定义购买</p>
          <p className="text-slate-500 text-xs mt-0.5">灵活选择套数，享阶梯优惠</p>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSets(s => Math.max(1, s - 1))}
            disabled={!userHasSubscription}
            className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold transition-colors flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
          >
            −
          </button>
          <input
            type="number"
            min="1"
            max={100}
            value={sets}
            disabled={!userHasSubscription}
            onChange={e => setSets(Math.max(1, Math.min(parseInt(e.target.value) || 1, 100)))}
            className="w-16 text-center bg-white/5 border border-white/10 rounded-xl px-2 py-1.5 text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-40"
          />
          <button
            onClick={() => setSets(s => Math.min(s + 1, 100))}
            disabled={!userHasSubscription}
            className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold transition-colors flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
          >
            +
          </button>
        </div>
        <span className="text-slate-500 text-xs">套</span>

        <div className="flex items-center gap-3 ml-auto">
          <div className="text-right">
            <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent font-black text-xl">¥{total}</span>
            {total < originalTotal && (
              <span className="text-slate-500 text-xs line-through ml-1">¥{originalTotal}</span>
            )}
          </div>
          <button
            onClick={handleBuy}
            disabled={isBuying || !userHasSubscription}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all duration-200 hover:scale-105 active:scale-95 ${
              userHasSubscription
                ? 'bg-gradient-to-r from-blue-500 to-cyan-400 shadow-lg shadow-blue-500/20'
                : 'bg-slate-700/80 cursor-not-allowed border border-white/5'
            }`}
          >
            {isBuying ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : !userHasSubscription ? (
              <span className="flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" />请先订阅
              </span>
            ) : (
              '购买'
            )}
          </button>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <AlertCircle className="w-3.5 h-3.5 text-slate-500" />
        <span className="text-xs text-slate-500">
          {sets >= 10 ? '¥75/套（约 76 折）' : sets >= 5 ? '¥80/套（约 81 折）' : sets >= 2 ? '¥94/套（约 95 折）' : '¥99/套（标准价）'}
        </span>
      </div>
    </motion.div>
  )
}

// ─── 区块E：高级特权与服务卡片 ───────────────────────────────────
function PremiumServiceCard({ service, onBuy, isBuying, userHasSubscription }: { service: PremiumService; onBuy: () => void; isBuying: boolean; userHasSubscription: boolean }) {
  const price = service.price
  const iconName = service.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      whileHover={{ scale: userHasSubscription ? 1.02 : 1 }}
      className={`relative flex flex-col gap-5 p-6 rounded-2xl backdrop-blur-xl border transition-all duration-200 overflow-hidden ${
        service.popular
          ? 'bg-gradient-to-br from-amber-950/30 to-slate-900/60 border-amber-500/30 shadow-xl shadow-amber-500/5'
          : 'bg-slate-900/40 border-white/5 hover:border-white/15'
      } ${!userHasSubscription ? 'opacity-50' : ''}`}
    >
      {/* Glow effect */}
      {service.popular && (
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-gradient-to-br from-amber-500/15 to-orange-500/5 rounded-full blur-3xl" />
      )}

      {/* 标签行 */}
      <div className="flex items-center gap-2">
        {service.badge && (
          <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full shadow-lg ${
            service.popular
              ? 'bg-gradient-to-r from-amber-500 to-orange-400 text-white'
              : 'bg-slate-700/80 text-white border border-white/10'
          }`}>
            {service.badge}
          </span>
        )}
        <span className={`px-2.5 py-0.5 text-xs rounded-full backdrop-blur-sm ${
          service.validDays === -1
            ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
            : 'bg-blue-500/10 border border-blue-500/20 text-blue-400'
        }`}>
          {service.validDays === -1 ? '永久有效' : `有效期 ${service.validDays} 天`}
        </span>
      </div>

      {/* 图标和标题 */}
      <div className="flex items-start gap-4">
        <div className={`w-14 h-14 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0 ${
          service.popular
            ? 'bg-gradient-to-br from-amber-500 to-orange-400 shadow-amber-500/20'
            : 'bg-gradient-to-br from-slate-700 to-slate-600'
        }`}>
          {userHasSubscription ? (
            <IconRenderer name={iconName} size={26} className="text-white" />
          ) : (
            <Lock size={26} className="text-white" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm leading-snug tracking-tight">{service.name}</p>
          <p className="text-slate-500 text-sm mt-1 leading-relaxed">{service.shortDesc}</p>
        </div>
      </div>

      {/* 价格和按钮 */}
      <div className="flex items-center justify-between pt-3 border-t border-white/5 mt-auto">
        <div>
          <span className={`text-3xl font-black tracking-tight ${
            service.popular ? 'bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent' : 'text-white'
          }`}>¥{price}</span>
          <span className="text-slate-500 text-xs ml-1.5">
            {service.validDays === -1 ? '一次性' : '× ' + service.validDays + '天'}
            {service.deliveryDays && ` · ${service.deliveryDays}工作日交付`}
          </span>
        </div>
        <button
          onClick={onBuy}
          disabled={isBuying || !userHasSubscription}
          className={`px-6 py-3 rounded-xl text-sm font-bold text-white transition-all duration-200 hover:scale-105 active:scale-95 shadow-lg ${
            userHasSubscription
              ? service.popular
                ? 'bg-gradient-to-r from-amber-500 to-orange-400 shadow-amber-500/20'
                : 'bg-gradient-to-r from-slate-600 to-slate-500 shadow-slate-500/10'
              : 'bg-slate-700/80 cursor-not-allowed border border-white/5'
          }`}
        >
          {isBuying ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : !userHasSubscription ? (
            <span className="flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />请先订阅
            </span>
          ) : (
            '立即购买'
          )}
        </button>
      </div>
    </motion.div>
  )
}

// ─── 导出包统一定价计算函数 ──────────────────────────────────────
const calculateExportPrice = (sets: number): number => {
  if (sets === 2) return 188 // 2套固定特惠价
  if (sets === 5) return 399 // 5套固定超值价
  if (sets >= 10) return sets * 75
  if (sets >= 5) return sets * 80
  if (sets >= 2) return sets * 94
  return sets * 99 // 1套标准价
}

// ─── 主页面 ───────────────────────────────────────────────────────
export default function StorePage() {
  const { toast } = useToast()
  const [isPaymentOpen, setIsPaymentOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<ProductForDialog | null>(null)
  const [userSubscriptionTier, setUserSubscriptionTier] = useState<string | null>(null)

  useEffect(() => {
    const fetchUserSubscription = async () => {
      try {
        const res = await fetch('/api/wallet/data', { cache: 'no-store' })
        if (res.ok) {
          const json = await res.json()
          setUserSubscriptionTier(json?.user?.subscriptionTier || null)
        }
      } catch (e) {
        console.error('Failed to fetch subscription:', e)
      }
    }
    fetchUserSubscription()

    // 监听购买成功后的刷新事件
    const handleRefresh = () => {
      fetchUserSubscription()
    }
    window.addEventListener('refresh-user-data', handleRefresh)
    return () => {
      window.removeEventListener('refresh-user-data', handleRefresh)
    }
  }, [])

  const openPayment = (product: ProductForDialog) => {
    const isAddon = product.type !== 'subscription'
    const canBuy = hasValidSubscription(userSubscriptionTier)

    if (isAddon && !canBuy) {
      toast({
        title: '增值服务仅面向正式订阅用户开放',
        description: '请先选择基础订阅方案，解锁算力补充、线索额度、域名扩展等全部增值服务',
        variant: 'destructive',
      })
      return
    }
    setSelectedProduct(product)
    setIsPaymentOpen(true)
  }

  const buyQuotaAddon = (addon: QuotaAddon) => {
    const product: ProductForDialog = {
      id: addon.id, name: addon.name, price: addon.price ?? 0,
      type: addon.tokens ? 'token' : addon.emails ? 'email' : 'lead',
      shortDesc: addon.shortDesc, modalDetail: addon.modalDetail,
      icon: addon.icon, badge: addon.badge, popular: addon.badge === '热门',
    }
    openPayment(product)
  }

  const buyDomainAddon = (addon: DomainAddon) => {
    const product: ProductForDialog = {
      id: addon.id, name: addon.name, price: addon.price ?? 0, type: 'domain',
      shortDesc: addon.shortDesc, modalDetail: addon.modalDetail,
      icon: addon.icon, badge: addon.badge, popular: addon.badge === '推荐',
    }
    openPayment(product)
  }

  const buyTemplateAsset = (asset: TemplateAsset) => {
    const product: ProductForDialog = {
      id: asset.id, name: asset.name, price: asset.price ?? 0, type: 'template',
      shortDesc: asset.shortDesc, modalDetail: asset.modalDetail,
      icon: asset.icon, badge: asset.badge, popular: asset.popular, isCustom: asset.isCustom,
    }
    openPayment(product)
  }

  const buyPremiumService = (service: PremiumService) => {
    const product: ProductForDialog = {
      id: service.id, name: service.name, price: service.price ?? 0, type: 'premium',
      shortDesc: service.shortDesc, modalDetail: service.modalDetail,
      icon: service.icon, badge: service.badge, popular: service.popular,
    }
    openPayment(product)
  }

  const buyPlan = (plan: Plan) => {
    const product: ProductForDialog = {
      id: plan.id, name: plan.name, price: plan.price, type: 'subscription',
      shortDesc: plan.subtitle, icon: 'Shield', badge: plan.badge,
      modalDetail: plan.features.map(f => `• ${f.label}：${f.value}`).join('\n'),
    }
    openPayment(product)
  }

  const buyExportPack = (sets: number) => {
    const credits = sets * 1000
    const total = calculateExportPrice(sets)
    const product: ProductForDialog = {
      id: 'EXPORT_PACK',
      name: `高阶数据导出包 - ${sets} 套装`,
      price: total,
      type: 'export',
      shortDesc: `${credits.toLocaleString()} 导出额度`,
      modalDetail: `包含 ${credits.toLocaleString()} 个高意向线索导出额度。\n专项用于解锁高意向客户名单的导出权限，助您将高质量数据无缝对接企业 CRM 或销售团队。即刻生效，永久有效。`,
      icon: 'Download',
      badge: sets >= 5 ? '超值' : sets >= 2 ? '特惠' : undefined,
      isCustom: sets === 1,
      sets: sets,
      credits: credits,
      unitPrice: Math.round(total / sets),
      unitLabel: '套',
      maxQty: 100,
    }
    openPayment(product)
  }

  const userHasSub = hasValidSubscription(userSubscriptionTier)

  return (
    <div className="min-h-screen bg-slate-950 antialiased">
      {/* 全局网格背景 */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(139,92,246,0.06),transparent)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_60%_40%_at_50%_0%,#000_40%,transparent_100%)]" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-12">
        {/* 页头 */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-14"
        >
          <div className="flex items-center gap-4 mb-3">
            <div className="relative">
              <div className="absolute inset-0 bg-purple-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-400 flex items-center justify-center shadow-xl shadow-purple-500/20">
                <ShoppingBag className="w-6 h-6 text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-4xl font-bold text-white tracking-tight bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">增值商城</h1>
              <p className="text-slate-400 text-base mt-1">按需购买，灵活扩展您的拓客能力</p>
            </div>
          </div>
        </motion.div>

        {/* ══ 区块A：升级订阅方案 ══ */}
        <section className="mb-16">
          <SectionTitle
            icon={<Crown className="w-5 h-5" />}
            title="升级订阅方案"
            desc="选择适合阶段的套餐，每月自动续期，随时可升级"
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PLANS.map(plan => (
              <PlanCard key={plan.id} plan={plan} onBuy={() => buyPlan(plan)} isBuying={false} />
            ))}
          </div>
        </section>

        {/* ══ 区块B：算力与配额补充 ══ */}
        <section className="mb-16">
          <div className="mb-8">
            <SectionTitle icon={<Zap className="w-5 h-5" />} title="算力补充" desc="AI 算力永久有效，不过期，可叠加" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {QUOTA_ADDONS.filter(a => a.tokens).slice(0, 2).map(addon => (
                <QuotaCard key={addon.id} addon={addon} onBuy={() => buyQuotaAddon(addon)} isBuying={false} userHasSubscription={userHasSub} />
              ))}
              <CustomQuotaCard {...{
                id: 'token-custom', name: '自定义算力', shortDesc: '按需购买，¥109/10万 tokens',
                unitPrice: 109, unitLabel: '10万 tokens',
                modalDetail: '', accentColor: 'from-amber-500 to-orange-400', borderColor: 'border-amber-500/20', icon: 'Zap', maxQty: 20,
              }} onBuy={(_, __, product) => openPayment(product)} isBuying={false} userHasSubscription={userHasSub} />
            </div>
          </div>

          <div className="mb-8">
            <SectionTitle icon={<span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">✉️</span>} title="发信额度" desc="额外发信配额，当月有效" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {QUOTA_ADDONS.filter(a => a.emails).map(addon => (
                <QuotaCard key={addon.id} addon={addon} onBuy={() => buyQuotaAddon(addon)} isBuying={false} userHasSubscription={userHasSub} />
              ))}
              <CustomQuotaCard {...{
                id: 'email-custom', name: '自定义发信额度', shortDesc: '按需购买，¥18/1000封，当月有效',
                unitPrice: 18, unitLabel: '1000 封',
                modalDetail: '', accentColor: 'from-emerald-500 to-teal-400', borderColor: 'border-emerald-500/20', icon: 'Mail', maxQty: 50,
              }} onBuy={(_, __, product) => openPayment(product)} isBuying={false} userHasSubscription={userHasSub} />
            </div>
          </div>

          <div>
            <SectionTitle icon={<span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">🎯</span>} title="线索额度" desc="额外线索挖掘配额，当月有效" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {QUOTA_ADDONS.filter(a => a.leads).map(addon => (
                <QuotaCard key={addon.id} addon={addon} onBuy={() => buyQuotaAddon(addon)} isBuying={false} userHasSubscription={userHasSub} />
              ))}
              <CustomQuotaCard {...{
                id: 'lead-custom', name: '自定义线索额度', shortDesc: '单价固定 ¥199/300家，无批量折扣',
                unitPrice: 199, unitLabel: '300 家', perPack: 300, step: 1,
                modalDetail: '', accentColor: 'from-cyan-500 to-blue-400', borderColor: 'border-cyan-500/20', icon: 'Target', maxQty: 50,
              }} onBuy={(_, __, product) => openPayment(product)} isBuying={false} userHasSubscription={userHasSub} />
            </div>
          </div>
        </section>

        {/* ══ 区块C：域名扩展包 ══ */}
        <section className="mb-16">
          <SectionTitle icon={<Globe className="w-5 h-5" />} title="域名扩展包" desc="增加发信域名数量，提升并发能力，降低封号风险" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {DOMAIN_ADDONS.map(addon => (
              <DomainCard key={addon.id} addon={addon} onBuy={() => buyDomainAddon(addon)} isBuying={false} userHasSubscription={userHasSub} />
            ))}
          </div>
        </section>

        {/* ══ 区块C2：高阶数据导出包 ══ */}
        <section className="mb-16">
          <SectionTitle icon={<Download className="w-5 h-5" />} title="高阶数据导出包" desc="按需购买导出额度，灵活扩展您的数据资产变现能力" />
          <div className="space-y-4">
            {/* 阶梯定价选项 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 2套特惠包（主推） */}
              <ExportPackageCard
                sets={2}
                credits={2000}
                originalPrice={198}
                price={188}
                badge="主推"
                accentColor="from-blue-500 to-cyan-400"
                borderColor="border-blue-500/30"
                onBuy={() => buyExportPack(2)}
                isBuying={false}
                userHasSubscription={userHasSub}
              />
              {/* 5套囤货包（超值） */}
              <ExportPackageCard
                sets={5}
                credits={5000}
                originalPrice={495}
                price={399}
                badge="超值"
                accentColor="from-purple-500 to-pink-400"
                borderColor="border-purple-500/30"
                onBuy={() => buyExportPack(5)}
                isBuying={false}
                userHasSubscription={userHasSub}
              />
              {/* 自定义购买 */}
              <ExportCustomCard
                onBuy={(sets) => buyExportPack(sets)}
                isBuying={false}
                userHasSubscription={userHasSub}
              />
            </div>
          </div>
        </section>

        {/* ══ 区块D：永久资产与行业模板 ══ */}
        <section className="mb-16">
          <SectionTitle icon={<Package className="w-5 h-5" />} title="永久资产与行业模板" desc="一次购买，终身使用。专属行业话术 + AI 定制化策略包，为您的业务量身打造" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {TEMPLATE_ASSETS.map(asset => (
              <TemplateCard key={asset.id} asset={asset} onBuy={() => buyTemplateAsset(asset)} isBuying={false} userHasSubscription={userHasSub} />
            ))}
          </div>
        </section>

        {/* ══ 区块E：高级特权与服务 ══ */}
        <section className="mb-16">
          <SectionTitle icon={<Crown className="w-5 h-5" />} title="高级特权与服务" desc="面向成长型团队的高级增值服务，让您的业务快人一步" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {PREMIUM_SERVICES.map(service => (
              <PremiumServiceCard key={service.id} service={service} onBuy={() => buyPremiumService(service)} isBuying={false} userHasSubscription={userHasSub} />
            ))}
          </div>
        </section>

        {/* 底部提示 */}
        <div className="text-center py-10 border-t border-white/5">
          <p className="text-slate-500 text-sm flex items-center justify-center gap-2">
            <Star className="w-4 h-4 text-amber-400/60" />
            所有增值包均支持微信支付 / 支付宝 · 永久资产购买后立即解锁
          </p>
        </div>
      </div>

      <PaymentDialog
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
        product={selectedProduct}
        userSubscriptionTier={userSubscriptionTier}
      />
    </div>
  )
}
