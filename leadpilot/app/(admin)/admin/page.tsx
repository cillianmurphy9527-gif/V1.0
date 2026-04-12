"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { 
  Users, 
  DollarSign, 
  Zap, 
  Mail,
  TrendingUp,
  Ban,
  Gift,
  Search,
  Calendar
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"

// 用户数据类型
type User = {
  id: string
  email: string
  phone: string
  currentPlan: string
  credits: number
  registeredAt: string
  status: 'active' | 'banned'
}

type DashboardStats = {
  newUsers: number
  totalRevenue: number
  creditsConsumed: number
  emailsSent: number
  queuedTasks: number
  filteredLeads: number
}

type Activity = {
  id: string
  user: string
  action: string
  status: 'running' | 'completed'
  time: string
}

export default function AdminPage() {
  const { toast } = useToast()
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [showBanModal, setShowBanModal] = useState(false)
  const [showGiftModal, setShowGiftModal] = useState(false)
  const [giftAmount, setGiftAmount] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  
  // 从 API 获取实时数据
  const [todayStats, setTodayStats] = useState<DashboardStats>({
    newUsers: 0,
    totalRevenue: 0,
    creditsConsumed: 0,
    emailsSent: 0,
    queuedTasks: 0,
    filteredLeads: 0
  })
  const [recentActivities, setRecentActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [revenueData, setRevenueData] = useState<Array<{date: string; subscription: number; addon: number}>>([])
  const [mrrBreakdown, setMrrBreakdown] = useState({ subscription: 0, addon: 0 })
  const [users, setUsers] = useState<User[]>([])
  const [usersLoading, setUsersLoading] = useState(true)

  useEffect(() => {
    fetchDashboardStats()
    fetchUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchDashboardStats = async () => {
    try {
      const response = await fetch('/api/admin/dashboard/stats')
      if (response.ok) {
        const data = await response.json()
        setTodayStats(data.todayStats || todayStats)
        setRecentActivities(data.recentActivities || [])
        setRevenueData(data.revenueTrend || [])
        setMrrBreakdown(data.mrrBreakdown || { subscription: 0, addon: 0 })
      }
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/admin/users/list')
      if (response.ok) {
        const data = await response.json()
        setUsers(data.users || [])
      }
    } catch (error) {
      console.error('Failed to fetch users:', error)
    } finally {
      setUsersLoading(false)
    }
  }

  // 安全除法：避免分母为 0 导致 NaN%
  const mrrTotal = mrrBreakdown.subscription + mrrBreakdown.addon
  const subPct = mrrTotal > 0 ? Math.round((mrrBreakdown.subscription / mrrTotal) * 100) : 0
  const addonPct = mrrTotal > 0 ? Math.round((mrrBreakdown.addon / mrrTotal) * 100) : 0

  return (
    <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* 页面标题 */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-2">系统管理后台</h1>
        <p className="text-sm sm:text-base text-slate-400">实时监控平台运营数据和用户管理</p>
      </div>

      {/* 核心看板 - 移动端 2 列，平板 3 列，桌面 6 列 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 lg:gap-4 mb-6 sm:mb-8">
        {[
          { 
            icon: Users, 
            label: '今日新增注册', 
            value: todayStats.newUsers, 
            unit: '人',
            color: 'blue',
            gradient: 'from-blue-500 to-cyan-500'
          },
          { 
            icon: DollarSign, 
            label: '今日实收总营收', 
            value: `¥${todayStats.totalRevenue.toLocaleString()}`, 
            unit: '',
            color: 'emerald',
            gradient: 'from-emerald-500 to-teal-500'
          },
          { 
            icon: Zap, 
            label: '消耗总算力', 
            value: todayStats.creditsConsumed.toLocaleString(), 
            unit: '点',
            color: 'orange',
            gradient: 'from-orange-500 to-red-500'
          },
          { 
            icon: Mail, 
            label: '发信总数', 
            value: todayStats.emailsSent.toLocaleString(), 
            unit: '封',
            color: 'purple',
            gradient: 'from-purple-500 to-pink-500'
          },
          { 
            icon: Calendar, 
            label: '任务队列排队数', 
            value: todayStats.queuedTasks, 
            unit: '个',
            color: 'yellow',
            gradient: 'from-yellow-500 to-orange-500'
          },
          { 
            icon: Ban, 
            label: '拦截无效线索', 
            value: todayStats.filteredLeads, 
            unit: '条',
            color: 'red',
            gradient: 'from-red-500 to-pink-500'
          }
        ].map((stat, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="relative group"
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-0 group-hover:opacity-20 rounded-2xl blur-2xl transition-opacity`} />
            
            <div className="relative bg-slate-900/50 border border-slate-700 rounded-xl sm:rounded-2xl p-3 sm:p-4 hover:border-slate-600 transition-all">
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br ${stat.gradient} flex items-center justify-center`}>
                  <stat.icon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-bold text-white mb-1">
                {stat.value}
                {stat.unit && <span className="text-xs sm:text-sm text-slate-400 ml-1">{stat.unit}</span>}
              </div>
              <div className="text-xs text-slate-400 leading-tight">{stat.label}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* 财报分析 - 移动端单列，桌面端双列 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 lg:gap-6 mb-6 sm:mb-8">
        {/* 财报漏斗图 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-slate-900/50 border border-slate-700 rounded-xl sm:rounded-2xl p-3 sm:p-4 lg:p-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white mb-1">财报漏斗图</h2>
              <p className="text-slate-400 text-xs">MRR 收入结构分析</p>
            </div>
          </div>

          {/* 漏斗可视化 */}
          <div className="space-y-4">
            {/* 订阅收入 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-400">订阅收入 (MRR)</span>
                <span className="text-lg font-bold text-blue-400">¥{mrrBreakdown.subscription.toLocaleString()}</span>
              </div>
              <div className="relative h-16 bg-slate-800/50 rounded-lg overflow-hidden">
                <div 
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-600 to-blue-400 flex items-center justify-center text-white font-bold"
                  style={{ width: `${subPct}%` }}
                >
                  {subPct}%
                </div>
              </div>
            </div>

            {/* 加油包收入 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-400">一次性加油包</span>
                <span className="text-lg font-bold text-orange-400">¥{mrrBreakdown.addon.toLocaleString()}</span>
              </div>
              <div className="relative h-16 bg-slate-800/50 rounded-lg overflow-hidden">
                <div 
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-orange-600 to-orange-400 flex items-center justify-center text-white font-bold"
                  style={{ width: `${addonPct}%` }}
                >
                  {addonPct}%
                </div>
              </div>
            </div>

            {/* 总计 */}
            <div className="pt-4 border-t border-slate-700">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">总 MRR</span>
                <span className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                  ¥{(mrrBreakdown.subscription + mrrBreakdown.addon).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Agent 实时流水动态 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-slate-900/50 border border-slate-700 rounded-xl sm:rounded-2xl p-3 sm:p-4 lg:p-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2">
            <div className="flex items-center gap-2">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-white mb-1">Agent 实时流水</h2>
                <p className="text-slate-400 text-xs">系统正在为用户自动拓客</p>
              </div>
              <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse flex-shrink-0"></div>
            </div>
          </div>

          {/* 滚动列表 */}
          <div className="space-y-2 sm:space-y-3 max-h-64 sm:max-h-96 overflow-y-auto">
            {recentActivities.map((activity, index) => (
              <motion.div
                key={activity.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 + index * 0.05 }}
                className="flex items-start gap-3 p-4 bg-slate-800/30 rounded-lg hover:bg-slate-800/50 transition-colors"
              >
                <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                  activity.status === 'running' 
                    ? 'bg-emerald-500 animate-pulse' 
                    : 'bg-slate-500'
                }`}></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-white font-medium">{activity.user}</span>
                    <span className="text-xs text-slate-500">{activity.time}</span>
                  </div>
                  <p className="text-sm text-slate-400">{activity.action}</p>
                </div>
                {activity.status === 'running' && (
                  <span className="text-xs px-2 py-1 bg-emerald-500/20 border border-emerald-500/30 rounded text-emerald-400 flex-shrink-0">
                    运行中
                  </span>
                )}
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* 近30天营收趋势 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="bg-slate-900/50 border border-slate-700 rounded-xl sm:rounded-2xl p-3 sm:p-4 lg:p-6 mb-6 sm:mb-8"
      >
        <div className="flex flex-col gap-3 mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white mb-1">近 30 天营收趋势</h2>
              <p className="text-slate-400 text-xs">区分订阅收入和增值服务</p>
            </div>
          </div>
          <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <span className="text-xs text-slate-400">订阅收入</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-500"></div>
              <span className="text-xs text-slate-400">增值服务</span>
            </div>
          </div>
        </div>

        {/* 简化的柱状图 - 移动端横向滚动 */}
        <div className="w-full overflow-x-auto">
          <div className="min-w-[600px] h-48 sm:h-64 flex items-end justify-between gap-2">
          {revenueData.map((data, index) => {
            const maxRevenue = 10000
            const subscriptionHeight = (data.subscription / maxRevenue) * 100
            const addonHeight = (data.addon / maxRevenue) * 100
            
            return (
              <div key={index} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex flex-col gap-1">
                  <div 
                    className="w-full bg-gradient-to-t from-orange-600 to-orange-400 rounded-t transition-all hover:opacity-80"
                    style={{ height: `${addonHeight}%` }}
                    title={`增值服务: ¥${data.addon}`}
                  />
                  <div 
                    className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t transition-all hover:opacity-80"
                    style={{ height: `${subscriptionHeight}%` }}
                    title={`订阅收入: ¥${data.subscription}`}
                  />
                </div>
                <span className="text-xs text-slate-500 mt-2">{data.date}</span>
              </div>
            )
          })}
        </div>
      </div>
      </motion.div>

      {/* 用户管理列表 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-slate-900/50 border border-slate-700 rounded-xl sm:rounded-2xl p-3 sm:p-4 lg:p-6"
      >
        <div className="flex flex-col gap-3 mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white mb-1">用户管理</h2>
              <p className="text-slate-400 text-xs">共 {users.length} 个用户</p>
            </div>
          </div>
          
          {/* 搜索框 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索邮箱或手机号"
              className="w-full pl-10 pr-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>
        </div>

        {/* 用户表格 - 移动端横向滚动 */}
        <div className="w-full overflow-x-auto -mx-3 sm:-mx-4 lg:-mx-6 px-3 sm:px-4 lg:px-6">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-2 sm:py-3 px-2 sm:px-3 text-xs font-semibold text-slate-400">邮箱</th>
                <th className="text-left py-2 sm:py-3 px-2 sm:px-3 text-xs font-semibold text-slate-400">手机号</th>
                <th className="text-left py-2 sm:py-3 px-2 sm:px-3 text-xs font-semibold text-slate-400">套餐</th>
                <th className="text-right py-2 sm:py-3 px-2 sm:px-3 text-xs font-semibold text-slate-400">算力</th>
                <th className="text-left py-2 sm:py-3 px-2 sm:px-3 text-xs font-semibold text-slate-400">注册时间</th>
                <th className="text-left py-2 sm:py-3 px-2 sm:px-3 text-xs font-semibold text-slate-400">状态</th>
                <th className="text-right py-2 sm:py-3 px-2 sm:px-3 text-xs font-semibold text-slate-400">操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user, index) => (
                <motion.tr
                  key={user.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 + index * 0.05 }}
                  className="border-b border-slate-800 hover:bg-slate-800/30 transition-colors"
                >
                  <td className="py-2 sm:py-3 px-2 sm:px-3">
                    <span className="text-white font-medium text-xs sm:text-sm truncate block">{user.email}</span>
                  </td>
                  <td className="py-2 sm:py-3 px-2 sm:px-3">
                    <span className="text-slate-400 font-mono text-xs">{user.phone}</span>
                  </td>
                  <td className="py-2 sm:py-3 px-2 sm:px-3">
                    <span className="text-blue-400 font-medium text-xs sm:text-sm">{user.currentPlan}</span>
                  </td>
                  <td className="py-2 sm:py-3 px-2 sm:px-3 text-right">
                    <span className="text-emerald-400 font-bold text-xs sm:text-sm">{user.credits.toLocaleString()}</span>
                  </td>
                  <td className="py-2 sm:py-3 px-2 sm:px-3">
                    <span className="text-slate-400 text-xs">{user.registeredAt}</span>
                  </td>
                  <td className="py-2 sm:py-3 px-2 sm:px-3">
                    {user.status === 'active' ? (
                      <span className="px-2 py-1 bg-emerald-500/20 border border-emerald-500/30 rounded text-xs text-emerald-400 font-medium whitespace-nowrap">
                        正常
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-red-500/20 border border-red-500/30 rounded text-xs text-red-400 font-medium whitespace-nowrap">
                        已封禁
                      </span>
                    )}
                  </td>
                  <td className="py-2 sm:py-3 px-2 sm:px-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        onClick={() => {
                          setSelectedUser(user)
                          setShowBanModal(true)
                        }}
                        disabled={user.status === 'banned'}
                        size="sm"
                        variant="outline"
                        className="border-red-600 text-red-400 hover:bg-red-500/10 disabled:opacity-50 disabled:cursor-not-allowed text-xs px-2 py-1 h-auto"
                      >
                        <Ban className="w-3 h-3" />
                      </Button>
                      <Button
                        onClick={() => {
                          setSelectedUser(user)
                          setShowGiftModal(true)
                        }}
                        size="sm"
                        variant="outline"
                        className="border-emerald-600 text-emerald-400 hover:bg-emerald-500/10 text-xs px-2 py-1 h-auto"
                      >
                        <Gift className="w-3 h-3" />
                      </Button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* 封禁账号弹窗 - 移动端适配 */}
      {showBanModal && selectedUser && (
        <>
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={() => setShowBanModal(false)}
          />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-2 sm:p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-slate-900 border border-red-500/50 rounded-xl sm:rounded-2xl p-3 sm:p-4 max-w-md w-full"
            >
              <div className="flex items-center gap-3 mb-3 sm:mb-4">
                <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                  <Ban className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white">封禁账号</h3>
                  <p className="text-xs text-slate-400">此操作不可撤销</p>
                </div>
              </div>
              
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2 sm:p-3 mb-3 sm:mb-4">
                <p className="text-xs text-slate-300">
                  确定要封禁用户 <span className="text-white font-bold break-all">{selectedUser.email}</span> 吗？
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <Button
                  onClick={() => setShowBanModal(false)}
                  variant="outline"
                  className="w-full py-2 text-sm"
                >
                  取消
                </Button>
                <Button
                  onClick={handleBanUser}
                  className="w-full bg-red-600 hover:bg-red-500 text-white py-2 text-sm"
                >
                  确认封禁
                </Button>
              </div>
            </motion.div>
          </div>
        </>
      )}

      {/* 赠送算力弹窗 - 移动端适配 */}
      {showGiftModal && selectedUser && (
        <>
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={() => setShowGiftModal(false)}
          />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-2 sm:p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-slate-900 border border-emerald-500/50 rounded-xl sm:rounded-2xl p-3 sm:p-4 max-w-md w-full"
            >
              <div className="flex items-center gap-3 mb-3 sm:mb-4">
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                  <Gift className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white">赠送算力</h3>
                  <p className="text-xs text-slate-400">为用户充值算力点数</p>
                </div>
              </div>
              
              <div className="mb-3 sm:mb-4">
                <label className="block text-xs font-medium text-slate-300 mb-2">
                  用户邮箱
                </label>
                <input
                  type="text"
                  value={selectedUser.email}
                  disabled
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-400"
                />
              </div>

              <div className="mb-3 sm:mb-4">
                <label className="block text-xs font-medium text-slate-300 mb-2">
                  赠送算力点数
                </label>
                <input
                  type="number"
                  value={giftAmount}
                  onChange={(e) => setGiftAmount(e.target.value)}
                  placeholder="请输入算力点数"
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Button
                  onClick={() => setShowGiftModal(false)}
                  variant="outline"
                  className="w-full py-2 text-sm"
                >
                  取消
                </Button>
                <Button
                  onClick={handleGiftCredits}
                  disabled={!giftAmount}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2 text-sm"
                >
                  确认赠送
                </Button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </div>
  )
}
