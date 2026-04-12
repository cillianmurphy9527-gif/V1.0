"use client"

import { useState, useRef, useEffect, useMemo, useCallback } from "react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence } from "framer-motion"
import {
  MessageSquare, X, Send, Loader2, Minimize2,
  Plus, ChevronLeft, AlertCircle, Zap
} from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

// ─── Types ───────────────────────────────────────────────
type Urgency = 'HIGH' | 'MEDIUM' | 'LOW'
type View = 'home' | 'new' | 'chat'
interface TicketMsg  { id:string; role:'user'|'admin'; text:string; time:string }
interface Ticket     { id:string; title:string; type:string; urgency:Urgency; preview:string; updatedAt:string; msgs:TicketMsg[] }

// ─── Helpers ─────────────────────────────────────────────
const nowT = () => new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})

function detectUrgency(text:string): Urgency {
  const t = text.toLowerCase()
  if (['付款','扣费','退款','封号','无法登录','紧急'].some(k=>t.includes(k))) return 'HIGH'
  if (['bug','报错','异常','无法','不能'].some(k=>t.includes(k))) return 'MEDIUM'
  return 'LOW'
}

const URGENCY: Record<Urgency,{label:string;cls:string}> = {
  HIGH:   { label:'🔴 高优', cls:'text-red-400 bg-red-500/15 border-red-500/40' },
  MEDIUM: { label:'🟡 普通', cls:'text-amber-400 bg-amber-500/15 border-amber-500/40' },
  LOW:    { label:'⚪ 低优', cls:'text-slate-400 bg-slate-500/15 border-slate-500/40' },
}

const TYPES = ['账单/充值','技术问题','账户问题','功能建议','其他']

const INIT_MSGS: TicketMsg[] = [
  { id:'a1', role:'admin', text:'👋 你好！这里是 LeadPilot 支持终端。', time:'--:--' },
  { id:'a2', role:'admin', text:'你可以发起新工单，我们会尽快跟进处理。', time:'--:--' },
]

// ─── Badge ───────────────────────────────────────────────
function UBadge({u}:{u:Urgency}) {
  const c = URGENCY[u]
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${c.cls}`}>{c.label}</span>
}

// ─── 常量 ───────────────────────────────────────────────
const FAB_SIZE = 56
const EDGE_PADDING = 20
const DRAG_THRESHOLD = 5
const PANEL_WIDTH = 800
const PANEL_HEIGHT = 600

// ════════════════════════════════════════════════════════════════════════════════
// 关闭确认弹窗组件
// ════════════════════════════════════════════════════════════════════════════════
function CloseConfirmModal({ 
  onCancel, 
  onConfirm 
}: { 
  onCancel: () => void
  onConfirm: () => void 
}) {
  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/50"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="w-[400px] rounded-2xl overflow-hidden"
        style={{
          background: 'rgba(15, 20, 35, 0.98)',
          backdropFilter: 'blur(32px)',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-red-400"/>
            </div>
            <div>
              <h3 className="text-base font-bold text-white">确定要结束对话吗？</h3>
              <p className="text-xs text-slate-400 mt-0.5">此操作无法撤销</p>
            </div>
          </div>
        </div>
        
        <div className="px-6 pb-4">
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <p className="text-sm text-amber-200">
              关闭后，当前对话将被终结，您只能在历史记录中查看。
            </p>
          </div>
        </div>
        
        <div className="flex gap-3 p-6 pt-4 border-t border-white/8">
          <button
            onClick={onCancel}
            className="flex-1 py-3 px-4 rounded-xl bg-white/8 hover:bg-white/12 text-slate-300 font-medium text-sm transition-all"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-3 px-4 rounded-xl bg-red-500 hover:bg-red-400 text-white font-medium text-sm transition-all"
          >
            确定结束
          </button>
        </div>
      </motion.div>
    </motion.div>,
    document.body
  )
}

// ════════════════════════════════════════════════════════════════════════════════
// 客服面板组件（独立渲染，使用 Portal）
// ════════════════════════════════════════════════════════════════════════════════
function ChatPanel({
  isPanelOpen,
  view,
  setView,
  tickets,
  loading,
  activeId,
  setActiveId,
  onMinimize,
  onRequestClose,
  bottomRef,
  chatInput,
  setChatInput,
  chatSending,
  sendChat,
  ntTitle,
  setNtTitle,
  ntType,
  setNtType,
  ntDesc,
  setNtDesc,
  ntSending,
  submitTicket,
  loadTickets,
}: {
  isPanelOpen: boolean
  view: View
  setView: (v: View) => void
  tickets: Ticket[]
  loading: boolean
  activeId: string | null
  setActiveId: (id: string | null) => void
  onMinimize: () => void
  onRequestClose: () => void
  bottomRef: React.RefObject<HTMLDivElement>
  chatInput: string
  setChatInput: (v: string) => void
  chatSending: boolean
  sendChat: () => void
  ntTitle: string
  setNtTitle: (v: string) => void
  ntType: string
  setNtType: (v: string) => void
  ntDesc: string
  setNtDesc: (v: string) => void
  ntSending: boolean
  submitTicket: () => void
  loadTickets: () => void
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const panelDragRef = useRef({
    isDragging: false,
    offsetX: 0,
    offsetY: 0,
  })

  const [panelPos, setPanelPos] = useState<{ x: number; y: number } | null>(null)

  const handlePanelHeaderMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    const target = e.target as HTMLElement
    if (target.closest('button')) return
    
    e.preventDefault()
    e.stopPropagation()
    
    const ref = panelDragRef.current
    ref.isDragging = true

    if (panelRef.current) {
      const rect = panelRef.current.getBoundingClientRect()
      ref.offsetX = e.clientX - rect.left
      ref.offsetY = e.clientY - rect.top
      setPanelPos({ x: rect.left, y: rect.top })
    }

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!panelDragRef.current.isDragging) return
      
      const newX = moveEvent.clientX - panelDragRef.current.offsetX
      const newY = moveEvent.clientY - panelDragRef.current.offsetY
      
      const clampedX = Math.max(0, Math.min(newX, window.innerWidth - PANEL_WIDTH))
      const clampedY = Math.max(0, Math.min(newY, window.innerHeight - PANEL_HEIGHT))
      
      setPanelPos({ x: clampedX, y: clampedY })
    }

    const handleMouseUp = (upEvent: MouseEvent) => {
      upEvent.preventDefault()
      upEvent.stopPropagation()
      panelDragRef.current.isDragging = false
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }, [])

  const handleMinimizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
  }, [])

  const handleCloseClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    onRequestClose()
  }, [onRequestClose])

  const activeTicket = useMemo(() => tickets.find(t => t.id === activeId) ?? null, [tickets, activeId])

  const HomeView = (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-white/8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">A</div>
          <div><p className="text-sm font-semibold text-white">专属顾问 Alex</p><p className="text-xs text-emerald-400 flex items-center gap-1"><motion.span animate={{opacity:[1,0.3,1]}} transition={{duration:2,repeat:Infinity}} className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"/>实时在线</p></div>
        </div>
        <motion.button whileHover={{scale:1.02}} whileTap={{scale:0.98}}
          onClick={()=>setView('new')}
          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 transition-all"
        ><Plus className="w-4 h-4"/>新建问题反馈 / 发起对话</motion.button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-3"><p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">历史工单</p></div>
        {loading ? (
          <div className="text-center py-10 text-slate-600">加载中...</div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-10 text-slate-600">暂无工单记录</div>
        ) : tickets.map(t => (
          <motion.div key={t.id} whileHover={{x:4}} onClick={() => setActiveId(t.id)}
            className="mx-3 mb-2 p-4 rounded-2xl bg-white/4 border border-white/8 cursor-pointer hover:bg-white/6 transition-all"
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <span className="text-sm font-semibold text-white leading-snug">{t.title}</span>
              <span className="text-xs text-slate-500 flex-shrink-0">{t.updatedAt}</span>
            </div>
            <p className="text-xs text-slate-500 truncate mb-2">{t.preview}</p>
            <div className="flex items-center gap-2"><UBadge u={t.urgency}/><span className="text-xs text-slate-600">{t.type}</span></div>
          </motion.div>
        ))}
      </div>
    </div>
  )

  const NewView = (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 p-5 border-b border-white/8">
        <button onClick={() => setView('home')} className="text-slate-400 hover:text-white transition-colors"><ChevronLeft className="w-5 h-5"/></button>
        <h3 className="text-base font-bold text-white">新建问题反馈</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        <div><p className="text-xs font-medium text-slate-400 mb-2">问题标题 *</p>
          <input value={ntTitle} onChange={e => setNtTitle(e.target.value)} placeholder="一句话描述您的问题"
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/60 transition-all"
          /></div>
        <div><p className="text-xs font-medium text-slate-400 mb-2">问题分类</p>
          <div className="grid grid-cols-3 gap-2">
            {TYPES.map(tp => (
              <button key={tp} onClick={() => setNtType(tp)}
                className={`py-2 px-3 rounded-xl text-xs font-medium border transition-all ${
                  ntType === tp ? 'bg-blue-500/20 border-blue-500/50 text-blue-300' : 'bg-white/4 border-white/8 text-slate-400 hover:text-white'
                }`}
              >{tp}</button>
            ))}
          </div></div>
        <div><p className="text-xs font-medium text-slate-400 mb-2">详细描述（选填）</p>
          <textarea value={ntDesc} onChange={e => setNtDesc(e.target.value)} rows={5}
            placeholder="请详细描述问题，包括操作步骤、截图说明等…"
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 resize-none focus:outline-none focus:border-blue-500/60 transition-all"
          /></div>
        {(ntTitle || ntDesc) && (
          <motion.div initial={{opacity:0,y:-4}} animate={{opacity:1,y:0}}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-semibold ${URGENCY[detectUrgency(ntTitle + ' ' + ntDesc)].cls}`}
          ><Zap className="w-3.5 h-3.5"/>AI 预判：{URGENCY[detectUrgency(ntTitle + ' ' + ntDesc)].label}</motion.div>
        )}
      </div>
      <div className="p-5 border-t border-white/8">
        <motion.button whileHover={{scale:1.02}} whileTap={{scale:0.97}}
          onClick={submitTicket} disabled={!ntTitle.trim() || ntSending}
          className="w-full py-3.5 rounded-2xl font-bold text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:opacity-40 flex items-center justify-center gap-2 transition-all"
        >{ntSending ? <><Loader2 className="w-4 h-4 animate-spin"/>提交中…</> : <><Send className="w-4 h-4"/>提交工单</>}</motion.button>
      </div>
    </div>
  )

  const ChatView = (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/8 flex-shrink-0">
        <button onClick={() => setView('home')} className="text-slate-400 hover:text-white transition-colors"><ChevronLeft className="w-5 h-5"/></button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white truncate">{activeTicket?.title}</p>
          <p className="text-xs text-slate-500">{activeTicket?.type}</p>
        </div>
        {activeTicket ? <UBadge u={activeTicket.urgency ?? 'LOW'}/> : null}
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {(activeTicket?.msgs ?? []).map((m, i) => (
          <motion.div key={m.id} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:i*0.03}}
            className={`flex gap-2 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 ${
              m.role === 'admin' ? 'bg-gradient-to-br from-blue-500 to-purple-600 text-white' : 'bg-slate-700 text-slate-300'
            }`}>{m.role === 'admin' ? 'A' : 'U'}</div>
            <div className={`flex flex-col gap-0.5 max-w-[75%] ${m.role === 'user' ? 'items-end' : ''}`}>
              <div className={`px-4 py-2.5 text-sm leading-relaxed rounded-2xl ${
                m.role === 'user' ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-white/8 border border-white/10 text-slate-200 rounded-bl-sm'
              }`}>{m.text}</div>
              <span className="text-xs text-slate-600 px-1">{m.time}</span>
            </div>
          </motion.div>
        ))}
        {chatSending && (
          <div className="flex gap-2">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">A</div>
            <div className="bg-white/8 border border-white/10 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1">
              {[0, 1, 2].map(i => (
                <motion.span key={i} animate={{y: [0, -4, 0]}} transition={{duration: 0.6, repeat: Infinity, delay: i * 0.15}} className="w-1.5 h-1.5 rounded-full bg-slate-400 inline-block"/>
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>
      <div className="px-5 pb-5 pt-3 border-t border-white/8 flex-shrink-0">
        <div className="flex items-end gap-2 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 focus-within:border-blue-500/40 transition-colors">
          <textarea value={chatInput} onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat() } }}
            placeholder="追问或补充说明… (Enter 发送)" rows={2}
            className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 resize-none focus:outline-none leading-relaxed"
          />
          <motion.button whileHover={{scale:1.1}} whileTap={{scale:0.9}} onClick={sendChat} disabled={!chatInput.trim() || chatSending}
            className="w-9 h-9 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 flex items-center justify-center text-white flex-shrink-0 transition-colors"
          >{chatSending ? <Loader2 className="w-4 h-4 animate-spin"/> : <Send className="w-4 h-4"/>}</motion.button>
        </div>
      </div>
    </div>
  )

  const panelContainerStyle: React.CSSProperties = panelPos === null
    ? {
        position: 'fixed' as const,
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        margin: 0,
        padding: 0,
        zIndex: 99999,
      }
    : {
        position: 'fixed' as const,
        left: panelPos.x,
        top: panelPos.y,
        margin: 0,
        padding: 0,
        zIndex: 99999,
      }

  const panelContent = (
    <div
      ref={panelRef}
      className="w-[800px] h-[600px] flex flex-col rounded-3xl overflow-hidden"
      style={{
        background: 'rgba(8,14,30,0.96)',
        backdropFilter: 'blur(32px)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 32px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.06)',
      }}
    >
      <div 
        onMouseDown={handlePanelHeaderMouseDown}
        className="flex items-center gap-4 px-6 py-4 border-b border-white/6 flex-shrink-0 cursor-move active:cursor-moving select-none"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="relative">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold">A</div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#080e1e]"/>
          </div>
          <div>
            <p className="text-sm font-bold text-white">LeadPilot 客服聚合终端</p>
            <p className="text-xs text-emerald-400 flex items-center gap-1">
              <motion.span animate={{opacity:[1,0.3,1]}} transition={{duration:2,repeat:Infinity}} className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"/>
              实时在线 · 工作日 09:00–22:00
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={onMinimize}
            onMouseDown={handleMinimizeMouseDown}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all"
            title="最小化（挂起会话）"
          >
            <Minimize2 className="w-4 h-4"/>
          </button>
          <button 
            onClick={handleCloseClick}
            onMouseDown={(e) => { e.stopPropagation(); e.preventDefault() }}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-red-500/20 flex items-center justify-center text-slate-400 hover:text-red-400 transition-all"
            title="结束对话"
          >
            <X className="w-4 h-4"/>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          {view === 'home' && (
            <motion.div key="home" initial={{opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}} className="h-full">
              {HomeView}
            </motion.div>
          )}
          {view === 'new' && (
            <motion.div key="new" initial={{opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}} className="h-full">
              {NewView}
            </motion.div>
          )}
          {view === 'chat' && (
            <motion.div key="chat" initial={{opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}} className="h-full">
              {ChatView}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="px-6 py-2 border-t border-white/6 flex items-center justify-between bg-white/1 flex-shrink-0">
        <p className="text-xs text-slate-600">LeadPilot Support Terminal v2.0</p>
        <p className="text-xs text-slate-600">AI 紧急度自动分级 · 端对端加密</p>
      </div>
    </div>
  )

  if (!isPanelOpen) return null

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      style={panelContainerStyle}
    >
      {panelContent}
    </motion.div>,
    document.body
  )
}

// ════════════════════════════════════════════════════════════════════════════════
// 主组件：悬浮球 + 客服面板
// ════════════════════════════════════════════════════════════════════════════════
export default function FeedbackButton() {
  const { toast } = useToast()

  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [isSessionActive, setIsSessionActive] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)
  const [view, setView] = useState<View>('home')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(false)
  const [ntTitle, setNtTitle] = useState('')
  const [ntType, setNtType] = useState(TYPES[0])
  const [ntDesc, setNtDesc] = useState('')
  const [ntSending, setNtSending] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [chatSending, setChatSending] = useState(false)
  
  const bottomRef = useRef<HTMLDivElement>(null)
  const pendingIdsRef = useRef<Set<string>>(new Set())

  const fabRef = useRef<HTMLDivElement>(null)
  const fabDragRef = useRef({ 
    isDragging: false, 
    isClick: true,
    startX: 0, 
    startY: 0,
    offsetX: 0,
    offsetY: 0
  })
  
  const [fabStyle, setFabStyle] = useState<React.CSSProperties>({
    bottom: EDGE_PADDING,
    right: EDGE_PADDING,
    left: 'auto',
    top: 'auto',
    transition: 'right 0.3s ease, left 0.3s ease, bottom 0.3s ease, top 0.3s ease',
  })

  const handleFabMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    
    const ref = fabDragRef.current
    ref.isDragging = false
    ref.isClick = true
    ref.startX = e.clientX
    ref.startY = e.clientY
    
    if (fabRef.current) {
      const rect = fabRef.current.getBoundingClientRect()
      ref.offsetX = e.clientX - rect.left
      ref.offsetY = e.clientY - rect.top
    }

    setFabStyle(prev => ({ ...prev, transition: 'none' }))

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const ref = fabDragRef.current
      const dx = moveEvent.clientX - ref.startX
      const dy = moveEvent.clientY - ref.startY
      const distance = Math.sqrt(dx * dx + dy * dy)
      
      if (distance > DRAG_THRESHOLD) {
        ref.isDragging = true
        ref.isClick = false
      }
      
      if (ref.isDragging) {
        const newX = moveEvent.clientX - ref.offsetX
        const newY = moveEvent.clientY - ref.offsetY
        const clampedY = Math.max(20, Math.min(newY, window.innerHeight - FAB_SIZE - 20))
        
        setFabStyle({
          left: newX,
          right: 'auto',
          top: clampedY,
          bottom: 'auto',
          transition: 'none',
        })
      }
    }

    const handleMouseUp = (upEvent: MouseEvent) => {
      upEvent.preventDefault()
      upEvent.stopPropagation()
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)

      const ref = fabDragRef.current
      const dx = upEvent.clientX - ref.startX
      const dy = upEvent.clientY - ref.startY
      const distance = Math.sqrt(dx * dx + dy * dy)

      if (distance > DRAG_THRESHOLD) {
        ref.isDragging = true
        ref.isClick = false
      } else {
        ref.isDragging = false
        ref.isClick = true
      }

      if (ref.isDragging && fabRef.current) {
        const rect = fabRef.current.getBoundingClientRect()
        const centerX = rect.left + rect.width / 2
        const screenMid = window.innerWidth / 2
        const currentTop = rect.top

        if (centerX < screenMid) {
          setFabStyle({
            left: EDGE_PADDING,
            right: 'auto',
            top: currentTop,
            bottom: 'auto',
            transition: 'left 0.3s ease, right 0.3s ease, top 0.3s ease, bottom 0.3s ease',
          })
        } else {
          setFabStyle({
            left: 'auto',
            right: EDGE_PADDING,
            top: currentTop,
            bottom: 'auto',
            transition: 'left 0.3s ease, right 0.3s ease, top 0.3s ease, bottom 0.3s ease',
          })
        }
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }, [])

  const handleFabClick = useCallback((e: React.MouseEvent) => {
    if (!fabDragRef.current.isClick) {
      e.preventDefault()
      e.stopPropagation()
      fabDragRef.current.isClick = true
      return
    }
    setIsPanelOpen(true)
    setUnreadCount(0)
  }, [])

  const handleMinimize = useCallback(() => {
    setIsPanelOpen(false)
  }, [])

  const handleRequestClose = useCallback(() => {
    setShowCloseConfirm(true)
  }, [])

  const handleConfirmClose = useCallback(() => {
    setShowCloseConfirm(false)
    setIsPanelOpen(false)
    setIsSessionActive(false)
    setActiveId(null)
    setView('home')
    setChatInput('')
    setNtTitle('')
    setNtType(TYPES[0])
    setNtDesc('')
    setUnreadCount(0)
  }, [])

  const loadTickets = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await fetch('/api/tickets')
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || '加载失败')
      const mapped: Ticket[] = (data?.tickets || []).map((t: any) => {
        const msgs: TicketMsg[] = (t.messages || []).map((m: any, idx: number) => ({
          id: m.id || `${t.id}-${idx}`,
          role: m.role === 'admin' ? 'admin' : 'user',
          text: String(m.content || ''),
          time: m.createdAt ? new Date(m.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '--:--',
        }))
        const previewMsg = msgs.slice().reverse().find(x => x.role === 'user' || x.role === 'admin')
        const urgency = detectUrgency(t.title)
        return {
          id: t.id,
          title: t.title,
          type: t.type || '其他',
          urgency,
          preview: previewMsg ? `${previewMsg.role === 'admin' ? '客服' : '您'}：${previewMsg.text.slice(0, 30)}…` : '—',
          updatedAt: t.updatedAt ? new Date(t.updatedAt).toLocaleString('zh-CN') : '—',
          msgs,
        }
      })
      setTickets(prev => {
        if (!silent) return mapped
        return prev.map(pt => {
          const fresh = mapped.find(m => m.id === pt.id)
          if (!fresh) return pt
          const merged = [...pt.msgs.filter(m => pendingIdsRef.current.has(m.id)), ...fresh.msgs]
          return { ...fresh, msgs: merged }
        })
      })
    } catch (e: any) {
      if (!silent) toast({ title: '加载工单失败', description: e?.message || '请稍后重试', variant: 'destructive' })
      if (!silent) setTickets([])
    } finally {
      if (!silent) setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    if (isPanelOpen) {
      loadTickets()
    }
  }, [isPanelOpen, loadTickets])

  // ────────────────────────────────────────────────────────────────────────
  // 静默轮询：新消息通知（即使面板关闭也持续运行，保护 UI 状态）
  // ────────────────────────────────────────────────────────────────────────
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const isPanelOpenRef = useRef(isPanelOpen)

  // 保持 ref 同步最新值
  useEffect(() => {
    isPanelOpenRef.current = isPanelOpen
  }, [isPanelOpen])

  useEffect(() => {
    // 每次 tick：静默拉取工单，检查是否有新的 admin 回复，更新未读计数
    const silentPoll = async () => {
      try {
        const res = await fetch('/api/tickets')
        if (!res.ok) return
        const data = await res.json()
        const freshTickets: Ticket[] = (data?.tickets || []).map((t: any) => {
          const msgs: TicketMsg[] = (t.messages || []).map((m: any, idx: number) => ({
            id: m.id || `${t.id}-${idx}`,
            role: m.role === 'admin' ? 'admin' : 'user',
            text: String(m.content || ''),
            time: m.createdAt ? new Date(m.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '--:--',
          }))
          return { id: t.id, msgs }
        })

        setTickets(prev => {
          let hasNewAdminMsg = false
          const merged = prev.map(pt => {
            const fresh = freshTickets.find(f => f.id === pt.id)
            if (!fresh) return pt
            const oldIds = new Set(pt.msgs.map(m => m.id))
            const newAdminMsgs = fresh.msgs.filter(m => m.role === 'admin' && !oldIds.has(m.id))
            if (newAdminMsgs.length > 0) hasNewAdminMsg = true
            return { ...pt, msgs: [...pt.msgs, ...newAdminMsgs] }
          })
          // 如果有新消息且面板关闭，增加未读计数
          if (hasNewAdminMsg && !isPanelOpenRef.current) {
            setUnreadCount((c: number) => c + 1)
          }
          return merged
        })
      } catch {
        // 静默失败，不影响用户
      }
    }

    // 启动静默轮询（每 3 秒）
    pollingIntervalRef.current = setInterval(silentPoll, 3000)

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
    }
  }, [])

  // chat 视图滚动到底部（新消息时自动滚动）
  useEffect(() => {
    if (view === 'chat') {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [view])

  const openTicket = useCallback((id: string) => { 
    setActiveId(id)
    setIsSessionActive(true)
    setView('chat') 
  }, [])

  const submitTicket = useCallback(async () => {
    if (!ntTitle.trim()) return
    setNtSending(true)
    try {
      const urgency = detectUrgency(ntTitle + ' ' + ntDesc)
      const priority = urgency === 'HIGH' ? 'URGENT' : urgency === 'MEDIUM' ? 'HIGH' : 'NORMAL'
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: ntTitle.trim(), type: ntType, content: ntDesc.trim(), priority }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || '提交失败')
      toast({ title: '✅ 工单已提交', description: '我们会尽快处理你的问题' })
      setNtTitle('')
      setNtType(TYPES[0])
      setNtDesc('')
      await loadTickets()
      if (data?.ticketId) { 
        setActiveId(data.ticketId)
        setIsSessionActive(true)
        setView('chat') 
      } else { 
        setView('home') 
      }
    } catch (e: any) {
      toast({ title: '❌ 提交失败', description: e?.message || '请稍后重试', variant: 'destructive' })
    } finally {
      setNtSending(false)
    }
  }, [ntTitle, ntType, ntDesc, toast, loadTickets])

  const sendChat = useCallback(async () => {
    if (!chatInput.trim() || !activeId || chatSending) return
    const text = chatInput.trim()
    setChatInput('')
    setChatSending(true)
    const userMsg: TicketMsg = { id: `u-${Date.now()}`, role: 'user', text, time: nowT() }
    pendingIdsRef.current.add(userMsg.id)
    setTickets(p => p.map(t => t.id !== activeId ? t : { ...t, msgs: [...t.msgs, userMsg] }))
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 30)
    try {
      const res = await fetch(`/api/tickets/${activeId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || '发送失败')
      pendingIdsRef.current.delete(userMsg.id)
      await loadTickets()
    } catch (e: any) {
      pendingIdsRef.current.delete(userMsg.id)
      setTickets(p => p.map(t => t.id !== activeId ? t : { ...t, msgs: t.msgs.filter(m => m.id !== userMsg.id) }))
      setChatInput(text)
      toast({ title: '❌ 发送失败', description: e?.message || '请稍后重试', variant: 'destructive' })
    } finally {
      setChatSending(false)
    }
  }, [chatInput, activeId, chatSending, toast, loadTickets])

  return (
    <>
      <div
        ref={fabRef}
        onMouseDown={handleFabMouseDown}
        onClick={handleFabClick}
        className="fixed z-[9999] cursor-grab active:cursor-grabbing select-none"
        style={{
          width: FAB_SIZE,
          height: FAB_SIZE,
          ...fabStyle,
        }}
      >
        <motion.div
          animate={{
            scale: fabDragRef.current.isDragging ? 1.15 : 1,
          }}
          transition={{
            type: 'spring',
            stiffness: 400,
            damping: 25,
          }}
          className="w-full h-full bg-gradient-to-br from-blue-600 to-purple-600 rounded-full shadow-2xl shadow-blue-500/40 flex items-center justify-center text-white relative"
        >
          <MessageSquare className="w-6 h-6"/>
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-400 rounded-full border-2 border-slate-950"/>
          
          {!isPanelOpen && unreadCount > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 rounded-full border-2 border-slate-950 flex items-center justify-center"
            >
              <span className="text-[10px] font-bold text-white leading-none">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            </motion.span>
          )}
        </motion.div>
      </div>

      <ChatPanel
        isPanelOpen={isPanelOpen}
        view={view}
        setView={setView}
        tickets={tickets}
        loading={loading}
        activeId={activeId}
        setActiveId={setActiveId}
        onMinimize={handleMinimize}
        onRequestClose={handleRequestClose}
        bottomRef={bottomRef}
        chatInput={chatInput}
        setChatInput={setChatInput}
        chatSending={chatSending}
        sendChat={sendChat}
        ntTitle={ntTitle}
        setNtTitle={setNtTitle}
        ntType={ntType}
        setNtType={setNtType}
        ntDesc={ntDesc}
        setNtDesc={setNtDesc}
        ntSending={ntSending}
        submitTicket={submitTicket}
        loadTickets={loadTickets}
      />

      <AnimatePresence>
        {showCloseConfirm && (
          <CloseConfirmModal
            onCancel={() => setShowCloseConfirm(false)}
            onConfirm={handleConfirmClose}
          />
        )}
      </AnimatePresence>
    </>
  )
}
