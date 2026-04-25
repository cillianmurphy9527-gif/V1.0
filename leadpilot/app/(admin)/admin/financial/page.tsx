"use client"
import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { TrendingUp, TrendingDown, RotateCcw, Zap, RefreshCw, Loader2, ArrowUpRight, Trash2, X, Plus, Server } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

interface PeriodReport {
  revenue: number; ordersCount: number; refundsCount: number;
  apiCost: number; fixedCost: number; totalCost: number;
  grossProfit: number; profitMargin: number;
}
interface FinancialStats { today: PeriodReport; week: PeriodReport; month: PeriodReport; }
interface FixedCostItem { id: string; name: string; category: string; amount: number; billingCycle: string; vendor?: string | null }

const CAT: { [k: string]: string } = { INFRA: '云基建', DATA: '数据源', PAYMENT: '支付通道', OTHER: '其他' }
const CYC: { [k: string]: string } = { MONTHLY: '包月', YEARLY: '包年' }

function fmt(n: number) { return `¥ ${Math.abs(n).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }

function KpiCard({ label, value, sub, border, bg, valCls, icon: Icon }: any) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className={`bg-slate-900 border ${border} rounded-2xl p-6 shadow-xl flex flex-col justify-between`}>
      <div>
        <div className="flex items-start justify-between mb-4">
          <div className={`w-11 h-11 rounded-xl ${bg} flex items-center justify-center`}><Icon className={`w-5 h-5 ${valCls}`} /></div>
        </div>
        <p className="text-slate-400 text-xs font-medium mb-1">{label}</p>
        <p className={`text-3xl font-black ${valCls} tracking-tight`}>{value}</p>
      </div>
      {sub && <p className="text-slate-500 text-[11px] mt-4 leading-relaxed bg-slate-950/50 p-2 rounded-lg border border-slate-800/50">{sub}</p>}
    </motion.div>
  )
}

function FixedCostDrawer({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', category: 'INFRA', billingCycle: 'MONTHLY', amount: '', vendor: '' })

  const handleAdd = async () => {
    if (!form.name.trim()) return toast({ title: '请填写名称', variant: 'destructive' })
    const amt = parseFloat(form.amount)
    if (isNaN(amt) || amt <= 0) return toast({ title: '请输入有效金额', variant: 'destructive' })
    
    setSaving(true)
    try {
      const r = await fetch('/api/admin/financial/fixed-costs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name.trim(), category: form.category, billingCycle: form.billingCycle, amount: amt, vendor: form.vendor.trim() })
      })
      if (!r.ok) throw new Error('新增失败')
      setForm({ name: '', category: 'INFRA', billingCycle: 'MONTHLY', amount: '', vendor: '' })
      toast({ title: '配置已生效，利润大盘已自动重算' })
      onSaved()
      onClose()
    } catch (e: any) {
      toast({ title: e.message, variant: 'destructive' })
    } finally { setSaving(false) }
  }

  const inp = "w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
  
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={onClose} />
          <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25 }} className="fixed right-0 top-0 h-full w-full max-w-md bg-slate-900 border-l border-slate-800 z-50 flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800 bg-slate-950/50">
              <div><h3 className="text-white font-bold text-lg">录入新资产</h3><p className="text-slate-500 text-xs mt-1">管理底层固定资产，自动扣除毛利</p></div>
              <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">资产名称 (例: 北京2核4G轻量云)</label>
                    <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inp} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                       <label className="block text-xs font-bold text-slate-400 mb-1">分类</label>
                       <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className={inp}>{Object.entries(CAT).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                    </div>
                    <div>
                       <label className="block text-xs font-bold text-slate-400 mb-1">计费周期</label>
                       <select value={form.billingCycle} onChange={e => setForm({ ...form, billingCycle: e.target.value })} className={inp}>{Object.entries(CYC).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                    </div>
                  </div>
                  <div>
                     <label className="block text-xs font-bold text-slate-400 mb-1">实付金额 (元)</label>
                     <input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} className={inp} />
                  </div>
                  <button onClick={handleAdd} disabled={saving} className="w-full py-3 mt-4 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-500 transition-all disabled:opacity-50 flex justify-center items-center shadow-lg shadow-blue-500/20">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : '提交配置并重算利润'}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export default function FinancialPage() {
  const { toast } = useToast()
  const [stats, setStats] = useState<FinancialStats | null>(null)
  const [fixedCosts, setFixedCosts] = useState<FixedCostItem[]>([])
  const [loading, setLoading] = useState(true)
  const [drawer, setDrawer] = useState(false)
  const [viewMode, setViewMode] = useState<'today' | 'week' | 'month'>('today')

  const loadData = async () => {
    setLoading(true)
    try {
      const [statsRes, costsRes] = await Promise.all([
        fetch('/api/admin/financial/stats'),
        fetch('/api/admin/financial/fixed-costs')
      ])
      if (statsRes.ok) setStats(await statsRes.json())
      if (costsRes.ok) {
        const costData = await costsRes.json()
        setFixedCosts(costData.items || costData || [])
      }
    } finally { setLoading(false) }
  }
  
  useEffect(() => { loadData() }, [])

  const handleDeleteCost = async (id: string) => {
    if (!confirm('确定要删除这项成本配置吗？大盘利润将重新计算。')) return
    try {
      const res = await fetch(`/api/admin/financial/fixed-costs?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast({ title: '删除成功' })
        loadData()
      }
    } catch (e) {
      toast({ title: '删除失败', variant: 'destructive' })
    }
  }

  const currentData = stats ? stats[viewMode] : null;
  const profit = currentData?.grossProfit ?? 0;

  // 动态获取前缀文案
  const getPrefix = () => {
    if (viewMode === 'today') return '今日';
    if (viewMode === 'week') return '近7天';
    return '近30天';
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-20">
      <div className="max-w-7xl mx-auto px-6 py-10">
        
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-10 gap-6">
          <div>
            <h1 className="text-4xl font-black tracking-tight mb-2">财务利润大盘</h1>
            <p className="text-slate-400 text-sm">日/周/月多维度对账 · 真实聚合底层 API 与基建成本</p>
          </div>
          
          <div className="flex items-center gap-4 bg-slate-900 border border-slate-800 p-1.5 rounded-2xl shadow-xl">
            <div className="flex bg-slate-950 rounded-xl p-1 border border-slate-800">
              {[
                { id: 'today', label: '今日实况' },
                { id: 'week', label: '近 7 天' },
                { id: 'month', label: '近 30 天' }
              ].map(tab => (
                <button 
                  key={tab.id}
                  onClick={() => setViewMode(tab.id as any)}
                  className={`px-5 py-2 text-sm font-bold rounded-lg transition-all ${viewMode === tab.id ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <button onClick={loadData} disabled={loading} className="p-2.5 text-slate-400 hover:text-white bg-slate-800 rounded-xl hover:bg-slate-700 transition-all mr-1">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-400' : ''}`} />
            </button>
          </div>
        </div>

        {loading && !stats ? (
          <div className="flex justify-center py-32"><Loader2 className="w-8 h-8 text-blue-400 animate-spin" /></div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
              <KpiCard 
                label={`${getPrefix()}总营收`} 
                value={fmt(currentData?.revenue ?? 0)} 
                sub={`产生 ${currentData?.ordersCount ?? 0} 笔有效订单`} 
                border="border-emerald-500/30" bg="bg-emerald-500/10" valCls="text-emerald-400" icon={ArrowUpRight} 
              />
              
              <KpiCard 
                label={`${getPrefix()}总支出`} 
                value={fmt(currentData?.totalCost ?? 0)} 
                sub={`包含动态 API 消耗: ¥${currentData?.apiCost?.toFixed(2)} | 固定资产摊销: ¥${currentData?.fixedCost?.toFixed(2)}`} 
                border="border-orange-500/30" bg="bg-orange-500/10" valCls="text-orange-400" icon={Zap}
              />
              
              <KpiCard 
                label={`${getPrefix()}发生退款`} 
                value={fmt(0)} 
                sub={`涉及 ${currentData?.refundsCount ?? 0} 笔退款订单`} 
                border="border-red-500/30" bg="bg-red-500/10" valCls="text-red-400" icon={RotateCcw} 
              />
              
              <KpiCard 
                label={`${getPrefix()}净利润`} 
                value={`${profit >= 0 ? '+' : '-'}${fmt(profit)}`} 
                sub={currentData && currentData.revenue > 0 ? `系统商业利润率 ${currentData.profitMargin.toFixed(1)}%` : '当前周期内暂无营收录入'} 
                border={profit < 0 ? 'border-red-500/40' : 'border-blue-500/40'} bg={profit < 0 ? 'bg-red-500/10' : 'bg-blue-600/20'} valCls={profit < 0 ? 'text-red-400' : 'text-blue-400'} icon={profit >= 0 ? TrendingUp : TrendingDown} 
              />
            </div>

            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
              <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-800/20">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2"><Server className="w-5 h-5 text-blue-400" /> 固定基建资产表 (CMS)</h2>
                  <p className="text-xs text-slate-400 mt-1">您录入的服务器、域名等采购，将根据此处配置自动按天数折算并计入上方的“总支出”卡片中</p>
                </div>
                <button onClick={() => setDrawer(true)} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-500 text-sm font-bold transition-all shadow-lg shadow-blue-500/20">
                  <Plus className="w-4 h-4" /> 录入新采购项
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-800/50 text-slate-400 text-xs uppercase tracking-wider">
                      <th className="p-5 font-medium border-b border-slate-800">采购项名称</th>
                      <th className="p-5 font-medium border-b border-slate-800">类目</th>
                      <th className="p-5 font-medium border-b border-slate-800">计费周期</th>
                      <th className="p-5 font-medium border-b border-slate-800">采购总额</th>
                      <th className="p-5 font-medium border-b border-slate-800">系统折算日成本</th>
                      <th className="p-5 font-medium text-right border-b border-slate-800">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {fixedCosts.length === 0 ? (
                      <tr><td colSpan={6} className="p-10 text-center text-slate-500 text-sm bg-slate-900/50">暂无配置，请点击右上角录入您的服务器或域名。</td></tr>
                    ) : fixedCosts.map((item) => {
                      const dailyCost = item.billingCycle === 'YEARLY' ? item.amount / 365 : item.amount / 30;
                      return (
                        <tr key={item.id} className="hover:bg-slate-800/30 transition-colors group bg-slate-900/30">
                          <td className="p-5 text-white font-bold">{item.name}</td>
                          <td className="p-5"><span className="text-xs font-bold px-2 py-1 rounded bg-slate-800 text-slate-300">{CAT[item.category] || item.category}</span></td>
                          <td className="p-5"><span className={`text-xs px-2 py-1 rounded font-bold ${item.billingCycle === 'YEARLY' ? 'bg-purple-500/10 text-purple-400' : 'bg-cyan-500/10 text-cyan-400'}`}>{CYC[item.billingCycle] || item.billingCycle}</span></td>
                          <td className="p-5 text-slate-300 font-bold">¥ {item.amount.toLocaleString()}</td>
                          <td className="p-5"><span className="text-orange-400 font-bold bg-orange-500/10 px-2 py-1 rounded-md text-sm border border-orange-500/20">¥ {dailyCost.toFixed(2)} / 天</span></td>
                          <td className="p-5 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleDeleteCost(item.id)} className="p-2 text-rose-400 hover:bg-rose-400/10 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </>
        )}
      </div>
      <FixedCostDrawer open={drawer} onClose={() => setDrawer(false)} onSaved={loadData} />
    </div>
  )
}