"use client"
import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { AlertTriangle, CheckCircle2, XCircle, Loader2, RefreshCw } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

interface RefundRequest {
  id: string
  orderId: string
  userEmail: string
  amount: number
  refundReason: string
  refundStatus: "REQUESTED" | "APPROVED" | "REJECTED" | "COMPLETED"
  status: "PENDING" | "PAID" | "REFUNDED" | "CANCELED"
  createdAt: string
  updatedAt: string
}

const REASON_MAP: Record<string, string> = {
  NOT_SATISFIED: "不满意服务质量",
  DUPLICATE_CHARGE: "重复扣费",
  WRONG_PLAN: "选错套餐",
  TECHNICAL_ISSUE: "技术问题",
  OTHER: "其他原因",
}

export default function RefundsPage() {
  const { toast } = useToast()
  const [requests, setRequests] = useState<RefundRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRequest, setSelectedRequest] = useState<RefundRequest | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [newStatus, setNewStatus] = useState<string>("")
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    fetchRefundRequests()
  }, [])

  const fetchRefundRequests = async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/admin/refunds")
      if (res.ok) {
        const data = await res.json()
        setRequests(data.refunds || [])
      }
    } catch (error) {
      console.error("Failed to fetch refunds:", error)
      toast({
        title: "加载失败",
        description: "无法加载退款申请",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleApproveRefund = async (request: RefundRequest) => {
    try {
      setProcessing(true)
      const res = await fetch(`/api/admin/refunds/${request.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" })
      })

      if (res.ok) {
        toast({ title: "✅ 退款已批准", description: `订单 ${request.orderId} 的退款已批准` })
        fetchRefundRequests()
        setShowDetailModal(false)
      }
    } catch (error) {
      toast({ title: "操作失败", description: "网络错误", variant: "destructive" })
    } finally {
      setProcessing(false)
    }
  }

  const handleRejectRefund = async (request: RefundRequest) => {
    try {
      setProcessing(true)
      const res = await fetch(`/api/admin/refunds/${request.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject" })
      })

      if (res.ok) {
        toast({ title: "✅ 退款已拒绝", description: `订单 ${request.orderId} 的退款已拒绝` })
        fetchRefundRequests()
        setShowDetailModal(false)
      }
    } catch (error) {
      toast({ title: "操作失败", description: "网络错误", variant: "destructive" })
    } finally {
      setProcessing(false)
    }
  }

  const handleChangeOrderStatus = async (request: RefundRequest) => {
    if (!newStatus) return
    try {
      setProcessing(true)
      const res = await fetch(`/api/admin/orders/${request.orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus })
      })

      if (res.ok) {
        toast({ title: "✅ 订单状态已更新", description: `订单 ${request.orderId} 状态已更改为 ${newStatus}` })
        fetchRefundRequests()
        setShowStatusModal(false)
        setNewStatus("")
      }
    } catch (error) {
      toast({ title: "操作失败", description: "网络错误", variant: "destructive" })
    } finally {
      setProcessing(false)
    }
  }

  const pendingRequests = requests.filter(r => r.refundStatus === "REQUESTED")
  const processedRequests = requests.filter(r => r.refundStatus !== "REQUESTED")

  if (loading) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="w-8 h-8 text-amber-400 animate-spin" /></div>
  }

  return (
    <div className="min-h-screen bg-slate-950 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">退款审核管理</h1>
            <p className="text-slate-400">从数据库拉取真实退款申请</p>
          </div>
          <button onClick={fetchRefundRequests} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors">
            <RefreshCw className="w-4 h-4" />刷新
          </button>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-slate-900/50 border border-slate-700 rounded-xl p-6 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <AlertTriangle className="w-6 h-6 text-amber-400" />
            <h2 className="text-2xl font-bold text-white">待审核申请 ({pendingRequests.length})</h2>
          </div>

          {pendingRequests.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
              <p className="text-slate-400">暂无待审核的退款申请</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingRequests.map((request) => (
                <motion.div key={request.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 hover:border-amber-500/50 transition-colors cursor-pointer" onClick={() => { setSelectedRequest(request); setShowDetailModal(true) }}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-white font-semibold">订单 {request.orderId}</span>
                        <span className="px-2 py-1 bg-amber-500/20 border border-amber-500/30 rounded text-xs text-amber-400">¥{request.amount}</span>
                      </div>
                      <p className="text-slate-400 text-sm mb-2">用户: {request.userEmail}</p>
                      <p className="text-slate-400 text-sm">原因: {REASON_MAP[request.refundReason] || request.refundReason}</p>
                    </div>
                    <div className="text-right"><div className="text-xs text-slate-500">{new Date(request.createdAt).toLocaleString("zh-CN")}</div></div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-slate-900/50 border border-slate-700 rounded-xl p-6">
          <h2 className="text-2xl font-bold text-white mb-6">已处理申请 ({processedRequests.length})</h2>
          {processedRequests.length === 0 ? (
            <div className="text-center py-12"><p className="text-slate-400">暂无已处理的退款申请</p></div>
          ) : (
            <div className="space-y-3">
              {processedRequests.map((request) => (
                <div key={request.id} className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-white font-semibold">订单 {request.orderId}</span>
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${request.refundStatus === "APPROVED" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-red-500/20 text-red-400 border border-red-500/30"}`}>{request.refundStatus === "APPROVED" ? "已批准" : "已拒绝"}</span>
                    </div>
                    <p className="text-slate-400 text-sm">用户: {request.userEmail}</p>
                  </div>
                  <div className="text-right text-xs text-slate-500">{new Date(request.updatedAt).toLocaleString("zh-CN")}</div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      <AnimatePresence>
        {showDetailModal && selectedRequest && (
          <>
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50" onClick={() => setShowDetailModal(false)} />
            <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-slate-900 border border-slate-700 rounded-xl p-8 max-w-2xl w-full">
                <h2 className="text-2xl font-bold text-white mb-6">退款申请详情</h2>
                <div className="space-y-4 mb-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div><div className="text-sm text-slate-400 mb-1">订单号</div><div className="text-white font-semibold">{selectedRequest.orderId}</div></div>
                    <div><div className="text-sm text-slate-400 mb-1">退款金额</div><div className="text-white font-semibold">¥{selectedRequest.amount}</div></div>
                    <div><div className="text-sm text-slate-400 mb-1">用户邮箱</div><div className="text-white font-semibold">{selectedRequest.userEmail}</div></div>
                    <div><div className="text-sm text-slate-400 mb-1">申请时间</div><div className="text-white font-semibold">{new Date(selectedRequest.createdAt).toLocaleString("zh-CN")}</div></div>
                  </div>
                  <div><div className="text-sm text-slate-400 mb-1">退款原因</div><div className="text-white font-semibold">{REASON_MAP[selectedRequest.refundReason] || selectedRequest.refundReason}</div></div>
                  <div><div className="text-sm text-slate-400 mb-1">当前订单状态</div><div className="flex items-center gap-2"><span className="text-white font-semibold">{selectedRequest.status}</span><button onClick={() => setShowStatusModal(true)} className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded transition-colors">修改状态</button></div></div>
                </div>

                {selectedRequest.refundStatus === "REQUESTED" && (
                  <div className="flex items-center gap-3 pt-6 border-t border-slate-700">
                    <button onClick={() => handleApproveRefund(selectedRequest)} disabled={processing} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 text-white font-semibold rounded-lg transition-colors">
                      {processing ? <><Loader2 className="w-4 h-4 animate-spin" /><span>处理中...</span></> : <><CheckCircle2 className="w-4 h-4" /><span>批准退款</span></>}
                    </button>
                    <button onClick={() => handleRejectRefund(selectedRequest)} disabled={processing} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-500 disabled:bg-slate-600 text-white font-semibold rounded-lg transition-colors">
                      {processing ? <><Loader2 className="w-4 h-4 animate-spin" /><span>处理中...</span></> : <><XCircle className="w-4 h-4" /><span>拒绝退款</span></>}
                    </button>
                  </div>
                )}

                <button onClick={() => setShowDetailModal(false)} className="w-full mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors">关闭</button>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showStatusModal && selectedRequest && (
          <>
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50" onClick={() => setShowStatusModal(false)} />
            <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-slate-900 border border-slate-700 rounded-xl p-8 max-w-md w-full">
                <h2 className="text-2xl font-bold text-white mb-6">修改订单状态</h2>
                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-300 mb-3">选择新状态</label>
                  <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">-- 请选择 --</option>
                    <option value="PENDING">待支付</option>
                    <option value="PAID">已支付</option>
                    <option value="REFUNDED">已退款</option>
                    <option value="CANCELED">已取消</option>
                  </select>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => handleChangeOrderStatus(selectedRequest)} disabled={!newStatus || processing} className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 text-white font-semibold rounded-lg transition-colors">{processing ? "更新中..." : "确认修改"}</button>
                  <button onClick={() => { setShowStatusModal(false); setNewStatus("") }} className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-lg transition-colors">取消</button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
