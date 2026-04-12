"use client"
import { useEffect, useMemo, useState, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { CheckCircle2, Clock, XCircle, Search, RefreshCw, Eye, X, AlertCircle, RotateCcw, Ban, AlertTriangle, Loader2 } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

type OrderStatus = 'PAID' | 'PENDING' | 'FAILED' | 'CANCELED' | 'REFUNDED'
type RefundStatus = 'NONE' | 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'COMPLETED'
type TabKey = 'ALL' | 'PENDING' | 'PAID' | 'REFUND_PENDING' | 'DONE'

interface Order {
  id: string
  rawId: string
  userEmail: string
  plan: string
  amount: number
  status: OrderStatus
  payMethod: string
  createdAt: string
  planType: 'subscription' | 'addon'
  refundStatus: RefundStatus
  refundReason?: string | null
  rejectReason?: string | null
  paymentIntentId?: string | null
}

function StatusBadge({ status, refundStatus }: { status: OrderStatus; refundStatus: RefundStatus }) {
  if (refundStatus === 'REQUESTED') return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-500/15 border border-orange-500/40 text-orange-400">
      <RotateCcw className="w-3 h-3" />退款审核中
    </span>
  )
  if (refundStatus === 'REJECTED') return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/15 border border-red-500/40 text-red-400">
      <Ban className="w-3 h-3" />退款已驳回
    </span>
  )
  if (refundStatus === 'COMPLETED' || status === 'REFUNDED') return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-500/15 border border-slate-600 text-slate-400">
      <RefreshCw className="w-3 h-3" />已退款
    </span>
  )
  if (status === 'PAID') return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 border border-emerald-500/40 text-emerald-400">
      <CheckCircle2 className="w-3 h-3" />已付款
    </span>
  )
  if (status === 'PENDING') return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-500/15 border border-slate-600 text-slate-400">
      <Clock className="w-3 h-3" />未付款
    </span>
  )
  if (status === 'CANCELED') return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-600/15 border border-slate-700 text-slate-500">
      <Ban className="w-3 h-3" />已取消
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/15 border border-red-500/40 text-red-400">
      <XCircle className="w-3 h-3" />支付失败
    </span>
  )
}

function RefundReviewPanel({ order, onClose, onRefresh }: {
  order: Order; onClose: () => void; onRefresh: () => void
}) {
  const { toast } = useToast()
  const [phase, setPhase] = useState<'review' | 'confirm-approve' | 'reject-input'>('review')
  const [rejectReason, setRejectReason] = useState('')
  const [rejectErr, setRejectErr] = useState('')
  const [loading, setLoading] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (phase === 'reject-input') setTimeout(() => textareaRef.current?.focus(), 50)
  }, [phase])

  const callApi = async (action: 'approve' | 'reject', reason?: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/orders/${order.rawId}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, rejectReason: reason }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || '操作失败')
      toast({ title: action === 'approve' ? '✅ 退款已处理' : '✅ 已驳回退款申请', description: data?.message })
      onClose(); onRefresh()
    } catch (e: any) {
      toast({ title: '❌ 操作失败', description: e?.message, variant: 'destructive' })
    } finally { setLoading(false) }
  }

  const handleReject = async () => {
    if (!rejectReason.trim()) { setRejectErr('请填写驳回原因'); return }
    if (rejectReason.trim().length < 5) { setRejectErr('驳回原因至少 5 个字符'); return }
    setRejectErr('')
    await callApi('reject', rejectReason.trim())
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="w-full max-w-lg bg-slate-900 border border-red-500/30 rounded-3xl overflow-hidden shadow-2xl"
        >
          <div className="h-1 bg-gradient-to-r from-orange-500 via-red-500 to-rose-500" />
          <div className="p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-red-500/20 border border-red-500/30 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">退款审核面板</h3>
                  <p className="text-xs text-slate-400">操作不可撤销，请仔细确认</p>
                </div>
              </div>
              <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-5">
              {[
                { label: '订单流水号', value: order.id },
                { label: '用户邮箱',   value: order.userEmail },
                { label: '订单金额',   value: `¥${order.amount}`, hi: true },
                { label: '支付方式',   value: order.payMethod },
                { label: '网关流水号', value: order.paymentIntentId || '（未记录）' },
                { label: '创建时间',   value: order.createdAt },
              ].map(r => (
                <div key={r.label} className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3">
                  <p className="text-[11px] text-slate-500 mb-0.5">{r.label}</p>
                  <p className={`text-sm font-semibold truncate ${r.hi ? 'text-emerald-400 text-lg' : 'text-white'}`}>{r.value}</p>
                </div>
              ))}
            </div>

            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 mb-5">
              <p className="text-xs font-semibold text-amber-300 mb-1">用户申请退款原因</p>
              <p className="text-slate-300 text-sm leading-relaxed">{order.refundReason || '（用户未填写退款原因）'}</p>
            </div>

            {phase === 'review' && (
              <>
                {!order.paymentIntentId && (
                  <div className="flex items-start gap-2 bg-slate-800/60 border border-slate-700/50 rounded-xl px-4 py-3 mb-4">
                    <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-300/80">未检测到支付网关流水号，将以 Mock 模式处理（MVP 阶段）。生产上线前请确保回调写入 paymentIntentId。</p>
                  </div>
                )}
                <div className="flex gap-3">
                  <button onClick={() => setPhase('reject-input')} disabled={loading}
                    className="flex-1 py-3 rounded-xl border border-slate-600 text-slate-300 hover:bg-slate-800 font-semibold text-sm transition-all disabled:opacity-50">
                    驳回申请
                  </button>
                  <button onClick={() => setPhase('confirm-approve')} disabled={loading}
                    className="flex-1 py-3 rounded-xl bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-bold text-sm shadow-lg shadow-red-500/20 transition-all disabled:opacity-50">
                    同意并原路退回
                  </button>
                </div>
              </>
            )}

            {phase === 'confirm-approve' && (
              <div>
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-4 mb-4 text-center">
                  <p className="text-red-300 text-sm font-semibold mb-1">⚠️ 最终确认</p>
                  <p className="text-slate-400 text-xs">即将向支付网关发起 <span className="text-red-400 font-bold">¥{order.amount}</span> 退款，此操作不可撤销。</p>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setPhase('review')} disabled={loading}
                    className="flex-1 py-3 rounded-xl border border-slate-600 text-slate-300 hover:bg-slate-800 font-semibold text-sm transition-all disabled:opacity-50">返回</button>
                  <button onClick={() => callApi('approve')} disabled={loading}
                    className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm shadow-lg shadow-red-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                    {loading ? <><Loader2 className="w-4 h-4 animate-spin" />处理中...</> : '确认执行退款'}
                  </button>
                </div>
              </div>
            )}

            {phase === 'reject-input' && (
              <div>
                <div className="mb-4">
                  <label className="block text-xs text-slate-400 mb-1.5 font-medium">驳回原因 <span className="text-red-400">*</span></label>
                  <textarea
                    ref={textareaRef}
                    value={rejectReason}
                    onChange={e => { setRejectReason(e.target.value); setRejectErr('') }}
                    placeholder="请说明驳回原因，例如：超过退款期限、违反服务协议等（至少 5 个字符）"
                    rows={3}
                    className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-red-500/60 resize-none transition-all"
                  />
                  {rejectErr && <p className="mt-1 text-xs text-red-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{rejectErr}</p>}
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setPhase('review')} disabled={loading}
                    className="flex-1 py-3 rounded-xl border border-slate-600 text-slate-300 hover:bg-slate-800 font-semibold text-sm transition-all disabled:opacity-50">返回</button>
                  <button onClick={handleReject} disabled={loading || !rejectReason.trim()}
                    className="flex-1 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                    {loading ? <><Loader2 className="w-4 h-4 animate-spin" />提交中...</> : '确认驳回'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </>
  )
}

// ─── Main Page ───────────────────────────────────────────────────
export default function AdminOrdersPage() {
  const { toast } = useToast()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<TabKey>('ALL')
  const [reviewOrder, setReviewOrder] = useState<Order | null>(null)

  const loadOrders = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/orders/list')
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || '加载失败')
      setOrders(data?.orders || [])
    } catch (e: any) {
      toast({ title: '加载失败', description: e?.message, variant: 'destructive' })
    } finally { setLoading(false) }
  }

  useEffect(() => { loadOrders() }, [])

  const counts = useMemo(() => ({
    ALL:            orders.length,
    PENDING:        orders.filter(o => o.status === 'PENDING').length,
    PAID:           orders.filter(o => o.status === 'PAID' && o.refundStatus === 'NONE').length,
    REFUND_PENDING: orders.filter(o => o.refundStatus === 'REQUESTED').length,
    DONE:           orders.filter(o => o.refundStatus === 'COMPLETED' || o.refundStatus === 'REJECTED' || o.status === 'REFUNDED').length,
  }), [orders])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return orders.filter(o => {
      const matchTab =
        tab === 'ALL'            ? true :
        tab === 'PENDING'        ? o.status === 'PENDING' :
        tab === 'PAID'           ? (o.status === 'PAID' && o.refundStatus === 'NONE') :
        tab === 'REFUND_PENDING' ? o.refundStatus === 'REQUESTED' :
        (o.refundStatus === 'COMPLETED' || o.refundStatus === 'REJECTED' || o.status === 'REFUNDED')
      const matchSearch = !q || o.userEmail.toLowerCase().includes(q) || o.id.toLowerCase().includes(q)
      return matchTab && matchSearch
    })
  }, [orders, tab, search])

  const totalRevenue = orders.filter(o => o.status === 'PAID').reduce((a, o) => a + o.amount, 0)

  const TABS: { key: TabKey; label: string; urgency?: boolean }[] = [
    { key: 'ALL',            label: '全部' },
    { key: 'PENDING',        label: '未付款' },
    { key: 'PAID',           label: '已付款' },
    { key: 'REFUND_PENDING', label: '退款工单', urgency: true },
    { key: 'DONE',           label: '已退款/驳回' },
  ]

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-4xl font-bold text-white">订单管理</h1>
        <button onClick={loadOrders} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 text-sm transition-all disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />刷新
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: '总收入',   value: `¥${totalRevenue.toLocaleString()}`,  color: '#10b981' },
          { label: '全部订单', value: counts.ALL,                            color: '#3b82f6' },
          { label: '退款工单', value: counts.REFUND_PENDING,                 color: counts.REFUND_PENDING > 0 ? '#f97316' : '#64748b' },
          { label: '已退款',   value: counts.DONE,                           color: '#ef4444' },
        ].map(s => (
          <div key={s.label} className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
            <div className="text-2xl font-bold mb-1" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs text-slate-500">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-4 mb-6">
        <div className="flex gap-1 bg-slate-900/60 border border-slate-800 rounded-2xl p-1">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`relative px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                tab === t.key ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}>
              {t.label}
              <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                tab === t.key ? 'bg-white/20 text-white' :
                t.urgency && counts[t.key] > 0 ? 'bg-orange-500/30 text-orange-300' : 'bg-slate-700 text-slate-400'
              }`}>{counts[t.key]}</span>
              {t.urgency && counts[t.key] > 0 && tab !== t.key && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
              )}
            </button>
          ))}
        </div>
        <div className="relative ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="搜索邮箱或订单号"
            className="pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 w-72" />
        </div>
      </div>

      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-800">
              {['订单流水号','用户邮箱','套餐','金额','支付方式','状态','时间','操作'].map(h => (
                <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-slate-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="py-16 text-center">
                <Loader2 className="w-6 h-6 animate-spin text-slate-500 mx-auto" />
              </td></tr>
            ) : visible.length === 0 ? (
              <tr><td colSpan={8} className="py-16 text-center text-slate-500 text-sm">暂无订单数据</td></tr>
            ) : visible.map(o => (
              <tr key={o.rawId} className={`border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors ${
                o.refundStatus === 'REQUESTED' ? 'bg-orange-500/5' : ''
              }`}>
                <td className="py-3 px-4">
                  <span className="text-xs font-mono text-slate-400 block max-w-[140px] truncate">{o.id}</span>
                  {o.rejectReason && (
                    <span className="text-[10px] text-red-400 block mt-0.5 truncate max-w-[140px]">驳回：{o.rejectReason}</span>
                  )}
                </td>
                <td className="py-3 px-4 text-sm text-white">{o.userEmail}</td>
                <td className="py-3 px-4">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    o.planType === 'subscription' ? 'bg-blue-500/15 text-blue-400' : 'bg-orange-500/15 text-orange-400'
                  }`}>{o.plan}</span>
                </td>
                <td className="py-3 px-4 font-bold text-white">¥{o.amount}</td>
                <td className="py-3 px-4 text-sm text-slate-400">{o.payMethod}</td>
                <td className="py-3 px-4"><StatusBadge status={o.status} refundStatus={o.refundStatus} /></td>
                <td className="py-3 px-4 text-xs text-slate-500">{o.createdAt}</td>
                <td className="py-3 px-4">
                  {o.refundStatus === 'REQUESTED' && (
                    <button onClick={() => setReviewOrder(o)}
                      className="px-3 py-1.5 bg-orange-500/20 border border-orange-500/40 text-orange-300 rounded-lg text-xs font-bold hover:bg-orange-500/30 transition-all flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />审核
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {reviewOrder && (
          <RefundReviewPanel
            order={reviewOrder}
            onClose={() => setReviewOrder(null)}
            onRefresh={loadOrders}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
