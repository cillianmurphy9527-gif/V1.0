"use client"
import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { TrendingUp, TrendingDown, AlertTriangle, RotateCcw, Zap, Mail, RefreshCw, Loader2, ArrowUpRight, Server, CreditCard, Settings, Trash2, X } from "lucide-react"
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"

interface KPI { totalRevenue:number; totalRefunds:number; totalCosts:number; netProfit:number; totalPaidCount:number; totalRefundCount:number }
interface CostItem { label:string; value:string; cost:number|null }
interface CostCenter { label:string; cost:number; pct:number; items:CostItem[] }
interface CostCenters { total:number; ai:CostCenter; outreach:CostCenter; infra:CostCenter; payment:CostCenter }
interface LedgerRow { id:string; tradeNo:string; type:'INCOME'|'REFUND'; amount:number; plan:string; orderType:string; userEmail:string; createdAt:string }
interface TrendDay { date:string; revenue:number; cost:number; profit:number }
interface FixedCostItem { id:string; name:string; category:string; amount:number; billingCycle:string; vendor?:string|null }
type Range='7days'|'30days'|'90days'|'all'
const CAT:{[k:string]:string}={INFRA:'云基建',DATA:'数据源',PAYMENT:'支付通道',OTHER:'其他'}
const CYC:{[k:string]:string}={MONTHLY:'月付',YEARLY:'年付'}
function fmt(n:number){return `¥ ${Math.abs(n).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2})}`}

function KpiCard({label,value,sub,border,bg,valCls,icon:Icon,warn,action}:{label:string;value:string;sub?:string;border:string;bg:string;valCls:string;icon:any;warn?:boolean;action?:React.ReactNode}){
  return(
    <motion.div initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} className={`bg-slate-900/40 border ${border} rounded-2xl p-6`}>
      <div className="flex items-start justify-between mb-4">
        <div className={`w-11 h-11 rounded-xl ${bg} flex items-center justify-center`}><Icon className={`w-5 h-5 ${valCls}`}/></div>
        <div className="flex items-center gap-2">{action}{warn&&<AlertTriangle className="w-5 h-5 text-red-400 animate-pulse"/>}</div>
      </div>
      <p className="text-slate-400 text-xs font-medium mb-1">{label}</p>
      <p className={`text-2xl font-black ${valCls} tracking-tight`}>{value}</p>
      {sub&&<p className="text-slate-500 text-xs mt-1">{sub}</p>}
    </motion.div>
  )
}
// END_KPICARD

function ProfitTrendChart({data}:{data:TrendDay[]}){
  const CT=({active,payload,label}:any)=>{
    if(!active||!payload?.length)return null
    return(
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs shadow-xl">
        <p className="text-slate-400 mb-2 font-semibold">{label}</p>
        {payload.map((p:any)=>(<p key={p.name} style={{color:p.color}} className="flex justify-between gap-4"><span>{p.name}</span><span className="font-bold">¥{Number(p.value).toFixed(2)}</span></p>))}
      </div>
    )
  }
  return(
    <motion.div initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} transition={{delay:0.1}} className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-6 mb-6">
      <div className="mb-5"><h3 className="text-white font-bold text-sm">利润与营收趋势（最近 30 天）</h3><p className="text-slate-500 text-xs mt-0.5">每日营收 · 每日总成本 · 每日净利润</p></div>
      <div style={{height:300}}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{top:4,right:4,left:0,bottom:0}}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b"/>
            <XAxis dataKey="date" tick={{fill:'#64748b',fontSize:11}} axisLine={false} tickLine={false}/>
            <YAxis tick={{fill:'#64748b',fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>`¥${v}`}/>
            <Tooltip content={<CT/>}/>
            <Legend wrapperStyle={{color:'#94a3b8',fontSize:12}}/>
            <Bar dataKey="revenue" name="每日营收" fill="#10b981" fillOpacity={0.85} radius={[3,3,0,0]}/>
            <Line dataKey="cost" name="每日总成本" stroke="#ef4444" strokeWidth={2} dot={false} type="monotone"/>
            <Line dataKey="profit" name="每日净利润" stroke="#3b82f6" strokeWidth={2.5} dot={false} type="monotone"/>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  )
}
// END_TREND

function FixedCostDrawer({open,onClose,onSaved}:{open:boolean;onClose:()=>void;onSaved:()=>void}){
  const [items,setItems]=useState<FixedCostItem[]>([])
  const [loading,setLoading]=useState(false)
  const [saving,setSaving]=useState(false)
  const [deleting,setDeleting]=useState<string|null>(null)
  const [form,setForm]=useState({name:'',category:'INFRA',billingCycle:'MONTHLY',amount:'',vendor:''})
  const [err,setErr]=useState('')
  const fetchItems=async()=>{
    setLoading(true)
    try{const r=await fetch('/api/admin/financial/fixed-costs');const d=await r.json();setItems(d.items||[])}finally{setLoading(false)}
  }
  useEffect(()=>{if(open)fetchItems()},[open])
  const handleAdd=async()=>{
    if(!form.name.trim()){setErr('请填写名称');return}
    const amt=parseFloat(form.amount)
    if(isNaN(amt)||amt<=0){setErr('请输入有效金额');return}
    setErr('');setSaving(true)
    try{
      const r=await fetch('/api/admin/financial/fixed-costs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:form.name.trim(),category:form.category,billingCycle:form.billingCycle,amount:amt,vendor:form.vendor.trim()||null})})
      const d=await r.json()
      if(!r.ok)throw new Error(d?.error||'新增失败')
      setForm({name:'',category:'INFRA',billingCycle:'MONTHLY',amount:'',vendor:''})
      await fetchItems();onSaved()
    }catch(e:any){setErr(e?.message)}finally{setSaving(false)}
  }
  const handleDelete=async(id:string)=>{
    setDeleting(id)
    try{await fetch(`/api/admin/financial/fixed-costs?id=${id}`,{method:'DELETE'});await fetchItems();onSaved()}finally{setDeleting(null)}
  }
  const inp="w-full bg-slate-900/60 border border-slate-700/60 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
  const sel="bg-slate-900/60 border border-slate-700/60 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 w-full"
  return(
    <AnimatePresence>{open&&(<>
      <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={onClose}/>
      <motion.div initial={{x:'100%'}} animate={{x:0}} exit={{x:'100%'}} transition={{type:'spring',damping:28,stiffness:260}} className="fixed right-0 top-0 h-full w-full max-w-md bg-slate-900 border-l border-slate-800 z-50 flex flex-col shadow-2xl">
        <div className="h-1 bg-gradient-to-r from-orange-500 via-amber-400 to-orange-600"/>
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800">
          <div><h3 className="text-white font-bold">⚙️ 成本项配置</h3><p className="text-slate-500 text-xs mt-0.5">管理固定成本，自动摊销进财务大盘</p></div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center"><X className="w-4 h-4"/></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4">
            <p className="text-xs font-semibold text-slate-300 mb-3">新增成本项</p>
            <div className="space-y-2.5">
              <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="成本名称（如：Vercel 服务器）" className={inp}/>
              <input value={form.vendor} onChange={e=>setForm(f=>({...f,vendor:e.target.value}))} placeholder="供应商（可选）" className={inp}/>
              <div className="grid grid-cols-2 gap-2">
                <select value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))} className={sel}>{Object.entries(CAT).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>
                <select value={form.billingCycle} onChange={e=>setForm(f=>({...f,billingCycle:e.target.value}))} className={sel}>{Object.entries(CYC).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>
              </div>
              <input type="number" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} placeholder="金额（元）" className={inp}/>
              {err&&<p className="text-xs text-red-400">{err}</p>}
              <button onClick={handleAdd} disabled={saving} className="w-full py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold text-sm hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {saving?<Loader2 className="w-4 h-4 animate-spin"/>:<Settings className="w-4 h-4"/>}{saving?'保存中...':'新增成本项'}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-400">当前成本项 ({items.length})</p>
            {loading?<div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-slate-500"/></div>:items.length===0?<p className="text-center text-slate-600 text-sm py-6">暂无成本项，请在上方新增</p>:items.map(item=>(
              <div key={item.id} className="bg-slate-800/40 border border-slate-700/40 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-white text-sm font-semibold truncate">{item.name}{item.vendor?<span className="text-slate-500 text-xs ml-1">({item.vendor})</span>:null}</p>
                  <p className="text-slate-500 text-xs mt-0.5">{CAT[item.category]||item.category} · {CYC[item.billingCycle]||item.billingCycle} · <span className="text-orange-400 font-semibold">¥{item.amount}</span></p>
                </div>
                <button onClick={()=>handleDelete(item.id)} disabled={deleting===item.id} className="w-8 h-8 flex-shrink-0 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 flex items-center justify-center transition-all disabled:opacity-50">
                  {deleting===item.id?<Loader2 className="w-3.5 h-3.5 animate-spin"/>:<Trash2 className="w-3.5 h-3.5"/>}
                </button>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </>)}</AnimatePresence>
  )
}
// END_DRAWER

const CM={ai:{emoji:'🤖',icon:Zap,bar:'bg-violet-500',border:'border-violet-500/20',bg:'bg-violet-500/10',grad:'from-violet-400 to-purple-400'},outreach:{emoji:'📧',icon:Mail,bar:'bg-cyan-500',border:'border-cyan-500/20',bg:'bg-cyan-500/10',grad:'from-cyan-400 to-blue-400'},infra:{emoji:'☁️',icon:Server,bar:'bg-slate-400',border:'border-slate-500/30',bg:'bg-slate-700/40',grad:'from-slate-300 to-slate-400'},payment:{emoji:'💳',icon:CreditCard,bar:'bg-amber-500',border:'border-amber-500/20',bg:'bg-amber-500/10',grad:'from-amber-400 to-orange-400'}} as const
type CK=keyof typeof CM
function OpexDashboard({centers}:{centers:CostCenters}){
  const keys:CK[]=['ai','outreach','infra','payment'];const tot=centers.total||1
  return(<motion.div initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} transition={{delay:0.15}} className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-6 mb-8">
    <div className="flex items-center justify-between mb-4"><div><h3 className="text-white font-bold text-sm">运营成本全景矩阵</h3><p className="text-slate-500 text-xs mt-0.5">四大成本中心 · 实时聚合</p></div><span className="text-orange-400 font-black text-xl">{fmt(centers.total)}</span></div>
    <div className="h-3 bg-slate-800 rounded-full overflow-hidden flex mb-6">{keys.map(k=><div key={k} className={`h-full ${CM[k].bar}`} style={{width:`${(centers[k].cost/tot)*100}%`}}/>)}</div>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {keys.map(k=>{const c=centers[k];const m=CM[k];const Icon=m.icon;return(
        <div key={k} className={`border ${m.border} rounded-xl p-4`}>
          <div className="flex items-center justify-between mb-3"><div className="flex items-center gap-2"><div className={`w-8 h-8 rounded-lg ${m.bg} flex items-center justify-center`}><Icon className="w-4 h-4 text-white/80"/></div><span className="text-xs font-semibold text-white">{m.emoji} {c.label}</span></div><span className="text-[11px] font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">{c.pct}%</span></div>
          <p className={`text-xl font-black bg-gradient-to-r ${m.grad} bg-clip-text text-transparent mb-3`}>{fmt(c.cost)}</p>
          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden mb-3"><div className={`h-full ${m.bar} rounded-full`} style={{width:`${c.pct}%`}}/></div>
          <div className="space-y-1.5">{c.items.map(it=>(<div key={it.label} className="flex justify-between items-start gap-1"><span className="text-[11px] text-slate-500 shrink-0">{it.label}</span><div className="text-right"><span className="text-[11px] text-slate-400 block">{it.value}</span>{it.cost!==null&&<span className="text-[10px] text-orange-400/80">{fmt(it.cost)}</span>}</div></div>))}</div>
        </div>)})}
    </div>
  </motion.div>)
}
function LedgerTable({rows}:{rows:LedgerRow[]}){
  return(<motion.div initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} transition={{delay:0.3}} className="bg-slate-900/40 border border-slate-800/60 rounded-2xl overflow-hidden">
    <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800/60"><h2 className="text-lg font-bold text-white">对账流水明细</h2><span className="text-slate-500 text-xs">共 {rows.length} 条记录</span></div>
    <div className="overflow-x-auto"><table className="w-full">
      <thead><tr className="border-b border-slate-800/60">{['交易时间','流水单号','交易类型','金额','套餐','操作用户'].map(h=><th key={h} className="text-left py-3 px-5 text-xs font-semibold text-slate-500">{h}</th>)}</tr></thead>
      <tbody>{rows.length===0?<tr><td colSpan={6} className="py-16 text-center text-slate-500 text-sm">暂无流水记录</td></tr>:rows.map(r=>(
        <tr key={r.id} className="border-b border-slate-800/40 hover:bg-slate-800/30 transition-colors">
          <td className="py-3 px-5 text-xs text-slate-400 whitespace-nowrap">{r.createdAt}</td>
          <td className="py-3 px-5"><span className="text-xs font-mono text-slate-300 block max-w-[160px] truncate" title={r.tradeNo}>{r.tradeNo}</span></td>
          <td className="py-3 px-5">{r.type==='INCOME'?<span className="inline-flex px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">收入</span>:<span className="inline-flex px-2.5 py-1 rounded-full text-xs font-bold bg-red-500/15 border border-red-500/30 text-red-400">退款</span>}</td>
          <td className="py-3 px-5"><span className={`font-bold text-sm ${r.type==='INCOME'?'text-emerald-400':'text-red-400'}`}>{r.type==='INCOME'?'+':'-'}{fmt(r.amount)}</span></td>
          <td className="py-3 px-5"><span className={`text-xs px-2 py-0.5 rounded-full ${r.orderType==='SUBSCRIPTION'?'bg-blue-500/15 text-blue-400':'bg-orange-500/15 text-orange-400'}`}>{r.plan}</span></td>
          <td className="py-3 px-5 text-sm text-slate-300">{r.userEmail}</td>
        </tr>))}
    </tbody></table></div>
  </motion.div>)
}
// END_LEDGER

export default function FinancialPage(){
  const [kpi,setKpi]=useState<KPI|null>(null)
  const [centers,setCenters]=useState<CostCenters|null>(null)
  const [trend,setTrend]=useState<TrendDay[]>([])
  const [ledger,setLedger]=useState<LedgerRow[]>([])
  const [loading,setLoading]=useState(true)
  const [range,setRange]=useState<Range>('30days')
  const [drawer,setDrawer]=useState(false)
  const RL:Record<Range,string>={'7days':'最近 7 天','30days':'最近 30 天','90days':'最近 90 天','all':'全部时间'}

  const load=async(r:Range)=>{
    setLoading(true)
    try{
      const res=await fetch(`/api/admin/financial/ledger?range=${r}`)
      const d=await res.json()
      if(!res.ok)throw new Error(d?.error||'加载失败')
      setKpi(d.kpi);setCenters(d.costCenters);setTrend(d.dailyTrend||[]);setLedger(d.ledger||[])
    }catch(e:any){console.error('[Financial]',e?.message)}
    finally{setLoading(false)}
  }
  useEffect(()=>{load(range)},[range])
  const profit=kpi?.netProfit??0

  return(
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="fixed inset-0 pointer-events-none bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-30"/>
      <div className="relative z-10 max-w-7xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-10">
          <div><h1 className="text-4xl font-black tracking-tight mb-1">财务流水大盘</h1><p className="text-slate-400 text-sm">基于真实数据库实时聚合 · CFO 级成本与利润对账</p></div>
          <div className="flex items-center gap-3">
            <select value={range} onChange={e=>setRange(e.target.value as Range)} className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none">
              {(Object.keys(RL)as Range[]).map(k=><option key={k} value={k}>{RL[k]}</option>)}
            </select>
            <button onClick={()=>load(range)} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-300 hover:bg-slate-700 transition-all disabled:opacity-50"><RefreshCw className={`w-4 h-4 ${loading?'animate-spin':''}`}/>刷新</button>
          </div>
        </div>
        {loading&&!kpi
          ?<div className="flex items-center justify-center py-32"><Loader2 className="w-8 h-8 text-blue-400 animate-spin"/></div>
          :(<>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <KpiCard label="总入账" value={fmt(kpi?.totalRevenue??0)} sub={`${kpi?.totalPaidCount??0} 笔已付款订单`} border="border-emerald-500/30" bg="bg-emerald-500/10" valCls="text-emerald-400" icon={ArrowUpRight}/>
              <KpiCard label="总运营成本" value={fmt(centers?.total??0)} sub="四大成本中心合计" border="border-orange-500/30" bg="bg-orange-500/10" valCls="text-orange-400" icon={Zap}
                action={<button onClick={()=>setDrawer(true)} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-700/60 border border-slate-600/50 text-slate-400 hover:text-white hover:bg-slate-700 text-[11px] transition-all"><Settings className="w-3 h-3"/>成本配置</button>}/>
              <KpiCard label="总退款" value={fmt(kpi?.totalRefunds??0)} sub={`${kpi?.totalRefundCount??0} 笔退款订单`} border="border-red-500/30" bg="bg-red-500/10" valCls="text-red-400" icon={RotateCcw}/>
              <KpiCard label="真实净利润" value={`${profit>=0?'+':'-'}${fmt(profit)}`} sub={kpi&&kpi.totalRevenue>0?`利润率 ${((profit/kpi.totalRevenue)*100).toFixed(1)}%`:'—'} border={profit<0?'border-red-500/40':'border-blue-500/30'} bg={profit<0?'bg-red-500/10':'bg-blue-500/10'} valCls={profit<0?'text-red-400':'text-blue-400'} icon={profit>=0?TrendingUp:TrendingDown} warn={profit<0}/>
            </div>
            {trend.length>0&&<ProfitTrendChart data={trend}/>}
            {centers&&<OpexDashboard centers={centers}/>}
            <LedgerTable rows={ledger}/>
          </>)
        }
      </div>
      <FixedCostDrawer open={drawer} onClose={()=>setDrawer(false)} onSaved={()=>load(range)}/>
    </div>
  )
}