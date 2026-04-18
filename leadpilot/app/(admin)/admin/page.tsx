"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Users, DollarSign, Zap, Mail, TrendingUp, Activity, Server, ShieldAlert, CreditCard } from "lucide-react"

type DashboardStats = {
  newUsers: number
  totalRevenue: number
  creditsConsumed: number
  emailsSent: number
  queuedTasks: number
  filteredLeads: number
  netProfit: number
}

export default function AdminOverviewPage() {
  const [todayStats, setTodayStats] = useState<DashboardStats>({
    newUsers: 0, totalRevenue: 0, creditsConsumed: 0, emailsSent: 0, queuedTasks: 0, filteredLeads: 0, netProfit: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/dashboard/stats')
      .then(res => res.json())
      .then(data => {
        setTodayStats(data.todayStats || todayStats);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch stats:', err);
        setLoading(false);
      });
  }, []);

  // 安全格式化数字，解决无限小数导致的 UI 溢出重叠 Bug
  const formatMoney = (val: number) => Number(val || 0).toFixed(2);
  const formatNum = (val: number) => Number(val || 0).toLocaleString();

  return (
    <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 min-h-screen bg-[#0B1120]">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-2">LeadPilot 总指挥部</h1>
        <p className="text-sm sm:text-base text-slate-400">全局数据总览：财务、系统状态与核心业务指标</p>
      </div>

      {/* 核心指标卡片区 - 修复了溢出问题 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 mb-6">
        {[
          { icon: Users, label: '今日新增', value: formatNum(todayStats.newUsers), unit: '人', gradient: 'from-blue-500 to-cyan-500' },
          { icon: DollarSign, label: '真实总入账', value: `¥${formatMoney(todayStats.totalRevenue)}`, unit: '', gradient: 'from-emerald-500 to-teal-500' },
          { icon: TrendingUp, label: '真实纯利润', value: `¥${formatMoney(todayStats.netProfit)}`, unit: '', gradient: 'from-orange-500 to-red-500' },
          { icon: Zap, label: 'API 真实硬成本', value: `¥${formatMoney(todayStats.creditsConsumed)}`, unit: '', gradient: 'from-red-600 to-pink-600' },
          { icon: Mail, label: '成功发信数', value: formatNum(todayStats.emailsSent), unit: '封', gradient: 'from-purple-500 to-pink-500' },
          { icon: Activity, label: '运行中任务', value: formatNum(todayStats.queuedTasks), unit: '个', gradient: 'from-yellow-500 to-orange-500' }
        ].map((stat, index) => (
          <motion.div key={index} className="relative bg-slate-900/80 border border-slate-700/50 rounded-xl p-4 overflow-hidden">
             <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${stat.gradient} flex items-center justify-center mb-3`}>
               <stat.icon className="w-4 h-4 text-white" />
             </div>
             {/* 使用 truncate 防止超长数字撑破盒子 */}
             <div className="text-xl font-bold text-white mb-1 truncate" title={String(stat.value)}>
               {stat.value} <span className="text-xs text-slate-400 font-normal">{stat.unit}</span>
             </div>
             <div className="text-xs text-slate-400">{stat.label}</div>
          </motion.div>
        ))}
      </div>

      <div className="mb-8 bg-blue-900/10 border border-blue-900/30 p-4 rounded-lg flex items-center">
        <ShieldAlert className="w-5 h-5 text-blue-400 mr-3 flex-shrink-0" />
        <p className="text-sm text-blue-300">
          <strong>CFO 提示：</strong> 上方显示的「API 真实硬成本」指客户实际调用大模型和代理IP产生的账单。未消耗的虚拟算力余额属于服务负债，不计入现时成本。
        </p>
      </div>

      {/* 🚀 下半部分重构为真正的“概览看板” */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* 微型财务大盘 */}
        <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white flex items-center">
              <CreditCard className="w-5 h-5 mr-2 text-emerald-500" />
              财务流水概览
            </h2>
            <a href="/admin/financial" className="text-sm text-blue-400 hover:text-blue-300">查看完整财报 →</a>
          </div>
          <div className="h-48 flex items-center justify-center border border-slate-800 rounded-lg bg-slate-800/30">
            <p className="text-slate-500 text-sm">财务趋势图表组件区域 (待接入完整 ECharts/Recharts 数据)</p>
          </div>
        </div>

        {/* 基础设施雷达摘要 */}
        <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white flex items-center">
              <Server className="w-5 h-5 mr-2 text-purple-500" />
              基建健康状态
            </h2>
            <a href="/admin/monitoring" className="text-sm text-blue-400 hover:text-blue-300">进入雷达 →</a>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-slate-800/50 rounded-lg">
              <span className="text-slate-300 text-sm">主数据库 (PostgreSQL)</span>
              <span className="text-emerald-500 text-xs px-2 py-1 bg-emerald-500/10 rounded">🟢 运行良好</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-slate-800/50 rounded-lg">
              <span className="text-slate-300 text-sm">DeepSeek AI 引擎</span>
              <span className="text-emerald-500 text-xs px-2 py-1 bg-emerald-500/10 rounded">🟢 接口通畅</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-slate-800/50 rounded-lg">
              <span className="text-slate-300 text-sm">发信网关 (Resend)</span>
              <span className="text-emerald-500 text-xs px-2 py-1 bg-emerald-500/10 rounded">🟢 运行良好</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-slate-800/50 rounded-lg">
              <span className="text-slate-300 text-sm">支付网关</span>
              <span className="text-yellow-500 text-xs px-2 py-1 bg-yellow-500/10 rounded">🟡 待配置</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}