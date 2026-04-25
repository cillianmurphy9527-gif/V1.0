"use client"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  FileText, FileType, Globe, Upload, Trash2,
  ChevronDown, ChevronRight, CheckCircle2, Plus,
  Zap, Eye, Database, Bot, User, Send, Loader2, X
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"

type FileCategory = 'PDF' | 'WORD' | 'LINK'
type ParseStatus  = 'PENDING' | 'PARSING' | 'READY' | 'FAILED'

interface DocumentChunk { id: string; index: number; content: string; tokenCount: number }
interface KBFile {
  id: string; name: string; category: FileCategory; status: ParseStatus
  chunkCount: number; fileSizeBytes?: number; vectorizedAt?: string
  sourceUrl?: string; progress?: number; chunks?: DocumentChunk[]
}
interface QAMessage { id: string; role: 'user' | 'assistant'; content: string; timestamp: string }

const CAT = {
  PDF:  { label: 'PDF 产品手册', Icon: FileText, color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  accept: '.pdf' },
  WORD: { label: 'Word 报价单',  Icon: FileType,  color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', accept: '.doc,.docx' },
  LINK: { label: '公司官网链接', Icon: Globe,     color: '#10b981', bg: 'rgba(16,185,129,0.12)', accept: '' },
} as const

const STA = {
  PENDING: { label: '等待解析', cls: 'text-slate-400',   dot: 'bg-slate-500' },
  PARSING: { label: '解析中',   cls: 'text-blue-400',    dot: 'bg-blue-400 animate-pulse' },
  READY:   { label: '已就绪',   cls: 'text-emerald-400', dot: 'bg-emerald-400' },
  FAILED:  { label: '解析失败', cls: 'text-red-400',     dot: 'bg-red-400' },
} as const

const INIT_QA: QAMessage[] = [
  { id: 'sys', role: 'assistant', timestamp: '—', content: '你好！我会严格基于你的知识库内容作答；如果知识库没有依据，我会直接说明未找到。' },
]

const fmtB = (b?: number) =>
  !b ? '—' : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`
const nowT = () => new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })

export default function KnowledgeBasePage() {
  const [files, setFiles]       = useState<KBFile[]>([])
  const [link, setLink]         = useState('')
  const [drag, setDrag]         = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [showQA, setShowQA]     = useState(false)
  const [msgs, setMsgs]         = useState<QAMessage[]>(INIT_QA)
  const [qaVal, setQaVal]       = useState('')
  const [qaLoad, setQaLoad]     = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const endRef  = useRef<HTMLDivElement>(null)
  const { toast } = useToast()

  // 初次加载
  useEffect(() => {
    loadKnowledgeBases()
  }, [])

  // 🚨 核心修复：智能轮询心跳机制
  // 只要列表中有处于“PARSING”状态的任务，就每隔 3 秒自动刷新一次，实现进度条自动走完
  useEffect(() => {
    const isParsing = files.some(f => f.status === 'PARSING')
    let interval: NodeJS.Timeout

    if (isParsing) {
      interval = setInterval(() => {
        loadKnowledgeBases(true) // 传入 true 表示后台静默刷新，不打扰用户其他操作
      }, 3000)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [files])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  const loadKnowledgeBases = async (silent = false) => {
    try {
      const response = await fetch('/api/knowledge-base/upload')
      if (response.ok) {
        const data = await response.json()
        setFiles(data.knowledgeBases || [])
      }
    } catch (error) {
      if (!silent) {
        console.error('Failed to load knowledge bases:', error)
        toast({
          title: "加载失败",
          description: "无法加载知识库列表",
          variant: "destructive",
        })
      }
    }
  }

  const totalChunks = files.filter(f => f.status === 'READY').reduce((a, f) => a + f.chunkCount, 0)
  const readyCount  = files.filter(f => f.status === 'READY').length

  const toggle = (id: string) =>
    setExpanded(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, cat: FileCategory) => {
    const file = e.target.files?.[0]
    if (!file) return

    const formData = new FormData()
    formData.append('file', file)
    formData.append('fileType', cat)

    try {
      const response = await fetch('/api/knowledge-base/upload', {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        const data = await response.json()
        toast({ title: "✅ 上传成功", description: data.message })
        const kb = data.knowledgeBase
        if (kb) {
          setFiles(prev => [{
            id: kb.id,
            name: kb.name,
            category: (kb.fileType || cat) as FileCategory,
            status: 'PARSING' as ParseStatus,
            chunkCount: 0,
            fileSizeBytes: kb.fileSizeBytes,
          }, ...prev])
        }
      } else {
        const error = await response.json()
        toast({ title: "上传失败", description: error.error || "请稍后重试", variant: "destructive" })
      }
    } catch (error) {
      toast({ title: "上传失败", description: "网络错误，请稍后重试", variant: "destructive" })
    }
  }

  const handleLinkSubmit = async (overrideUrl?: string) => {
    const url = overrideUrl ?? link
    if (!url.trim()) {
      toast({ title: "输入无效", description: "请输入有效的链接地址", variant: "destructive" })
      return
    }

    try {
      const formData = new FormData()
      formData.append('fileType', 'LINK')
      formData.append('sourceUrl', url)

      const response = await fetch('/api/knowledge-base/upload', {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        const data = await response.json()
        toast({ title: "✅ 链接已添加", description: data.message })
        setLink('')
        const kb = data.knowledgeBase
        if (kb) {
          setFiles(prev => [{
            id: kb.id,
            name: kb.name || url,
            category: 'LINK' as FileCategory,
            status: 'PARSING' as ParseStatus, // 强制状态为解析中，触发自动轮询
            chunkCount: 0,
            sourceUrl: kb.sourceUrl,
          }, ...prev])
        }
      } else {
        const error = await response.json()
        toast({ title: "添加失败", description: error.error || "请稍后重试", variant: "destructive" })
      }
    } catch (error) {
      toast({ title: "添加失败", description: "网络错误，请稍后重试", variant: "destructive" })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个知识库吗？')) return

    try {
      const response = await fetch(`/api/knowledge-base/upload?id=${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast({ title: "✅ 删除成功", description: "知识库已删除" })
        loadKnowledgeBases()
      } else {
        const error = await response.json()
        toast({ title: "删除失败", description: error.error || "请稍后重试", variant: "destructive" })
      }
    } catch (error) {
      toast({ title: "删除失败", description: "网络错误，请稍后重试", variant: "destructive" })
    }
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 10 * 1024 * 1024) {
      toast({ title: '文件超过 10MB 限制', variant: 'destructive' })
      return
    }
    handleFileUpload(e, 'PDF')
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDrag(false)
    const f = e.dataTransfer.files?.[0]
    if (!f) return
    if (f.size > 10 * 1024 * 1024) {
      toast({ title: '文件超过 10MB 限制', variant: 'destructive' })
      return
    }
    const name = f.name.toLowerCase()
    const cat: FileCategory = name.endsWith('.pdf') ? 'PDF' : 'WORD'
    const input = document.createElement('input')
    input.type = 'file'
    const dt = new DataTransfer()
    dt.items.add(f)
    input.files = dt.files
    handleFileUpload({ target: input } as any, cat)
  }

  const handleAddLink = () => {
    if (!link.trim()) return
    let normalized = link.trim()
    if (!/^https?:\/\//i.test(normalized)) {
      normalized = 'https://' + normalized
    }
    try { new URL(normalized) } catch (_e) {
      toast({ title: '请输入有效的网址', variant: 'destructive' })
      return
    }
    handleLinkSubmit(normalized)
  }

  const handleQA = async () => {
    if (!qaVal.trim() || qaLoad) return
    const q: QAMessage = { id: `u-${Date.now()}`, role: 'user', content: qaVal, timestamp: nowT() }
    setMsgs(p => [...p, q]); setQaVal(''); setQaLoad(true)
    try {
      const res = await fetch('/api/knowledge-base/qa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q.content }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || '问答失败')
      const a: QAMessage = { id: `a-${Date.now()}`, role: 'assistant', content: data.answer || '知识库中未找到依据', timestamp: nowT() }
      setMsgs(p => [...p, a])
    } catch (error: any) {
      const a: QAMessage = { id: `a-${Date.now()}`, role: 'assistant', content: `问答失败：${error?.message || '请稍后重试'}`, timestamp: nowT() }
      setMsgs(p => [...p, a])
    } finally {
      setQaLoad(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="container mx-auto px-6 py-8">

        {/* 页头 */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold flex items-center gap-3 mb-2">
              <Database className="w-9 h-9 text-blue-400" />
              知识库管理
            </h1>
            <p className="text-slate-400">上传产品文档，AI 自动向量化切片，赋予开发信专业深度与精准度</p>
          </div>
          <Button
            onClick={() => setShowQA(v => !v)}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-500/20"
          >
            <Bot className="w-4 h-4" />
            {showQA ? '收起测试面板' : '知识库问答测试'}
          </Button>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: '文档总数',     value: files.length, Icon: FileText,     color: '#3b82f6' },
            { label: '已就绪',       value: readyCount,   Icon: CheckCircle2, color: '#10b981' },
            { label: '语义切片总数', value: totalChunks,  Icon: Zap,          color: '#f97316' },
          ].map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 flex items-center gap-4"
            >
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${s.color}20` }}>
                <s.Icon className="w-6 h-6" style={{ color: s.color }} />
              </div>
              <div>
                <div className="text-2xl font-bold">{s.value}</div>
                <div className="text-xs text-slate-500">{s.label}</div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className={`grid gap-6 ${showQA ? 'lg:grid-cols-3' : 'grid-cols-1'}`}>

          {/* ══ 主列：上传 + 文档列表 ══ */}
          <div className={showQA ? 'lg:col-span-2 space-y-6' : 'space-y-6'}>

            {/* ── 区域1：上传产品资料 ── */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6"
            >
              <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-5">
                <Upload className="w-5 h-5 text-blue-400" />
                上传产品资料
              </h2>

              <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" onChange={handleFile} className="hidden" />

              {/* 拖拽上传区 */}
              <div
                onDragOver={e => { e.preventDefault(); setDrag(true) }}
                onDragLeave={() => setDrag(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all mb-5 ${
                  drag ? 'border-blue-500 bg-blue-500/10' : 'border-slate-700 hover:border-slate-500 hover:bg-slate-800/30'
                }`}
              >
                <motion.div
                  animate={{ y: drag ? -4 : 0 }}
                  transition={{ type: 'spring', stiffness: 300 }}
                >
                  <Upload className="w-10 h-10 mx-auto mb-3 text-slate-500" />
                  <p className="text-base text-slate-400 font-medium">拖拽 PDF / Word 到此处，或点击上传</p>
                  <p className="text-xs text-slate-600 mt-1">最大 10MB · 支持 .pdf .doc .docx</p>
                </motion.div>
              </div>

              {/* 链接添加 */}
              <div className="flex gap-2">
                <input
                  type="url" value={link} onChange={e => setLink(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddLink()}
                  placeholder="https://your-website.com（自动爬取并切片）"
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                />
                <button
                  onClick={handleAddLink}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-medium transition-all flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" />添加链接
                </button>
              </div>
            </motion.div>

            {/* ── 区域2：已上传文档列表（白盒切片查看）── */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-slate-800 flex items-center gap-2">
                <Eye className="w-5 h-5 text-purple-400" />
                <h2 className="font-semibold text-white">已上传文档 · 白盒切片查看</h2>
                <span className="ml-auto text-xs text-slate-500">{files.length} 个文件</span>
              </div>

              <div className="divide-y divide-slate-800/60">
                <AnimatePresence>
                  {files.length === 0 ? (
                    <div className="text-center py-16 text-slate-600">
                      <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">暂无文档，请上传产品资料</p>
                    </div>
                  ) : files.map(file => {
                    const isExp = expanded.has(file.id)
                    const Ic = CAT[file.category].Icon
                    return (
                      <motion.div key={file.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                        {/* 文件行 */}
                        <div className="flex items-center gap-3 px-6 py-4 hover:bg-slate-800/30 transition-all">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ background: CAT[file.category].bg }}>
                            <Ic className="w-4 h-4" style={{ color: CAT[file.category].color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{file.name}</p>
                            <div className="flex items-center gap-3 mt-1">
                              <div className="flex items-center gap-1.5">
                                <div className={`w-1.5 h-1.5 rounded-full ${STA[file.status].dot}`} />
                                <span className={`text-xs ${STA[file.status].cls}`}>{STA[file.status].label}</span>
                              </div>
                              {file.fileSizeBytes && <span className="text-xs text-slate-600">{fmtB(file.fileSizeBytes)}</span>}
                              {file.status === 'READY' && <span className="text-xs text-slate-600">{file.chunkCount} 个切片</span>}
                              {file.vectorizedAt && <span className="text-xs text-slate-700">向量化 {file.vectorizedAt}</span>}
                            </div>
                            {file.status === 'PARSING' && (
                              <div className="mt-2 h-1 bg-slate-800 rounded-full overflow-hidden w-full relative">
                                <motion.div
                                  className="absolute top-0 left-0 h-full bg-blue-500 rounded-full w-full opacity-30 animate-pulse"
                                />
                                <motion.div
                                  className="h-full bg-blue-500 rounded-full"
                                  initial={{ width: "10%" }}
                                  animate={{ width: "90%" }}
                                  transition={{ duration: 15, ease: "linear" }}
                                />
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {file.status === 'READY' && (
                              <button
                                onClick={() => toggle(file.id)}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 text-xs transition-all"
                              >
                                {isExp ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                查看切片
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(file.id)}
                              className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* 切片展开 Accordion */}
                        <AnimatePresence>
                          {isExp && file.chunks && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.25 }}
                              className="overflow-hidden"
                            >
                              <div className="px-6 pb-5 pt-2 bg-slate-950/40">
                                <p className="text-xs text-purple-400 font-semibold mb-3 flex items-center gap-1.5">
                                  <Eye className="w-3.5 h-3.5" />
                                  AI 切片内容（{file.chunks.length} 个语义块）· 白盒可视
                                </p>
                                <div className="space-y-2">
                                  {file.chunks.map(chunk => (
                                    <div key={chunk.id} className="bg-slate-900 border border-slate-700/60 rounded-xl p-4">
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-mono font-bold text-purple-400">#{chunk.index + 1}</span>
                                        <span className="text-xs text-slate-600">~{chunk.tokenCount} tokens</span>
                                      </div>
                                      <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{chunk.content}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
              </div>
            </motion.div>
          </div>

          {/* ══ 右侧：知识库问答测试面板 ══ */}
          <AnimatePresence>
            {showQA && (
              <motion.div
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 24 }}
                transition={{ duration: 0.3 }}
                className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden flex flex-col"
                style={{ height: '720px' }}
              >
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                      <Bot className="w-4 h-4 text-purple-400" />
                    </div>
                    <div>
                      <h2 className="font-semibold text-sm">知识库问答测试</h2>
                      <p className="text-xs text-slate-500">测试 AI 对知识库的理解程度</p>
                    </div>
                  </div>
                  <button onClick={() => setShowQA(false)} className="text-slate-500 hover:text-white transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* 消息区 */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {msgs.map(m => (
                    <motion.div key={m.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}
                    >
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                        m.role === 'assistant' ? 'bg-purple-500/20' : 'bg-blue-500/20'
                      }`}>
                        {m.role === 'assistant'
                          ? <Bot className="w-4 h-4 text-purple-400" />
                          : <User className="w-4 h-4 text-blue-400" />}
                      </div>
                      <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                        m.role === 'assistant'
                          ? 'bg-slate-800 text-slate-200 rounded-tl-sm'
                          : 'bg-blue-600 text-white rounded-tr-sm'
                      }`}>
                        {m.content}
                        <p className="text-xs opacity-40 mt-1">{m.timestamp}</p>
                      </div>
                    </motion.div>
                  ))}
                  {qaLoad && (
                    <div className="flex gap-3">
                      <div className="w-7 h-7 rounded-full bg-purple-500/20 flex items-center justify-center">
                        <Bot className="w-4 h-4 text-purple-400" />
                      </div>
                      <div className="bg-slate-800 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
                        <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
                        <span className="text-sm text-slate-400">正在检索知识库...</span>
                      </div>
                    </div>
                  )}
                  <div ref={endRef} />
                </div>

                {/* 输入框 */}
                <div className="p-4 border-t border-slate-800">
                  <div className="flex gap-2">
                    <input
                      value={qaVal} onChange={e => setQaVal(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleQA()}
                      placeholder="提问，测试 AI 对知识库的理解..."
                      className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
                    />
                    <button
                      onClick={handleQA} disabled={qaLoad || !qaVal.trim()}
                      className="w-10 h-10 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-all"
                    >
                      <Send className="w-4 h-4 text-white" />
                    </button>
                  </div>
                  <p className="text-xs text-slate-600 mt-2 text-center">基于知识库严格作答 · 不编造信息</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </div>
    </div>
  )
}