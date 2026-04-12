'use client'

import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Zap, Mail, Target, Package, Crown,
  Loader2, CheckCircle2, Clock, Download,
  Gift, Users, Copy, Share2, AlertCircle,
  X, ExternalLink, ChevronRight, Ticket, Wallet as WalletIcon
} from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { IconRenderer } from '@/components/IconRenderer'

// ═══════════════════════════════════════════════════════════════════
// 数据类型定义
// ═══════════════════════════════════════════════════════════════════

interface UserInfo {
  id: string
  companyName: string
  subscriptionTier: string
  tokenBalance: number
  trialEndsAt: string | null
  createdAt: string
  exportCredits?: number
}

interface WalletInfo {
  emailCredits: number
  leadCredits: number
  aiTokens: number
}

interface OrderInfo {
  id: string
  createdAt: string
  plan: string
  amount: number
  status: string
  orderType: string
  tradeNo: string | null
  refundStatus?: string
  refundReason?: string | null
}

interface UserAssetInfo {
  id: string
  assetType: string
  unlockedAt: string
}

interface CouponInfo {
  id: string
  discountAmount: number
  sourceDescription: string | null
  validUntil: string
  createdAt: string
}

interface AffiliateStats {
  referralCode: string
  totalReferrals: number
  paidConversions: number
}

interface WalletPageData {
  user: UserInfo | null
  wallet: WalletInfo | null
  orders: OrderInfo[]
  userAssets: UserAssetInfo[]
}

interface ValidCoupon {
  id: string
  value: number
  name: string
  validUntil: string
  createdAt: string
}

// 资产标签映射
const ASSET_LABELS: Record<string, { name: string; icon: string; desc: string }> = {
  TEMPLATE_MECHANICAL: { name: '机械制造行业模板包', icon: 'Briefcase', desc: '50 套开发信模板 + 行业话术' },
  TEMPLATE_ELECTRONICS: { name: '电子元器件行业模板包', icon: 'Briefcase', desc: '50 套开发信模板 + 行业话术' },
  TEMPLATE_FURNITURE: { name: '家居家具行业模板包', icon: 'Briefcase', desc: '50 套开发信模板 + 行业话术' },
  TEMPLATE_TEXTILE: { name: '纺织面料行业模板包', icon: 'Briefcase', desc: '50 套开发信模板 + 行业话术' },
  STRATEGY_EXECUTIVE: { name: '高管成交策略包', icon: 'TrendingUp', desc: '针对 C-level 的高转化话术库' },
  STRATEGY_FOLLOWUP: { name: '跟进序列策略包', icon: 'Mail', desc: '7 步自动化跟进邮件模板' },
  AI_CUSTOM_INDUSTRY: { name: 'AI 专属定制行业开发信与策略包', icon: 'Sparkles', desc: 'AI 深度介入，为您生成独家私有化拓客矩阵' },
}

// 套餐名称映射
const PLAN_NAMES: Record<string, string> = {
  STARTER: '试运营版',
  PRO: '增长版',
  MAX: '规模化版',
  TRIAL: '试用版',
  FREE: '免费版',
}

// 默认空数据
const EMPTY_DATA: WalletPageData = {
  user: null,
  wallet: { emailCredits: 0, leadCredits: 0, aiTokens: 0 },
  orders: [],
  userAssets: [],
}

// ═══════════════════════════════════════════════════════════════════
// 主页面组件
// ═══════════════════════════════════════════════════════════════════

export default function WalletPage() {
  const { toast } = useToast()
  const [data, setData] = useState<WalletPageData>(EMPTY_DATA)
  const [coupons, setCoupons] = useState<ValidCoupon[]>([])
  const [affiliate, setAffiliate] = useState<AffiliateStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedOrder, setSelectedOrder] = useState<OrderInfo | null>(null)
  const [refundReason, setRefundReason] = useState('')
  const [isRefunding, setIsRefunding] = useState(false)
  const [isGeneratingCode, setIsGeneratingCode] = useState(false)

  // 获取数据
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [walletRes, couponRes, affiliateRes] = await Promise.all([
          fetch('/api/wallet/data', { cache: 'no-store' }),
          fetch('/api/user/coupons/valid', { cache: 'no-store' }),
          fetch('/api/affiliate/stats', { cache: 'no-store' }),
        ])

        const walletJson = await walletRes.json().catch(() => ({}))
        const safeData: WalletPageData = {
          user: walletJson?.user || null,
          wallet: walletJson?.wallet || { emailCredits: 0, leadCredits: 0, aiTokens: 0 },
          orders: Array.isArray(walletJson?.orders) ? walletJson.orders : [],
          userAssets: Array.isArray(walletJson?.userAssets) ? walletJson.userAssets : [],
        }
        setData(safeData)

        if (couponRes.ok) {
          const couponJson = await couponRes.json()
          setCoupons(couponJson?.coupons || [])
        }

        if (affiliateRes.ok) {
          const affiliateJson = await affiliateRes.json()
          setAffiliate(affiliateJson || null)
        }
      } catch (e) {
        console.error('Failed to fetch wallet data:', e)
        toast({ title: '提示', description: '获取数据失败', variant: 'destructive' })
      } finally {
        setLoading(false)
      }
    }

    fetchData()

    // 监听购买成功后的刷新事件，确保数据同步
    const handleRefresh = () => {
      setLoading(true)
      fetchData()
    }
    window.addEventListener('refresh-user-data', handleRefresh)
    return () => {
      window.removeEventListener('refresh-user-data', handleRefresh)
    }
  }, [toast])

  const handleGenerateCode = async () => {
    setIsGeneratingCode(true)
    try {
      const res = await fetch('/api/affiliate/generate-code', { method: 'POST' })
      const json = await res.json()
      if (res.ok && json.referralCode) {
        setAffiliate(prev => prev ? { ...prev, referralCode: json.referralCode } : { referralCode: json.referralCode, totalReferrals: 0, paidConversions: 0 })
        toast({ title: '邀请码已生成', description: '分享给好友，双方都能获得优惠' })
      }
    } catch (e) {
      toast({ title: '生成失败', variant: 'destructive' })
    } finally {
      setIsGeneratingCode(false)
    }
  }

  const handleCopyCode = () => {
    if (affiliate?.referralCode) {
      navigator.clipboard.writeText(`https://leadpilot.cn/register?ref=${affiliate.referralCode}`)
      toast({ title: '已复制', description: '邀请链接已复制到剪贴板' })
    }
  }

  const handleRefund = async () => {
    if (!selectedOrder || !refundReason.trim()) {
      toast({ title: '请填写退款原因', variant: 'destructive' })
      return
    }

    setIsRefunding(true)
    try {
      const res = await fetch('/api/user/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: selectedOrder.id, reason: refundReason }),
      })
      const json = await res.json()

      if (res.ok) {
        toast({ title: '退款申请已提交', description: '我们将在 3-5 个工作日内处理' })
        setSelectedOrder(null)
        setRefundReason('')
        window.location.reload()
      } else {
        toast({ title: '退款申请失败', description: json.error || '请重试', variant: 'destructive' })
      }
    } catch (e) {
      toast({ title: '申请失败', variant: 'destructive' })
    } finally {
      setIsRefunding(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 antialiased flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Loader2 className="w-6 h-6 animate-spin text-white" />
          </div>
          <p className="text-slate-400 text-sm font-medium">加载中...</p>
        </div>
      </div>
    )
  }

  const user = data.user
  const wallet = data.wallet || { emailCredits: 0, leadCredits: 0, aiTokens: 0 }
  const orders = data.orders || []
  const userAssets = data.userAssets || []

  const aiTokens = wallet.aiTokens || 0
  const emailCredits = wallet.emailCredits || 0
  const leadCredits = wallet.leadCredits || 0
  const exportCredits = user?.exportCredits || 0

  const aiPercent = Math.min(100, Math.round((aiTokens / 50000) * 100))
  const emailPercent = Math.min(100, Math.round((emailCredits / 5000) * 100))
  const leadPercent = Math.min(100, Math.round((leadCredits / 1000) * 100))

  return (
    <div className="min-h-screen bg-slate-950 antialiased">
      {/* 全局网格背景 */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(16,185,129,0.05),transparent)]" />
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
              <div className="absolute inset-0 bg-emerald-500/20 rounded-2xl blur-xl" />
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-400 flex items-center justify-center shadow-xl shadow-emerald-500/20">
                <WalletIcon className="w-6 h-6 text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-4xl font-bold text-white tracking-tight bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">我的资产</h1>
              <p className="text-slate-400 text-base mt-1">查看和管理您的订阅、额度与订单</p>
            </div>
          </div>
        </motion.div>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* 区块 A：当前订阅与核心资产 */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <section className="mb-14">
          {/* 订阅信息卡片 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-6 p-8 rounded-2xl backdrop-blur-xl border border-emerald-500/20 bg-emerald-950/20 shadow-xl shadow-emerald-500/5"
          >
            <div className="flex items-start justify-between flex-wrap gap-6">
              <div>
                <div className="flex items-center gap-2.5 mb-2">
                  <Crown className="w-5 h-5 text-amber-400" />
                  <span className="text-xs text-slate-400 uppercase tracking-widest font-medium">当前订阅</span>
                </div>
                <h3 className="text-3xl font-bold text-white tracking-tight bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                  {user ? PLAN_NAMES[user.subscriptionTier] || user.subscriptionTier || '免费版' : '免费版'}
                </h3>
                <p className="text-slate-400 text-sm mt-2">
                  {user?.trialEndsAt
                    ? `试用到期：${new Date(user.trialEndsAt).toLocaleDateString('zh-CN')}`
                    : '已激活'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500 mb-1 uppercase tracking-widest">账户建立于</p>
                <p className="text-slate-300 text-sm font-medium">
                  {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('zh-CN') : '-'}
                </p>
              </div>
            </div>
          </motion.div>

          {/* 核心额度卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* AI 算力 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="relative p-5 rounded-2xl backdrop-blur-xl border border-amber-500/20 bg-slate-900/50 shadow-lg shadow-amber-500/5 hover:border-amber-500/40 transition-all duration-300"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-orange-400 flex items-center justify-center shadow-lg shadow-amber-500/20">
                    <IconRenderer name="Zap" size={20} className="text-white" />
                  </div>
                  <div>
                    <p className="text-slate-400 text-xs font-medium">剩余 AI 算力</p>
                    <p className="text-white font-bold text-lg">{aiTokens.toLocaleString()}</p>
                  </div>
                </div>
                <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent font-black text-2xl tracking-tight">{aiPercent}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-800/80 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${aiPercent}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                  className="h-full bg-gradient-to-r from-amber-500 to-orange-400 rounded-full"
                />
              </div>
              <p className="text-xs text-slate-500 mt-2">配额：50,000 tokens</p>
            </motion.div>

            {/* 发信额度 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.15 }}
              className="relative p-5 rounded-2xl backdrop-blur-xl border border-emerald-500/20 bg-slate-900/50 shadow-lg shadow-emerald-500/5 hover:border-emerald-500/40 transition-all duration-300"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                    <IconRenderer name="Mail" size={20} className="text-white" />
                  </div>
                  <div>
                    <p className="text-slate-400 text-xs font-medium">剩余发信额度</p>
                    <p className="text-white font-bold text-lg">{emailCredits.toLocaleString()}</p>
                  </div>
                </div>
                <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent font-black text-2xl tracking-tight">{emailPercent}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-800/80 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${emailPercent}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full"
                />
              </div>
              <p className="text-xs text-slate-500 mt-2">配额：5,000 封</p>
            </motion.div>

            {/* 线索额度 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="relative p-5 rounded-2xl backdrop-blur-xl border border-cyan-500/20 bg-slate-900/50 shadow-lg shadow-cyan-500/5 hover:border-cyan-500/40 transition-all duration-300"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-400 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                    <IconRenderer name="Target" size={20} className="text-white" />
                  </div>
                  <div>
                    <p className="text-slate-400 text-xs font-medium">剩余线索额度</p>
                    <p className="text-white font-bold text-lg">{leadCredits.toLocaleString()}</p>
                  </div>
                </div>
                <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent font-black text-2xl tracking-tight">{leadPercent}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-800/80 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${leadPercent}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                  className="h-full bg-gradient-to-r from-cyan-500 to-blue-400 rounded-full"
                />
              </div>
              <p className="text-xs text-slate-500 mt-2">配额：1,000 家</p>
            </motion.div>

            {/* 导出额度 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.25 }}
              className="relative p-5 rounded-2xl backdrop-blur-xl border border-blue-500/20 bg-slate-900/50 shadow-lg shadow-blue-500/5 hover:border-blue-500/40 transition-all duration-300"
            >
              <div className="absolute -top-16 -right-16 w-32 h-32 bg-gradient-to-br from-blue-500/10 to-purple-500/5 rounded-full blur-3xl" />
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-purple-400 flex items-center justify-center shadow-lg shadow-blue-500/20">
                    <Download size={20} className="text-white" />
                  </div>
                  <div>
                    <p className="text-slate-400 text-xs font-medium">导出额度</p>
                    <p className="text-white font-bold text-lg">{exportCredits.toLocaleString()}</p>
                  </div>
                </div>
                <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent font-black text-2xl tracking-tight">
                  {exportCredits > 0 ? '活跃' : '0'}
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-800/80 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: exportCredits > 0 ? '100%' : '0%' }}
                  animate={{ width: exportCredits > 0 ? '100%' : '0%' }}
                  transition={{ duration: 1.5, ease: 'easeInOut' }}
                  className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-blue-400 rounded-full relative overflow-hidden"
                >
                  {exportCredits > 0 && (
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-[shimmer_2s_ease-in-out_infinite]" />
                  )}
                </motion.div>
              </div>
              <p className="text-xs text-slate-500 mt-2">商城购买，永久有效</p>
            </motion.div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* 区块 B：已购增值资产库 */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {userAssets.length > 0 && (
          <section className="mb-14">
            <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-3 tracking-tight">
              <Package className="w-5 h-5 text-purple-400" />
              已购永久资产
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {userAssets.map((asset, idx) => {
                const label = ASSET_LABELS[asset.assetType]
                if (!label) return null
                return (
                  <motion.div
                    key={asset.id}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: idx * 0.05 }}
                    className="p-5 rounded-2xl backdrop-blur-xl border border-purple-500/20 bg-purple-950/20 hover:border-purple-500/40 transition-all duration-300"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500 to-pink-400 flex items-center justify-center shadow-lg shadow-purple-500/20 flex-shrink-0">
                        <IconRenderer name={label.icon as any} size={22} className="text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-semibold text-sm tracking-tight">{label.name}</p>
                        <p className="text-slate-500 text-xs mt-1">{label.desc}</p>
                        <p className="text-slate-600 text-xs mt-2">
                          已解锁：{new Date(asset.unlockedAt).toLocaleDateString('zh-CN')}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </section>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* 区块 B2：特权与永久资产 (Mock) */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {(() => {
          const mockPrivileges = [
            { id: 1, name: '独立发信预热池与高信誉 IP', type: '高级特权', status: '已激活', icon: 'ShieldCheck' },
            { id: 2, name: '行业模板包 · 机械制造', type: '永久资产', status: '永久有效', icon: 'Briefcase' },
          ]
          return (
            <section className="mb-14">
              <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-3 tracking-tight">
                <Gift className="w-5 h-5 text-amber-400" />
                特权与永久资产
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {mockPrivileges.map((priv, idx) => (
                  <motion.div
                    key={priv.id}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: idx * 0.05 }}
                    className="relative p-5 rounded-2xl backdrop-blur-xl border border-amber-500/20 bg-gradient-to-br from-amber-950/30 to-slate-900/60 hover:border-amber-500/40 transition-all duration-300 overflow-hidden"
                  >
                    {/* 右上角状态 Badge */}
                    <div className={`absolute top-3 right-3 flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                      priv.status === '已激活'
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                        : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                    }`}>
                      <CheckCircle2 className="w-3 h-3" />
                      {priv.status}
                    </div>

                    {/* 左侧图标 */}
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500/30 to-orange-500/30 border border-amber-500/30 flex items-center justify-center mb-3">
                      <IconRenderer name={priv.icon as any} size={22} className="text-amber-400" />
                    </div>

                    {/* 资产名称 */}
                    <p className="text-white font-semibold text-sm tracking-tight pr-20">{priv.name}</p>

                    {/* 类型标签 */}
                    <div className="flex items-center gap-2 mt-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-500/15 text-purple-400 border border-purple-500/30">
                        {priv.type}
                      </span>
                    </div>

                    {/* 装饰光晕 */}
                    <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-gradient-to-br from-amber-500/5 to-transparent rounded-full blur-xl" />
                  </motion.div>
                ))}
              </div>
            </section>
          )
        })()}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* 区块 C：我的卡包与邀请 */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <section className="mb-14">
          <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-3 tracking-tight">
            <Gift className="w-5 h-5 text-pink-400" />
            优惠与邀请
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* 优惠券卡片 */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="p-6 rounded-2xl backdrop-blur-xl border border-white/5 bg-slate-900/40"
            >
              <div className="flex items-center gap-3 mb-5">
                <Ticket className="w-5 h-5 text-emerald-400" />
                <span className="text-white font-semibold">我的优惠券</span>
                <span className="ml-auto px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium rounded-full backdrop-blur-sm">
                  {coupons.length} 张可用
                </span>
              </div>
              {coupons.length > 0 ? (
                <div className="space-y-3">
                  {coupons.slice(0, 3).map(coupon => (
                    <div key={coupon.id} className="p-4 rounded-xl bg-white/5 border border-white/5 backdrop-blur-sm flex items-center justify-between hover:bg-white/10 transition-all duration-200">
                      <div>
                        <p className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent font-bold text-lg">{coupon.value}元</p>
                        <p className="text-slate-500 text-xs mt-0.5">{coupon.name || '优惠券'}</p>
                      </div>
                      <p className="text-slate-600 text-xs">
                        有效期至 {new Date(coupon.validUntil).toLocaleDateString('zh-CN')}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Ticket className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                  <p className="text-slate-500 text-sm">暂无可用优惠券</p>
                  <p className="text-slate-600 text-xs mt-1">通过邀请好友获得更多优惠</p>
                </div>
              )}
            </motion.div>

            {/* 邀请好友卡片 */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="p-6 rounded-2xl backdrop-blur-xl border border-white/5 bg-slate-900/40"
            >
              <div className="flex items-center gap-3 mb-5">
                <Users className="w-5 h-5 text-blue-400" />
                <span className="text-white font-semibold">邀请好友</span>
                <span className="ml-auto px-3 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium rounded-full backdrop-blur-sm">
                  {affiliate?.totalReferrals || 0} 人已邀请
                </span>
              </div>
              {affiliate?.referralCode ? (
                <div>
                  <div className="p-4 rounded-xl bg-white/5 border border-white/5 backdrop-blur-sm mb-4">
                    <p className="text-xs text-slate-500 mb-2 uppercase tracking-widest">您的专属邀请码</p>
                    <div className="flex items-center justify-between">
                      <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent font-black text-2xl tracking-widest">{affiliate.referralCode}</span>
                      <button
                        onClick={handleCopyCode}
                        className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={handleCopyCode}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-400 text-white text-sm font-bold hover:from-blue-400 hover:to-cyan-300 shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
                  >
                    <Share2 className="w-4 h-4" />
                    分享链接
                  </button>
                  <p className="text-xs text-slate-600 mt-4 text-center">
                    每邀请 1 位好友购买，双方各得 ¥50 优惠券
                  </p>
                </div>
              ) : (
                <div className="text-center py-6">
                  <Users className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                  <p className="text-slate-500 text-sm mb-4">生成专属邀请码</p>
                  <button
                    onClick={handleGenerateCode}
                    disabled={isGeneratingCode}
                    className="py-3 px-6 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-400 text-white text-sm font-bold hover:from-blue-400 hover:to-cyan-300 shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2 mx-auto"
                  >
                    {isGeneratingCode ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                    生成邀请码
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* 区块 D：订单历史与退款闭环 */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <section>
          <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-3 tracking-tight">
            <Clock className="w-5 h-5 text-blue-400" />
            订单历史
          </h2>
          {orders.length > 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="rounded-2xl backdrop-blur-xl border border-white/5 bg-slate-900/40 overflow-hidden"
            >
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 bg-white/[0.02]">
                    <th className="px-6 py-4 text-left text-slate-400 font-medium">时间</th>
                    <th className="px-6 py-4 text-left text-slate-400 font-medium">商品</th>
                    <th className="px-6 py-4 text-left text-slate-400 font-medium">金额</th>
                    <th className="px-6 py-4 text-left text-slate-400 font-medium">状态</th>
                    <th className="px-6 py-4 text-left text-slate-400 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order, idx) => (
                    <tr key={order.id} className={`border-b border-white/5 hover:bg-white/[0.02] transition-colors ${idx % 2 === 0 ? '' : 'bg-white/[0.01]'}`}>
                      <td className="px-6 py-4 text-slate-400 font-medium">
                        {new Date(order.createdAt).toLocaleDateString('zh-CN')}
                      </td>
                      <td className="px-6 py-4 text-white font-medium">
                        {PLAN_NAMES[order.plan] || order.plan || order.orderType}
                      </td>
                      <td className="px-6 py-4 text-white font-semibold">
                        {order.amount > 0 ? `¥${order.amount}` : '-'}
                      </td>
                      <td className="px-6 py-4">
                        <OrderStatusBadge status={order.status} refundStatus={order.refundStatus} />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => setSelectedOrder(order)}
                            className="text-blue-400 hover:text-blue-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" />
                            查看详情
                          </button>
                          {order.status === 'PAID' && order.refundStatus === 'NONE' && (
                            <button
                              onClick={() => setSelectedOrder(order)}
                              className="text-amber-400 hover:text-amber-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
                            >
                              <ChevronRight className="w-3.5 h-3.5" />
                              申请退款
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </motion.div>
          ) : (
            <div className="p-12 text-center rounded-2xl backdrop-blur-xl border border-white/5 bg-slate-900/40">
              <Clock className="w-12 h-12 text-slate-700 mx-auto mb-4" />
              <p className="text-slate-400 font-medium">暂无订单记录</p>
              <p className="text-slate-600 text-sm mt-1">前往商城购买心仪的服务</p>
            </div>
          )}
        </section>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* 订单详情/退款 Modal */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {selectedOrder && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedOrder(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-xl z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div className="relative w-full max-w-lg bg-slate-900/90 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl shadow-black/20 overflow-hidden">
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="absolute top-5 right-5 w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all"
                >
                  <X className="w-4 h-4" />
                </button>

                <div className="p-8">
                  <h3 className="text-xl font-bold text-white mb-6 tracking-tight">订单详情</h3>

                  <div className="space-y-4 mb-8">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">订单编号</span>
                      <span className="text-white font-medium">{selectedOrder.tradeNo || selectedOrder.id.slice(0, 8)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">商品</span>
                      <span className="text-white font-medium">{PLAN_NAMES[selectedOrder.plan] || selectedOrder.plan || selectedOrder.orderType}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">金额</span>
                      <span className="bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent font-bold">{selectedOrder.amount > 0 ? `¥${selectedOrder.amount}` : '-'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">下单时间</span>
                      <span className="text-white font-medium">{new Date(selectedOrder.createdAt).toLocaleString('zh-CN')}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">状态</span>
                      <span className={selectedOrder.status === 'PAID' ? 'text-emerald-400 font-medium' : 'text-slate-400'}>
                        {selectedOrder.status === 'PAID' ? '已支付' : selectedOrder.status === 'PENDING' ? '待支付' : selectedOrder.status}
                      </span>
                    </div>
                  </div>

                  {selectedOrder.status === 'PAID' && selectedOrder.refundStatus === 'NONE' && (
                    <div className="border-t border-white/5 pt-6">
                      <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-400" />
                        申请退款
                      </h4>
                      <textarea
                        value={refundReason}
                        onChange={e => setRefundReason(e.target.value)}
                        placeholder="请填写退款原因（必填）"
                        rows={3}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none"
                      />
                      <div className="flex gap-3 mt-4">
                        <button
                          onClick={handleRefund}
                          disabled={isRefunding || !refundReason.trim()}
                          className="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-400 text-white text-sm font-bold hover:from-amber-400 hover:to-orange-300 shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {isRefunding ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                          {isRefunding ? '提交中...' : '确认申请退款'}
                        </button>
                        <button
                          onClick={() => setSelectedOrder(null)}
                          className="px-5 py-3.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-sm font-medium transition-all"
                        >
                          取消
                        </button>
                      </div>
                      <p className="text-xs text-slate-600 mt-3">
                        退款申请提交后，我们将在 3-5 个工作日内处理。订单超过 7 天将无法申请退款。
                      </p>
                    </div>
                  )}

                  {selectedOrder.refundStatus && selectedOrder.refundStatus !== 'NONE' && (
                    <div className="border-t border-white/5 pt-6">
                      <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                        <p className="text-amber-400 text-sm font-semibold mb-1">
                          退款{selectedOrder.refundStatus === 'REQUESTED' ? '申请中' : selectedOrder.refundStatus === 'APPROVED' ? '已批准' : selectedOrder.refundStatus === 'REJECTED' ? '已被拒绝' : '已完成'}
                        </p>
                        {selectedOrder.refundReason && (
                          <p className="text-slate-400 text-xs">退款原因：{selectedOrder.refundReason}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// 辅助组件
// ═══════════════════════════════════════════════════════════════════

function OrderStatusBadge({ status, refundStatus }: { status: string; refundStatus?: string }) {
  if (refundStatus && refundStatus !== 'NONE') {
    const refundLabels: Record<string, { label: string; class: string }> = {
      REQUESTED: { label: '退款中', class: 'bg-amber-500/10 text-amber-300 border border-amber-500/20' },
      APPROVED: { label: '退款批准', class: 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' },
      REJECTED: { label: '退款拒绝', class: 'bg-red-500/10 text-red-300 border border-red-500/20' },
      COMPLETED: { label: '已退款', class: 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' },
    }
    const style = refundLabels[refundStatus] || { label: refundStatus, class: 'bg-slate-500/10 text-slate-300 border border-slate-500/20' }
    return <span className={`px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-sm ${style.class}`}>{style.label}</span>
  }

  const statusLabels: Record<string, { label: string; class: string }> = {
    PAID: { label: '已支付', class: 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' },
    PENDING: { label: '待支付', class: 'bg-amber-500/10 text-amber-300 border border-amber-500/20' },
    FAILED: { label: '失败', class: 'bg-red-500/10 text-red-300 border border-red-500/20' },
    CANCELED: { label: '已取消', class: 'bg-slate-500/10 text-slate-300 border border-slate-500/20' },
    REFUNDED: { label: '已退款', class: 'bg-slate-500/10 text-slate-300 border border-slate-500/20' },
  }
  const style = statusLabels[status] || { label: status, class: 'bg-slate-500/10 text-slate-300 border border-slate-500/20' }
  return <span className={`px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-sm ${style.class}`}>{style.label}</span>
}
