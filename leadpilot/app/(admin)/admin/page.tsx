"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Users, DollarSign, Zap, Mail, TrendingUp, Activity, Server, ShieldAlert, CreditCard, PieChart, Database } from "lucide-react"

type CostBreakdown = {
  aiCost: number; emailCost: number; apolloCost: number; 
  hunterCost: number; zeroBounceCost: number; namecheapCost: number; otherCost: number;
}

type ApiBalance = {
  provider: string; balance: string; unit: string; health: 'good' | 'warning' | 'danger' | 'loading';
}

type DashboardStats = {
  newUsers: number; totalRevenue: number; totalRefund: number; netRevenue: number;
  creditsConsumed: number; emailsSent: number; queuedTasks: number; netProfit: number;
}

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<DashboardStats>({
    newUsers: 0, totalRevenue: 0, totalRefund: 0, netRevenue: 0, creditsConsumed: 0, emailsSent: 0, queuedTasks: 0, netProfit: 0
  })
  const [costs, setCosts] = useState<CostBreakdown>({
    aiCost: 0, emailCost: 0, apolloCost: 0, hunterCost: 0, zeroBounceCost: 0, namecheapCost: 0, otherCost: 0
  })
  const [balances, setBalances] = useState<ApiBalance[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/dashboard/stats')
      .then(res => res.json())
      .then(data => {
        if(data.todayStats) setStats(data.todayStats);
        if(data.costBreakdown) setCosts(data.costBreakdown);
        if(data.apiBalances) setBalances(data.apiBalances);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch stats:', err);
        setLoading(false);
      });
  }, []);

  const formatMoney = (val: number) => Number(val || 0).toFixed(2);
  const formatNum = (val: number) => Number(val || 0).toLocaleString();

  return (
    <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 min-h-screen bg-[#0B1120]">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-2">LeadPilot 总指挥部</h1>
        <p className="text-sm sm:text-base text-slate-400">全局数据总览：财务利润、成本分布与 API 水位监控</p>
      </div>

      {/* 🚀 核心指标卡片区 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 mb-6">
        {[
          { icon: DollarSign, label: '总入账 (未扣退款)', value: `¥${formatMoney(stats.totalRevenue)}`, unit: '', gradient: 'from-blue-500 to-cyan-500' },
          { icon: CreditCard, label: '已退款', value: `¥${formatMoney(stats.totalRefund)}`, unit: '', gradient: 'from-slate-500 to-slate-700' },
          { icon: TrendingUp, label: '净营收', value: `¥${formatMoney(stats.netRevenue)}`, unit: '', gradient: 'from-emerald-500 to-teal-500' },
          { icon: Zap, label: '总营业成本', value: `¥${formatMoney(stats.creditsConsumed)}`, unit: '', gradient: 'from-red-600 to-pink-600' },
          { icon: Activity, label: '真实纯利润', value: `¥${formatMoney(stats.netProfit)}`, unit: '', gradient: 'from-yellow-500 to-orange-500' },
          { icon: Mail, label: '成功发信数', value: formatNum(stats.emailsSent), unit: '封', gradient: 'from-purple-500 to-indigo-500' }
        ].map((stat, index) => (
          <motion.div key={index} className="relative bg-slate-900/80 border border-slate-700/50 rounded-xl p-4 overflow-hidden shadow-lg">
             <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${stat.gradient} flex items-center justify-center mb-3`}>
               <stat.icon className="w-4 h-4 text-white" />
             </div>
             <div className="text-xl font-bold text-white mb-1 truncate" title={String(stat.value)}>
               {stat.value} <span className="text-xs text-slate-400 font-normal">{stat.unit}</span>
             </div>
             <div className="text-xs text-slate-400">{stat.label}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* 📉 成本细项分布 */}
        <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-5 lg:col-span-2 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white flex items-center">
              <PieChart className="w-5 h-5 mr-2 text-pink-500" /> 营业成本分布 (CNY)
            </h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
              <div className="text-xs text-slate-400 mb-1">AI 算力消耗</div>
              <div className="text-lg font-bold text-white">¥{formatMoney(costs.aiCost)}</div>
            </div>
            <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
              <div className="text-xs text-slate-400 mb-1">邮件投递网关</div>
              <div className="text-lg font-bold text-white">¥{formatMoney(costs.emailCost)}</div>
            </div>
            <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
              <div className="text-xs text-slate-400 mb-1">Apollo / Proxycurl</div>
              <div className="text-lg font-bold text-white">¥{formatMoney(costs.apolloCost)}</div>
            </div>
            <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
              <div className="text-xs text-slate-400 mb-1">Hunter.io 寻源</div>
              <div className="text-lg font-bold text-white">¥{formatMoney(costs.hunterCost)}</div>
            </div>
            <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
              <div className="text-xs text-slate-400 mb-1">ZeroBounce 清洗</div>
              <div className="text-lg font-bold text-white">¥{formatMoney(costs.zeroBounceCost)}</div>
            </div>
            <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
              <div className="text-xs text-slate-400 mb-1">Namecheap 域名</div>
              <div className="text-lg font-bold text-white">¥{formatMoney(costs.namecheapCost)}</div>
            </div>
          </div>
        </div>

        {/* 🛢️ API 余额实时水库 */}
        <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white flex items-center">
              <Database className="w-5 h-5 mr-2 text-blue-500" /> API 余额监控池
            </h2>
          </div>
          <div className="space-y-3">
            {balances.length === 0 ? (
              <div className="text-slate-500 text-sm text-center py-4">正在连接各大平台...</div>
            ) : (
              balances.map((api, idx) => (
                <div key={idx} className="flex justify-between items-center p-3 bg-slate-800/50 rounded-lg border border-slate-700/30">
                  <span className="text-slate-300 text-sm font-medium">{api.provider}</span>
                  <div className="text-right">
                    <span className={`text-sm font-bold ${api.health === 'loading' ? 'text-slate-400' : 'text-emerald-400'}`}>
                      {api.balance}
                    </span>
                    <span className="text-xs text-slate-500 ml-1">{api.unit}</span>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="mt-4 pt-4 border-t border-slate-700/50">
             <p className="text-xs text-slate-500 text-center">系统将于每日 00:00 自动抓取并核对各大平台真实余额水位。</p>
          </div>
        </div>
      </div>

    </div>
  )
}