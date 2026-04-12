"use client"

import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { 
  Search,
  MoreVertical,
  User,
  Gift,
  TrendingUp,
  Ban,
  X
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"

// 用户数据类型
type User = {
  id: string
  email: string
  phone: string
  companyName: string
  currentPlan: string
  planColor: string
  credits: number
  registeredAt: string
  isSendingSuspended?: boolean
}

export default function UsersPage() {
  const { toast } = useToast()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [showActionMenu, setShowActionMenu] = useState<string | null>(null)
  const [showBanModal, setShowBanModal] = useState(false)
  const [showGiftModal, setShowGiftModal] = useState(false)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [giftAmount, setGiftAmount] = useState('')
  const [newPlan, setNewPlan] = useState('')

  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  const loadUsers = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/users/list')
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || '加载失败')
      setUsers(data?.users || [])
    } catch (e: any) {
      toast({ title: '加载失败', description: e?.message || '无法加载用户列表', variant: 'destructive' })
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  // 过滤用户
  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return users
    return users.filter(user =>
      (user.email || '').toLowerCase().includes(q) ||
      (user.phone || '').includes(searchQuery) ||
      (user.companyName || '').includes(searchQuery)
    )
  }, [users, searchQuery])

  // 查看资料
  const handleViewProfile = (user: User) => {
    toast({
      title: user.companyName || '用户资料',
      description: `${user.email || '—'} / ${user.phone || '—'}`,
    })
    setShowActionMenu(null)
  }

  // 赠送算力
  const handleGiftCredits = async () => {
    if (!selectedUser || !giftAmount) return
    try {
      const res = await fetch('/api/admin/users/gift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUser.id, amount: Number(giftAmount) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || '操作失败')
      toast({ title: '✅ 已赠送算力', description: `用户：${selectedUser.email} +${Number(giftAmount).toLocaleString()} tokens` })
      setShowGiftModal(false)
      setSelectedUser(null)
      setGiftAmount('')
      await loadUsers()
    } catch (e: any) {
      toast({ title: '❌ 赠送失败', description: e?.message || '请稍后重试', variant: 'destructive' })
    }
  }

  // 调整套餐
  const handleUpgradePlan = async () => {
    if (!selectedUser || !newPlan) return
    const tierMap: Record<string, string> = { '体验版': 'TRIAL', '入门版': 'STARTER', '专业版': 'PRO', '旗舰版': 'MAX', '企业版': 'MAX' }
    const tier = tierMap[newPlan] || newPlan
    try {
      const res = await fetch('/api/admin/users/upgrade-tier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUser.id, tier }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || '操作失败')
      toast({ title: '✅ 套餐已更新', description: `用户：${selectedUser.email} → ${tier}` })
      setShowUpgradeModal(false)
      setSelectedUser(null)
      setNewPlan('')
      await loadUsers()
    } catch (e: any) {
      toast({ title: '❌ 更新失败', description: e?.message || '请稍后重试', variant: 'destructive' })
    }
  }

  // 暂停/恢复发信
  const handleSuspendSending = async () => {
    if (!selectedUser) return
    const next = !(selectedUser.isSendingSuspended ?? false)
    try {
      const res = await fetch('/api/admin/users/suspend-sending', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUser.id, suspended: next }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || '操作失败')
      toast({ title: '✅ 已更新风控状态', description: next ? '已暂停该用户发信能力' : '已恢复该用户发信能力' })
      setShowBanModal(false)
      setSelectedUser(null)
      await loadUsers()
    } catch (e: any) {
      toast({ title: '❌ 操作失败', description: e?.message || '请稍后重试', variant: 'destructive' })
    }
  }

  return (
    <div className="container mx-auto px-6 py-8">
      {/* 页面标题 */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">用户管理</h1>
        <p className="text-slate-400">管理系统所有用户账号和权限</p>
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
              placeholder="搜索邮箱、手机号或公司名"
              className="pl-10 pr-4 py-2 w-80 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="text-sm text-slate-400">
            共 <span className="text-white font-bold">{users.length}</span> 个用户
          </div>
        </div>
      </div>

      {/* 用户表格 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-slate-900/50 border border-slate-700 rounded-3xl overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-800/50">
                <th className="text-left py-4 px-6 text-sm font-semibold text-slate-400">用户</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-slate-400">联系方式</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-slate-400">当前套餐</th>
                <th className="text-right py-4 px-6 text-sm font-semibold text-slate-400">算力余额</th>
                <th className="text-right py-4 px-6 text-sm font-semibold text-slate-400">发信风控</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-slate-400">注册时间</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-slate-400">状态</th>
                <th className="text-center py-4 px-6 text-sm font-semibold text-slate-400">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="py-12 text-center text-slate-400">加载中...</td></tr>
              ) : filteredUsers.length === 0 ? (
                <tr><td colSpan={8} className="py-12 text-center text-slate-500">暂无用户数据</td></tr>
              ) : filteredUsers.map((user, index) => (
                <motion.tr
                  key={user.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="border-b border-slate-800 hover:bg-slate-800/30 transition-colors"
                >
                  {/* 用户信息 */}
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-2xl">
                        👤
                      </div>
                      <div>
                        <div className="text-white font-medium">{user.companyName}</div>
                        <div className="text-xs text-slate-500">{user.email}</div>
                      </div>
                    </div>
                  </td>

                  {/* 联系方式 */}
                  <td className="py-4 px-6">
                    <span className="text-slate-400 font-mono text-sm">{user.phone}</span>
                  </td>

                  {/* 当前套餐 */}
                  <td className="py-4 px-6">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      user.planColor === 'blue' ? 'bg-blue-500/20 border border-blue-500/30 text-blue-400' :
                      user.planColor === 'purple' ? 'bg-purple-500/20 border border-purple-500/30 text-purple-400' :
                      user.planColor === 'emerald' ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400' :
                      'bg-slate-500/20 border border-slate-500/30 text-slate-400'
                    }`}>
                      {user.currentPlan}
                    </span>
                  </td>

                  {/* 算力余额 */}
                  <td className="py-4 px-6 text-right">
                    <span className="text-orange-400 font-bold">{user.credits.toLocaleString()}</span>
                    <span className="text-slate-500 text-xs ml-1">点</span>
                  </td>

                  {/* 发信风控 */}
                  <td className="py-4 px-6 text-right">
                    <span className={`font-bold ${user.isSendingSuspended ? 'text-red-400' : 'text-emerald-400'}`}>
                      {user.isSendingSuspended ? '已暂停' : '正常'}
                    </span>
                  </td>

                  {/* 注册时间 */}
                  <td className="py-4 px-6">
                    <span className="text-slate-400 text-sm">{user.registeredAt}</span>
                  </td>

                  {/* 状态 */}
                  <td className="py-4 px-6">
                    {!user.isSendingSuspended ? (
                      <span className="px-2 py-1 bg-emerald-500/20 border border-emerald-500/30 rounded text-xs text-emerald-400 font-medium">
                        正常
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-red-500/20 border border-red-500/30 rounded text-xs text-red-400 font-medium">
                        已暂停发信
                      </span>
                    )}
                  </td>

                  {/* 操作 */}
                  <td className="py-4 px-6">
                    <div className="flex items-center justify-center">
                      <div className="relative">
                        <button
                          onClick={() => setShowActionMenu(showActionMenu === user.id ? null : user.id)}
                          className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                        >
                          <MoreVertical className="w-4 h-4 text-slate-400" />
                        </button>

                        {/* 下拉菜单 */}
                        {showActionMenu === user.id && (
                          <div className="absolute right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-10">
                            <button
                              onClick={() => handleViewProfile(user)}
                              className="w-full flex items-center gap-2 px-4 py-3 text-left text-sm text-slate-300 hover:bg-slate-700 transition-colors"
                            >
                              <User className="w-4 h-4" />
                              查看资料
                            </button>
                            <button
                              onClick={() => {
                                setSelectedUser(user)
                                setShowGiftModal(true)
                                setShowActionMenu(null)
                              }}
                              className="w-full flex items-center gap-2 px-4 py-3 text-left text-sm text-emerald-400 hover:bg-slate-700 transition-colors"
                            >
                              <Gift className="w-4 h-4" />
                              赠送算力加油包
                            </button>
                            <button
                              onClick={() => {
                                setSelectedUser(user)
                                setShowUpgradeModal(true)
                                setShowActionMenu(null)
                              }}
                              className="w-full flex items-center gap-2 px-4 py-3 text-left text-sm text-blue-400 hover:bg-slate-700 transition-colors"
                            >
                              <TrendingUp className="w-4 h-4" />
                              调整套餐等级
                            </button>
                            <button
                              onClick={() => {
                                setSelectedUser(user)
                                setShowBanModal(true)
                                setShowActionMenu(null)
                              }}
                              className="w-full flex items-center gap-2 px-4 py-3 text-left text-sm text-red-400 hover:bg-slate-700 transition-colors"
                            >
                              <Ban className="w-4 h-4" />
                              {user.isSendingSuspended ? '恢复发信能力' : '暂停发信能力'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* 赠送算力弹窗 */}
      {showGiftModal && selectedUser && (
        <>
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={() => setShowGiftModal(false)}
          />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-slate-900 border border-emerald-500/50 rounded-2xl p-6 max-w-md w-full"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <Gift className="w-6 h-6 text-emerald-500" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">赠送算力加油包</h3>
                    <p className="text-sm text-slate-400">为用户充值算力点数</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowGiftModal(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  用户
                </label>
                <input
                  type="text"
                  value={selectedUser.companyName}
                  disabled
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-400"
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  赠送算力点数
                </label>
                <input
                  type="number"
                  value={giftAmount}
                  onChange={(e) => setGiftAmount(e.target.value)}
                  placeholder="请输入算力点数"
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={() => setShowGiftModal(false)}
                  variant="outline"
                  className="flex-1"
                >
                  取消
                </Button>
                <Button
                  onClick={handleGiftCredits}
                  disabled={!giftAmount}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  确认赠送
                </Button>
              </div>
            </motion.div>
          </div>
        </>
      )}

      {/* 调整套餐弹窗 */}
      {showUpgradeModal && selectedUser && (
        <>
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={() => setShowUpgradeModal(false)}
          />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-slate-900 border border-blue-500/50 rounded-2xl p-6 max-w-md w-full"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-blue-500" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">调整套餐等级</h3>
                    <p className="text-sm text-slate-400">手动修改用户套餐</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowUpgradeModal(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  用户
                </label>
                <input
                  type="text"
                  value={selectedUser.companyName}
                  disabled
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-400"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  当前套餐
                </label>
                <input
                  type="text"
                  value={selectedUser.currentPlan}
                  disabled
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-slate-400"
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  新套餐等级
                </label>
                <select
                  value={newPlan}
                  onChange={(e) => setNewPlan(e.target.value)}
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">请选择套餐</option>
                  <option value="体验版">体验版</option>
                  <option value="专业版">专业版</option>
                  <option value="企业版">企业版</option>
                </select>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={() => setShowUpgradeModal(false)}
                  variant="outline"
                  className="flex-1"
                >
                  取消
                </Button>
                <Button
                  onClick={handleUpgradePlan}
                  disabled={!newPlan}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 text-white"
                >
                  确认调整
                </Button>
              </div>
            </motion.div>
          </div>
        </>
      )}

      {/* 封禁账号弹窗 */}
      {showBanModal && selectedUser && (
        <>
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={() => setShowBanModal(false)}
          />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-slate-900 border border-red-500/50 rounded-2xl p-6 max-w-md w-full"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                  <Ban className="w-6 h-6 text-red-500" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">封禁账号</h3>
                  <p className="text-sm text-slate-400">此操作不可撤销</p>
                </div>
              </div>
              
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
                <p className="text-sm text-slate-300">
                  确定要{selectedUser.isSendingSuspended ? '恢复' : '暂停'}用户 <span className="text-white font-bold">{selectedUser.companyName}</span> 的发信能力吗？
                </p>
                <p className="text-xs text-slate-500 mt-2">
                  该操作不影响登录，仅用于风控拦截发信
                </p>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={() => setShowBanModal(false)}
                  variant="outline"
                  className="flex-1"
                >
                  取消
                </Button>
                <Button
                  onClick={handleSuspendSending}
                  className="flex-1 bg-red-600 hover:bg-red-500 text-white"
                >
                  确认
                </Button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </div>
  )
}
