"use client"
import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { RefreshCw, Loader2, Zap, BrainCircuit, ShieldCheck, Mail, Plus, X, Search, Activity, Database, Trash2, Signal, Globe, BarChart3, CreditCard } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

// 1. 绝对的技术栈清单：只要 .env 里配了 Key，这里就应该列出来
const FULL_TECH_STACK = [
  { provider: 'DeepSeek AI', envKey: 'DEEPSEEK_API_KEY', type: 'AI', icon: BrainCircuit },
  { provider: 'OpenAI', envKey: 'OPENAI_API_KEY', type: 'AI', icon: BrainCircuit },
  { provider: 'Apollo.io', envKey: 'APOLLO_API_KEY', type: 'DATA', icon: Search },
  { provider: 'Hunter.io', envKey: 'HUNTER_API_KEY', type: 'DATA', icon: ShieldCheck },
  { provider: 'ZeroBounce', envKey: 'ZEROBOUNCE_API_KEY', type: 'DATA', icon: Mail },
  { provider: 'Namecheap', envKey: 'NAMECHEAP_API_KEY', type: 'INFRA', icon: Globe },
  { provider: 'Smartlead', envKey: 'SMARTLEAD_API_KEY', type: 'OUTREACH', icon: Activity },
]

export default function AdminMonitoringPage() {
  const { toast } = useToast()
  const [categories, setCategories] = useState<any[]>([])
  const [statsData, setStatsData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [drawer, setDrawer] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', category: 'AI_ENGINE', envKey: '', description: '' })

  const loadAllData = async () => {
    setLoading(true)
    try {
      const [nodesRes, statsRes] = await Promise.all([
        fetch('/api/admin/monitoring/nodes'),
        fetch('/api/admin/monitoring/stats')
      ])
      if (nodesRes.ok) setCategories(await nodesRes.json())
      if (statsRes.ok) setStatsData(await statsRes.json())
    } catch (e) {
      toast({ title: '扫描中断', variant: 'destructive' })
    } finally { setLoading(false) }
  }

  useEffect(() => { loadAllData() }, [])

  const handleDelete = async (id: string) => {
    if(!confirm("确定要移除这个监控节点吗？")) return;
    try {
      const res = await fetch(`/api/admin/monitoring/nodes?id=${id}`, { method: 'DELETE' });
      if(res.ok) {
        toast({ title: "探头已卸载" });
        loadAllData();
      } else { throw new Error() }
    } catch (e) {
      toast({ title: "移除失败", description: "请确保后端 route.ts 已包含 DELETE 方法", variant: "destructive" });
    }
  }

  const handleAddNode = async () => {
    if (!form.name.trim() || !form.envKey.trim()) return toast({ title: '必填项缺失', variant: 'destructive' })
    if (form.envKey.startsWith('sk-')) return toast({ title: '格式错误', description: '变量名不能直接填写密钥值', variant: 'destructive' })
    setSaving(true)
    try {
      const r = await fetch('/api/admin/monitoring/nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      if (!r.ok) throw new Error()
      setForm({ name: '', category: 'AI_ENGINE', envKey: '', description: '' })
      setDrawer(false)
      loadAllData()
    } catch (e) { toast({ title: '接入失败', variant: 'destructive' }) } finally { setSaving(false) }
  }

  // 2. 核心匹配逻辑：强制遍历技术栈清单，逐个匹配探针结果
  const getDisplayProbes = () => {
    return FULL_TECH_STACK.map(item => {
      // 从接口返回的探针数据中找匹配项
      const probe = statsData?.apiBalances?.find((b: any) => 
        b.provider.toLowerCase().includes(item.envKey.toLowerCase().replace('_api_key', '').replace('_', ' '))
      );
      if (probe) return { ...item, ...probe };
      // 如果没匹配上，检查环境变量状态
      const envStatus = statsData?.envStatus;
      const keyExists = envStatus?.[item.envKey.toLowerCase()] || envStatus?.[item.provider.toLowerCase().replace('.io', '').replace(' ai', '')];
      if (keyExists) {
        return { ...item, health: 'warning', statusText: '等待探测...', balance: null, unit: '' };
      }
      // Key 没配就不展示
      return null;
    }).filter(Boolean);
  };

  const displayProbes = getDisplayProbes();
  const manualCount = categories.reduce((s, c) => s + c.nodes.length, 0);
  const readyCount = displayProbes.filter((p:any) => p.health === 'good').length + 
                     categories.reduce((s, c) => s + c.nodes.filter((n:any) => n.active).length, 0);
  const readiness = (displayProbes.length + manualCount) > 0 ? Math.round((readyCount / (displayProbes.length + manualCount)) * 100) : 0;
  const getLog = (provider: string) => (statsData?.apiLogs || []).find((l: any) => l.provider === provider) || { _sum: { usageAmount: 0, costCny: 0 } };
  const inp = "w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none"

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-20">
      <div className="container mx-auto px-6 py-8 max-w-7xl">
        
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-black mb-2 tracking-tight italic">🔭 NOVA 运维驾驶舱</h1>
            <p className="text-slate-400 font-medium">全域 API 实弹监控 · 财务级成本透视</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setDrawer(true)} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 rounded-xl text-sm font-bold shadow-lg shadow-blue-500/20 hover:bg-blue-500 transition-all">
              <Plus className="w-4 h-4" /> 接入扩展探头
            </button>
            <button onClick={loadAllData} className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm font-bold hover:bg-slate-700 transition-all">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> 全盘扫描
            </button>
          </div>
        </div>

        {/* 统计看板 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {[
            { label: '总监控节点', value: displayProbes.length + manualCount, color: 'text-white' },
            { label: '✅ 联通正常', value: readyCount, color: 'text-emerald-400' },
            { label: '⚠️ 待配置/异常', value: (displayProbes.length + manualCount) - readyCount, color: 'text-amber-400' },
            { label: '全节点就绪率', value: `${readiness}%`, color: readiness >= 80 ? 'text-emerald-400' : 'text-red-400' },
          ].map((s, i) => (
            <div key={i} className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <div className={`text-3xl font-black mb-1 ${s.color}`}>{s.value}</div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">{s.label}</div>
            </div>
          ))}
        </div>

        {/* 核心 API 自动探针区 (全量展示) */}
        <section className="mb-12">
          <h2 className="text-lg font-bold mb-6 flex items-center gap-2 text-blue-400 uppercase tracking-wider">
            <Signal className="w-5 h-5" /> 核心基础设施 (自动侦测)
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {displayProbes.map((probe: any, idx: number) => (
              <div key={idx} className={`relative rounded-2xl border p-5 bg-slate-900/80 transition-all ${probe.health === 'good' ? 'border-emerald-500/30 bg-emerald-500/5' : probe.health === 'warning' ? 'border-amber-500/30 bg-amber-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
                <div className="flex justify-between items-start mb-5">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${probe.health === 'good' ? 'bg-emerald-500/20 text-emerald-400' : probe.health === 'warning' ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}`}>
                    {(() => { const IconComponent = probe.icon || BrainCircuit; return <IconComponent className="w-6 h-6" />; })()}
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-base">{probe.provider}</h3>
                      <p className="text-[10px] text-slate-500 font-mono">{probe.statusText || 'STATUS: 未知'}</p>
                    </div>
                  </div>
                  <div className={`px-2 py-0.5 rounded-full text-[10px] font-black ${probe.health === 'good' ? 'bg-emerald-500 text-emerald-950' : probe.health === 'warning' ? 'bg-amber-500 text-amber-950' : 'bg-red-500 text-white'}`}>
                    {probe.health === 'good' ? 'ONLINE' : probe.health === 'warning' ? 'WAITING' : 'ERROR'}
                  </div>
                </div>
                <div className="flex items-end justify-between">
                   <div className="text-2xl font-black text-white">
                      {probe.balance !== null ? <><span className="text-xs font-medium text-slate-500 mr-2 italic">余额</span>¥{probe.balance}</> : <span className="text-slate-600 text-sm italic">计费节点</span>}
                   </div>
                   <div className="text-[10px] text-slate-600 font-mono">{probe.unit}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 扩展节点区 */}
        {categories.length > 0 && (
          <section className="mb-12">
            <h2 className="text-lg font-bold mb-6 flex items-center gap-2 text-slate-500 uppercase tracking-wider">
              <Database className="w-5 h-5" /> 扩展监控矩阵 (手动配置)
            </h2>
            <div className="space-y-8">
              {categories.map((cat, ci) => (
                <div key={ci} className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
                  <h3 className="text-sm font-bold text-slate-400 mb-5 flex items-center gap-2">
                    <div className="w-1.5 h-4 bg-slate-700 rounded-full" /> {cat.title}
                  </h3>
                  <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {cat.nodes.map((node: any) => {
                      const isWrong = node.envKey.startsWith('sk-');
                      return (
                        <div key={node.id} className="group relative p-4 rounded-xl border border-slate-800 bg-slate-950/40 hover:border-slate-700 transition-all">
                          <button onClick={() => handleDelete(node.id)} className="absolute -top-2 -right-2 p-1.5 bg-red-600 rounded-lg opacity-0 group-hover:opacity-100 transition-all shadow-xl z-20"><Trash2 className="w-3 h-3"/></button>
                          <div className="flex justify-between items-start mb-2">
                            <span className="font-bold text-xs text-white">{node.label}</span>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${node.active ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-800 text-slate-500'}`}>
                              {node.active ? 'CONNECTED' : 'PENDING'}
                            </span>
                          </div>
                          <p className={`text-[10px] font-mono truncate ${isWrong ? 'text-red-500 bg-red-500/10 px-1 py-0.5 rounded' : 'text-slate-600'}`}>
                            {isWrong ? '⚠️ 填成了密钥值' : `KEY: ${node.envKey}`}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 30天消耗雷达 */}
        <section className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-bold flex items-center gap-3 text-orange-400">
              <BarChart3 className="w-6 h-6"/> 30天 API 消耗实况雷达
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { id: 'DEEPSEEK', label: 'DeepSeek AI', icon: BrainCircuit, color: 'text-blue-400' },
              { id: 'APOLLO', label: 'Apollo 寻源', icon: Search, color: 'text-orange-400' },
              { id: 'HUNTER', label: 'Hunter 挖掘', icon: ShieldCheck, color: 'text-emerald-400' },
              { id: 'ZEROBOUNCE', label: 'ZeroBounce 清洗', icon: Mail, color: 'text-pink-400' }
            ].map(api => {
              const log = getLog(api.id);
              return (
                <div key={api.id} className="p-6 rounded-2xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 transition-all">
                  <div className="flex items-center gap-3 mb-4">
                    <api.icon className={`w-5 h-5 ${api.color}`}/>
                    <span className="font-bold text-sm text-slate-300">{api.label}</span>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">累计支出</div>
                    <div className="text-2xl font-black text-emerald-400">¥ {(log._sum?.costCny || 0).toFixed(2)}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      </div>

      {/* 侧边抽屉 */}
      <AnimatePresence>
        {drawer && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 backdrop-blur-md z-40" onClick={() => setDrawer(false)} />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} className="fixed right-0 top-0 h-full w-full max-w-md bg-slate-950 border-l border-slate-800 z-50 flex flex-col shadow-2xl">
              <div className="px-8 py-8 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                <div>
                  <h3 className="text-2xl font-bold text-white">接入扩展探头</h3>
                  <p className="text-slate-500 text-xs mt-1">请填写环境变量名而非密钥值</p>
                </div>
                <X className="w-8 h-8 cursor-pointer text-slate-500 hover:text-white" onClick={() => setDrawer(false)} />
              </div>
              <div className="flex-1 overflow-y-auto px-8 py-8 space-y-6">
                <div><label className="text-[10px] font-bold text-slate-500 mb-2 block uppercase tracking-widest">探头显示名称</label><input className={inp} value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="例: 阿里云存储 OSS" /></div>
                <div><label className="text-[10px] font-bold text-slate-500 mb-2 block uppercase tracking-widest">所属分类</label><select className={inp} value={form.category} onChange={e => setForm({...form, category: e.target.value})}><option value="AI_ENGINE">🧠 核心 AI 引擎</option><option value="DATA_SOURCE">🕵️ 数据挖掘与清洗</option><option value="OUTREACH">✉️ 触达与发信集群</option><option value="PAYMENT">💰 交易与风控网关</option><option value="INFRA">🗄️ 底层高可用基建</option></select></div>
                <div><label className="text-[10px] font-bold text-slate-500 mb-2 block uppercase tracking-widest">关联环境变量键 (ENV KEY)</label><input className={inp} value={form.envKey} onChange={e => setForm({...form, envKey: e.target.value})} placeholder="例: ALIYUN_OSS_KEY" /></div>
                <div><label className="text-[10px] font-bold text-slate-500 mb-2 block uppercase tracking-widest">功能描述</label><textarea className={`${inp} h-28 resize-none`} value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="简述该节点在 Nova 系统中的作用..." /></div>
                <button onClick={handleAddNode} disabled={saving} className="w-full py-4 bg-blue-600 rounded-2xl font-bold hover:bg-blue-500 shadow-xl shadow-blue-600/20 flex justify-center items-center">{saving ? <Loader2 className="w-6 h-6 animate-spin" /> : '激活雷达探头'}</button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}