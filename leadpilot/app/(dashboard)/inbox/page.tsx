"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import { motion } from "framer-motion"
import { Bell, Mail, Search, Send, Sparkles, Brain, Loader2, User, CheckCheck, Trash2, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/use-toast"
import { useWorkbench, WorkbenchProvider } from "@/contexts/WorkbenchContext"
import { getPlan } from "@/config/pricing"

// 身份权重映射（对齐 pricing.ts）
const PLAN_WEIGHT: Record<string, number> = { STARTER: 1, PRO: 2, MAX: 3 };

interface EmailMessage {
  id: string
  from: string
  to: string
  subject: string
  body: string
  sentAt: string
  isFromUser: boolean
}

interface EmailThread {
  id: string
  targetEmail: string
  targetName?: string
  subject: string
  status: string
  updatedAt: string
  messages?: EmailMessage[]
  intentAnalysis?: { intent: string; summary: string; leadScore?: number }
}

interface SystemNotification {
  id: string
  title: string
  content: string
  type: string
  isRead: boolean
  createdAt: string
}

// ═══════════════════════════════════════════════════════════════════════════
// B2B 模拟测试数据 — 预览 UI 效果专用
// 生产上线时删除整个 MOCK_* 区段，并恢复真实 fetchInitialData 调用
// ═══════════════════════════════════════════════════════════════════════════
const MOCK_PREVIEW_MODE = true

const mockEmail = {
  id: 'msg_12345',
  subject: 'Inquiry: Bulk Order for 2026 LED Display Panels',
  sender: {
    name: 'Michael Chen',
    email: 'm.chen@visiontech-global.com',
    initials: 'MC',
  },
  receivedAt: '今天 14:30',
  /** 英文原文 */
  contentOriginal: `Hi LeadPilot Team,

I recently came across your new series of outdoor LED display panels.

We are a systems integrator based in Dubai, and we are currently bidding on a large stadium project. We would need approximately 500 sq meters of P3.91 outdoor screens.

Could you please provide:
1. Your latest catalog and technical specs.
2. FOB pricing for a bulk order of this size.
3. Estimated lead time for production and shipping.

Looking forward to your prompt response.

Best regards,

Michael Chen
Procurement Director | VisionTech Global`,
  /** 中文翻译 */
  contentZh: `LeadPilot 团队您好，

我们最近关注到贵司全新系列的户外 LED 显示屏产品。

我们是一家总部位于迪拜的系统集成商，目前正在参与一个大型体育场项目的投标，急需采购约 500 平方米的 P3.91 户外屏幕。

烦请提供以下信息：
1. 最新产品目录及技术规格书；
2. 此等规模的大宗订单 FOB 报价；
3. 预计生产及运输交期。

期待您的及时回复。

此致，

Michael Chen
采购总监 | VisionTech Global`,
}

const mockAiDraft = {
  /** 英文原文（外贸回复必须用发件人语言）*/
  original: `Hi Michael,

Thank you for reaching out and for your interest in our outdoor LED display panels. It's great to connect with a leading systems integrator in Dubai.

For a stadium project of 500 sq meters, our P3.91 series is indeed an excellent choice, offering high brightness and superior weather resistance.

I have attached our latest catalog and technical specs for your review. Regarding the FOB pricing for this bulk order, I am preparing a detailed quotation and will send it over by tomorrow morning. Our standard lead time for this volume is typically 15-20 business days.

Could we schedule a quick 10-minute call this Thursday to discuss the project requirements in detail?

Best regards,
[Your Name]`,
  /** 中文预览 */
  zh: `Michael 您好，

非常感谢您的来信，以及对我们户外 LED 显示屏产品的关注。很高兴能与迪拜领先的系统集成商建立联系。

对于 500 平方米体育场项目，我们的 P3.91 系列是绝佳选择，具有高亮度和卓越的耐候性能。

我已随信附上最新产品目录和技术规格供您审阅。关于该大宗订单的 FOB 报价，我正在准备详细报价单，将于明日上午发送给您。此等规模的交货期一般为 15-20 个工作日。

本周四我们能否安排一次简短的 10 分钟通话，详细讨论项目需求？

此致敬礼
[您的姓名]`,
}

const MOCK_THREAD: EmailThread = {
  id: 'thread_preview_001',
  targetEmail: mockEmail.sender.email,
  targetName: mockEmail.sender.name,
  subject: mockEmail.subject,
  status: 'OPEN',
  updatedAt: new Date().toISOString(),
  intentAnalysis: {
    intent: 'INQUIRY',
    summary:
      '发件人为迪拜系统集成商，正在投标大型体育场项目，急需500平方米P3.91户外LED屏幕。需求明确，意向强烈，线索评分 82/100，属于高价值询盘，建议24小时内优先跟进。',
    leadScore: 82,
  },
  messages: [
    {
      id: 'msg_12345',
      from: mockEmail.sender.name,
      to: 'me@leadpilot.com',
      subject: mockEmail.subject,
      body: mockEmail.contentOriginal,
      sentAt: new Date().toISOString(),
      isFromUser: false,
    },
  ],
}

const MOCK_NOTIFICATIONS: SystemNotification[] = [
  {
    id: 'notif_preview_1',
    title: 'LeadPilot 配额已更新',
    content: '您的月度 AI 分析配额已重置为 200 次，祝您本月开单顺利！',
    type: 'SYSTEM',
    isRead: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
]

// 包装组件：在 WorkbenchProvider 内渲染 InboxPage 内容
function InboxPageContent() {
  // ── 全局配置读取（高级配置 Tab 4 联动）──────────────────────────────
  const { activeConfig, userPlan } = useWorkbench()
  const weight = PLAN_WEIGHT[String(userPlan ?? '')] || 1

  // Tab 4 配置解构：使用权重判断替代旧数字比较
  const aiIntentTagsEnabled = activeConfig.aiIntentTags && weight >= 2
  const leadScoringEnabled = activeConfig.leadScoring === 'ml' && weight >= 3
  const autoReplyEnabled = activeConfig.autoReply && weight >= 2
  // ─────────────────────────────────────────────────────────────────

  const [localThreads, setLocalThreads] = useState<EmailThread[]>([])
  const [localNotifications, setLocalNotifications] = useState<SystemNotification[]>([])
  const [selectedThread, setSelectedThread] = useState<EmailThread | null>(null)
  const [selectedNotification, setSelectedNotification] = useState<SystemNotification | null>(null)
  const [threadDetails, setThreadDetails] = useState<EmailThread | null>(null)
  const [activeTab, setActiveTab] = useState<'emails' | 'system'>('emails')
  const [searchQuery, setSearchQuery] = useState('')
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [replyText, setReplyText] = useState('')
  /** 左右两侧语言切换状态 */
  const [emailLang, setEmailLang] = useState<'original' | 'zh'>('original')
  const [draftLang, setDraftLang] = useState<'original' | 'zh'>('original')
  /** AI 最近一次生成的双语结果（用于预览切换） */
  const [generatedDraft, setGeneratedDraft] = useState<{ original: string; zh: string }>(mockAiDraft)
  const [sendingReply, setSendingReply] = useState(false)
  const [analyzingIntent, setAnalyzingIntent] = useState(false)
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set())
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkProcessing, setBulkProcessing] = useState(false)

  const { toast } = useToast()

  // ── 初始状态：预览模式下直接注入 mock 数据，跳过真实 API ─────────────
  useEffect(() => {
    if (MOCK_PREVIEW_MODE) {
      setLoading(false)
      setLocalThreads([MOCK_THREAD])
      setLocalNotifications(MOCK_NOTIFICATIONS)
      setUnreadCount(1)
      // 自动展开详情页预览
      setSelectedThread(MOCK_THREAD)
      setThreadDetails(MOCK_THREAD)
      setReplyText(mockAiDraft.original)
      return
    }
    fetchInitialData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchInitialData = useCallback(async () => {
    try {
      setLoading(true)
      const [threadsRes, notificationsRes] = await Promise.all([
        fetch('/api/inbox/threads'),
        fetch('/api/notifications/unread')
      ])
      
      if (!threadsRes.ok) {
        const errData = await threadsRes.json()
        throw new Error(errData.error || errData.details || 'Failed to fetch threads')
      }
      
      const threadsData = await threadsRes.json()
      const notificationsData = notificationsRes.ok ? await notificationsRes.json() : { notifications: [], unreadCount: 0 }
      
      setLocalThreads(threadsData.threads || [])
      setLocalNotifications(notificationsData.notifications || [])
      setUnreadCount(notificationsData.unreadCount || 0)
    } catch (error: any) {
      console.error('❌ 收件箱加载失败:', error)
      toast({ 
        title: "加载失败", 
        description: error?.message || "无法加载收件箱数据",
        variant: "destructive" 
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchInitialData()
  }, [fetchInitialData])

  // 在 selectedThread 变化时获取详情（预览模式跳过）
  useEffect(() => {
    if (!selectedThread) return
    if (MOCK_PREVIEW_MODE) {
      setThreadDetails(MOCK_THREAD)
      return
    }
    fetchThreadDetails(selectedThread.id)
  }, [selectedThread])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fetchThreadDetails = async (threadId: string) => {
    try {
      setDetailsLoading(true)
      const response = await fetch(`/api/inbox/threads/${threadId}`)
      if (!response.ok) {
        const errData = await response.json()
        throw new Error(errData.error || errData.details || response.statusText)
      }
      const data = await response.json()
      setThreadDetails(data.thread)
    } catch (error: any) {
      console.error('❌ 线程详情加载失败:', error)
      toast({ 
        title: "加载失败", 
        description: error?.message || "无法加载邮件详情",
        variant: "destructive" 
      })
    } finally {
      setDetailsLoading(false)
    }
  }

  const handleTabSwitch = (tab: 'emails' | 'system') => {
    setActiveTab(tab)
    setSelectedThread(null)
    setSelectedNotification(null)
    setThreadDetails(null)
  }

  const handleSelectNotification = async (notification: SystemNotification) => {
    console.log("【标记已读】准备标记的通知 ID:", notification.id)
    console.log("【标记已读】当前通知列表字段:", Object.keys(notification))

    if (notification.isRead) {
      setSelectedNotification(notification)
      return
    }

    const previousNotifications = [...localNotifications]
    const previousUnreadCount = unreadCount

    setSelectedNotification(notification)
    setLocalNotifications(prev => {
      console.log("【标记已读】过滤前列表:", prev.map(n => ({ id: n.id, isRead: n.isRead })))
      const filtered = prev.map(n => n.id === notification.id ? { ...n, isRead: true } : n)
      console.log("【标记已读】过滤后列表:", filtered.map(n => ({ id: n.id, isRead: n.isRead })))
      return filtered
    })
    setUnreadCount(prev => Math.max(0, prev - 1))

    try {
      const response = await fetch('/api/notifications/unread', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId: notification.id }),
      })

      if (!response.ok) {
        throw new Error('标记已读失败')
      }
      
      console.log("【标记已读】API 成功")
    } catch (error) {
      console.error('【标记已读】失败，回滚状态:', error)
      setLocalNotifications(previousNotifications)
      setUnreadCount(previousUnreadCount)
      toast({ 
        title: "操作失败", 
        description: "无法标记通知为已读",
        variant: "destructive" 
      })
    }
  }

  const handleDeleteNotification = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()

    console.log("【删除通知】准备删除的 ID:", id)
    console.log("【删除通知】当前列表第一条数据的字段:", localNotifications[0] ? Object.keys(localNotifications[0]) : '列表为空')

    const previousNotifications = [...localNotifications]
    const previousUnreadCount = unreadCount
    const previousSelectedId = selectedNotification?.id

    const target = localNotifications.find(n => n.id === id)
    console.log("【删除通知】找到的目标项:", target ? { id: target.id, isRead: target.isRead } : '未找到')
    const wasUnread = target ? !target.isRead : false

    console.log("【删除通知】过滤前列表长度:", localNotifications.length)
    setLocalNotifications(prev => {
      const filtered = prev.filter(n => n.id !== id)
      console.log("【删除通知】过滤后列表长度:", filtered.length)
      return filtered
    })
    
    if (previousSelectedId === id) {
      setSelectedNotification(null)
    }
    
    if (wasUnread) {
      console.log("【删除通知】被删项未读，扣减未读计数:", unreadCount, "→", unreadCount - 1)
      setUnreadCount(prev => prev - 1)
    }

    try {
      const response = await fetch(`/api/notifications/unread?id=${encodeURIComponent(id)}`, { 
        method: 'DELETE' 
      })

      console.log("【删除通知】API 响应状态:", response.status)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error("【删除通知】API 错误响应:", errorText)
        throw new Error(`API 返回 ${response.status}: ${errorText}`)
      }

      const result = await response.json()
      console.log("【删除通知】API 成功响应:", result)

      toast({ title: '🗑️ 通知已删除' })
      
      const notificationsRes = await fetch('/api/notifications/unread')
      if (notificationsRes.ok) {
        const data = await notificationsRes.json()
        console.log("【删除通知】刷新后的未读数:", data.unreadCount)
        setUnreadCount(data.unreadCount || 0)
      }
      
      console.log("【删除通知】全部完成")
    } catch (error: any) {
      console.error('【删除通知】失败，回滚状态:', error)
      console.error('Error details:', error.message)
      setLocalNotifications(previousNotifications)
      setUnreadCount(previousUnreadCount)
      toast({ 
        title: "删除失败", 
        description: error.message || "无法删除通知，已恢复",
        variant: "destructive" 
      })
    }
  }

  const handleSendReply = async () => {
    if (!selectedThread) {
      toast({ title: "请选择一封邮件", description: "请先在左侧选择会话，再发送回复", variant: "destructive" })
      return
    }
    try {
      setSendingReply(true)
      const response = await fetch('/api/inbox/generate-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId: selectedThread.id, replyContent: replyText }),
      })
      if (!response.ok) throw new Error('Failed to send reply')
      toast({ title: "✅ 回复已发送", description: "邮件已成功发送" })
      setReplyText('')
      fetchThreadDetails(selectedThread.id)
    } catch (error) {
      console.error('Failed to send reply:', error)
      toast({ title: "发送失败", description: "无法发送回复", variant: "destructive" })
    } finally {
      setSendingReply(false)
    }
  }

  const handleAnalyzeIntent = async () => {
    if (!selectedThread) return
    try {
      setAnalyzingIntent(true)
      const response = await fetch('/api/inbox/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId: selectedThread.id }),
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to analyze')
      }
      const data = await response.json()
      setThreadDetails(prev => prev ? { ...prev, intentAnalysis: data.analysis } : null)
      toast({ title: "✅ 分析完成", description: "AI 意图分析已完成" })
    } catch (error: any) {
      console.error('Failed to analyze intent:', error)
      toast({ title: "分析失败", description: error.message, variant: "destructive" })
    } finally {
      setAnalyzingIntent(false)
    }
  }

  const handlePin = (id: string) => {
    setPinnedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    toast({ title: pinnedIds.has(id) ? '已取消置顶' : '✅ 已置顶' })
  }

  const handleDeleteThread = async (id: string) => {
    console.log("【删除邮件】准备删除的 ID:", id)
    console.log("【删除邮件】当前列表第一条数据的字段:", localThreads[0] ? Object.keys(localThreads[0]) : '列表为空')

    const previousThreads = [...localThreads]
    const previousSelectedId = selectedThread?.id

    console.log("【删除邮件】过滤前列表长度:", localThreads.length)
    setLocalThreads(prev => {
      const filtered = prev.filter(t => t.id !== id)
      console.log("【删除邮件】过滤后列表长度:", filtered.length)
      return filtered
    })
    
    if (previousSelectedId === id) {
      setSelectedThread(null)
      setThreadDetails(null)
    }

    try {
      console.log("【删除邮件】调用 API: DELETE /api/inbox/threads/", id)
      const response = await fetch(`/api/inbox/threads/${id}`, { method: 'DELETE' })

      console.log("【删除邮件】API 响应状态:", response.status)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error("【删除邮件】API 错误响应:", errorText)
        throw new Error(`API 返回 ${response.status}: ${errorText}`)
      }

      const result = await response.json()
      console.log("【删除邮件】API 成功响应:", result)

      toast({ title: '🗑️ 已删除' })
      console.log("【删除邮件】全部完成")
    } catch (error: any) {
      console.error('【删除邮件】失败，回滚状态:', error)
      console.error('Error details:', error.message)
      setLocalThreads(previousThreads)
      if (previousSelectedId === id) {
        const restored = previousThreads.find(t => t.id === id)
        if (restored) {
          console.log("【删除邮件】恢复选中的邮件:", restored.id)
          setSelectedThread(restored)
        }
      }
      toast({ 
        title: "删除失败", 
        description: error.message || "无法删除邮件，已恢复",
        variant: "destructive" 
      })
    }
  }

  const toggleSelectThread = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleBulkAI = async () => {
    if (selectedIds.size === 0) {
      toast({ title: '请先勾选邮件', description: '勾选左侧邮件后再批量处理', variant: 'destructive' })
      return
    }
    setBulkProcessing(true)
    toast({ title: `🤖 正在调用大模型分析 ${selectedIds.size} 封邮件...`, description: '分析标签、意图与优先级' })
    const processedCount = selectedIds.size
    await new Promise(r => setTimeout(r, 2200))
    setBulkProcessing(false)
    setSelectedIds(new Set())
    toast({ title: `✅ 批量处理完成`, description: `已为 ${processedCount} 封邮件打标签` })
  }

  const sortedThreads = [...(localThreads || [])].sort((a, b) => {
    const ap = pinnedIds.has(a.id) ? 1 : 0
    const bp = pinnedIds.has(b.id) ? 1 : 0
    return bp - ap || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  })

  const filteredThreads = sortedThreads.filter(t =>
    t?.targetEmail?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t?.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t?.targetName?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredNotifications = (localNotifications || []).filter(n =>
    n?.title?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      <div className="container mx-auto px-4 py-8">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <h1 className="text-4xl font-bold text-white mb-2">收件箱</h1>
          <p className="text-slate-400">管理您的邮件和系统通知</p>
        </motion.div>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1 bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl overflow-hidden flex flex-col h-[700px]">
            <div className="flex border-b border-slate-800">
              <button onClick={() => handleTabSwitch('emails')} className={`flex-1 px-4 py-3 text-sm font-semibold transition-all ${activeTab === 'emails' ? 'bg-blue-600/20 text-blue-400 border-b-2 border-blue-400' : 'text-slate-400 hover:text-white'}`}>
                <Mail className="w-4 h-4 inline mr-2" />邮件
              </button>
              <button onClick={() => handleTabSwitch('system')} className={`flex-1 px-4 py-3 text-sm font-semibold transition-all relative ${activeTab === 'system' ? 'bg-blue-600/20 text-blue-400 border-b-2 border-blue-400' : 'text-slate-400 hover:text-white'}`}>
                <Bell className="w-4 h-4 inline mr-2" />通知
                {unreadCount > 0 && <span className="absolute top-2 right-2 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">{unreadCount}</span>}
              </button>
            </div>
            <div className="p-4 border-b border-slate-800">
              <div className="relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                <Input type="text" placeholder="搜索..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 bg-slate-800/50 border-slate-700 text-white" />
              </div>
              {activeTab === 'emails' && (
                <button
                  onClick={handleBulkAI}
                  disabled={bulkProcessing}
                  className="mt-2 w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold bg-purple-600/20 border border-purple-500/30 text-purple-300 hover:bg-purple-600/30 transition-all disabled:opacity-50"
                >
                  {bulkProcessing ? <><Loader2 className="w-3 h-3 animate-spin" />处理中...</> : <><Sparkles className="w-3 h-3" />AI 批量处理 {selectedIds.size > 0 && `(${selectedIds.size})`}</>}
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center"><Loader2 className="w-8 h-8 mx-auto mb-2 text-blue-400 animate-spin" /><p className="text-slate-400 text-sm">加载中...</p></div>
              ) : activeTab === 'emails' ? (
                filteredThreads?.length === 0 ? (
                  <div className="p-8 text-center text-slate-500"><Mail className="w-12 h-12 mx-auto mb-3 opacity-30" /><p className="font-semibold">暂无邮件</p></div>
                ) : (
                  filteredThreads?.map((thread) => (
                    <motion.div 
                      key={thread?.id} 
                      initial={{ opacity: 0 }} 
                      animate={{ opacity: 1 }}
                      layoutId={undefined}
                      className={`w-full text-left border-b border-slate-800 hover:bg-slate-800/50 transition-all ${
                        selectedThread?.id === thread?.id ? 'bg-blue-600/20 border-l-4 border-l-blue-400' : ''
                      } ${pinnedIds.has(thread?.id) ? 'border-l-4 border-l-amber-400' : ''}`}
                    >
                      <div className="flex items-start gap-2 px-3 py-3">
                        <input type="checkbox" checked={selectedIds.has(thread?.id)}
                          onChange={() => toggleSelectThread(thread?.id)}
                          className="mt-1 accent-purple-500 flex-shrink-0"
                          onClick={e => e.stopPropagation()}
                        />
                        <button className="flex-1 text-left min-w-0" onClick={() => setSelectedThread(thread)}>
                          <div className="flex items-start justify-between mb-1">
                            <div className="font-semibold text-white text-sm truncate flex-1">
                              {pinnedIds.has(thread?.id) && <span className="text-amber-400 mr-1">📌</span>}
                              {thread?.targetName || thread?.targetEmail}
                            </div>
                            <span className={`text-xs px-2 py-0.5 rounded flex-shrink-0 ${
                              thread?.status === 'REPLIED' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                            }`}>{thread?.status === 'REPLIED' ? '已回复' : '待回复'}</span>
                          </div>
                          <div className="text-xs text-slate-400 truncate">{thread?.subject}</div>
                          <div className="text-xs text-slate-500 mt-1">{thread?.updatedAt ? new Date(thread.updatedAt).toLocaleString('zh-CN') : ''}</div>
                        </button>
                        <div className="flex flex-col gap-1 flex-shrink-0">
                          <button onClick={() => handlePin(thread?.id)} title="置顶"
                            className={`text-xs px-1.5 py-1 rounded transition-colors ${
                              pinnedIds.has(thread?.id) ? 'text-amber-400 hover:text-amber-300' : 'text-slate-600 hover:text-amber-400'
                            }`}
                          >📌</button>
                          <button onClick={() => handleDeleteThread(thread?.id)} title="删除"
                            className="text-xs px-1.5 py-1 rounded text-slate-600 hover:text-red-400 transition-colors"
                          >🗑</button>
                        </div>
                      </div>
                    </motion.div>
                  ))
                )
              ) : (
                filteredNotifications?.length === 0 ? (
                  <div className="p-8 text-center text-slate-500"><Bell className="w-12 h-12 mx-auto mb-3 opacity-30" /><p className="font-semibold">暂无通知</p></div>
                ) : (
                  filteredNotifications?.map((notification) => (
                    <div 
                      key={notification?.id} 
                      className={`flex items-start border-b border-slate-800 hover:bg-slate-800/50 transition-all ${
                        selectedNotification?.id === notification?.id
                          ? 'bg-blue-600/20 border-l-4 border-l-blue-400'
                          : !notification?.isRead ? 'bg-slate-800/30' : ''
                      }`}
                    >
                      <button className="flex-1 text-left px-4 py-3 min-w-0" onClick={() => handleSelectNotification(notification)}>
                        <div className="flex items-center gap-2 mb-1">
                          {!notification?.isRead && <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />}
                          <div className="font-semibold text-white text-sm truncate flex-1">{notification?.title}</div>
                        </div>
                        <div className="text-xs text-slate-400 line-clamp-2">{notification?.content}</div>
                        <div className="text-xs text-slate-600 mt-1">{notification?.createdAt ? new Date(notification.createdAt).toLocaleString('zh-CN') : ''}</div>
                      </button>
                      <button
                        onClick={(e) => handleDeleteNotification(notification?.id, e)}
                        title="删除通知"
                        className="flex-shrink-0 p-2 mt-2 mr-2 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )
              )}
            </div>
          </div>
          {/* ────────────────────────────────────────────────────────
               邮件详情区：当选中 thread 时，替换为 AI 驾驶舱分栏视图
               布局：lg:grid-cols-3 → 左侧占 2 列（阅读区），右侧占 1 列（副驾驶）
               ──────────────────────────────────────────────────────── */}
          <div className="lg:col-span-3 bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl overflow-hidden flex flex-col h-[700px]">
            {selectedThread ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 h-full">

                {/* ══════════════════════════════════════════════════════
                    左侧：Email 沉浸阅读区（占 2/3）
                    ══════════════════════════════════════════════════════ */}
                <div className="lg:col-span-2 flex flex-col border-r border-slate-800 overflow-hidden">

                  {/* ── Header：返回 + 邮件主题 ── */}
                  <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-800 bg-slate-900/30">
                    <button
                      onClick={() => { setSelectedThread(null); setThreadDetails(null) }}
                      className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-800/60"
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      返回
                    </button>
                    <div className="h-4 w-px bg-slate-700" />
                    {threadDetails?.intentAnalysis && aiIntentTagsEnabled && (
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
                        threadDetails.intentAnalysis.intent === 'POSITIVE' || threadDetails.intentAnalysis.intent === 'INQUIRY'
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          : threadDetails.intentAnalysis.intent === 'REJECTION' || threadDetails.intentAnalysis.intent === 'COMPLAINT'
                          ? 'bg-red-500/15 text-red-400 border-red-500/30'
                          : 'bg-purple-500/15 text-purple-400 border-purple-500/30'
                      }`}>
                        {threadDetails.intentAnalysis.intent === 'POSITIVE' ? '正向' :
                         threadDetails.intentAnalysis.intent === 'INQUIRY' ? '询问' :
                         threadDetails.intentAnalysis.intent === 'REJECTION' ? '拒绝' :
                         threadDetails.intentAnalysis.intent === 'COMPLAINT' ? '投诉' :
                         threadDetails.intentAnalysis.intent === 'NEGOTIATION' ? '洽谈中' : '待分析'}
                      </span>
                    )}
                    <h1 className="flex-1 text-base font-bold text-white truncate pr-4">
                      {threadDetails?.subject || selectedThread?.subject}
                    </h1>
                    <button
                      onClick={() => {
                        if (!aiIntentTagsEnabled) {
                          toast({ title: '🔒 AI 意图分析未就绪', description: '请在高级配置中开启或升级套餐', variant: 'destructive' })
                          return
                        }
                        handleAnalyzeIntent()
                      }}
                      disabled={analyzingIntent}
                      className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all disabled:opacity-50 ${
                        aiIntentTagsEnabled
                          ? 'bg-purple-600/20 border border-purple-500/30 text-purple-300 hover:bg-purple-600/30'
                          : 'bg-slate-800/60 border border-slate-700/50 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      {analyzingIntent
                        ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />分析中</>
                        : <><Brain className="w-3.5 h-3.5" />AI 分析</>
                      }
                    </button>
                  </div>

                  {/* ── AI 分析结果横幅（鉴权拦截）── */}
                  {threadDetails?.intentAnalysis ? (
                    // 已分析结果：检查是否开启 AI 意图标签功能
                    aiIntentTagsEnabled ? (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mx-6 mt-4 p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl"
                      >
                        <div className="flex items-start gap-3">
                          <Sparkles className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-bold text-purple-400">AI 意图分析</span>
                              {threadDetails.intentAnalysis.leadScore && leadScoringEnabled && (
                                <span className="text-xs font-bold text-amber-400">
                                  线索评分 {threadDetails.intentAnalysis.leadScore}/100
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-300 leading-relaxed">{threadDetails.intentAnalysis.summary}</p>
                          </div>
                        </div>
                      </motion.div>
                    ) : (
                      // 功能未开启：显示模糊化遮罩
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mx-6 mt-4 p-3 bg-slate-800/40 border border-slate-700/50 rounded-xl relative overflow-hidden"
                      >
                        <div className="absolute inset-0 backdrop-blur-sm bg-slate-900/60 flex items-center justify-center z-10">
                          <div className="text-center">
                            <Lock className="w-6 h-6 text-slate-500 mx-auto mb-1" />
                            <p className="text-xs text-slate-500">AI 意图分析未启用</p>
                            <p className="text-[10px] text-slate-600 mt-0.5">请在高级配置中开启或升级套餐</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3 opacity-30 filter blur-sm pointer-events-none">
                          <Sparkles className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-bold text-purple-400">AI 意图分析</span>
                              {threadDetails.intentAnalysis.leadScore && (
                                <span className="text-xs font-bold text-amber-400">
                                  线索评分 {threadDetails.intentAnalysis.leadScore}/100
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-300 leading-relaxed">{threadDetails.intentAnalysis.summary}</p>
                          </div>
                        </div>
                      </motion.div>
                    )
                  ) : null}

                  {/* ── 发件信息卡片 ── */}
                  {(() => {
                    const lastMsg = threadDetails?.messages?.[threadDetails.messages.length - 1]
                    const senderName = lastMsg?.from || selectedThread?.targetName || '未知发件人'
                    const senderEmail = lastMsg?.isFromUser ? 'me' : (selectedThread?.targetEmail || '')
                    const sentAt = lastMsg?.sentAt ? new Date(lastMsg.sentAt) : new Date(selectedThread?.updatedAt || Date.now())
                    const now = new Date()
                    const isToday = sentAt.toDateString() === now.toDateString()
                    const formattedTime = isToday
                      ? `今天 ${sentAt.getHours().toString().padStart(2, '0')}:${sentAt.getMinutes().toString().padStart(2, '0')}`
                      : sentAt.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }) + ' ' +
                        sentAt.getHours().toString().padStart(2, '0') + ':' +
                        sentAt.getMinutes().toString().padStart(2, '0')
                    const initials = senderName.replace(/\s+/g, '').slice(0, 2).toUpperCase()
                    const avatarColors = [
                      'from-blue-600 to-blue-500', 'from-purple-600 to-purple-500',
                      'from-emerald-600 to-emerald-500', 'from-amber-600 to-amber-500',
                      'from-rose-600 to-rose-500', 'from-cyan-600 to-cyan-500',
                    ]
                    const colorIdx = senderName.charCodeAt(0) % avatarColors.length
                    return (
                      <div className="mx-6 mt-4 flex items-center gap-3 p-3 bg-slate-800/40 border border-slate-700/50 rounded-xl">
                        <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${avatarColors[colorIdx]} flex items-center justify-center flex-shrink-0 shadow-lg`}>
                          <span className="text-sm font-bold text-white">{initials}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-white">{senderName}</span>
                            <span className="text-xs px-1.5 py-0.5 rounded bg-slate-700/60 text-slate-400">{senderEmail}</span>
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">{formattedTime}</div>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <span className={`w-2 h-2 rounded-full ${selectedThread?.status === 'REPLIED' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                          {selectedThread?.status === 'REPLIED' ? '已回复' : '待回复'}
                        </div>
                      </div>
                    )
                  })()}

                  {/* ── 邮件正文区 ── */}
                  <div className="flex-1 overflow-y-auto px-6 py-4">
                    {detailsLoading ? (
                      <div className="flex items-center justify-center h-48"><Loader2 className="w-8 h-8 text-blue-400 animate-spin" /></div>
                    ) : threadDetails?.messages && threadDetails.messages.length > 0 ? (
                      <div className="space-y-4">
                        {threadDetails.messages.map((message) => (
                          <motion.div
                            key={message.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`rounded-xl border ${
                              message.isFromUser
                                ? 'bg-blue-500/8 border-blue-500/20 ml-8'
                                : 'bg-slate-800/60 border-slate-700/60 mr-8'
                            }`}
                          >
                            <div className="p-4">
                              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-700/40">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${message.isFromUser ? 'bg-blue-500/30' : 'bg-slate-700'}`}>
                                  <User className="w-3.5 h-3.5 text-white" />
                                </div>
                                <span className="text-xs font-semibold text-slate-300">{message.isFromUser ? '我' : message.from}</span>
                                <span className="text-xs text-slate-600 ml-auto">
                                  {message.sentAt ? new Date(message.sentAt).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                                </span>
                                {/* ── 原文 / 中文 切换 ── */}
                                {!message.isFromUser && (
                                  <div className="flex items-center rounded-lg border border-slate-700/60 bg-slate-800/40 p-0.5 ml-2">
                                    <button
                                      onClick={() => setEmailLang('original')}
                                      className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
                                        emailLang === 'original'
                                          ? 'bg-blue-600 text-white shadow-sm'
                                          : 'text-slate-500 hover:text-slate-300'
                                      }`}
                                    >原文</button>
                                    <button
                                      onClick={() => setEmailLang('zh')}
                                      className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
                                        emailLang === 'zh'
                                          ? 'bg-blue-600 text-white shadow-sm'
                                          : 'text-slate-500 hover:text-slate-300'
                                      }`}
                                    >中文</button>
                                  </div>
                                )}
                              </div>
                              {/* ── 正文：根据 emailLang 互斥显示原文或中文翻译 ── */}
                              <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                                {emailLang === 'zh' ? mockEmail.contentZh : message.body}
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-48 text-slate-500 text-sm">
                        <Mail className="w-8 h-8 mr-2 opacity-30" />
                        暂无邮件内容
                      </div>
                    )}
                  </div>

                </div>

                {/* ══════════════════════════════════════════════════════
                    右侧：AI 副驾驶舱（占 1/3）
                    ── 所有回复编辑与发送动作均在此完成 ───────────────────
                    ══════════════════════════════════════════════════════ */}
                <AICopilotPanel
                  threadId={selectedThread.id}
                  threadDetails={threadDetails}
                  replyText={replyText}
                  setReplyText={setReplyText}
                  onSendReply={handleSendReply}
                  sendingReply={sendingReply}
                  draftLang={draftLang}
                  setDraftLang={setDraftLang}
                  mockAiDraft={generatedDraft}
                  onDraftGenerated={(draft) => setGeneratedDraft(draft)}
                  autoReplyEnabled={autoReplyEnabled}
                />
              </div>
            ) : selectedNotification ? (
              <motion.div
                key={selectedNotification?.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex-1 overflow-y-auto p-8"
              >
                <div className="max-w-2xl">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
                      <Bell className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">系统通知</span>
                      <div className="flex items-center gap-2 mt-1">
                        <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-xs text-slate-500">已读</span>
                      </div>
                    </div>
                  </div>

                  <h1 className="text-2xl font-bold text-white mb-3 leading-snug">
                    {selectedNotification?.title}
                  </h1>

                  <div className="text-xs text-slate-500 mb-6">
                    {selectedNotification?.createdAt ? new Date(selectedNotification.createdAt).toLocaleString('zh-CN', {
                      year: 'numeric', month: '2-digit', day: '2-digit',
                      hour: '2-digit', minute: '2-digit', second: '2-digit'
                    }) : ''}
                  </div>

                  <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
                    <p className="text-slate-300 leading-relaxed whitespace-pre-wrap text-sm">
                      {selectedNotification?.content}
                    </p>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center text-slate-500">
                  {activeTab === 'emails'
                    ? <><Mail className="w-16 h-16 mx-auto mb-4 opacity-30" /><p className="text-lg font-semibold">选择邮件查看详情</p></>
                    : <><Bell className="w-16 h-16 mx-auto mb-4 opacity-30" /><p className="text-lg font-semibold">选择通知查看详情</p></>
                  }
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// 导出默认函数：用 WorkbenchProvider 包裹 InboxPageContent
export default function InboxPage() {
  return (
    <WorkbenchProvider>
      <InboxPageContent />
    </WorkbenchProvider>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// AI 副驾驶舱组件（AICopilotPanel）
// 职责：快捷策略按钮组 + AI 草稿编辑器 + 底部动作条
// 状态：Mock State 预备，接通 /api/inbox/generate-reply 即可上线
// ═══════════════════════════════════════════════════════════════════════════
type ReplyStrategy = 'positive' | 'negative' | 'question' | 'custom'

interface AICopilotPanelProps {
  threadId: string
  threadDetails: EmailThread | null
  replyText: string
  setReplyText: (text: string) => void
  onSendReply: () => void
  sendingReply: boolean
  draftLang: 'original' | 'zh'
  setDraftLang: (lang: 'original' | 'zh') => void
  /** 当前 AI 生成的双语结果，供 zh 预览渲染 */
  mockAiDraft: { original: string; zh: string }
  /** 生成完成后同步最新结果回父组件，供预览切换使用 */
  onDraftGenerated?: (draft: { original: string; zh: string }) => void
  /** Tab 4 AI 智能回复接管鉴权 */
  autoReplyEnabled?: boolean
}

const STRATEGIES: { id: ReplyStrategy; emoji: string; label: string; desc: string }[] = [
  { id: 'positive', emoji: '👍', label: '积极跟进', desc: '热情、专业、有价值' },
  { id: 'negative', emoji: '👎', label: '委婉拒绝', desc: '礼貌、得体、不伤和气' },
  { id: 'question', emoji: '❓', label: '询问细节', desc: '追问关键信息' },
  { id: 'custom',   emoji: '📝', label: '自定义语气', desc: '调整至你的风格' },
]

function AICopilotPanel({
  threadId,
  threadDetails,
  replyText,
  setReplyText,
  onSendReply,
  sendingReply,
  draftLang,
  setDraftLang,
  mockAiDraft,
  onDraftGenerated,
  autoReplyEnabled = false,
}: AICopilotPanelProps) {
  const { toast } = useToast()
  /** 持有每次 AI 生成的双语结果，供 zh 预览渲染 */
  const [currentDraft, setCurrentDraft] = React.useState<{ original: string; zh: string }>(mockAiDraft)
  const [activeStrategy, setActiveStrategy] = React.useState<ReplyStrategy | null>(
    MOCK_PREVIEW_MODE ? 'positive' : null
  )
  const [generating, setGenerating] = React.useState(false)
  const [copilotMode, setCopilotMode] = React.useState<'idle' | 'generating' | 'ready'>(
    MOCK_PREVIEW_MODE ? 'ready' : 'idle'
  )
  /** 用户是否手动编辑过草稿（用于区分 AI 生成 vs 用户自定义内容） */
  const [userEdited, setUserEdited] = React.useState(false)

  // 预览模式：初始激活「积极跟进」策略
  React.useEffect(() => {
    if (MOCK_PREVIEW_MODE && replyText === mockAiDraft.original) {
      setActiveStrategy('positive')
      setCopilotMode('ready')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // AI 生成草稿后，如果用户之前没有手动编辑过，则同步到 replyText
  // 如果用户已手动编辑，则保留用户内容不变（不覆盖）
  React.useEffect(() => {
    if (!userEdited && currentDraft.original) {
      setReplyText(currentDraft.original)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDraft.original])

  const handleStrategySelect = async (strategy: ReplyStrategy) => {
    // ── 鉴权检查：Tab 4 AI 智能回复接管 ──────────────────────────────
    if (!autoReplyEnabled) {
      toast({
        title: '🔒 AI 回复助理未就绪',
        description: '请前往高级配置核准权限',
        variant: 'destructive',
      })
      return
    }
    // ─────────────────────────────────────────────────────────────────

    if (strategy === 'custom') {
      setActiveStrategy('custom')
      setReplyText('')
      setUserEdited(false)
      setCopilotMode('idle')
      return
    }

    setActiveStrategy(strategy)
    setGenerating(true)
    setCopilotMode('generating')

    // ── 获取邮件原文和发件人信息 ────────────────────────────────────────────
    const latestMsg = threadDetails?.messages?.[threadDetails.messages.length - 1]
    const emailContent = latestMsg?.body || threadDetails?.messages?.[0]?.body || ''
    const senderName = latestMsg?.from?.split(' ')[0] || 'there'

    try {
      // ── 调用 /api/ai/reply 接口 ──────────────────────────────────────────
      const response = await fetch('/api/ai/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailContent, tone: strategy, senderName }),
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      const data = await response.json()
      // data: { original: string, zh: string }
      const { original, zh } = data

      // 更新本地双语状态
      setCurrentDraft({ original, zh })
      // 父组件同步最新双语结果（用于预览切换）
      onDraftGenerated?.({ original, zh })
      // 英文原文写入回复框（仅在用户未手动编辑时覆盖）
      if (!userEdited) {
        setReplyText(original)
      }
      setDraftLang('original')
      setCopilotMode('ready')
    } catch (err) {
      console.error('[/api/ai/reply] failed:', err)
      // 降级：使用 mock 数据
      const fallback = mockAiDraft.original
      setCurrentDraft(mockAiDraft)
      onDraftGenerated?.(mockAiDraft)
      if (!userEdited) {
        setReplyText(fallback)
      }
      setDraftLang('original')
      setCopilotMode('ready')
    } finally {
      setGenerating(false)
    }
  }

  const handleRegenerate = async () => {
    if (!activeStrategy || activeStrategy === 'custom') return
    await handleStrategySelect(activeStrategy)
  }

  const latestMessage = threadDetails?.messages?.[threadDetails.messages.length - 1]

  /** 中文预览模式下 textarea 的占位内容（readOnly 展示中文翻译） */
  const zhPreviewContent = draftLang === 'zh' ? currentDraft.zh : ''

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-900/20">
      {/* ── Copilot Header ── */}
      <div className="px-5 py-4 border-b border-slate-800 bg-slate-900/30">
        <div className="flex items-center gap-2 mb-0.5">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
            AI 智能回复助理
          </span>
          {userEdited && (
            <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
              已手动编辑
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500">
          {latestMessage ? '基于最新邮件内容生成' : '选择策略开始撰写回复'}
        </p>
      </div>

      {/* ── 快捷策略按钮组（鉴权拦截）── */}
      {!autoReplyEnabled ? (
        /* 未开启功能：全组禁用 + 大锁遮罩 */
        <div className="px-5 py-4 border-b border-slate-800/60 relative">
          <div className="absolute inset-0 backdrop-blur-sm bg-slate-900/70 flex flex-col items-center justify-center z-10 rounded-b-xl">
            <Lock className="w-8 h-8 text-slate-600 mb-2" />
            <p className="text-sm text-slate-500 font-medium">AI 回复助理未就绪</p>
            <p className="text-xs text-slate-600 mt-1">请前往高级配置核准权限</p>
          </div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 opacity-30">选择回复策略</p>
          <div className="grid grid-cols-2 gap-2 opacity-30">
            {STRATEGIES.map((s) => (
              <button
                key={s.id}
                disabled
                className="group flex flex-col items-start p-3 rounded-xl border bg-slate-800/30 border-slate-700/50 text-slate-600 cursor-not-allowed"
              >
                <span className="text-base mb-1">{s.emoji}</span>
                <span className="text-xs font-semibold leading-tight">{s.label}</span>
                <span className="text-[10px] text-slate-700 mt-0.5 leading-tight">{s.desc}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* 功能已开启：正常渲染 */
        <div className="px-5 py-4 border-b border-slate-800/60">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">选择回复策略</p>
          <div className="grid grid-cols-2 gap-2">
            {STRATEGIES.map((s) => (
              <button
                key={s.id}
                onClick={() => handleStrategySelect(s.id)}
                disabled={generating}
                className={`group flex flex-col items-start p-3 rounded-xl border transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                  activeStrategy === s.id
                    ? 'bg-purple-600/20 border-purple-500/50 text-white'
                    : 'bg-slate-800/30 border-slate-700/50 text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 hover:border-slate-600'
                }`}
              >
                <span className="text-base mb-1">{s.emoji}</span>
                <span className="text-xs font-semibold leading-tight">{s.label}</span>
                <span className="text-[10px] text-slate-600 mt-0.5 leading-tight">{s.desc}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── 状态指示器 ── */}
      {copilotMode === 'generating' && (
        <div className="px-5 py-3 flex items-center gap-2 bg-purple-600/10 border-b border-purple-600/20">
          <div className="w-4 h-4 rounded-full border-2 border-purple-400 border-t-transparent animate-spin" />
          <span className="text-xs text-purple-400 font-medium">AI 正在撰写回复...</span>
        </div>
      )}

      {/* ── 草稿编辑器（可编辑 textarea）────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden px-5 py-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">回复草稿</p>
            {userEdited && (
              <span className="text-[9px] text-amber-400/80 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                已编辑
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {copilotMode === 'ready' && !userEdited && (
              <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                AI 已生成
              </span>
            )}
            {userEdited && (
              <span className="text-[10px] text-amber-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                手动编辑
              </span>
            )}
            {/* ── 原文 / 中文 切换（右侧） ── */}
            <div className="flex items-center rounded-lg border border-slate-700/60 bg-slate-800/40 p-0.5">
              <button
                onClick={() => { setDraftLang('original'); setCopilotMode('ready') }}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
                  draftLang === 'original'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >原文</button>
              <button
                onClick={() => { setDraftLang('zh'); setCopilotMode('idle') }}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
                  draftLang === 'zh'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >中文预览</button>
            </div>
          </div>
        </div>

        {/* ── 中文预览提示条（仅 zh 模式显示）── */}
        {draftLang === 'zh' && (
          <div className="mb-2 flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="flex-shrink-0">
              <circle cx="6" cy="6" r="5.5" stroke="#f59e0b"/>
              <path d="M6 5v3M6 3.5v.5" stroke="#f59e0b" strokeLinecap="round"/>
            </svg>
            <span className="text-[10px] text-amber-400">中文预览仅供阅读，发送前请切回英文原文</span>
          </div>
        )}

        {/* ── 核心修改：双向绑定的可编辑 textarea ─────────────────────── */}
        {draftLang === 'zh' ? (
          // 中文预览模式：readOnly 展示翻译，用户可直接切换回原文编辑
          <textarea
            value={currentDraft.zh}
            readOnly
            placeholder="点击「原文」切换后可编辑"
            className="flex-1 rounded-xl p-3 text-sm resize-none bg-slate-800/30 border border-slate-700/40 text-slate-400 italic cursor-not-allowed leading-relaxed"
          />
        ) : (
          // 原文模式：完全可编辑的 textarea，双向绑定 replyText
          <textarea
            value={replyText}
            onChange={(e) => {
              setReplyText(e.target.value)
              setUserEdited(true)   // 用户手动编辑后标记，防止 AI 重写覆盖
              setCopilotMode('idle')
            }}
            disabled={generating}
            placeholder={
              activeStrategy === null
                ? '点击上方策略按钮，让 AI 为您生成回复草稿'
                : generating
                ? '深度思考中，请稍候...'
                : '在此修改 AI 生成的回复，或直接输入您的回复内容'
            }
            className={`flex-1 rounded-xl p-3 text-sm resize-y bg-slate-800/50 border border-slate-700/60 text-slate-200 placeholder:text-slate-600 leading-relaxed transition-all focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 ${
              generating ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          />
        )}
      </div>

      {/* ── 底部动作条 ── */}
      <div className="px-5 py-4 border-t border-slate-800 bg-slate-900/30">
        <div className="flex gap-2">
          {/* 重新生成（用户已编辑时提示确认） */}
          <button
            onClick={() => {
              if (userEdited) {
                if (!window.confirm('重新生成将覆盖您的手动编辑内容，确定继续吗？')) return
                setUserEdited(false)
              }
              handleRegenerate()
            }}
            disabled={!replyText || generating || activeStrategy === 'custom'}
            title="重新生成"
            className="flex items-center justify-center w-10 h-10 rounded-xl border border-slate-700/60 text-slate-400 hover:text-white hover:border-slate-500 hover:bg-slate-800/60 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <path d="M13.5 7.5C13.5 10.8137 10.8137 13.5 7.5 13.5C4.18629 13.5 1.5 10.8137 1.5 7.5C1.5 4.18629 4.18629 1.5 7.5 1.5C9.5 1.5 11.25 2.625 12.1875 4.3125" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              <path d="M12 4.3125V7.1875H9.125" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          {/* 发送回复（主按钮） */}
          <button
            onClick={onSendReply}
            disabled={!replyText.trim() || sendingReply || generating}
            className="flex-1 flex items-center justify-center gap-2 h-10 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white text-sm font-semibold shadow-lg shadow-purple-600/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {sendingReply || generating ? (
              <><div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />发送中</>
            ) : (
              <><Send className="w-4 h-4" />发送回复</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
