"use client"

import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { 
  Ticket,
  TrendingUp,
  XCircle,
  Plus,
  X,
  Search
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"

// 优惠券数据类型
type Coupon = {
  id: string
  code: string
  userId: string
  userEmail: string
  amount: number
  status: 'unused' | 'used' | 'expired'
  source: string
  issuedAt: string
  expiresAt: string
  usedAt?: string
}

export default function CouponsPage() {
  const { toast } = useToast()
  const [showIssueModal, setShowIssueModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [issueEmail, setIssueEmail] = useState('')
  const [issueAmount, setIssueAmount] = useState('')
  const [issueExpireDays, setIssueExpireDays] = useState('90')
  const [loading, setLoading] = useState(true)
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [couponStats, setCouponStats] = useState({ totalIssued: 0, totalUsed: 0, totalExpired: 0 })

  const loadCoupons = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/coupons/list')
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || '加载失败')
      setCoupons(data?.coupons || [])
      setCouponStats(data?.stats || { totalIssued: 0, totalUsed: 0, totalExpired: 0 })
    } catch (e: any) {
      toast({ title: '加载失败', description: e?.message || '无法加载优惠券列表', variant: 'destructive' })
      setCoupons([])
      setCouponStats({ totalIssued: 0, totalUsed: 0, totalExpired: 0 })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCoupons()
  }, [])

  // 过滤优惠券
  const filteredCoupons = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return coupons
    return coupons.filter(coupon =>
      coupon.code.toLowerCase().includes(q) ||
      coupon.userEmail.toLowerCase().includes(q) ||
      coupon.id.toLowerCase().includes(q)
    )
  }, [coupons, searchQuery])

  // 手动发行优惠券
  const handleIssueCoupon = async () => {
    if (!issueEmail || !issueAmount || !issueExpireDays) {
      toast({ title: '请填写完整信息', variant: 'destructive' })
      return
    }
    try {
      const res = await fetch('/api/admin/coupons/issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: issueEmail,
          amount: Number(issueAmount),
          expireDays: Number(issueExpireDays),
          source: '后台补偿',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || '发行失败')
      toast({ title: '✅ 优惠券发行成功', description: `已发放给：${issueEmail}` })
      setShowIssueModal(false)
      setIssueEmail('')
      setIssueAmount('')
      setIssueExpireDays('90')
      await loadCoupons()
    } catch (e: any) {
      toast({ title: '❌ 发行失败', description: e?.message || '请稍后重试', variant: 'destructive' })
    }
  }

  // 获取状态样式
  const getStatusStyle = (status: Coupon['status']) => {
    switch (status) {
      case 'unused':
        return {
          bg: 'bg-emerald-500/20',
          border: 'border-emerald-500/30',
          text: 'text-emerald-400',
          label: '未使用'
        }
      case 'used':
        return {
          bg: 'bg-slate-500/20',
          border: 'border-slate-500/30',
          text: 'text-slate-400',
          label: '已核销'
        }
      case 'expired':
        return {
          bg: 'bg-red-500/20',
          border: 'border-red-500/30',
          text: 'text-red-400',
          label: '已过期'
        }
    }
  }

  return (
    <div className="container mx-auto px-6 py-8">
      {/* 页面标题 */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2">卡包管理</h1>
          <p className="text-slate-400">系统裂变中枢 - 管理全站优惠券发放与核销</p>
        </div>
        
        {/* 手动发行按钮 */}
        <Button
          onClick={() => setShowIssueModal(true)}
          className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white px-6 py-6 text-lg shadow-xl"
        >
          <Plus className="w-5 h-5 mr-2" />
          手动发行优惠券
        </Button>
      </div>

      {/* 顶部数据卡片 */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        {/* 累计发放总额 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative group"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-cyan-500 opacity-0 group-hover:opacity-20 rounded-3xl blur-2xl transition-opacity" />
          
          <div className="relative bg-slate-900/50 border border-slate-700 rounded-3xl p-6 hover:border-slate-600 transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                <Ticket className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="text-3xl font-bold text-white mb-2">
              ¥{couponStats.totalIssued.toLocaleString()}
            </div>
            <div className="text-sm text-slate-400">累计发放优惠券总额</div>
          </div>
        </motion.div>

        {/* 已核销总额 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="relative group"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 to-teal-500 opacity-0 group-hover:opacity-20 rounded-3xl blur-2xl transition-opacity" />
          
          <div className="relative bg-slate-900/50 border border-slate-700 rounded-3xl p-6 hover:border-slate-600 transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="text-3xl font-bold text-white mb-2">
              ¥{couponStats.totalUsed.toLocaleString()}
            </div>
            <div className="text-sm text-slate-400">已被核销总额</div>
          </div>
        </motion.div>

        {/* 未核销作废总额 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="relative group"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-red-500 to-pink-500 opacity-0 group-hover:opacity-20 rounded-3xl blur-2xl transition-opacity" />
          
          <div className="relative bg-slate-900/50 border border-slate-700 rounded-3xl p-6 hover:border-slate-600 transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center">
                <XCircle className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="text-3xl font-bold text-white mb-2">
              ¥{couponStats.totalExpired.toLocaleString()}
            </div>
            <div className="text-sm text-slate-400">未核销作废总额</div>
          </div>
        </motion.div>
      </div>

      {/* 搜索和统计 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索券码、用户邮箱或ID"
              className="pl-10 pr-4 py-2 w-80 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="text-sm text-slate-400">
            共 <span className="text-white font-bold">{coupons.length}</span> 张优惠券
          </div>
        </div>
      </div>

      {/* 数据表格 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-slate-900/50 border border-slate-700 rounded-3xl overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-800/50">
                <th className="text-left py-4 px-6 text-sm font-semibold text-slate-400">券码 ID</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-slate-400">归属用户</th>
                <th className="text-right py-4 px-6 text-sm font-semibold text-slate-400">面额</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-slate-400">状态</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-slate-400">发放渠道</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-slate-400">发放时间</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-slate-400">有效期至</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-slate-400">核销时间</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="py-12 text-center text-slate-400">加载中...</td></tr>
              ) : filteredCoupons.length === 0 ? (
                <tr><td colSpan={8} className="py-12 text-center text-slate-500">暂无优惠券数据</td></tr>
              ) : filteredCoupons.map((coupon, index) => {
                const statusStyle = getStatusStyle(coupon.status)
                
                return (
                  <motion.tr
                    key={coupon.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + index * 0.03 }}
                    className="border-b border-slate-800 hover:bg-slate-800/30 transition-colors"
                  >
                    {/* 券码 ID */}
                    <td className="py-4 px-6">
                      <div>
                        <div className="text-white font-medium">{coupon.id}</div>
                        <div className="text-xs text-slate-500 font-mono">{coupon.code}</div>
                      </div>
                    </td>

                    {/* 归属用户 */}
                    <td className="py-4 px-6">
                      <div className="text-blue-400">{coupon.userEmail}</div>
                    </td>

                    {/* 面额 */}
                    <td className="py-4 px-6 text-right">
                      <span className="text-orange-400 font-bold text-lg">¥{coupon.amount}</span>
                    </td>

                    {/* 状态 */}
                    <td className="py-4 px-6">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusStyle.bg} border ${statusStyle.border} ${statusStyle.text}`}>
                        {statusStyle.label}
                      </span>
                    </td>

                    {/* 发放渠道 */}
                    <td className="py-4 px-6">
                      <span className={`text-sm ${
                        coupon.source === '分销奖励' ? 'text-emerald-400' : 'text-purple-400'
                      }`}>
                        {coupon.source}
                      </span>
                    </td>

                    {/* 发放时间 */}
                    <td className="py-4 px-6">
                      <span className="text-slate-400 text-sm">{coupon.issuedAt}</span>
                    </td>

                    {/* 有效期至 */}
                    <td className="py-4 px-6">
                      <span className="text-slate-400 text-sm">{coupon.expiresAt}</span>
                    </td>

                    {/* 核销时间 */}
                    <td className="py-4 px-6">
                      {coupon.usedAt ? (
                        <span className="text-slate-400 text-sm">{coupon.usedAt}</span>
                      ) : (
                        <span className="text-slate-600 text-sm">-</span>
                      )}
                    </td>
                  </motion.tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* 手动发行优惠券弹窗 */}
      {showIssueModal && (
        <>
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={() => setShowIssueModal(false)}
          />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-slate-900 border border-orange-500/50 rounded-2xl p-6 max-w-md w-full"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center">
                    <Ticket className="w-6 h-6 text-orange-500" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">手动发行优惠券</h3>
                    <p className="text-sm text-slate-400">定向发券给指定用户</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowIssueModal(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-4 mb-6">
                {/* 用户邮箱 */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    用户邮箱
                  </label>
                  <input
                    type="email"
                    value={issueEmail}
                    onChange={(e) => setIssueEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>

                {/* 优惠券面额 */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    优惠券面额（元）
                  </label>
                  <input
                    type="number"
                    value={issueAmount}
                    onChange={(e) => setIssueAmount(e.target.value)}
                    placeholder="请输入金额"
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>

                {/* 有效期 */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    有效期（天）
                  </label>
                  <select
                    value={issueExpireDays}
                    onChange={(e) => setIssueExpireDays(e.target.value)}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  >
                    <option value="14">14 天（极速收割）</option>
                    <option value="30">30 天（常规逼单）</option>
                    <option value="90">90 天（长线留存）</option>
                  </select>
                </div>
              </div>

              <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4 mb-6">
                <p className="text-sm text-slate-300">
                  发行后优惠券将立即生效，用户可在钱包中查看并使用。
                </p>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={() => setShowIssueModal(false)}
                  variant="outline"
                  className="flex-1"
                >
                  取消
                </Button>
                <Button
                  onClick={handleIssueCoupon}
                  disabled={!issueEmail || !issueAmount}
                  className="flex-1 bg-orange-600 hover:bg-orange-500 text-white"
                >
                  确认发行
                </Button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </div>
  )
}
