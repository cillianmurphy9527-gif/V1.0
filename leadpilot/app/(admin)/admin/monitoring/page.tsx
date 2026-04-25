"use client"
import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { CheckCircle2, AlertCircle, Database, RefreshCw, Loader2, Zap, BrainCircuit, Globe, ShieldCheck, Mail, Plus, X, Settings } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

export default function AdminMonitoringPage() {
  const { toast } = useToast()
  
  // 数据源
  const [categories, setCategories] = useState<any[]>([])
  const [statsData, setStatsData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  
  // CMS 表单状态
  const [drawer, setDrawer] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', category: 'AI_ENGINE', envKey: '', description: '' })

  const loadAllData = async () => {
    setLoading(true)
    try {
      // 1. 读取数据库里您配置的动态节点
      const nodesRes = await fetch('/api/admin/monitoring/nodes')
      if (nodesRes.ok) setCategories(await nodesRes.json())
      
      // 2. 读取 API 的真实计费消耗实况
      const statsRes = await fetch('/api/admin/monitoring/stats')
      if (statsRes.ok) setStatsData(await statsRes.json())
    } catch (e) {
      toast({ title: '数据读取失败', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAllData() }, [])

  // 提交新节点
  const handleAddNode = async () => {
    if (!form.name.trim() || !form.envKey.trim()) return toast({ title: '名称和环境变量键不能为空', variant: 'destructive' })
    
    setSaving(true)
    try {
      const r = await fetch('/api/admin/monitoring/nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      if (!r.ok) throw new Error('新增失败')
      toast({ title: '节点已成功接入雷达' })
      setForm({ name: '', category: 'AI_ENGINE', envKey: '', description: '' })
      setDrawer(false)
      loadAllData() // 刷新大盘
    } catch (e: any) {
      toast({ title: e.message, variant: 'destructive' })
    } finally { setSaving(false) }
  }

  // 计算状态指标
  const totalNodes = categories.reduce((s, c) => s + c.nodes.length, 0)
  const activeNodes = categories.reduce((s, c) => s + c.nodes.filter((n: any) => n.active).length, 0)
  const pendingNodes = totalNodes - activeNodes
  const readiness = totalNodes > 0 ? Math.round((activeNodes / totalNodes) * 100) : 0

  // 提取动态 API 消耗方法
  const apiLogs = statsData?.apiLogs || []
  const getLog = (provider: string) => apiLogs.find((l: any) => l.provider === provider) || { _sum: { usageAmount: 0, costCny: 0 } }

  const inp = "w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"

  if (loading && categories.length === 0) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-950"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /></div>
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-20">
      <div className="container mx-auto px-6 py-8 max-w-7xl">
        
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2 tracking-tight">🔭 Nova 自动化运维驾驶舱</h1>
            <p className="text-slate-400">告别假数据 · 完全自由配置您的监控网络与 API 探头</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setDrawer(true)} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 rounded-xl text-sm font-bold text-white hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/20">
              <Plus className="w-4 h-4" /> 接入新探头
            </button>
            <button onClick={loadAllData} disabled={loading} className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm font-bold text-slate-200 hover:bg-slate-700 transition-all disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-400' : ''}`} /> 全盘扫描
            </button>
          </div>
        </div>

        {/* 核心指标统计 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: '总监控节点', value: totalNodes, color: 'text-white' },
            { label: '✅ 已打通实弹', value: activeNodes, color: 'text-emerald-400' },
            { label: '⚠️ 待配置或 Mock', value: pendingNodes, color: 'text-amber-400' },
            { label: '系统商业就绪率', value: `${readiness}%`, color: readiness >= 80 ? 'text-emerald-400' : readiness >= 50 ? 'text-amber-400' : 'text-red-400' },
          ].map((s, i) => (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} key={i} className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 text-center shadow-lg">
              <div className={`text-3xl font-black mb-1 ${s.color}`}>{s.value}</div>
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">{s.label}</div>
            </motion.div>
          ))}
        </div>

        {/* 动态配置的全景雷达图 (从数据库读出) */}
        <div className="space-y-6 mb-10">
          {categories.length === 0 ? (
             <div className="py-16 text-center border border-dashed border-slate-700 rounded-xl bg-slate-800/30">
               <p className="text-slate-400 text-sm">您的雷达网络目前为空</p>
               <p className="text-slate-500 text-xs mt-2 mb-4">请点击右上角【接入新探头】开始构建您的监控矩阵</p>
               <button onClick={() => setDrawer(true)} className="px-4 py-2 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-lg text-xs font-bold hover:bg-blue-600/30">立即配置</button>
             </div>
          ) : categories.map((cat, ci) => (
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: ci * 0.1 }} key={ci} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center gap-3 mb-5">
                <div className={`w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center`}>
                  <span className="text-white text-sm font-bold">●</span>
                </div>
                <h2 className="text-lg font-bold text-white">{cat.title}</h2>
                <span className="ml-auto text-xs font-bold text-slate-500 bg-slate-800 px-3 py-1 rounded-full">
                  {cat.nodes.filter((n: any) => n.active).length} / {cat.nodes.length} 就绪
                </span>
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
                {cat.nodes.map((node: any) => (
                  <div key={node.id} className={`relative rounded-xl border p-4 transition-all ${node.active ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-slate-800/30 border-slate-700/50 opacity-70'}`}>
                    <div className="absolute top-3 right-3">
                      {node.active ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          <CheckCircle2 className="w-2.5 h-2.5" /> 畅通
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <AlertCircle className="w-2.5 h-2.5" /> PENDING
                        </span>
                      )}
                    </div>
                    <div className="pr-16">
                      <p className={`font-bold text-sm mb-1 ${node.active ? 'text-white' : 'text-slate-400'}`}>{node.label}</p>
                      <p className="text-[11px] text-slate-500 leading-snug mb-2">{node.description}</p>
                      <p className="text-[9px] font-mono text-slate-600 bg-slate-950 px-1.5 py-0.5 rounded inline-block">env: {node.envKey}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        {/* 动态消耗实况 (保留底部的真实扣费) */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold flex items-center gap-2"><Zap className="w-5 h-5 text-orange-400"/> 第三方 API 调用消耗雷达 (近30天实况)</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { provider: 'OPENAI', label: 'OpenAI 引擎', icon: BrainCircuit, color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
              { provider: 'PROXYCURL', label: 'Proxycurl 粗筛', icon: Globe, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
              { provider: 'HUNTER', label: 'Hunter 高管挖掘', icon: ShieldCheck, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
              { provider: 'ZEROBOUNCE', label: 'UseBouncer 验箱', icon: Mail, color: 'text-pink-400', bg: 'bg-pink-500/10', border: 'border-pink-500/20' }
            ].map(api => {
              const log = getLog(api.provider);
              const calls = log._sum?.usageAmount || 0;
              const cost = log._sum?.costCny || 0;
              return (
                <div key={api.provider} className={`p-5 rounded-2xl border ${api.border} bg-slate-800/30 relative overflow-hidden group hover:bg-slate-800/60 transition-all`}>
                  <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full blur-3xl opacity-20 ${api.bg} group-hover:opacity-40 transition-opacity`}></div>
                  <div className="flex items-center gap-3 mb-5 relative z-10">
                    <div className={`w-10 h-10 rounded-xl ${api.bg} border ${api.border} flex items-center justify-center shadow-lg`}><api.icon className={`w-5 h-5 ${api.color}`}/></div>
                    <span className="font-bold text-white text-sm">{api.label}</span>
                  </div>
                  <div className="space-y-3 relative z-10">
                    <div className="flex justify-between items-end bg-slate-900/50 p-2.5 rounded-lg border border-slate-700/30">
                      <span className="text-xs text-slate-400">系统总调用</span>
                      <span className="font-mono text-sm text-white font-bold">{calls.toLocaleString()} 次</span>
                    </div>
                    <div className="flex justify-between items-end bg-slate-900/50 p-2.5 rounded-lg border border-slate-700/30">
                      <span className="text-xs text-slate-400">已发生成本</span>
                      <span className="font-black text-sm text-orange-400">¥ {cost.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </motion.div>
      </div>

      {/* 新增节点的侧边抽屉 */}
      <AnimatePresence>
      {drawer && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={() => setDrawer(false)} />
          <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25 }} className="fixed right-0 top-0 h-full w-full max-w-md bg-slate-950 border-l border-slate-800 z-50 flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800 bg-slate-900/50">
              <div><h3 className="text-white font-bold text-lg">接入新探头</h3><p className="text-slate-500 text-xs mt-1">配置后将自动监测环境连通性</p></div>
              <button onClick={() => setDrawer(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">探头名称 (例: DeepSeek 主脑)</label>
                  <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inp} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">所属雷达分组</label>
                  <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className={inp}>
                    <option value="AI_ENGINE">🧠 核心 AI 引擎 (大模型)</option>
                    <option value="DATA_SOURCE">🕵️ 数据挖掘与清洗节点</option>
                    <option value="OUTREACH">✉️ 触达与发信集群</option>
                    <option value="PAYMENT">💰 交易与风控网关</option>
                    <option value="INFRA">🗄️ 底层高可用基建</option>
                  </select>
                </div>
                <div>
                   <label className="block text-xs font-bold text-slate-400 mb-1">关联的系统环境变量键名 (极度重要)</label>
                   <input value={form.envKey} onChange={e => setForm({ ...form, envKey: e.target.value })} placeholder="例: DEEPSEEK_API_KEY" className={inp} />
                   <p className="text-[10px] text-slate-500 mt-1">系统将通过探查该变量是否存在，判断组件是否“畅通”</p>
                </div>
                <div>
                   <label className="block text-xs font-bold text-slate-400 mb-1">探头描述</label>
                   <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="简单描述该组件的作用..." className={inp} />
                </div>
                <button onClick={handleAddNode} disabled={saving} className="w-full py-3 mt-4 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-500 transition-all disabled:opacity-50 flex justify-center items-center">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : '激活雷达探头'}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
      </AnimatePresence>

    </div>
  )
}