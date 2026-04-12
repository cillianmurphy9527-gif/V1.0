"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { 
  Copy, 
  Check, 
  Users, 
  ShoppingCart, 
  Ticket,
  TrendingUp,
  Gift,
  Sparkles,
  Award
} from "lucide-react"
import { Button } from "@/components/ui/button"

// 优惠券获取记录类型
type CouponLog = {
  id: string
  buyerPhone: string // 被邀请人手机号（掩码）
  plan: string // 购买套餐
  couponAmount: number // 获得的优惠券金额
  createdAt: string
}

export default function AffiliatePage() {
  const [copied, setCopied] = useState(false)

  const [referralCode, setReferralCode] = useState('')
  const [referralLink, setReferralLink] = useState('')
  const [totalReferrals, setTotalReferrals] = useState(0)
  const [paidConversions, setPaidConversions] = useState(0)
  const [totalCoupons, setTotalCoupons] = useState(0)
  const [unusedCoupons, setUnusedCoupons] = useState(0)
  const [couponLogs, setCouponLogs] = useState<CouponLog[]>([])
  const [loadingData, setLoadingData] = useState(true)

  useEffect(() => {
    fetch('/api/affiliate/stats')
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then(async d => {
        // 确保邀请码不为空
        let code: string = d?.referralCode || ''
        if (!code) {
          const genRes = await fetch('/api/affiliate/generate-code', { method: 'POST' })
          if (genRes.ok) {
            const genData = await genRes.json()
            code = genData?.referralCode || ''
          }
        }
        // referralLink 在 useEffect 里构建，window 此时必然存在
        const origin = window.location.origin || 'https://leadpilot.com'
        setReferralCode(code)
        setReferralLink(code ? `${origin}/register?ref=${code}` : '')
        setTotalReferrals(d?.totalReferrals || 0)
        setPaidConversions(d?.paidConversions || 0)
        setTotalCoupons(d?.totalCoupons || 0)
        setUnusedCoupons(d?.unusedCoupons || 0)
        setCouponLogs(d?.couponLogs || [])
      })
      .catch((err) => {
        console.error('[Affiliate] 加载失败', err)
      })
      .finally(() => setLoadingData(false))
  }, [])

  // 复制邀请码
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="container mx-auto px-6 py-8">
        {/* 页面标题 */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
            🔥 全球合伙人
            <span className="text-2xl font-normal text-slate-400">(Affiliate Program)</span>
          </h1>
          <p className="text-slate-400">邀请同行，获得优惠券，多邀多得</p>
        </div>

        {/* 专属海报与链接区 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative mb-8"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-orange-500/30 to-red-500/30 rounded-3xl blur-3xl" />
          
          <div className="relative bg-slate-900/80 backdrop-blur-xl border border-orange-500/30 rounded-3xl p-8">
            <div className="grid md:grid-cols-2 gap-8">
              {/* 左侧：邀请码 */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Gift className="w-5 h-5 text-orange-400" />
                  <h3 className="text-xl font-bold text-white">您的专属邀请码</h3>
                </div>
                
                <div className="bg-slate-800/50 rounded-2xl p-6 mb-4">
                  <div className="text-center">
                    <div className="text-sm text-slate-400 mb-2">邀请码</div>
                    <div className="text-5xl font-bold bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent tracking-wider mb-4 min-h-[60px] flex items-center justify-center">
                      {loadingData ? (
                        <span className="text-2xl text-slate-600 animate-pulse">生成中...</span>
                      ) : referralCode ? (
                        referralCode
                      ) : (
                        <span className="text-2xl text-slate-500">暂无邀请码</span>
                      )}
                    </div>
                    <Button
                      onClick={() => referralCode && handleCopy(referralCode)}
                      disabled={!referralCode || loadingData}
                      className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {copied ? (
                        <>
                          <Check className="w-4 h-4 mr-2" />
                          已复制
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 mr-2" />
                          一键复制邀请码
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                <div className="bg-slate-800/50 rounded-2xl p-4">
                  <div className="text-xs text-slate-400 mb-2">邀请链接</div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={referralLink}
                      readOnly
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 font-mono"
                    />
                    <Button
                      onClick={() => referralLink && handleCopy(referralLink)}
                      size="sm"
                      variant="outline"
                      disabled={!referralLink}
                      className="border-slate-600 text-slate-300 hover:bg-slate-800 disabled:opacity-40"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* 右侧：分销政策 */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-5 h-5 text-orange-400" />
                  <h3 className="text-xl font-bold text-white">分销政策</h3>
                </div>

                <div className="bg-gradient-to-br from-orange-500/20 to-red-500/20 border border-orange-500/30 rounded-2xl p-6">
                  <div className="space-y-4 text-slate-200 leading-relaxed">
                    <p className="text-lg font-semibold text-white">
                      邀请同行入驻，对方首单立减 ¥100。
                    </p>
                    <p className="text-lg font-semibold text-white">
                      对方付费成功后，您将获得对应等级的<span className="text-orange-400">【无门槛充值优惠券】</span>，多邀多得！
                    </p>
                  </div>

                  <div className="mt-6 pt-6 border-t border-orange-500/20">
                    <div className="text-sm text-orange-300 font-semibold mb-3">阶梯奖励规则：</div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between bg-slate-800/50 rounded-lg px-4 py-3">
                        <span className="text-slate-300">好友购买体验版</span>
                        <span className="text-orange-400 font-bold">→ 奖 ¥50 优惠券</span>
                      </div>
                      <div className="flex items-center justify-between bg-slate-800/50 rounded-lg px-4 py-3">
                        <span className="text-slate-300">好友购买专业版</span>
                        <span className="text-orange-400 font-bold">→ 奖 ¥150 优惠券</span>
                      </div>
                      <div className="flex items-center justify-between bg-slate-800/50 rounded-lg px-4 py-3">
                        <span className="text-slate-300">好友购买企业版</span>
                        <span className="text-orange-400 font-bold">→ 奖 ¥300 优惠券</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* 数据看板 */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          {[
            { 
              icon: Users, 
              label: '累计邀请注册', 
              value: totalReferrals, 
              unit: '人',
              color: 'blue',
              gradient: 'from-blue-500 to-cyan-500'
            },
            { 
              icon: ShoppingCart, 
              label: '成功付费转化', 
              value: paidConversions, 
              unit: '单',
              color: 'purple',
              gradient: 'from-purple-500 to-pink-500'
            },
            { 
              icon: Ticket, 
              label: '🎟️ 累计获得优惠券', 
              value: totalCoupons, 
              unit: '张',
              color: 'orange',
              gradient: 'from-orange-500 to-red-500'
            },
            { 
              icon: Award, 
              label: '未使用优惠券', 
              value: unusedCoupons, 
              unit: '张',
              color: 'emerald',
              gradient: 'from-emerald-500 to-teal-500'
            }
          ].map((stat, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + index * 0.1 }}
              className="relative group"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-0 group-hover:opacity-20 rounded-3xl blur-2xl transition-opacity`} />
              
              <div className="relative bg-slate-900/50 border border-slate-700 rounded-3xl p-6 hover:border-slate-600 transition-all">
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${stat.gradient} flex items-center justify-center`}>
                    <stat.icon className="w-6 h-6 text-white" />
                  </div>
                </div>
                <div className="text-4xl font-bold text-white mb-2">
                  {stat.value}
                  {stat.unit && <span className="text-xl text-slate-400 ml-2">{stat.unit}</span>}
                </div>
                <div className="text-sm text-slate-400">{stat.label}</div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* 优惠券获取记录 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-slate-900/50 border border-slate-700 rounded-3xl p-8"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-bold text-white">优惠券获取记录</h3>
            <div className="text-sm text-slate-400">
              共 {couponLogs.length} 条记录
            </div>
          </div>

          {couponLogs.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Ticket className="w-16 h-16 mx-auto mb-4 opacity-20" />
              <p>暂无优惠券记录</p>
              <p className="text-sm mt-2">分享您的邀请码，开始获得优惠券</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-4 px-4 text-sm font-semibold text-slate-400">获取时间</th>
                    <th className="text-left py-4 px-4 text-sm font-semibold text-slate-400">被邀请人</th>
                    <th className="text-left py-4 px-4 text-sm font-semibold text-slate-400">购买套餐</th>
                    <th className="text-right py-4 px-4 text-sm font-semibold text-slate-400">获得奖励</th>
                  </tr>
                </thead>
                <tbody>
                  {couponLogs.map((log, index) => (
                    <motion.tr
                      key={log.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 + index * 0.05 }}
                      className="border-b border-slate-800 hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="py-4 px-4">
                        <span className="text-sm text-slate-400">{log.createdAt}</span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-white font-medium font-mono">{log.buyerPhone}</span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-blue-400 font-medium">{log.plan}</span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <motion.div
                          initial={{ scale: 1 }}
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ duration: 0.5, delay: 0.5 + index * 0.05 }}
                          className="inline-flex items-center gap-1 text-orange-400 font-bold text-lg"
                        >
                          <Ticket className="w-4 h-4" />
                          <span>¥{log.couponAmount} 优惠券</span>
                        </motion.div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
