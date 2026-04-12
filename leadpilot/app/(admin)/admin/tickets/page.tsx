"use client"

import { useEffect, useMemo, useRef, useState, useCallback } from "react"
import { motion } from "framer-motion"
import { MessageSquare, CheckCircle2, Clock, X, Send, Search } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

type TicketStatus = 'OPEN' | 'PENDING' | 'RESOLVED'
type TicketType   = 'billing' | 'technical' | 'account' | 'other'
interface TicketMsg { id:string; from:'user'|'admin'; content:string; createdAt:string }
interface Ticket   { id:string; userEmail:string; userCompanyName:string|null; type:TicketType; subject:string; status:TicketStatus; priority:'LOW'|'NORMAL'|'HIGH'|'URGENT'; createdAt:string; updatedAt:string; messages:TicketMsg[] }

// 提取用户展示名：公司名 > email 前缀
const displayName = (companyName: string|null|undefined, email: string): string =>
  companyName || email?.split('@')[0] || '未知用户'

const TLABEL:Record<TicketType,string>={billing:'账单',technical:'技术',account:'账户',other:'其他'}
const STA={OPEN:{label:'待处理',cls:'text-amber-400',bg:'bg-amber-500/15',bdr:'border-amber-500/40',Icon:Clock},PENDING:{label:'跟进中',cls:'text-blue-400',bg:'bg-blue-500/15',bdr:'border-blue-500/40',Icon:MessageSquare},RESOLVED:{label:'已解决',cls:'text-emerald-400',bg:'bg-emerald-500/15',bdr:'border-emerald-500/40',Icon:CheckCircle2}}
const PRI={LOW:{label:'低',cls:'text-slate-400'},NORMAL:{label:'普通',cls:'text-blue-400'},HIGH:{label:'高',cls:'text-orange-400'},URGENT:{label:'紧急',cls:'text-red-400'}}

export default function AdminTicketsPage() {
  const { toast } = useToast()
  const [tickets,setTickets]=useState<Ticket[]>([])
  const [loading,setLoading]=useState(true)
  const [sel,setSel]=useState<Ticket|null>(null)
  const [reply,setReply]=useState('')
  const [sending,setSending]=useState(false)
  const [search,setSearch]=useState('')
  const [flt,setFlt]=useState<TicketStatus|'ALL'>('ALL')
  const [pendingIds,setPendingIds]=useState<Set<string>>(new Set())
  const chatEndRef=useRef<HTMLDivElement>(null)

  const loadTickets = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/tickets/list')
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || '加载失败')
      const next = data?.tickets || []
      setTickets(next)
      return next as Ticket[]
    } catch (e: any) {
      toast({ title: '加载失败', description: e?.message || '无法加载工单列表', variant: 'destructive' })
      setTickets([])
      return [] as Ticket[]
    } finally {
      setLoading(false)
    }
  }, [toast])

  const refetchSel = useCallback(async () => {
    if (!sel) return
    try {
      const res = await fetch('/api/admin/tickets/list')
      if (!res.ok) return
      const data = await res.json()
      const fresh = (data?.tickets || []).find((t: Ticket) => t.id === sel.id)
      if (!fresh) return
      const merged = sel.messages.filter(m => pendingIds.has(m.id)).concat(fresh.messages)
      setSel({ ...fresh, messages: merged })
    } catch { /* silent */ }
  }, [sel, pendingIds])

  useEffect(() => {
    loadTickets()
  }, [loadTickets])

  // ────────────────────────────────────────────────────────────────────────
  // 静默轮询：工单列表实时刷新 + 自动排序到顶部
  // ────────────────────────────────────────────────────────────────────────
  const listPollingRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const silentPoll = async () => {
      try {
        const res = await fetch('/api/admin/tickets/list')
        if (!res.ok) return
        const data = await res.json()
        const next: Ticket[] = data?.tickets || []

        setTickets(prev => {
          // 保留当前选中工单中 pending 的 optimistic 消息
          const prevIds = new Set(prev.map(t => t.id))
          const prevSelId = sel?.id
          const prevSelPending = prev.find(t => t.id === prevSelId)?.messages.filter(m => pendingIds.has(m.id)) || []

          // 如果列表有变化才更新（避免无意义的重渲染）
          const prevStr = JSON.stringify(prev.map(t => ({ id: t.id, updatedAt: t.updatedAt, status: t.status })))
          const nextStr = JSON.stringify(next.map(t => ({ id: t.id, updatedAt: t.updatedAt, status: t.status })))
          if (prevStr === nextStr && prev.length === next.length) return prev

          // 为当前选中工单合并 pending 消息
          if (prevSelId) {
            const nextSel = next.find(t => t.id === prevSelId)
            if (nextSel) {
              const mergedSel = { ...nextSel, messages: [...prevSelPending, ...nextSel.messages] }
              return next.map(t => t.id === prevSelId ? mergedSel : t)
            }
          }
          return next
        })
      } catch { /* silent */ }
    }

    listPollingRef.current = setInterval(silentPoll, 3000)

    return () => {
      if (listPollingRef.current) {
        clearInterval(listPollingRef.current)
        listPollingRef.current = null
      }
    }
  }, []) // 仅挂载时启动一次，不依赖 sel，避免重复

  // 选中工单时：轮询该工单消息 + 自动滚动到底部
  useEffect(() => {
    if (!sel) return
    const id = setInterval(() => {
      refetchSel()
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 80)
    }, 3000)
    return () => clearInterval(id)
  }, [sel?.id, refetchSel])

  const visible = useMemo(() => {
    return tickets.filter(t =>
      (flt === 'ALL' || t.status === flt) &&
      (!search || t.userEmail.includes(search) || t.subject.includes(search))
    )
  }, [tickets, flt, search])

  const counts={ALL:tickets.length,OPEN:tickets.filter(t=>t.status==='OPEN').length,PENDING:tickets.filter(t=>t.status==='PENDING').length,RESOLVED:tickets.filter(t=>t.status==='RESOLVED').length}

  const sendReply=async()=>{
    if(!reply.trim()||!sel)return
    const text=reply.trim()
    setSending(true)
    const optimisticMsg: TicketMsg={id:`adm-${Date.now()}`,from:'admin',content:text,createdAt:new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})}
    pendingIds.add(optimisticMsg.id)
    setPendingIds(new Set(pendingIds))
    setSel(p=>p?{...p,messages:[...p.messages,optimisticMsg]}:p)
    setTimeout(()=>chatEndRef.current?.scrollIntoView({behavior:'smooth'}),30)
    setReply('')
    try{
      const res = await fetch(`/api/admin/tickets/${sel.id}/reply`,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({content:text})
      })
      const data = await res.json()
      if(!res.ok) throw new Error(data?.error||'发送失败')
      pendingIds.delete(optimisticMsg.id)
      setPendingIds(new Set(pendingIds))
      const next = await loadTickets()
      setSel(next.find(t=>t.id===sel.id)||null)
    }catch(e:any){
      pendingIds.delete(optimisticMsg.id)
      setPendingIds(new Set(pendingIds))
      setSel(p=>p?{...p,messages:p.messages.filter(m=>m.id!==optimisticMsg.id)}:p)
      toast({title:'❌ 发送失败',description:e?.message||'请稍后重试',variant:'destructive'})
      setReply(text)
    }finally{
      setSending(false)
    }
  }
  const resolve=async(id:string)=>{
    try{
      const res = await fetch(`/api/admin/tickets/${id}/resolve`,{method:'POST'})
      const data = await res.json()
      if(!res.ok) throw new Error(data?.error||'操作失败')
      toast({title:'✅ 已标记解决'})
      await loadTickets()
      if(sel?.id===id) setSel(null)
    }catch(e:any){
      toast({title:'❌ 操作失败',description:e?.message||'请稍后重试',variant:'destructive'})
    }
  }

  return(
    <div className="flex h-screen overflow-hidden">
      {/* 工单列表 */}
      <div className="w-96 border-r border-slate-800 flex flex-col bg-slate-900/30">
        <div className="p-5 border-b border-slate-800">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><MessageSquare className="w-5 h-5 text-blue-400"/>工单处理大厅</h2>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"/>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="搜索用户或主题"
              className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"/>
          </div>
          <div className="flex gap-1">
            {(['ALL','OPEN','PENDING','RESOLVED'] as const).map(s=>(
              <button key={s} onClick={()=>setFlt(s)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${flt===s?'bg-blue-600 text-white':'text-slate-400 hover:text-white hover:bg-slate-800'}`}
              >{s==='ALL'?`全部(${counts.ALL})`:s==='OPEN'?`待处理(${counts.OPEN})`:s==='PENDING'?`跟进(${counts.PENDING})`:`已解决(${counts.RESOLVED})`}</button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
          {loading ? (
            <div className="p-8 text-center text-slate-500">加载中...</div>
          ) : visible.length === 0 ? (
            <div className="p-8 text-center text-slate-600">暂无工单</div>
          ) : visible.map((t,i)=>{
            const s=STA[t.status]
            return(
              <motion.div key={t.id} initial={{opacity:0,x:-12}} animate={{opacity:1,x:0}} transition={{delay:i*0.05}}
                onClick={()=>setSel(t)}
                className={`p-4 cursor-pointer hover:bg-slate-800/40 transition-all ${sel?.id===t.id?'bg-slate-800 border-l-2 border-blue-500':''}`}
              >
                <div className="flex items-start justify-between mb-1">
                  <span className="text-xs font-mono text-slate-500">{t.id}</span>
                  <span className={`text-xs font-bold ${PRI[t.priority].cls}`}>{PRI[t.priority].label}优先级</span>
                </div>
                <p className="text-sm font-semibold text-white mb-1 truncate">{t.subject}</p>
                <p className="text-xs text-slate-500 mb-2 truncate">{displayName(t.userCompanyName, t.userEmail)}</p>
                <div className="flex items-center justify-between">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${s.bg} ${s.bdr} ${s.cls}`}><s.Icon className="w-2.5 h-2.5"/>{s.label}</span>
                  <span className="text-xs text-slate-600 bg-slate-800/50 px-2 py-0.5 rounded-full">{TLABEL[t.type]}</span>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* 详情+回复 */}
      {sel?(
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/30 flex items-center gap-4">
            <div className="flex-1">
              <h3 className="font-bold text-white">{sel.subject}</h3>
              <p className="text-sm text-slate-400 mt-0.5">{displayName(sel.userCompanyName, sel.userEmail)} · {TLABEL[sel.type]} · {sel.createdAt}</p>
            </div>
            <div className="flex items-center gap-2">
              {sel.status!=='RESOLVED'&&(
                <button onClick={()=>resolve(sel.id)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-all">
                  <CheckCircle2 className="w-4 h-4"/>标记已解决
                </button>
              )}
              <button onClick={()=>setSel(null)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all"><X className="w-5 h-5"/></button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {sel.messages.map((msg,i)=>(
              <motion.div key={msg.id} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:i*0.06}}
                className={`flex ${msg.from==='admin'?'justify-end':'justify-start'}`}>
                <div className={`max-w-lg rounded-2xl px-5 py-4 ${msg.from==='admin'?'bg-blue-600/20 border border-blue-500/30':'bg-slate-800/70 border border-slate-700'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xs font-semibold ${msg.from==='admin'?'text-blue-400':'text-slate-400'}`}>{msg.from==='admin'?'🛡️ 管理员':'👤 '+displayName(sel.userCompanyName, sel.userEmail)}</span>
                    <span className="text-xs text-slate-600">{msg.createdAt}</span>
                  </div>
                  <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                </div>
              </motion.div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <div className="border-t border-slate-800 p-5 bg-slate-900/30">
            {sel.status==='RESOLVED'?(
              <div className="flex items-center justify-center gap-2 py-3 text-emerald-400 text-sm"><CheckCircle2 className="w-4 h-4"/>工单已解决</div>
            ):(
              <>
                <textarea value={reply} onChange={e=>setReply(e.target.value)} placeholder="输入回复内容..."
                  onKeyDown={e=>{if(e.key==='Enter'&&e.metaKey)sendReply()}}
                  className="w-full h-24 px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 resize-none focus:outline-none focus:border-blue-500 mb-3"
                />
                <button onClick={sendReply} disabled={!reply.trim()||sending}
                  className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-all"
                >
                  {sending?<><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>发送中...</>:<><Send className="w-4 h-4"/>发送回复 (⌘↵)</>}
                </button>
              </>
            )}
          </div>
        </div>
      ):(
        <div className="flex-1 flex items-center justify-center bg-slate-950">
          <div className="text-center">
            <MessageSquare className="w-16 h-16 mx-auto mb-4 text-slate-800"/>
            <p className="text-slate-500">选择一个工单开始处理</p>
          </div>
        </div>
      )}
    </div>
  )
}
