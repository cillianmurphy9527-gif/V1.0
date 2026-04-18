'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Zap, Globe, Package, Crown, Loader2,
  CheckCircle2, Sparkles, Star, ShoppingBag,
  AlertCircle, Shield, Lock, Download, Target, Mail, BadgeCheck
} from 'lucide-react'
import { PaymentDialog } from '@/components/PaymentDialog'
import { IconRenderer, type IconName } from '@/components/IconRenderer'
import { useToast } from '@/components/ui/use-toast'

// 判断用户是否有有效订阅
function hasValidSubscription(tier: string | undefined | null): boolean {
  if (!tier) return false
  return ['STARTER', 'PRO', 'MAX'].includes(tier.toUpperCase())
}

// ─── 动态图标渲染器 ───────────────────────────────────────────────
function DynamicIcon({ name, className }: { name: string, className?: string }) {
  const icons: Record<string, any> = { Zap, Globe, Package, Crown, Target, Mail, Shield, Star };
  const Icon = icons[name] || Zap;
  return <Icon className={className} />;
}

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

// ─── 绝美皮肤 1：核心套餐卡片 ──────────────────────────────────────────
function PlanCard({ plan, onBuy, isBuying }: { plan: any; onBuy: () => void; isBuying: boolean }) {
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
      {isFeatured && <div className="absolute -inset-px bg-gradient-to-r from-blue-500/10 via-cyan-500/5 to-blue-500/10 rounded-3xl blur-xl -z-10" />}
      {isFeatured && <span className="absolute -top-4 left-1/2 -translate-x-1/2 px-5 py-1.5 bg-gradient-to-r from-blue-500 to-cyan-400 text-white text-xs font-bold rounded-full shadow-lg shadow-blue-500/30"><Sparkles className="w-3 h-3 inline mr-1" />主推</span>}

      <div>
        <h3 className="text-xl font-bold text-white tracking-tight">{plan.name}</h3>
        <p className="text-sm text-slate-500 mt-1 line-clamp-2">{plan.subtitle || plan.desc}</p>
        {plan.coreOutcome && <p className={`text-sm font-medium mt-2 ${isFeatured ? 'text-blue-400' : isMax ? 'text-amber-400' : 'text-emerald-400'}`}>✦ {plan.coreOutcome}</p>}
      </div>

      <div className="flex items-baseline gap-1.5">
        <span className={`text-5xl font-black tracking-tight ${isFeatured ? 'bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent' : isMax ? 'bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent' : 'text-white'}`}>¥{plan.price}</span>
        <span className="text-slate-500 text-base">/月</span>
      </div>

      <ul className="space-y-3 flex-1">
        {(plan.features || []).map((f:any) => (
          <li key={f.label} className={`flex items-start gap-3 text-sm ${f.locked ? 'text-slate-600' : 'text-slate-400'}`}>
            <CheckCircle2 className={`w-4 h-4 mt-0.5 flex-shrink-0 ${f.locked ? 'text-slate-700' : isFeatured ? 'text-blue-400' : isMax ? 'text-amber-400' : 'text-emerald-400'}`} />
            <span className={f.locked ? 'opacity-40' : ''}><span className="text-white/80 font-medium">{f.label}：</span>{f.value}</span>
          </li>
        ))}
      </ul>

      <button
        onClick={onBuy}
        disabled={isBuying}
        className={`w-full py-4 rounded-xl text-sm font-bold text-white transition-all duration-200 disabled:opacity-50 ${isFeatured ? 'bg-gradient-to-r from-blue-500 to-cyan-400 hover:from-blue-400 hover:to-cyan-300 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 hover:scale-[1.02] active:scale-[0.98]' : isMax ? 'bg-gradient-to-r from-amber-500 to-orange-400 hover:from-amber-400 hover:to-orange-300 shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30' : 'bg-slate-800/80 hover:bg-slate-700/80 border border-white/5'}`}
      >
        {isBuying ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : (plan.ctaText || '立即配置')}
      </button>
    </motion.div>
  )
}

// ─── 绝美皮肤 2：额度包卡片 ──────────────────────────────────────────
function QuotaCard({ addon, onBuy, isBuying, userHasSubscription }: { addon: any; onBuy: () => void; isBuying: boolean; userHasSubscription: boolean }) {
  const price = addon.price ?? 0
  const shortDesc = addon.shortDesc ?? addon.description ?? addon.subtitle ?? ''
  const iconName = addon.icon || 'Zap'
  const badge = addon.badge

  const getColorClass = () => {
    if (addon.tokens || addon.id?.includes('token')) return { accent: 'from-amber-500 to-orange-400', border: 'border-amber-500/20', hover: 'hover:border-amber-500/50', badge: 'from-amber-500 to-orange-400', glow: 'shadow-amber-500/10' }
    if (addon.emails || addon.id?.includes('email')) return { accent: 'from-emerald-500 to-teal-400', border: 'border-emerald-500/20', hover: 'hover:border-emerald-500/50', badge: 'from-emerald-500 to-teal-400', glow: 'shadow-emerald-500/10' }
    if (addon.leads || addon.id?.includes('lead')) return { accent: 'from-cyan-500 to-blue-400', border: 'border-cyan-500/20', hover: 'hover:border-cyan-500/50', badge: 'from-cyan-500 to-blue-400', glow: 'shadow-cyan-500/10' }
    return { accent: 'from-blue-500 to-indigo-400', border: 'border-blue-500/20', hover: 'hover:border-blue-500/50', badge: 'from-blue-500 to-indigo-400', glow: 'shadow-blue-500/10' }
  }
  const colors = getColorClass()

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} whileHover={{ scale: userHasSubscription ? 1.02 : 1 }} className={`relative flex items-center gap-5 p-5 backdrop-blur-xl border ${colors.border} ${userHasSubscription ? colors.hover : 'opacity-50'} rounded-2xl bg-slate-900/40 transition-all duration-200`}>
      {badge && <span className={`absolute -top-2.5 right-4 px-2.5 py-0.5 bg-gradient-to-r ${colors.badge} text-white text-xs font-bold rounded-full shadow-lg`}>{badge}</span>}
      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${userHasSubscription ? colors.accent : 'from-slate-600 to-slate-700'} flex items-center justify-center shadow-lg ${userHasSubscription ? colors.glow : ''} flex-shrink-0`}>
        {userHasSubscription ? <IconRenderer name={iconName} size={22} className="text-white" /> : <Lock size={22} className="text-white" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold text-sm tracking-tight">{addon.name}</p>
        <p className="text-slate-500 text-xs mt-0.5 line-clamp-1">{shortDesc}</p>
        <p className={`bg-gradient-to-r ${colors.accent} bg-clip-text text-transparent text-xs mt-1 font-medium`}>
          {addon.tokens ? `${addon.tokens.toLocaleString()} tokens` : addon.emails ? `${addon.emails.toLocaleString()} 封` : addon.leads ? `${addon.leads.toLocaleString()} 家` : (addon.unit || '专属配额')}
        </p>
      </div>
      <button onClick={onBuy} disabled={isBuying || !userHasSubscription} className={`flex-shrink-0 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all duration-200 hover:scale-105 active:scale-95 ${userHasSubscription ? `bg-gradient-to-r ${colors.accent} shadow-lg ${colors.glow}` : 'bg-slate-700/80 cursor-not-allowed border border-white/5'}`}>
        {isBuying ? <Loader2 className="w-4 h-4 animate-spin" /> : userHasSubscription ? <span className="bg-gradient-to-r from-white to-white/90 bg-clip-text text-transparent">¥{price}</span> : <span className="flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" />请先订阅</span>}
      </button>
    </motion.div>
  )
}

// ─── 绝美皮肤 3：域名包卡片 ──────────────────────────────────────────
function DomainCard({ addon, onBuy, isBuying, userHasSubscription }: { addon: any; onBuy: () => void; isBuying: boolean; userHasSubscription: boolean }) {
  const price = addon.price ?? 0
  const shortDesc = addon.shortDesc ?? addon.description ?? ''
  const iconName = addon.icon || 'Globe'
  const badge = addon.badge

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} whileHover={{ scale: userHasSubscription ? 1.02 : 1 }} className={`relative flex items-center gap-5 p-5 backdrop-blur-xl border border-blue-500/20 ${userHasSubscription ? 'hover:border-blue-500/50' : 'opacity-50'} rounded-2xl bg-slate-900/40 transition-all duration-200`}>
      {badge && <span className="absolute -top-2.5 right-4 px-2.5 py-0.5 bg-gradient-to-r from-blue-500 to-cyan-400 text-white text-xs font-bold rounded-full shadow-lg">{badge}</span>}
      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${userHasSubscription ? 'from-blue-500 to-cyan-400' : 'from-slate-600 to-slate-700'} flex items-center justify-center shadow-lg shadow-blue-500/10 flex-shrink-0`}>
        {userHasSubscription ? <IconRenderer name={iconName} size={22} className="text-white" /> : <Lock size={22} className="text-white" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold text-sm tracking-tight">{addon.name}</p>
        <p className="text-slate-500 text-xs mt-0.5 line-clamp-1">{shortDesc}</p>
        <p className="text-blue-400/80 text-xs mt-1 font-medium">{addon.domainCount || 1} 个专属发信域名 · 永久有效</p>
      </div>
      <button onClick={onBuy} disabled={isBuying || !userHasSubscription} className={`flex-shrink-0 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all duration-200 hover:scale-105 active:scale-95 ${userHasSubscription ? 'bg-gradient-to-r from-blue-500 to-cyan-400 shadow-lg shadow-blue-500/20' : 'bg-slate-700/80 cursor-not-allowed border border-white/5'}`}>
        {isBuying ? <Loader2 className="w-4 h-4 animate-spin" /> : userHasSubscription ? <span className="bg-gradient-to-r from-white to-white/90 bg-clip-text text-transparent">¥{price}</span> : <span className="flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" />请先订阅</span>}
      </button>
    </motion.div>
  )
}

// ─── 绝美皮肤 4：模板包卡片 ──────────────────────────────────────────
function TemplateCard({ asset, onBuy, isBuying, userHasSubscription }: { asset: any; onBuy: () => void; isBuying: boolean; userHasSubscription: boolean }) {
  const price = asset.price ?? 0
  const shortDesc = asset.shortDesc ?? asset.description ?? ''
  const iconName = asset.icon || 'Briefcase'
  const isCustom = asset.isCustom

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} whileHover={{ scale: userHasSubscription ? 1.02 : 1 }} className={`relative flex flex-col gap-4 p-6 rounded-2xl backdrop-blur-xl border transition-all duration-200 ${isCustom ? `bg-gradient-to-br from-purple-950/40 to-slate-900/60 border-purple-500/30 ${userHasSubscription ? 'hover:border-purple-500/60' : ''} shadow-xl shadow-purple-500/5` : `bg-slate-900/40 border-purple-500/20 ${userHasSubscription ? 'hover:border-purple-500/50' : ''}`} ${!userHasSubscription ? 'opacity-50' : ''}`}>
      <div className="flex items-center gap-2">
        {asset.badge && <span className="px-2.5 py-0.5 bg-gradient-to-r from-purple-500 to-pink-400 text-white text-xs font-bold rounded-full shadow-lg">{asset.badge}</span>}
        <span className="px-2.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-full backdrop-blur-sm">永久有效</span>
      </div>
      <div className="flex items-start gap-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/10 flex-shrink-0 ${isCustom ? 'bg-gradient-to-br from-purple-500 to-pink-400' : 'bg-gradient-to-br from-purple-500 to-purple-400'}`}>
          {userHasSubscription ? <IconRenderer name={iconName} size={22} className="text-white" /> : <Lock size={22} className="text-white" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm leading-snug tracking-tight">{asset.name}</p>
          <p className="text-slate-500 text-xs mt-1 leading-relaxed line-clamp-2">{shortDesc}</p>
        </div>
      </div>
      <div className="flex items-center justify-between pt-2 mt-auto">
        <div>
          <span className={`text-2xl font-black tracking-tight ${isCustom ? 'bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent' : 'text-white'}`}>¥{price}</span>
        </div>
        <button onClick={onBuy} disabled={isBuying || !userHasSubscription} className={`px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all duration-200 hover:scale-105 active:scale-95 shadow-lg ${userHasSubscription ? isCustom ? 'bg-gradient-to-r from-purple-500 to-pink-400 shadow-purple-500/20' : 'bg-gradient-to-r from-purple-500 to-purple-400 shadow-purple-500/10' : 'bg-slate-700/80 cursor-not-allowed border border-white/5'}`}>
          {isBuying ? <Loader2 className="w-4 h-4 animate-spin" /> : !userHasSubscription ? <span className="flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" />请先订阅</span> : isCustom ? '立即定制' : '立即获取'}
        </button>
      </div>
    </motion.div>
  )
}

// ─── 绝美皮肤 5：高级服务卡片 ──────────────────────────────────────────
function PremiumServiceCard({ service, onBuy, isBuying, userHasSubscription }: { service: any; onBuy: () => void; isBuying: boolean; userHasSubscription: boolean }) {
  const price = service.price
  const iconName = service.icon || 'Star'

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} whileHover={{ scale: userHasSubscription ? 1.02 : 1 }} className={`relative flex flex-col gap-5 p-6 rounded-2xl backdrop-blur-xl border transition-all duration-200 overflow-hidden ${service.popular || service.badge ? 'bg-gradient-to-br from-amber-950/30 to-slate-900/60 border-amber-500/30 shadow-xl shadow-amber-500/5' : 'bg-slate-900/40 border-white/5 hover:border-white/15'} ${!userHasSubscription ? 'opacity-50' : ''}`}>
      {(service.popular || service.badge) && <div className="absolute -top-24 -right-24 w-48 h-48 bg-gradient-to-br from-amber-500/15 to-orange-500/5 rounded-full blur-3xl" />}
      <div className="flex items-center gap-2">
        {service.badge && <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full shadow-lg ${(service.popular || service.badge) ? 'bg-gradient-to-r from-amber-500 to-orange-400 text-white' : 'bg-slate-700/80 text-white border border-white/10'}`}>{service.badge}</span>}
      </div>
      <div className="flex items-start gap-4">
        <div className={`w-14 h-14 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0 ${(service.popular || service.badge) ? 'bg-gradient-to-br from-amber-500 to-orange-400 shadow-amber-500/20' : 'bg-gradient-to-br from-slate-700 to-slate-600'}`}>
          {userHasSubscription ? <IconRenderer name={iconName} size={26} className="text-white" /> : <Lock size={26} className="text-white" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm leading-snug tracking-tight">{service.name}</p>
          <p className="text-slate-500 text-sm mt-1 leading-relaxed line-clamp-2">{service.shortDesc}</p>
        </div>
      </div>
      <div className="flex items-center justify-between pt-3 border-t border-white/5 mt-auto">
        <div>
          <span className={`text-3xl font-black tracking-tight ${(service.popular || service.badge) ? 'bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent' : 'text-white'}`}>¥{price}</span>
        </div>
        <button onClick={onBuy} disabled={isBuying || !userHasSubscription} className={`px-6 py-3 rounded-xl text-sm font-bold text-white transition-all duration-200 hover:scale-105 active:scale-95 shadow-lg ${userHasSubscription ? (service.popular || service.badge) ? 'bg-gradient-to-r from-amber-500 to-orange-400 shadow-amber-500/20' : 'bg-gradient-to-r from-slate-600 to-slate-500 shadow-slate-500/10' : 'bg-slate-700/80 cursor-not-allowed border border-white/5'}`}>
          {isBuying ? <Loader2 className="w-4 h-4 animate-spin" /> : !userHasSubscription ? <span className="flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" />请先订阅</span> : '立即购买'}
        </button>
      </div>
    </motion.div>
  )
}

// ─── 页面主入口 ───────────────────────────────────────────────────
export default function StorePage() {
  const { toast } = useToast()
  const [isPaymentOpen, setIsPaymentOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<any>(null)
  const [userTier, setUserTier] = useState<string | null>(null)
  const [liveGroups, setLiveGroups] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      try {
        const resSub = await fetch('/api/wallet/data', { cache: 'no-store' });
        if (resSub.ok) { const json = await resSub.json(); setUserTier(json?.user?.subscriptionTier || null); }
        
        const resStore = await fetch('/api/public/products?t=' + Date.now(), { cache: 'no-store' });
        const jsonStore = await resStore.json();
        if (jsonStore.success && jsonStore.data.groups) setLiveGroups(jsonStore.data.groups);
      } catch (e) {} finally { setLoading(false); }
    }
    init();
  }, [])

  const openPayment = (product: any, cardType: string) => {
    const isAddon = cardType !== 'plan';
    const userHasSub = hasValidSubscription(userTier);
    if (isAddon && !userHasSub) {
      return toast({ title: '仅限订阅用户', description: '请先选择基础订阅方案', variant: 'destructive' })
    }
    setSelectedProduct({ ...product, type: isAddon ? 'addon' : 'subscription' });
    setIsPaymentOpen(true);
  }

  // 🚀 核心路由站：根据后台的卡片类型，调用对应的精美 UI！
  const renderCard = (item: any, cardType: string, userHasSub: boolean) => {
    if (cardType === 'plan') return <PlanCard key={item.id} plan={item} onBuy={() => openPayment(item, 'plan')} isBuying={false} />;
    if (cardType === 'quota') return <QuotaCard key={item.id} addon={item} onBuy={() => openPayment(item, 'quota')} isBuying={false} userHasSubscription={userHasSub} />;
    if (cardType === 'domain') return <DomainCard key={item.id} addon={item} onBuy={() => openPayment(item, 'domain')} isBuying={false} userHasSubscription={userHasSub} />;
    if (cardType === 'template') return <TemplateCard key={item.id} asset={item} onBuy={() => openPayment(item, 'template')} isBuying={false} userHasSubscription={userHasSub} />;
    if (cardType === 'premium') return <PremiumServiceCard key={item.id} service={item} onBuy={() => openPayment(item, 'premium')} isBuying={false} userHasSubscription={userHasSub} />;
    
    // 默认 fallback
    return <QuotaCard key={item.id} addon={item} onBuy={() => openPayment(item, 'quota')} isBuying={false} userHasSubscription={userHasSub} />;
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-950"><Loader2 className="w-10 h-10 animate-spin text-blue-500" /></div>

  const userHasSub = hasValidSubscription(userTier);

  return (
    <div className="min-h-screen bg-slate-950 pb-20 antialiased relative">
      {/* 科技感背景网格 */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(139,92,246,0.06),transparent)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_60%_40%_at_50%_0%,#000_40%,transparent_100%)]" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-6 pt-16">
        {/* 🛠️ 重新设计的精简绝美头部标题栏 */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-14">
          <div className="flex items-center gap-5 mb-3">
            {/* 更精致、比例更平衡的图标容器 */}
            <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 via-purple-500 to-pink-500 flex items-center justify-center shadow-xl shadow-purple-500/20">
              <Sparkles className="w-7 h-7 text-white/90" />
              <div className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full bg-slate-950 border-2 border-slate-950 p-0.5">
                  <BadgeCheck className="w-full h-full text-emerald-400" />
              </div>
            </div>
            <div>
              {/* 大道至简的商城标题 */}
              <h1 className="text-4xl font-extrabold tracking-tight text-white">
                <span className="bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">商城</span>
              </h1>
              {/* 涵盖全系统服务的终极副标题 */}
              <p className="text-slate-400 text-sm mt-2 max-w-2xl leading-relaxed">
                一站式获取全矩阵拓客资源。从核心订阅升级、多维额度补给（线索/算力/发信），到独立域名基建与高阶专家服务，全链路赋能您的业务爆发。
              </p>
            </div>
          </div>
        </motion.div>

        {/* 动态渲染所有 CMS 分组 */}
        {liveGroups.map((group) => (
          <section key={group.id} className="mb-16">
            <SectionTitle icon={<DynamicIcon name={group.icon} className="w-5 h-5 text-slate-400" />} title={group.name} desc={group.desc} />
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* 遍历组内所有上架商品，并呼叫精致的 UI */}
              {group.items.filter((i:any) => i.status !== 'inactive').map((item:any) => renderCard(item, group.cardType, userHasSub))}
            </div>

            {group.items.filter((i:any) => i.status !== 'inactive').length === 0 && (
              <div className="p-8 mt-4 text-center text-slate-600 border border-dashed border-slate-800 rounded-2xl text-sm font-medium">该分类下暂无上架商品</div>
            )}
          </section>
        ))}
      </div>

      <PaymentDialog isOpen={isPaymentOpen} onClose={() => setIsPaymentOpen(false)} product={selectedProduct} userSubscriptionTier={userTier} />
    </div>
  )
}