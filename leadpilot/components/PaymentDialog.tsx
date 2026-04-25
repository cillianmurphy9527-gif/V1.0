'use client'

import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, CreditCard, Loader2, CheckCircle2,
  AlertCircle, ChevronRight, Star, Info,
  QrCode, Smartphone
} from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { IconRenderer, getIconById, type IconName } from '@/components/IconRenderer'

// ─── 支付状态机枚举 ──────────────────────────────────────────────
type PaymentStep = 'idle' | 'loading' | 'qrcode' | 'success'

// 扩展后的产品类型，支持 modalDetail 和 shortDesc
export interface PaymentDialogProduct {
  id: string
  name: string
  price: number | undefined
  type?: string
  shortDesc?: string
  modalDetail?: string
  icon?: IconName
  badge?: string
  popular?: boolean
  isCustom?: boolean
  unitPrice?: number
  unitLabel?: string
  perPack?: number
  maxQty?: number
  sets?: number
  credits?: number
  tokens?: number
  emails?: number
  leads?: number
  domainCount?: number
}

const calculateExportPrice = (sets: number): number => {
  if (sets === 2) return 188
  if (sets === 5) return 399
  if (sets >= 10) return sets * 75
  if (sets >= 5) return sets * 80
  if (sets >= 2) return sets * 94
  return sets * 99
}

export function isAddonProduct(product: PaymentDialogProduct | null): boolean {
  if (!product) return false
  const type = product.type
  if (type === 'subscription') return false
  return true
}

export function hasValidSubscription(subscriptionTier: string | undefined | null): boolean {
  if (!subscriptionTier) return false
  const validTiers = ['STARTER', 'PRO', 'MAX']
  return validTiers.includes(subscriptionTier.toUpperCase())
}

type BillingCycle = 'monthly' | 'quarterly' | 'yearly'
type PaymentMethod = 'WECHAT_PAY' | 'ALIPAY'

interface PaymentDialogProps {
  isOpen: boolean
  onClose: () => void
  product: PaymentDialogProduct | null
  userSubscriptionTier?: string | null
  onPurchaseSuccess?: (product: PaymentDialogProduct) => void
}

export function PaymentDialog({ isOpen, onClose, product, userSubscriptionTier, onPurchaseSuccess }: PaymentDialogProps) {
  const { toast } = useToast()
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('WECHAT_PAY')
  const [quantity, setQuantity] = useState(1)

  // ─── 阶段六核心：支付状态机 ──────────────────────────────────────
  const [paymentStep, setPaymentStep] = useState<PaymentStep>('idle')
  /** 模拟轮询计数器 */
  const [pollCount, setPollCount] = useState(0)
  const pollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isAddon = isAddonProduct(product)
  const userHasValidSubscription = hasValidSubscription(userSubscriptionTier)
  const isBlockedAddon = isAddon && !userHasValidSubscription

  // ─── 弹窗关闭时重置所有状态 ────────────────────────────────────
  const resetAll = () => {
    setPaymentStep('idle')
    setPollCount(0)
    setQuantity(1)
    setBillingCycle('monthly')
  }

  useEffect(() => {
    if (!isOpen) {
      resetAll()
      return
    }
    if (product?.type === 'export' && product?.sets) {
      setQuantity(product.sets)
    } else {
      setQuantity(1)
    }
  }, [isOpen, product])

  // ─── 组件卸载时清理所有定时器 ──────────────────────────────────
  useEffect(() => {
    return () => {
      if (pollingTimerRef.current) clearInterval(pollingTimerRef.current)
      if (successTimerRef.current) clearTimeout(successTimerRef.current)
    }
  }, [])

  if (!product) return null

  const safeUnitPrice = product.unitPrice ?? product.price ?? 0
  const isExportType = product.type === 'export'
  const exportSets = isExportType ? quantity : (product.sets || 1)

  const calculateTotal = () => {
    if (isExportType) return calculateExportPrice(exportSets)
    if (product.type === 'subscription') {
      const cycleMultiplier = billingCycle === 'monthly' ? 1 : billingCycle === 'quarterly' ? 3 : 12
      const cycleDiscount = billingCycle === 'monthly' ? 1 : billingCycle === 'quarterly' ? 0.85 : 0.7
      return Math.round(safeUnitPrice * cycleMultiplier * cycleDiscount)
    }
    return safeUnitPrice * quantity
  }

  const calculateFinalPrice = () => {
    return calculateTotal() // 已移除优惠券扣减逻辑
  }

  const cycleLabel = {
    monthly: '月付',
    quarterly: '季付（85折）',
    yearly: '年付（7折）',
  }

  const iconName = product.icon || getIconById(product.id)
  const iconColorClass = product.isCustom
    ? 'from-purple-600 to-pink-500'
    : product.type === 'subscription'
      ? 'from-blue-600 to-cyan-500'
      : product.id.startsWith('token')
        ? 'from-amber-600 to-orange-500'
        : product.id.startsWith('email')
          ? 'from-emerald-600 to-teal-500'
          : product.id.startsWith('lead')
            ? 'from-cyan-600 to-blue-500'
            : product.id.startsWith('domain')
              ? 'from-blue-600 to-cyan-500'
              : 'from-purple-600 to-pink-500'

  const isSubscriptionType = product.type === 'subscription'
  const isCustomType = product.id.includes('custom')

  // ─── 阶段六核心：启动扫码支付流程 ─────────────────────────────
  const startPaymentFlow = async () => {
    if (isBlockedAddon) {
      toast({ title: '增值服务仅面向正式订阅用户开放', description: '请先选择基础订阅方案，解锁全部增值服务', variant: 'destructive' })
      return
    }

    // Step 1: loading — 请求支付环境
    setPaymentStep('loading')
    setPollCount(0)

    // 模拟请求支付二维码（1 秒后进入 qrcode 阶段）
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Step 2: qrcode — 展示二维码，开始轮询
    setPaymentStep('qrcode')

    // 模拟后端轮询：每 3 秒查询一次，2 次后自动成功
    pollingTimerRef.current = setInterval(() => {
      setPollCount(prev => {
        const next = prev + 1
        console.log(`[PaymentDialog] 轮询第 ${next} 次...`)

        if (next >= 2) {
          // 模拟支付成功
          if (pollingTimerRef.current) clearInterval(pollingTimerRef.current)
          pollingTimerRef.current = null
          handlePaymentSuccess()
        }
        return next
      })
    }, 3000)
  }

  // ─── 阶段六核心：支付成功处理 ─────────────────────────────────
  const handlePaymentSuccess = async () => {
    setPaymentStep('success')

    // 触发后端订单确认（导出包直接调 API）
    if (isExportType) {
      try {
        await fetch('/api/export/purchase', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sets: Number(quantity) }),
        })
      } catch (_e) {}
    }

    // 停留 2 秒展示成功动画
    successTimerRef.current = setTimeout(() => {
      // 触发前端数据刷新
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('refresh-user-data'))
      }
      onPurchaseSuccess?.(product)
      onClose()
    }, 2000)
  }

  // ─── 放弃支付（从 qrcode 阶段返回 idle）─────────────────────────
  const handleCancelPayment = () => {
    if (pollingTimerRef.current) clearInterval(pollingTimerRef.current)
    if (successTimerRef.current) clearTimeout(successTimerRef.current)
    pollingTimerRef.current = null
    successTimerRef.current = null
    setPaymentStep('idle')
    setPollCount(0)
  }

  // 判断当前按钮是否禁用
  const isButtonDisabled = paymentStep !== 'idle' || calculateFinalPrice() <= 0 || isBlockedAddon

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={paymentStep === 'idle' ? onClose : handleCancelPayment}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="relative w-full max-w-5xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-slate-700/50 rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
              <button
                onClick={paymentStep === 'idle' ? onClose : handleCancelPayment}
                className="absolute top-4 right-4 w-10 h-10 rounded-lg bg-slate-800/50 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-all z-10"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
                {/* ─── 左列：商品详情（始终保留）────────────────────────────── */}
                <div className="p-8 lg:p-10 border-b lg:border-b-0 lg:border-r border-slate-700/50 overflow-y-auto custom-scrollbar" style={{ maxHeight: '70vh' }}>
                  <div className="flex items-start gap-4 mb-6">
                    <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${iconColorClass} flex items-center justify-center text-white shadow-lg flex-shrink-0`}>
                      <IconRenderer name={iconName} size={28} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-2xl font-bold text-white">{product.name}</h2>
                        {product.badge && (
                          <span className="px-2 py-0.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold rounded-full">{product.badge}</span>
                        )}
                        {product.popular && (
                          <span className="px-2 py-0.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold rounded-full">热门</span>
                        )}
                      </div>
                      {product.shortDesc && (
                        <p className="text-slate-400 text-sm mt-1">{product.shortDesc}</p>
                      )}
                    </div>
                  </div>

                  {product.modalDetail ? (
                    <div className="mb-6 p-5 bg-slate-800/50 border border-slate-700/50 rounded-xl">
                      <div className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <Info className="w-4 h-4" />
                        商品详情
                      </div>
                      <pre className="text-sm text-slate-400 whitespace-pre-wrap font-mono leading-relaxed max-h-[40vh] overflow-y-auto custom-scrollbar">
                        {product.modalDetail}
                      </pre>
                    </div>
                  ) : (
                    <div className="mb-6 p-5 bg-slate-800/50 border border-slate-700/50 rounded-xl">
                      <div className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        包含权益
                      </div>
                      <ul className="space-y-2 text-sm text-slate-400">
                        <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-400 flex-shrink-0" /><span>永久有效，不设过期时间</span></li>
                        <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-400 flex-shrink-0" /><span>可无限叠加使用</span></li>
                        <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-400 flex-shrink-0" /><span>购买后即时到账</span></li>
                      </ul>
                    </div>
                  )}

                  <div className="pt-4 border-t border-slate-700/50">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-slate-500 leading-relaxed">
                        退款说明：虚拟资产与服务一经售出即刻生效，暂不支持退款。如有疑问请联系客服。
                      </p>
                    </div>
                  </div>
                </div>

                {/* ─── 右列：支付区域（根据 paymentStep 动态切换）────────── */}
                <div className="p-8 lg:p-10 flex flex-col">

                  {/* ── 越权拦截警告（仅 idle 阶段显示）── */}
                  {isBlockedAddon && paymentStep === 'idle' && (
                    <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-amber-300 text-sm font-semibold">增值服务仅面向正式订阅用户</p>
                          <p className="text-amber-400/70 text-xs mt-1">请先选择基础订阅方案，解锁算力补充、线索额度、域名扩展等全部增值服务。</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ══════════════════════════════════════════════════════
                      paymentStep === 'idle'：原始支付表单
                      ══════════════════════════════════════════════════ */}
                  {paymentStep === 'idle' && (
                    <>
                      {isCustomType && !isBlockedAddon && !isExportType && (
                        <div className="mb-6">
                          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">选择数量</h3>
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                              <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="w-10 h-10 rounded-lg bg-slate-800 text-white font-bold hover:bg-slate-700 transition-colors flex items-center justify-center">-</button>
                              <input type="number" min="1" max={product.maxQty || 100} value={quantity} onChange={e => { const val = parseInt(e.target.value) || 1; setQuantity(Math.max(1, Math.min(val, product.maxQty || 100))) }} className="w-20 text-center bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-lg font-bold focus:outline-none focus:ring-2 focus:ring-blue-500" />
                              <button onClick={() => setQuantity(q => Math.min(q + 1, product.maxQty || 100))} className="w-10 h-10 rounded-lg bg-slate-800 text-white font-bold hover:bg-slate-700 transition-colors flex items-center justify-center">+</button>
                            </div>
                            <span className="text-slate-400 text-sm">份</span>
                            <span className="text-cyan-400 text-sm ml-2">共 {quantity * (product.perPack || 1)} 家</span>
                          </div>
                          <div className="mt-3 p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
                            <p className="text-xs text-cyan-300">单价固定 ¥{safeUnitPrice} / {product.unitLabel || '1个'}</p>
                          </div>
                        </div>
                      )}

                      {isExportType && !isBlockedAddon && (
                        <div className="mb-6">
                          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">选择套数</h3>
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                              <button onClick={() => setQuantity(Math.max(1, exportSets - 1))} disabled={exportSets <= 1} className="w-10 h-10 rounded-lg bg-slate-800 text-white font-bold hover:bg-slate-700 transition-colors flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed">-</button>
                              <input type="number" min="1" max={100} value={exportSets} onChange={e => { const val = parseInt(e.target.value) || 1; setQuantity(Math.max(1, Math.min(val, 100))) }} className="w-20 text-center bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-lg font-bold focus:outline-none focus:ring-2 focus:ring-blue-500" />
                              <button onClick={() => setQuantity(Math.min(exportSets + 1, 100))} className="w-10 h-10 rounded-lg bg-slate-800 text-white font-bold hover:bg-slate-700 transition-colors flex items-center justify-center">+</button>
                            </div>
                            <span className="text-slate-400 text-sm">套</span>
                            <span className="text-slate-500 text-xs ml-auto">1 套 = 1000 额度</span>
                          </div>
                          <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                            <p className="text-xs text-blue-300">
                              阶梯优惠：
                              {exportSets === 1 && ' ¥99/套（标准）'}
                              {exportSets >= 2 && exportSets < 5 && ' ¥94/套（95折）'}
                              {exportSets >= 5 && exportSets < 10 && ' ¥80/套（81折）'}
                              {exportSets >= 10 && ' ¥75/套（76折）'}
                            </p>
                          </div>
                        </div>
                      )}

                      {isSubscriptionType && (
                        <div className="mb-6">
                          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">选择周期</h3>
                          <div className="space-y-2">
                            {(['monthly', 'quarterly', 'yearly'] as BillingCycle[]).map(cycle => (
                              <button key={cycle} onClick={() => setBillingCycle(cycle)} className={`w-full p-3 rounded-lg border transition-all text-left text-sm font-medium ${billingCycle === cycle ? 'bg-blue-600/20 border-blue-500/50 text-blue-300' : 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:border-slate-600'}`}>
                                <div className="flex items-center justify-between">
                                  <span>{cycleLabel[cycle]}</span>
                                  {cycle !== 'monthly' && <span className="text-xs text-emerald-400">省 {Math.round(safeUnitPrice * (cycle === 'quarterly' ? 3 * 0.15 : 12 * 0.3))}元</span>}
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 优惠券模块已彻底移除 */}

                      <div className="mb-6">
                        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">支付方式</h3>
                        <div className="space-y-2">
                          <label className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all hover:bg-emerald-500/5 ${paymentMethod === 'WECHAT_PAY' ? 'bg-emerald-500/10 border-emerald-500/40' : 'bg-slate-800/50 border-slate-700/50 hover:border-emerald-500/30'}`}>
                            <input type="radio" name="payment" value="WECHAT_PAY" checked={paymentMethod === 'WECHAT_PAY'} onChange={() => setPaymentMethod('WECHAT_PAY')} className="w-4 h-4" />
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-600 to-teal-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">微</div>
                            <div><p className="text-white text-sm font-semibold">微信支付</p><p className="text-slate-500 text-xs">WeChat Pay</p></div>
                          </label>
                          <label className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all hover:bg-blue-500/5 ${paymentMethod === 'ALIPAY' ? 'bg-blue-500/10 border-blue-500/40' : 'bg-slate-800/50 border-slate-700/50 hover:border-blue-500/30'}`}>
                            <input type="radio" name="payment" value="ALIPAY" checked={paymentMethod === 'ALIPAY'} onChange={() => setPaymentMethod('ALIPAY')} className="w-4 h-4" />
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">支</div>
                            <div><p className="text-white text-sm font-semibold">支付宝</p><p className="text-slate-500 text-xs">Alipay</p></div>
                          </label>
                        </div>
                      </div>

                      <div className="mb-6 p-5 bg-slate-800/50 border border-slate-700/50 rounded-xl">
                        <div className="flex items-baseline justify-between">
                          <span className="text-slate-300 text-sm">应付金额</span>
                          <div className="flex items-baseline gap-2">
                            <span className="text-4xl font-black text-white">{calculateFinalPrice()}元</span>
                          </div>
                        </div>
                        {isExportType && (
                          <div className="mt-3 pt-3 border-t border-slate-700/50">
                            <p className="text-xs text-slate-500">
                              {exportSets} 套 × 1000 额度 = {exportSets * 1000} 个导出额度
                            </p>
                          </div>
                        )}
                        {isCustomType && !isExportType && (
                          <div className="mt-3 pt-3 border-t border-slate-700/50">
                            <p className="text-xs text-slate-500">
                              {quantity} 份 × ¥{safeUnitPrice} = {quantity * (product.perPack || 1)} 家
                            </p>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={startPaymentFlow}
                        disabled={isButtonDisabled}
                        className={`w-full py-4 rounded-xl text-base font-bold text-white transition-all shadow-lg flex items-center justify-center gap-2 ${
                          isButtonDisabled
                            ? 'bg-slate-700 cursor-not-allowed'
                            : 'bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 shadow-blue-500/30'
                        }`}
                      >
                        <CreditCard className="w-5 h-5" />
                        确认支付 {calculateFinalPrice()}元
                      </button>

                      <div className="mt-4 flex items-center justify-center gap-4">
                        <p className="text-xs text-slate-500 flex items-center gap-1"><Star className="w-3 h-3 text-amber-500" />安全支付</p>
                        <p className="text-xs text-slate-500 flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-400" />即时到账</p>
                      </div>
                    </>
                  )}

                  {/* ══════════════════════════════════════════════════════
                      paymentStep === 'loading'：生成二维码中
                      ══════════════════════════════════════════════════ */}
                  {paymentStep === 'loading' && (
                    <div className="flex-1 flex flex-col items-center justify-center py-16">
                      <div className="relative mb-8">
                        <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-2xl animate-pulse" />
                        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shadow-2xl shadow-blue-500/30">
                          <Loader2 className="w-10 h-10 text-white animate-spin" />
                        </div>
                      </div>
                      <h3 className="text-xl font-bold text-white mb-2">正在生成安全支付环境</h3>
                      <p className="text-slate-400 text-sm text-center max-w-xs">正在与支付网关建立加密连接，请稍候...</p>
                      <div className="mt-6 flex items-center gap-2 text-xs text-slate-500">
                        <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
                        连接中...
                      </div>
                    </div>
                  )}

                  {/* ══════════════════════════════════════════════════════
                      paymentStep === 'qrcode'：展示二维码 + 轮询
                      ══════════════════════════════════════════════════ */}
                  {paymentStep === 'qrcode' && (
                    <div className="flex-1 flex flex-col items-center py-8">
                      {/* 标题 */}
                      <div className="text-center mb-6">
                        <h3 className="text-xl font-bold text-white mb-1">扫码支付</h3>
                        <p className="text-slate-400 text-sm">
                          应付金额 <span className="text-2xl font-black text-white mx-1">{calculateFinalPrice()}</span> 元
                        </p>
                      </div>

                      {/* 二维码区域 */}
                      <div className="relative mb-6">
                        {/* 外框装饰 */}
                        <div className="absolute -inset-3 bg-gradient-to-br from-blue-500/20 to-emerald-500/20 rounded-3xl blur-lg" />
                        <div className="relative bg-white rounded-2xl p-4 shadow-2xl">
                          {/* 二维码占位：使用 lucide QrCode 图标模拟 */}
                          <div className="w-48 h-48 bg-slate-100 rounded-xl flex flex-col items-center justify-center">
                            <QrCode className="w-24 h-24 text-slate-700 mb-2" />
                            <div className="text-center">
                              <p className="text-slate-600 text-xs font-semibold">
                                {paymentMethod === 'WECHAT_PAY' ? '微信' : '支付宝'}
                              </p>
                              <p className="text-slate-400 text-[10px]">扫码后可见支付页面</p>
                            </div>
                          </div>
                          {/* 右上角 Logo */}
                          <div className="absolute top-3 right-3 w-8 h-8 rounded bg-gradient-to-br from-emerald-600 to-teal-500 flex items-center justify-center">
                            {paymentMethod === 'WECHAT_PAY' ? (
                              <span className="text-white text-[10px] font-bold">微</span>
                            ) : (
                              <span className="text-white text-[10px] font-bold">支</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* 扫码指引 */}
                      <div className="flex items-center gap-3 mb-6 px-4 py-3 bg-slate-800/60 border border-slate-700/50 rounded-xl max-w-sm w-full">
                        <Smartphone className="w-5 h-5 text-blue-400 flex-shrink-0" />
                        <p className="text-slate-300 text-xs leading-relaxed">
                          打开{paymentMethod === 'WECHAT_PAY' ? '微信' : '支付宝'}，扫描上方二维码完成支付
                        </p>
                      </div>

                      {/* 轮询状态 */}
                      <div className="flex flex-col items-center gap-2 mb-6">
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
                          <span className="text-slate-400 text-sm">等待付款结果...</span>
                        </div>
                        <p className="text-slate-600 text-xs">
                          已轮询 {pollCount} 次 · 付款后自动确认
                        </p>
                      </div>

                      {/* 放弃支付按钮 */}
                      <button
                        onClick={handleCancelPayment}
                        className="text-slate-500 hover:text-slate-300 text-xs transition-colors flex items-center gap-1"
                      >
                        <X className="w-3 h-3" />
                        放弃支付
                      </button>
                    </div>
                  )}

                  {/* ══════════════════════════════════════════════════════
                      paymentStep === 'success'：支付成功
                      ══════════════════════════════════════════════════ */}
                  {paymentStep === 'success' && (
                    <div className="flex-1 flex flex-col items-center justify-center py-16">
                      {/* 成功动画 */}
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                        className="relative mb-8"
                      >
                        {/* 光晕 */}
                        <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-3xl animate-pulse" />
                        {/* 绿色圆圈 */}
                        <motion.div
                          initial={{ scale: 0, rotate: -180 }}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={{ delay: 0.1, type: 'spring', stiffness: 150, damping: 12 }}
                          className="relative w-24 h-24 rounded-full bg-gradient-to-br from-emerald-500 to-teal-400 flex items-center justify-center shadow-2xl shadow-emerald-500/40"
                        >
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.3, type: 'spring' }}
                          >
                            <CheckCircle2 className="w-12 h-12 text-white" />
                          </motion.div>
                        </motion.div>
                        {/* 环形波纹动画 */}
                        <div className="absolute inset-0 rounded-full border-2 border-emerald-400/40 animate-ping" style={{ animationDuration: '2s' }} />
                      </motion.div>

                      {/* 文字 */}
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="text-center"
                      >
                        <h3 className="text-2xl font-black text-white mb-2">
                          支付成功！
                        </h3>
                        <p className="text-emerald-400 text-sm mb-1">
                          ¥{calculateFinalPrice()} 元
                        </p>
                        <p className="text-slate-400 text-sm">
                          正在为您分配算力额度，请稍候...
                        </p>
                      </motion.div>

                      {/* 进度点 */}
                      <div className="flex items-center gap-2 mt-8">
                        <motion.div animate={{ scale: [1, 1.3, 1], opacity: [1, 0.5, 1] }} transition={{ duration: 1.5, repeat: Infinity }} className="w-2 h-2 rounded-full bg-emerald-400" />
                        <motion.div animate={{ scale: [1, 1.3, 1], opacity: [1, 0.5, 1] }} transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }} className="w-2 h-2 rounded-full bg-emerald-400" />
                        <motion.div animate={{ scale: [1, 1.3, 1], opacity: [1, 0.5, 1] }} transition={{ duration: 1.5, repeat: Infinity, delay: 0.4 }} className="w-2 h-2 rounded-full bg-emerald-400" />
                      </div>

                      {/* 成功后自动关闭倒计时提示 */}
                      <p className="text-slate-600 text-xs mt-4">页面将在 2 秒后自动刷新...</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}