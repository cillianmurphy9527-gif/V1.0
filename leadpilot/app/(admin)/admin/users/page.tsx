"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Search, ShieldAlert, Ban, Gift, UserCog, Activity, Diamond, Loader2 } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

// 套餐等级映射，用于降级保护判断
const PLAN_LEVELS: Record<string, number> = {
  TRIAL: 0,
  STARTER: 1,
  PRO: 2,
  MAX: 3,
}

export default function UsersManagementPage() {
  const { toast } = useToast()
  
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  
  // 复合弹窗状态
  const [profileModalOpen, setProfileModalOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [auditData, setAuditData] = useState<any>(null)
  const [auditLoading, setAuditLoading] = useState(false)
  
  // 快捷操作状态
  const [giftAmount, setGiftAmount] = useState('')
  
  // 🌟 新增：套餐修改状态
  const [selectedTier, setSelectedTier] = useState<string>('')
  const [isUpdatingTier, setIsUpdatingTier] = useState(false)

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users/list')
      const data = await res.json()
      setUsers(data.users || [])
      setLoading(false)
    } catch (e) {
      console.error(e)
      setLoading(false)
    }
  }

  const handleOpenProfile = async (user: any) => {
    setSelectedUser(user);
    setProfileModalOpen(true);
    setAuditLoading(true);
    setAuditData(null);
    setGiftAmount('');
    setSelectedTier('');

    try {
      const res = await fetch(`/api/admin/users/${user.id}/stats`);
      if (res.ok) {
        const data = await res.json();
        setAuditData(data);
      }
    } catch (err) {
      console.error("查账失败", err);
    } finally {
      setAuditLoading(false);
    }
  }

  // 🌟 新增：修改套餐函数（含降级保护）
  const handleUpdateTier = async () => {
    if (!selectedUser || !selectedTier) return;

    const oldLevel = PLAN_LEVELS[selectedUser.subscriptionTier ?? 'TRIAL'] ?? 0;
    const newLevel = PLAN_LEVELS[selectedTier] ?? 0;

    // 保留原有的降级保护逻辑
    if (newLevel < oldLevel) {
      const confirmed = window.confirm(
        `⚠️ 降级风险警告\n\n` +
        `即将把用户套餐从 ${selectedUser.subscriptionTier || '当前版本'} 降级为 ${selectedTier}。\n\n` +
        `降级后，用户配额将被重置为新套餐额度（不保留未用完的旧额度）。\n\n` +
        `确定要继续吗？`
      );
      if (!confirmed) return;
    } else {
      const confirmed = window.confirm(
        `确认将 ${selectedUser.email} 的套餐修改为 ${selectedTier} 吗？\n\n修改后该用户的配额将自动同步刷新。`
      );
      if (!confirmed) return;
    }

    setIsUpdatingTier(true);
    try {
      const res = await fetch('/api/admin/users/upgrade-tier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUser.id, tier: selectedTier }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || '更新失败');

      toast({ title: '套餐已更新', description: '账户配额已同步刷新！' });
      
      // 1. 强制重新拉取用户列表，刷新表格状态
      fetchUsers(); 
      
      // 2. 重新拉取该用户的审计数据，并强制更新弹窗内显示
      setAuditLoading(true);
      const statsRes = await fetch(`/api/admin/users/${selectedUser.id}/stats`);
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setAuditData(statsData);
      }
      setAuditLoading(false);

      // 3. 局部更新弹窗内套餐标识，并清空套餐选择器
      setSelectedUser({ ...selectedUser, subscriptionTier: selectedTier });
      setSelectedTier('');

    } catch (e: any) {
      toast({ title: '操作失败', description: e.message, variant: 'destructive' });
    } finally {
      setIsUpdatingTier(false);
    }
  };

  const handleGift = async () => {
    if (!selectedUser || !giftAmount) return;
    try {
      await fetch(`/api/admin/users/${selectedUser.id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'gift', amount: Number(giftAmount) })
      });
      toast({ title: `成功充值 ${giftAmount} 算力！` })
      setGiftAmount('');
      fetchUsers();
      handleOpenProfile(selectedUser);
    } catch (e) { console.error(e) }
  }

  const handleBan = async () => {
    if (!selectedUser || !confirm(`确定要彻底封禁 ${selectedUser.email} 并清空算力吗？`)) return;
    try {
      await fetch(`/api/admin/users/${selectedUser.id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ban' })
      });
      toast({ title: '账号已封禁！' })
      setProfileModalOpen(false);
      fetchUsers();
    } catch (e) { console.error(e) }
  }

  const filteredUsers = users.filter((u: any) => 
    (u.email || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
    (u.phone || '').includes(searchQuery)
  );

  return (
    <div className="p-6 text-white min-h-screen bg-[#0B1120]">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">用户管理</h1>
          <p className="text-slate-400 text-sm">管理系统所有用户账号、资产审计与权限</p>
        </div>
      </div>

      <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-4 sm:p-6 shadow-xl">
        <div className="flex justify-between items-center mb-6">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="搜索邮箱或手机号..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-800/80 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="text-sm text-slate-400">共 {filteredUsers.length} 个用户</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-800/40 text-slate-400 border-b border-slate-700">
              <tr>
                <th className="p-4 font-medium">用户邮箱</th>
                <th className="p-4 font-medium">联系方式</th>
                <th className="p-4 font-medium">当前套餐</th>
                <th className="p-4 font-medium">算力余额</th>
                <th className="p-4 font-medium">注册时间</th>
                <th className="p-4 font-medium">状态</th>
                <th className="p-4 font-medium text-center">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={7} className="p-4 text-center text-slate-500">加载中...</td></tr> : 
               filteredUsers.length === 0 ? <tr><td colSpan={7} className="p-4 text-center text-slate-500">未找到相关用户</td></tr> :
               filteredUsers.map((u: any) => (
                <tr key={u.id} className="border-b border-slate-800 hover:bg-slate-800/30 transition-colors">
                  <td className="p-4 flex items-center">
                    <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center mr-3 text-blue-400 font-bold">
                      {u.email.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-medium">{u.email}</span>
                  </td>
                  <td className="p-4 text-slate-400 font-mono text-xs">{u.phone || '-'}</td>
                  <td className="p-4">
                    <span className="bg-slate-800 border border-slate-700 text-slate-300 px-3 py-1 rounded-full text-xs">
                      {u.subscriptionTier || u.currentPlan}
                    </span>
                  </td>
                  <td className="p-4 font-bold text-orange-400">{Number(u.credits || u.tokenBalance || 0).toLocaleString()} 点</td>
                  <td className="p-4 text-slate-400 text-xs">{new Date(u.createdAt || u.registeredAt).toLocaleDateString()}</td>
                  <td className="p-4">
                    {u.status === 'banned' ? (
                      <span className="text-red-400 border border-red-500/30 bg-red-500/10 px-2 py-1 rounded text-xs">封禁</span>
                    ) : (
                      <span className="text-emerald-400 border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 rounded text-xs">正常</span>
                    )}
                  </td>
                  <td className="p-4 text-center">
                    <button 
                      onClick={() => handleOpenProfile(u)}
                      className="text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 px-3 py-1.5 rounded transition-colors text-xs flex items-center justify-center mx-auto"
                    >
                      <UserCog className="w-3.5 h-3.5 mr-1" /> 管理与查账
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 复合弹窗：用户详情 + 审计 + 快捷操作 */}
      {profileModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
          >
            <div className="p-5 bg-slate-800/80 border-b border-slate-700 flex justify-between items-center">
              <h2 className="text-xl font-bold text-white flex items-center">
                <UserCog className="w-5 h-5 mr-2 text-blue-400" /> 用户综合管理面板
              </h2>
              <button onClick={() => setProfileModalOpen(false)} className="text-slate-400 hover:text-white text-2xl">&times;</button>
            </div>
            
            <div className="flex flex-col md:flex-row flex-1 overflow-y-auto">
              
              {/* 左侧：基础资料与高频操作 */}
              <div className="w-full md:w-1/3 p-6 border-b md:border-b-0 md:border-r border-slate-700 bg-slate-800/20">
                <div className="mb-6">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-2xl font-bold text-white mb-4">
                    {selectedUser.email.charAt(0).toUpperCase()}
                  </div>
                  <h3 className="text-lg font-bold text-white break-all">{selectedUser.email}</h3>
                  <p className="text-sm text-slate-400 font-mono mt-1">{selectedUser.phone || '未绑定手机'}</p>
                  <div className="mt-3 inline-block bg-blue-500/20 text-blue-400 border border-blue-500/30 px-3 py-1 rounded text-xs">
                    {selectedUser.subscriptionTier || selectedUser.currentPlan}
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-slate-700">
                  <h4 className="text-sm font-bold text-slate-300">快捷操作指令</h4>
                  
                  {/* 🌟 新增：变更套餐模块 */}
                  <div className="bg-slate-800/50 p-3 rounded-lg border border-blue-500/30">
                    <label className="text-xs font-bold text-blue-400 mb-2 block flex items-center gap-1">
                      <Diamond className="w-3.5 h-3.5" /> 变更客户套餐
                    </label>
                    <div className="flex gap-2">
                      <select 
                        value={selectedTier}
                        onChange={(e) => setSelectedTier(e.target.value)}
                        className="flex-1 bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
                      >
                        <option value="">选择新套餐...</option>
                        <option value="TRIAL">体验版 (TRIAL)</option>
                        <option value="STARTER">入门版 (STARTER)</option>
                        <option value="PRO">专业版 (PRO)</option>
                        <option value="MAX">旗舰版 (MAX)</option>
                      </select>
                      <button 
                        onClick={handleUpdateTier}
                        disabled={!selectedTier || isUpdatingTier}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded text-xs font-bold whitespace-nowrap transition-colors disabled:opacity-50 flex items-center justify-center min-w-[60px]"
                      >
                        {isUpdatingTier ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '执行'}
                      </button>
                    </div>
                  </div>
                  
                  {/* 充值模块 */}
                  <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                    <label className="text-xs text-slate-400 mb-2 block">手动发放虚拟算力</label>
                    <div className="flex gap-2">
                      <input 
                        type="number" value={giftAmount} onChange={e => setGiftAmount(e.target.value)}
                        placeholder="输入额度" className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-sm text-white"
                      />
                      <button onClick={handleGift} className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded text-xs font-bold whitespace-nowrap transition-colors">
                        <Gift className="w-3 h-3 inline mr-1" />充值
                      </button>
                    </div>
                  </div>

                  {/* 危险操作区 */}
                  <div className="pt-2">
                    <button onClick={handleBan} className="w-full flex items-center justify-center bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 px-4 py-2.5 rounded text-sm transition-colors">
                      <Ban className="w-4 h-4 mr-2" /> 彻底封禁并清空资产
                    </button>
                  </div>
                </div>
              </div>

              {/* 右侧：底层资产审计 */}
              <div className="w-full md:w-2/3 p-6 bg-slate-900">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center">
                  <Activity className="w-5 h-5 mr-2 text-orange-500" /> 底层资产深度审计
                </h3>

                {auditLoading ? (
                  <div className="flex flex-col items-center justify-center h-48 text-orange-500 space-y-3">
                    <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-sm animate-pulse">正在穿透数据库读取财务明细...</p>
                  </div>
                ) : auditData ? (
                  <div className="space-y-5">
                    
                    <div className={`p-4 rounded-xl border ${auditData.assets?.domainCount > 0 ? 'bg-red-500/10 border-red-500/50' : 'bg-emerald-500/10 border-emerald-500/50'}`}>
                      <h4 className={`font-bold flex items-center mb-1 ${auditData.assets?.domainCount > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                        <ShieldAlert className="w-4 h-4 mr-2" /> 智能退款风控结论：
                      </h4>
                      <p className="text-sm text-slate-300 ml-6">
                        {auditData.assets?.domainCount > 0 
                          ? '🚨 警告：该客户已激活专属域名！系统已向第三方垫付不可逆硬成本，根据政策【绝对禁止全额退款】。' 
                          : '✅ 安全：该客户仅消耗虚拟算力，未占用独立域名通道，可以安全办理原路退款。'}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-xl">
                        <div className="text-slate-400 text-xs mb-1">当前剩余虚拟算力</div>
                        <div className="text-2xl font-bold text-orange-400">
                          {Number(auditData.balances?.tokenBalance || 0).toLocaleString()} <span className="text-sm text-slate-500 font-normal">点</span>
                        </div>
                      </div>
                      <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-xl">
                        <div className="text-slate-400 text-xs mb-1">已占用独立域名 (高成本基建)</div>
                        <div className="text-2xl font-bold text-white">
                          {auditData.assets?.domainCount || 0} <span className="text-sm text-slate-500 font-normal">个</span>
                        </div>
                      </div>
                      <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-xl">
                        <div className="text-slate-400 text-xs mb-1 flex items-center">
                          该客户制造的 API 硬成本
                          <span className="ml-2 text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded">会扣您的钱</span>
                        </div>
                        <div className="text-2xl font-bold text-red-400">
                          ¥{Number(auditData.balances?.apiCostTotal || 0).toFixed(2)}
                        </div>
                      </div>
                      <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-xl">
                        <div className="text-slate-400 text-xs mb-1">历史下达拓客任务数</div>
                        <div className="text-2xl font-bold text-white">
                          {auditData.assets?.campaignCount || 0} <span className="text-sm text-slate-500 font-normal">次</span>
                        </div>
                      </div>
                    </div>

                  </div>
                ) : (
                  <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                    获取审计数据失败，请检查数据库连接。
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}