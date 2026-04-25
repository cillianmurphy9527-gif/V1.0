"use client"

import React, { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Zap, StopCircle, CheckCircle2, AlertTriangle,
  Mail, BarChart3, TrendingUp,
  Loader2, AlertCircle, Database, ArrowRight, Users, Send,
  Shield,
  Check, Clock
} from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { AgentAvatar } from "@/components/dashboard/AgentAvatar"
import { UpgradeModal } from "@/components/dashboard/UpgradeModal"
import { OnboardingTour } from "@/components/dashboard/OnboardingTour"
import { CampaignEstimateModal } from "@/components/dashboard/CampaignEstimateModal"
import { WorkbenchProvider, useWorkbench } from "@/contexts/WorkbenchContext"
import { NovaDrawer } from "@/components/dashboard/nova-workbench/NovaDrawer"
import { NovaForm, PLAN_WEIGHT } from "@/components/dashboard/NovaForm"
import { domainHealth } from "@/lib/dashboard/domain-health"
import { getPlan } from "@/config/pricing"

// ─── Types ───────────────────────────────────────────────
type AgentState = 'IDLE' | 'SEARCHING' | 'WRITING' | 'COOLING'
type WorkflowState = 'IDLE' | 'SAMPLING_REVIEW' | 'RUNNING' | 'PAUSED' | 'COMPLETED'

interface ExecutionLog {
  id: string; timestamp: string; message: string; type: 'info' | 'success' | 'warning'
}

interface EmailSample {
  id: string; recipientCompany: string; recipientEmail: string
  language: string; subject: string; content: string
}

interface MissionReport {
  totalFound: number; sent: number; successRate: number
  summary: string; topCountry: string; duration: string
}

// ─── 知识库统计：来自真实 /api/user/assets（ragFileCount） ────────────────────────

// ─── Quick-fill templates ────────────────────────────────
const TEMPLATES = [
  {
    label: "🌍 欧洲高端地接社",
    prompt: "寻找欧洲高端定制游地接社，推销中国入境游精品路线。重点强调我们在华的顶级接待资源与高净值客户定制经验，以及独家合作的五星级酒店资源。目标国家：法国、意大利、西班牙。联系方式：inbound@example.com"
  },
  {
    label: "🇩🇪 德国机械采购商",
    prompt: "帮我找德国的机械制造公司采购部门，介绍我们的精密零部件加工服务。优势：20年行业经验，ISO9001认证，公差±0.005mm，支持小批量定制，15天交货。联系方式：sales@example.com"
  },
  {
    label: "🇫🇷 法国钢材分销商",
    prompt: "锁定法国钢材分销商和工程承包商，介绍我们符合EN 10080欧盟标准的高强度钢筋产品。价格比欧洲本地供应商低20%，支持FOB深圳发货，提供完整材质证书。联系：steel@example.com"
  },
  {
    label: "🇮🇹 意大利时尚买手",
    prompt: "搜索意大利时装周买手和精品店采购总监，推销我们的定制成衣ODM服务。支持小批量起订（50件），14天打样，拥有OEKO-TEX认证面料。联系：fashion@example.com"
  },
]

// ─── Execution log：真实从 Campaign/Session 状态推导 ───────────────────────────────

const AGENT_CYCLE: AgentState[] = ['SEARCHING', 'WRITING', 'COOLING', 'SEARCHING']

const nowT = () => new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

// ─── Email samples：从真实 LLM 生成（按需） ────────────────────────────────────────

// ─── Tier Badge Helper ─────────────────────────────────────────────
function TierBadge({ tier, size = 'sm' }: { tier: string; size?: 'sm' | 'md' }) {
  // 统一使用 pricing.ts 的 getPlan 获取真实名称
  const plan = tier ? getPlan(tier as any) : null
  const planName = plan?.name || tier || '未订阅'
  const isMax     = tier === 'MAX'     || tier === 'ULTIMATE' || tier === '旗舰版' || tier === '规模化版'
  const isPro     = tier === 'PRO'     || tier === '专业版' || tier === '增长版'
  const isStarter = tier === 'STARTER'  || tier === '入门版' || tier === '试运营版'
  const isTrial   = !tier || tier === 'FREE' || tier === 'TRIAL' || tier === 'UNSUBSCRIBED' || tier === '试用' || tier === '未订阅'
  const base = size === 'md' ? 'px-3 py-1.5 text-sm' : 'px-2.5 py-1 text-xs'
  if (isMax) return (
    <span className={`inline-flex items-center gap-1 ${base} rounded-full font-extrabold border border-amber-300/50 bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 text-white shadow-[0_0_20px_rgba(245,158,11,0.8)] animate-pulse`}>
      👑 {planName}
    </span>
  )
  if (isPro) return (
    <span className={`inline-flex items-center gap-1 ${base} rounded-full font-bold bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-[0_0_12px_rgba(139,92,246,0.6)]`}>
      🚀 {planName}
    </span>
  )
  if (isStarter) return (
    <span className={`inline-flex items-center gap-1 ${base} rounded-full font-medium bg-slate-800 text-slate-300 border border-slate-700`}>
      🌱 {planName}
    </span>
  )
  if (isTrial) return (
    <span className={`inline-flex items-center gap-1 ${base} rounded-full font-bold bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-[0_0_12px_rgba(139,92,246,0.5)]`}>
      🎁 免费试用
    </span>
  )
  // fallback: unknown tier — show real name from pricing.ts
  return (
    <span className={`inline-flex items-center gap-1 ${base} rounded-full font-medium bg-slate-800 text-slate-400 border border-slate-700`}>
      {planName}
    </span>
  )
}


// ─── Dashboard Inner (needs WorkbenchContext) ────────────────────────────────

export type DashboardInitialUserAssets = {
  tokenBalance: number
  subscriptionTier: string
  ragFileCount: number
}

function DashboardInner({ initialUserAssets }: { initialUserAssets: DashboardInitialUserAssets }) {
  const { activeConfig, userPlan, assets, openDrawer, openDrawerToTab } = useWorkbench()

  const [workflow, setWorkflow]       = useState<WorkflowState>('IDLE')
  const [agentState, setAgentState]   = useState<AgentState>('IDLE')
  const [userPrompt, setUserPrompt]   = useState('')
  const [logs, setLogs]               = useState<ExecutionLog[]>([])
  const [campaignId, setCampaignId]   = useState<string | null>(null)
  const [sampleIdx, setSampleIdx]     = useState(0)
  const [showSampling, setShowSampling] = useState(false)
  const [emailSamples, setEmailSamples] = useState<EmailSample[]>([])
  const [loadingSamples, setLoadingSamples] = useState(false)
  const [report, setReport]           = useState<MissionReport | null>(null)
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [userAssets, setUserAssets] = useState<{
    tokenBalance: number
    subscriptionTier: string
    ragFileCount?: number
  }>(() => ({
    tokenBalance: initialUserAssets.tokenBalance,
    subscriptionTier: initialUserAssets.subscriptionTier || '未订阅',
    ragFileCount: initialUserAssets.ragFileCount ?? 0,
  }))

  useEffect(() => {
    const fetchUserAssets = async () => {
      try {
        const response = await fetch('/api/user/assets')
        if (response.ok) {
          const data = await response.json()
          setUserAssets({
            tokenBalance: data.tokenBalance ?? 0,
            subscriptionTier: data.subscriptionTier || '未订阅',
            ragFileCount: typeof data.ragFileCount === 'number' ? data.ragFileCount : 0,
          })
        }
      } catch (error) {
        console.error('Failed to fetch user assets:', error)
      }
    }
    fetchUserAssets()
  }, [])

  const tier = userAssets.subscriptionTier
  const [showEstimateModal, setShowEstimateModal] = useState(false)
  const [novaLaunchLoading, setNovaLaunchLoading] = useState(false)
  const [ticker, setTicker]           = useState('')   // 跑马灯文字

  // ── [TEMP MOCK] 强制显示 Dashboard 主体，暂时忽略知识库状态 ──────────────
  // TODO 上线前删除
  const kbFileCount = userAssets?.ragFileCount ?? 3  // 暂时 mock 为 3 个文件
  const hasKnowledge = false                          // 强制关闭知识库拦截
  // ──────────────────────────────────────────────────────────────────────────
  // ── 新增：战术配置状态 ──
  const [savedTactics, setSavedTactics] = useState<{id:string;label:string;prompt:string;color:string;category:string}[]>([
    { id:'t1', label:'🌍 欧洲高端地接社', prompt: TEMPLATES[0].prompt, color:'blue', category:'旅游' },
    { id:'t2', label:'🇩🇪 德国机械采购商', prompt: TEMPLATES[1].prompt, color:'purple', category:'机械' },
    { id:'t3', label:'🇫🇷 法国钢材分销商', prompt: TEMPLATES[2].prompt, color:'orange', category:'建材' },
    { id:'t4', label:'🇮🇹 意大利时尚买手', prompt: TEMPLATES[3].prompt, color:'pink', category:'消费' },
  ])
  // ── 战术保存 Dialog 状态 ──
  const [showSaveTacticDialog, setShowSaveTacticDialog] = useState(false)
  const [tacticName, setTacticName] = useState('')
  const [tacticCategory, setTacticCategory] = useState('通用')
  const [tacticColor, setTacticColor] = useState('blue')
  const [targetRegions, setTargetRegions]       = useState<string[]>([])
  const [targetIndustries, setTargetIndustries] = useState<string[]>([])
  const [targetPersonas, setTargetPersonas]     = useState<string[]>([])
  const [langChoice, setLangChoice]   = useState('自动检测')
  const [freqChoice, setFreqChoice]   = useState('标准速率')
  // ── 实时指标 ──
  const [metricLeads, setMetricLeads]     = useState(0)
  const [metricSent, setMetricSent]       = useState(0)
  const [metricHealth, setMetricHealth]   = useState(100)
  const [showAbortConfirm, setShowAbortConfirm] = useState(false)
  const [novaKeyword, setNovaKeyword] = useState('')  // 保留上下文兼容性
  const [novaTemplate, setNovaTemplate] = useState('intro-v1')  // 保留上下文兼容性

  // 域名健康度风险弹窗状态
  const [showDomainHealthWarning, setShowDomainHealthWarning] = useState(false)
  const [pendingLaunch, setPendingLaunch] = useState(false)

  // 未发信线索唤醒提醒
  const [showPendingReminder, setShowPendingReminder] = useState(false)
  const [pendingLeadsCount, setPendingLeadsCount] = useState(0)

  const logsEndRef    = useRef<HTMLDivElement>(null)
  const logTimerRef   = useRef<ReturnType<typeof setInterval> | null>(null)
  const agentTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const tickerTimer   = useRef<ReturnType<typeof setInterval> | null>(null)
  const statusTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastStatusRef = useRef<{ status?: string; emailsSent?: number; tokensUsed?: number } | null>(null)
  const { toast } = useToast()

  // ─── 页面加载时恢复运行中的任务状态 ───────────────────────────
  useEffect(() => {
    const restoreRunningTask = async () => {
      try {
        const res = await fetch('/api/campaigns/active')
        if (res.ok) {
          const data = await res.json()
          const activeCampaign = data?.campaign

          if (activeCampaign && activeCampaign.status === 'RUNNING') {
            setCampaignId(activeCampaign.id)
            setAgentState('SEARCHING')
            setWorkflow('RUNNING')
            console.log('[Dashboard] Restored running campaign:', activeCampaign.id)
          }
        }
      } catch (error) {
        console.error('[Dashboard] Failed to restore task:', error)
      }
    }

    // ─── 检查待发线索数量，唤醒提醒 ───────────────────────
    const checkPendingLeads = async () => {
      try {
        const res = await fetch('/api/delivery-logs?pending=true&limit=1')
        if (res.ok) {
          const data = await res.json()
          const count = data.count ?? 0
          setPendingLeadsCount(count)
          if (count > 0) {
            setShowPendingReminder(true)
          }
        }
      } catch (error) {
        console.error('[Dashboard] Failed to check pending leads:', error)
      }
    }

    restoreRunningTask()
    checkPendingLeads()
  }, [])

  // ─── Pre-flight Check ────────────────────────────────────────────────────────
  const [preflightFail, setPreflightFail] = useState<{
    reason: string
    field: 'tokens' | 'leads' | 'domains' | null
  } | null>(null)

  // Reactive domain slot (used in card UI only — actual check done in handleStart)
  const weight = PLAN_WEIGHT[userPlan as string] || 1
  const extra = (assets.addons_purchased || []).reduce((acc: number, key: string) => {
    if (key === 'domain-1') return acc + 1;
    if (key === 'domain-3') return acc + 3;
    if (key === 'domain-5') return acc + 5;
    return acc;
  }, 0)
  const slot = {
    used: activeConfig.activeDomains || 1,
    max: (weight >= 3 ? 10 : weight >= 2 ? 3 : 1) + extra,
  }

  // 自动滚动日志
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  // Agent 状态循环（RUNNING 时）
  useEffect(() => {
    if (workflow === 'RUNNING') {
      let i = 0
      agentTimerRef.current = setInterval(() => {
        i = (i + 1) % AGENT_CYCLE.length
        setAgentState(AGENT_CYCLE[i])
      }, 3000)
    } else {
      if (agentTimerRef.current) clearInterval(agentTimerRef.current)
      if (workflow === 'COMPLETED') setAgentState('IDLE')
    }
    return () => { if (agentTimerRef.current) clearInterval(agentTimerRef.current) }
  }, [workflow])

  // 跑马灯
  useEffect(() => {
    if (workflow !== 'RUNNING') { setTicker(''); return }
    const phrases = [
      '正在全球搜索目标客户...',
      'Nova 基于 RAG 知识库生成个性化邮件...',
      '智能轮换发信域名，规避风控...',
      '实时监控进箱率与回复信号...',
    ]
    let i = 0
    setTicker(phrases[0])
    tickerTimer.current = setInterval(() => {
      i = (i + 1) % phrases.length
      setTicker(phrases[i])
    }, 2500)
    return () => { if (tickerTimer.current) clearInterval(tickerTimer.current) }
  }, [workflow])

  const startLogSimulation = () => {
    // Phase 2：移除 Mock 日志序列。真实日志来自后端 Campaign/AgentSession 状态轮询。
    setLogs([{ id: `l-${Date.now()}`, timestamp: nowT(), message: '⏳ 等待后端任务状态...', type: 'info' }])
    setMetricLeads(0); setMetricSent(0); setMetricHealth(100)
  }

  const handleStart = () => {
    if (!userPrompt.trim()) {
      toast({ title: '请输入指令', description: '告诉 Nova 你想要什么', variant: 'destructive' })
      return
    }

    // ── Pre-flight Check ───────────────────────────────────────────────────
    const planWeight = PLAN_WEIGHT[userPlan as string] || 1
    const issues: { label: string; field: 'tokens' | 'leads' | 'domains' }[] = []

    if (assets.tokens <= 0) {
      issues.push({ label: '可用算力 Tokens 为 0', field: 'tokens' })
    }
    if (assets.leads <= 0) {
      issues.push({ label: '可用线索额度为 0', field: 'leads' })
    }
    const extraSlots = (assets.addons_purchased || []).reduce((acc: number, key: string) => {
      if (key === 'domain-1') return acc + 1;
      if (key === 'domain-3') return acc + 3;
      if (key === 'domain-5') return acc + 5;
      return acc;
    }, 0)
    const maxDomains = (planWeight >= 3 ? 10 : planWeight >= 2 ? 3 : 1) + extraSlots
    if ((activeConfig.activeDomains || 1) > maxDomains) {
      issues.push({ label: `域名数(${activeConfig.activeDomains})超出可用槽位(最大${maxDomains})`, field: 'domains' })
    }
    if ((activeConfig.activeDomains || 1) < 1) {
      issues.push({ label: '出动域名数必须 ≥ 1', field: 'domains' })
    }

    if (issues.length > 0) {
      setPreflightFail({ reason: issues[0].label, field: issues[0].field })
      toast({
        title: '⚠️ 资源不足',
        description: issues.map(i => i.label).join(' · '),
        variant: 'destructive',
      })
      return
    }

    setPreflightFail(null)

    // ── 域名健康度点火自检 ────────────────────────────────────────────────
    const dispatchCount = activeConfig.activeDomains || 1
    const hasDedicatedIP = activeConfig.dedicatedIP

    // 若未开启官方 IP 专线，且出动域名数 > 已预热域名数，则弹出风险警告
    if (!hasDedicatedIP && dispatchCount > domainHealth.ready) {
      setPendingLaunch(true)
      setShowDomainHealthWarning(true)
      return
    }

    // 弹出预估弹窗继续流程
    setShowEstimateModal(true)
  }

// ▼▼▼ 粘贴这段新代码 ▼▼▼
const handleConfirmEstimate = async (estimatedLeads: number) => {
  setNovaLaunchLoading(true)
  try {
    setWorkflow('RUNNING')
    setReport(null)
    startLogSimulation()

    setLogs((p) => [...p, { id: `ign-1`, timestamp: new Date().toLocaleTimeString(), message: '> 正在初始化主站任务库...', type: 'info' as const }])

    // 1. 先创建任务，拿到 ID
    const createRes = await fetch('/api/campaigns/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `Nova 任务 - ${new Date().toLocaleDateString()}`,
        systemPrompt: userPrompt,
        targetRegions,
        targetIndustries,
        targetPersonas,
        activeConfig,
      }),
    })
    const createData = await createRes.json()
    const newId = createData?.campaign?.id
    if (!newId) throw new Error(createData?.error || '任务 ID 生成失败')
    setCampaignId(newId)

    setLogs((p) => [...p, { id: `ign-2`, timestamp: new Date().toLocaleTimeString(), message: `> 身份证已生成: ${newId}`, type: 'success' as const }])

    // 2. 带着 ID 启动泥头车
    const startNovaRes = await fetch('/api/nova/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        campaignId: newId, 
        targetRegions,
        targetIndustries,
        targetPersonas,
        pitch: userPrompt,
      }),
    })
    
    if (!startNovaRes.ok) {
       const errData = await startNovaRes.json().catch(()=>({}))
       throw new Error(errData?.error || '泥头车点火失败')
    }

    // 3. 启动主站监控
    await fetch('/api/campaigns/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaignId: newId, estimatedLeads, activeConfig }),
    })

    setLogs((p) => [...p, { id: `ign-3`, timestamp: new Date().toLocaleTimeString(), message: `✅ 引擎挂载指令成功，泥头车出发！`, type: 'success' as const }])

    // 4. 开启状态轮询 (前端停止转圈的关键)
    if (statusTimerRef.current) clearInterval(statusTimerRef.current)
    statusTimerRef.current = setInterval(async () => {
      try {
          const res = await fetch(`/api/campaigns/status?campaignId=${newId}`)
          const data = await res.json()
          if (data?.campaign?.status !== 'RUNNING') {
            clearInterval(statusTimerRef.current!)
            setWorkflow('COMPLETED')
          }
      } catch(e) {}
    }, 5000)

  } catch (e: any) {
    setWorkflow('IDLE')
    toast({ title: '启动失败', description: e.message, variant: 'destructive' })
  } finally {
    setNovaLaunchLoading(false)
    setShowEstimateModal(false)
  }
}
// ▲▲▲ 新代码结束 ▲▲▲

  const handleApprove = () => {
    setShowSampling(false)
  }
  const handleAbort = async () => {
    if (!campaignId) {
      // 无 campaignId，直接前端清状态（兜底）
      if (logTimerRef.current) clearInterval(logTimerRef.current)
      if (agentTimerRef.current) clearInterval(agentTimerRef.current)
      if (statusTimerRef.current) clearInterval(statusTimerRef.current)
      logTimerRef.current = null
      agentTimerRef.current = null
      statusTimerRef.current = null
      lastStatusRef.current = null
      setWorkflow('IDLE'); setAgentState('IDLE'); setLogs([])
      setCampaignId(null); setReport(null)
      setMetricLeads(0); setMetricSent(0); setMetricHealth(100)
      setShowAbortConfirm(false)
      toast({ title: '任务已终止', variant: 'destructive' })
      return
    }

    // 停止所有定时器（但先不清状态，等 API 确认）
    if (logTimerRef.current) clearInterval(logTimerRef.current)
    if (agentTimerRef.current) clearInterval(agentTimerRef.current)
    if (statusTimerRef.current) clearInterval(statusTimerRef.current)
    logTimerRef.current = null
    agentTimerRef.current = null
    statusTimerRef.current = null

    // 必须等待后端返回 200 才清前端状态
    try {
      const stopRes = await fetch('/api/campaigns/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId }),
      })
      console.log('[handleAbort] API 返回状态:', stopRes.status)

      if (!stopRes.ok) {
        const errData = await stopRes.json().catch(() => ({}))
        console.error('[handleAbort] 停止失败, 后端返回:', errData)
        toast({
          title: '终止失败',
          description: errData?.error || '后端返回异常，状态未清除，请刷新页面',
          variant: 'destructive',
        })
        // 失败时重新启动轮询
        if (campaignId) {
          statusTimerRef.current = setInterval(async () => {
            try {
              const s = await fetch(`/api/campaigns/status?campaignId=${campaignId}`)
              const d = await s.json()
              const cStatus = d?.campaign?.status
              if (cStatus && cStatus !== 'RUNNING') {
                if (statusTimerRef.current) clearInterval(statusTimerRef.current)
                setWorkflow('COMPLETED')
              }
            } catch (_e) {}
          }, 5000)
        }
        return
      }

      // 后端确认成功 → 彻底清空所有前端状态
      lastStatusRef.current = null
      setWorkflow('IDLE')
      setAgentState('IDLE')
      setLogs([])
      setCampaignId(null)
      setReport(null)
      setMetricLeads(0)
      setMetricSent(0)
      setMetricHealth(100)
      setShowAbortConfirm(false)

      toast({ title: '任务已终止', description: '后端已确认停止，所有状态已重置', variant: 'destructive' })
    } catch (e) {
      toast({
        title: '网络错误',
        description: '无法连接到服务器，请检查网络后重试',
        variant: 'destructive',
      })
      // 网络错误时不清状态，留给下次轮询处理
    }
  }
  const handleReset = () => { setWorkflow('IDLE'); setAgentState('IDLE'); setLogs([]); setReport(null); setUserPrompt('') }

  const isRunning  = workflow === 'RUNNING'
  const isComplete = workflow === 'COMPLETED'

  return (
    <>
      <div className="min-h-screen bg-slate-950 text-white">
        <div className="container mx-auto px-6 py-8 max-w-7xl">
          {false ? (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="flex items-center justify-center min-h-[80vh]">
            <div className="max-w-xl w-full">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/30 to-red-500/30 rounded-3xl blur-3xl" />
                <div className="relative bg-slate-900/90 border-2 border-amber-500/40 rounded-3xl p-10 text-center">
                  <div className="flex justify-center mb-6">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-amber-500 to-red-500 flex items-center justify-center shadow-2xl shadow-amber-500/40 animate-pulse">
                      <AlertTriangle className="w-12 h-12 text-white" />
                    </div>
                  </div>
                  <h2 className="text-3xl font-bold text-white mb-3">Nova 缺乏产品记忆</h2>
                  <p className="text-slate-400 text-base leading-relaxed mb-8">知识库为空 — 为防止 Nova 产生幻觉，请先前往知识库为其注入灵魂。</p>
                  <Link href="/knowledge-base">
                    <button className="w-full py-4 rounded-2xl font-bold text-white text-lg bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 shadow-xl transition-all flex items-center justify-center gap-3">
                      <Database className="w-5 h-5" />前往知识库上传资料<ArrowRight className="w-5 h-5" />
                    </button>
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-4xl font-bold mb-1">指挥中心</h1>
                <p className="text-slate-400">知识库已就绪 · {kbFileCount} 个文件 · Nova 待命</p>
              </div>
              <div className="flex items-center gap-4">
                {/* 钱包与余额 */}
                <div className="flex items-center gap-3 px-5 py-3 bg-gradient-to-br from-slate-900/90 to-slate-800/90 border border-slate-700/50 rounded-2xl backdrop-blur-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
                      <Zap className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <TierBadge tier={userAssets.subscriptionTier} />
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-xl font-bold text-white">{userAssets.tokenBalance.toLocaleString()}</span>
                        <span className="text-xs text-slate-400">tokens 剩余</span>
                      </div>
                      <div className="mt-1 w-32 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-amber-500 to-orange-500" style={{ width: `${Math.min((userAssets.tokenBalance / 50000) * 100, 100)}%` }} />
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 ml-2">
                    <Link href="/billing">
                      <Button size="sm" className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-xs px-4 py-1.5 h-auto">
                        升级套餐
                      </Button>
                    </Link>
                    <Link href="/billing">
                      <Button size="sm" variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-800 text-xs px-4 py-1.5 h-auto">
                        充值算力
                      </Button>
                    </Link>
                  </div>
                </div>
                
                <AnimatePresence>
                  {isRunning && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-full">
                    <motion.div animate={{ scale: [1,1.4,1] }} transition={{ duration: 1.5, repeat: Infinity }}
                      className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span className="text-emerald-400 text-sm font-medium">Nova 云端运行中 · 可安全关闭页面</span>
                  </motion.div>
                )}
                </AnimatePresence>
              </div>
            </div>

            <div className="grid lg:grid-cols-5 gap-6">
              <NovaForm
                isRunning={isRunning}
                workflow={workflow}
                novaLaunchLoading={novaLaunchLoading}
                preflightFail={preflightFail}
                onStartClick={handleStart}
                targetRegions={targetRegions}
                setTargetRegions={setTargetRegions}
                targetIndustries={targetIndustries}
                setTargetIndustries={setTargetIndustries}
                targetPersonas={targetPersonas}
                setTargetPersonas={setTargetPersonas}
                userPrompt={userPrompt}
                setUserPrompt={setUserPrompt}
                savedTactics={savedTactics}
                setSavedTactics={setSavedTactics}
                showSaveTacticDialog={showSaveTacticDialog}
                setShowSaveTacticDialog={setShowSaveTacticDialog}
                tacticName={tacticName}
                setTacticName={setTacticName}
                tacticCategory={tacticCategory}
                setTacticCategory={setTacticCategory}
                tacticColor={tacticColor}
                setTacticColor={setTacticColor}
                slot={slot}
              />


              {/* 区域2+3 */}
              <div className="lg:col-span-2 space-y-5">
                {/* 监控区 */}
                <motion.div layout animate={{ scale: isRunning ? 1.02 : 1 }} transition={{ duration: 0.4 }}
                  className={`relative rounded-3xl border transition-all duration-500 ${
                    isRunning ? 'border-emerald-500/50 bg-slate-900/90 shadow-2xl shadow-emerald-500/10' : 'border-slate-800 bg-slate-900/60'
                  }`}
                  data-onboarding="agent-monitor"
                >
                  {isRunning && <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-cyan-500/5 rounded-3xl" />}
                  <div className="relative p-5">
                    {/* 标题行 */}
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="font-semibold text-white flex items-center gap-2">
                        {isRunning ? <Loader2 className="w-4 h-4 animate-spin text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-slate-500" />}
                        实时执行监控
                      </h2>
                      {isRunning && (
                        <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                          <motion.span animate={{ opacity:[1,0.3,1] }} transition={{ duration:1.5, repeat:Infinity }} className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                          LIVE
                        </span>
                      )}
                    </div>

                    {/* Avatar + 跑马灯 */}
                    <div className="flex items-center gap-4 mb-4">
                      <AgentAvatar state={agentState} size={56} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-500 mb-0.5">Nova 状态</p>
                        <p className="text-sm font-bold text-white tracking-wide">{agentState}</p>
                        {isRunning && ticker && (
                          <motion.p key={ticker} initial={{ opacity:0, y:4 }} animate={{ opacity:1, y:0 }}
                            className="text-xs text-emerald-400 mt-1 truncate">{ticker}</motion.p>
                        )}
                      </div>
                    </div>

                    {/* 实时指标卡片 */}
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      {[
                        { label: '挖掘线索', value: metricLeads > 0 ? `${metricLeads}/500` : '—', color: 'blue', dot: '#3b82f6' },
                        { label: '成功投递', value: metricSent > 0 ? String(metricSent) : '—', color: 'emerald', dot: '#10b981' },
                        { label: '域名健康', value: isRunning ? `${metricHealth}%` : '—', color: metricHealth >= 95 ? 'emerald' : 'amber', dot: metricHealth >= 95 ? '#10b981' : '#f59e0b' },
                      ].map(s => (
                        <motion.div key={s.label}
                          className="bg-slate-800/70 border border-slate-700/50 rounded-xl p-2.5 text-center"
                        >
                          <motion.p
                            key={s.value}
                            initial={{ opacity:0, y:-4 }}
                            animate={{ opacity:1, y:0 }}
                            className={`text-base font-bold text-${s.color}-400 tabular-nums`}
                          >{s.value}</motion.p>
                          <p className="text-xs text-slate-600 mt-0.5">{s.label}</p>
                        </motion.div>
                      ))}
                    </div>

                    {/* 极客终端日志 */}
                    <div className="rounded-2xl overflow-hidden border border-slate-700/50 shadow-inner">
                      {/* Mac 风格顶栏 */}
                      <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-800/80 border-b border-slate-700/50">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                        <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                        <span className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
                        <span className="ml-auto text-xs text-slate-600 font-mono">leadpilot-agent — bash</span>
                      </div>
                      <div className="bg-slate-950 p-3 h-44 overflow-y-auto font-mono text-xs">
                        {logs.length === 0 ? (
                          <p className="text-slate-700 text-center mt-16">$ waiting for task...</p>
                        ) : logs.map((log, i) => {
                          const level = log.type === 'success' ? 'INFO ' : log.type === 'warning' ? 'WARN ' : 'SYS  '
                          const cls = log.type === 'success' ? 'text-green-400' :
                            log.type === 'warning' ? 'text-yellow-400' : 'text-slate-300'
                          const pulse = log.type === 'warning' ? 'animate-pulse' : ''
                          return (
                            <motion.div key={log.id} initial={{ opacity:0, x:-6 }} animate={{ opacity:1, x:0 }}
                              transition={{ delay: Math.min(i*0.02, 0.3) }}
                              className={`flex gap-2 py-0.5 leading-relaxed ${cls} ${pulse}`}
                            >
                              <span className="text-slate-600 flex-shrink-0">[{log.timestamp}]</span>
                              <span className="text-slate-500 flex-shrink-0">[{level}]</span>
                              <span>{log.message}</span>
                            </motion.div>
                          )
                        })}
                        <div ref={logsEndRef} />
                      </div>
                    </div>

                    {/* ── 系统遥测面板 ── */}
                    <div className="mt-3 rounded-xl overflow-hidden border border-slate-800/70">
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900/80 border-b border-slate-800/70">
                        <Shield className="w-2.5 h-2.5 text-slate-600" />
                        <span className="text-[9px] text-slate-600 font-mono font-semibold uppercase tracking-widest">SYS.TELEMETRY</span>
                        <span className="ml-auto text-[9px] text-slate-700 font-mono">v2.4.1</span>
                      </div>
                      <div className="grid grid-cols-3 divide-x divide-slate-800/60">
                        {/* ① 发信矩阵健康度 */}
                        <div className="flex items-center gap-2 px-3 py-2.5">
                          <span className="text-[10px]">🛡️</span>
                          <div className="min-w-0">
                            <p className="text-[9px] text-slate-600 leading-tight">发信矩阵</p>
                            <p className="text-[10px] text-emerald-500 font-semibold leading-tight mt-0.5">100% 极佳</p>
                            <p className="text-[9px] text-slate-700 leading-tight">无拦截风险</p>
                          </div>
                        </div>
                        {/* ② AI 算力预估 */}
                        <div className="flex items-center gap-2 px-3 py-2.5">
                          <span className="text-[10px]">⚡️</span>
                          <div className="min-w-0">
                            <p className="text-[9px] text-slate-600 leading-tight">AI 算力预估</p>
                            <p className="text-[10px] text-blue-400 font-semibold leading-tight mt-0.5">~120 Tokens/封</p>
                            <p className="text-[9px] text-slate-700 leading-tight">单次生成</p>
                          </div>
                        </div>
                        {/* ③ 并发速率墙 */}
                        <div className="flex items-center gap-2 px-3 py-2.5">
                          <span className="text-[10px]">📊</span>
                          <div className="min-w-0">
                            <p className="text-[9px] text-slate-600 leading-tight">并发速率墙</p>
                            <p className="text-[10px] text-amber-400 font-semibold leading-tight mt-0.5">40封/时/域</p>
                            <p className="text-[9px] text-slate-700 leading-tight">安全预热期</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Kill Switch */}
                    <motion.button
                      onClick={() => isRunning && setShowAbortConfirm(true)}
                      disabled={!isRunning}
                      whileHover={isRunning ? { scale: 1.02 } : {}}
                      whileTap={isRunning ? { scale: 0.97 } : {}}
                      className={`mt-4 w-full py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                        isRunning
                          ? 'bg-red-600/20 border-2 border-red-500/60 text-red-400 hover:bg-red-600/30 hover:border-red-500 shadow-lg shadow-red-500/10'
                          : 'bg-slate-800/40 border border-slate-700/40 text-slate-600 cursor-not-allowed'
                      }`}
                    >
                      <StopCircle className={`w-4 h-4 ${isRunning ? 'animate-pulse' : ''}`} />
                      紧急终止当前任务
                    </motion.button>

                  </div>
                </motion.div>

                {/* 战报输出区 */}
                <AnimatePresence>
                  {isComplete && report && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="relative rounded-3xl border border-blue-500/30 bg-slate-900/80 overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 to-purple-600/10" />
                      <div className="relative p-5">
                        <div className="flex items-center justify-between mb-4">
                          <h2 className="font-semibold text-white flex items-center gap-2">
                            <BarChart3 className="w-4 h-4 text-blue-400" />战报输出
                          </h2>
                          <button onClick={handleReset} className="text-xs text-slate-500 hover:text-white px-2 py-1 rounded-lg hover:bg-slate-800 transition-all">新任务</button>
                        </div>
                        <div className="grid grid-cols-3 gap-3 mb-4">
                          {[
                            { label: '找到客户', value: String(report.totalFound), Icon: Users, color: '#3b82f6' },
                            { label: '发送成功', value: String(report.sent), Icon: Send, color: '#10b981' },
                            { label: '进箱率', value: `${report.successRate}%`, Icon: TrendingUp, color: '#f97316' },
                          ].map(s => (
                            <div key={s.label} className="bg-slate-800/60 rounded-xl p-3 text-center">
                              <s.Icon className="w-4 h-4 mx-auto mb-1" style={{ color: s.color }} />
                              <p className="text-lg font-bold text-white">{s.value}</p>
                              <p className="text-xs text-slate-500">{s.label}</p>
                            </div>
                          ))}
                        </div>
                        <div className="bg-slate-800/40 rounded-xl p-4">
                          <p className="text-xs text-slate-500 mb-1">AI 执行总结</p>
                          <p className="text-sm text-slate-300 leading-relaxed">{report.summary}</p>
                          <div className="flex gap-4 mt-3 text-xs text-slate-500">
                            <span>最多：{report.topCountry}</span>
                            <span>耗时：{report.duration}</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>

    {/* 二次确认弹窗 */}
    <AnimatePresence>
      {showAbortConfirm && (
        <>
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60]" onClick={() => setShowAbortConfirm(false)} />
          <div className="fixed inset-0 flex items-center justify-center z-[60] p-4">
            <motion.div initial={{ opacity:0, scale:0.85, y:20 }} animate={{ opacity:1, scale:1, y:0 }} exit={{ opacity:0, scale:0.85 }}
              className="max-w-sm w-full bg-slate-900 border-2 border-red-500/40 rounded-3xl p-8 shadow-2xl shadow-red-500/20 text-center">
              <motion.div animate={{ rotate:[0,-8,8,-4,4,0] }} transition={{ duration:0.5, delay:0.1 }}
                className="w-16 h-16 rounded-full bg-red-500/20 border-2 border-red-500/50 flex items-center justify-center mx-auto mb-5">
                <StopCircle className="w-8 h-8 text-red-400" />
              </motion.div>
              <h3 className="text-xl font-bold text-white mb-2">确认紧急终止？</h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-6">此操作将立即停止所有发信队列并清空任务。已发出的邮件无法撤回。</p>
              <div className="flex gap-3">
                <button onClick={() => setShowAbortConfirm(false)}
                  className="flex-1 py-3 rounded-xl border border-slate-600 text-slate-300 hover:bg-slate-800 font-medium transition-all text-sm">取消</button>
                <motion.button onClick={handleAbort}
                  whileHover={{ scale:1.03 }} whileTap={{ scale:0.97 }}
                  className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold shadow-lg shadow-red-500/30 transition-all text-sm flex items-center justify-center gap-2">
                  <StopCircle className="w-4 h-4" />确认终止
                </motion.button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>

    {/* 抽查弹窗 */}
    <AnimatePresence>
      {showSampling && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50" onClick={() => { setShowSampling(false); setWorkflow('IDLE') }} />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}
              className="max-w-3xl w-full max-h-[90vh] bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
              <div className="p-6 border-b border-slate-800">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                    <Mail className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">AI 已生成样例开发信</h3>
                    <p className="text-slate-400 text-sm">请抽查确认无误后放行发送</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {emailSamples.map((s, i) => (
                    <button key={s.id} onClick={() => setSampleIdx(i)}
                      className={`flex-1 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                        sampleIdx === i ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                      }`}>样例 {i+1} · {s.language}</button>
                  ))}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                <AnimatePresence mode="wait">
                  {loadingSamples ? (
                    <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="flex items-center justify-center py-20 text-slate-400">
                      <Loader2 className="w-6 h-6 animate-spin mr-2" />生成样例中...
                    </motion.div>
                  ) : emailSamples.length === 0 ? (
                    <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="text-center py-20 text-slate-500">
                      暂无样例。请稍后重试。
                    </motion.div>
                  ) : (
                    <motion.div key={sampleIdx} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}>
                      <div className="grid grid-cols-2 gap-4 mb-4 bg-slate-800/50 rounded-xl p-4">
                        <div><p className="text-xs text-slate-500 mb-1">收件公司</p><p className="text-white font-semibold text-sm">{emailSamples[sampleIdx]?.recipientCompany || '—'}</p></div>
                        <div><p className="text-xs text-slate-500 mb-1">收件邮箱</p><p className="text-white font-semibold text-sm">{emailSamples[sampleIdx]?.recipientEmail || '—'}</p></div>
                      </div>
                      <div className="mb-4">
                        <p className="text-xs text-slate-500 mb-1">主题</p>
                        <div className="bg-slate-800/50 rounded-xl p-3 text-white text-sm font-semibold">{emailSamples[sampleIdx]?.subject || '—'}</div>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-1">正文</p>
                        <div className="bg-slate-800/50 rounded-xl p-4 text-slate-300 whitespace-pre-wrap text-sm leading-relaxed font-mono">{emailSamples[sampleIdx]?.content || '—'}</div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <div className="p-6 border-t border-slate-800 flex gap-4">
                <button onClick={() => { setShowSampling(false); setWorkflow('IDLE') }}
                  className="flex-1 py-3 rounded-xl border border-slate-600 text-slate-300 hover:bg-slate-800 font-medium transition-all">返回修改指令</button>
                <button onClick={handleApprove}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-bold shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />确认无误，放行全量发送
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>

    <UpgradeModal isOpen={showUpgrade} onClose={() => setShowUpgrade(false)}
      feature="多语言引擎 & 并发域名" currentTier={userAssets.subscriptionTier} targetTier="专业版" price={599} />

    {/* 发信预估弹窗 */}
    <CampaignEstimateModal
      isOpen={showEstimateModal}
      onClose={() => !novaLaunchLoading && setShowEstimateModal(false)}
      onConfirm={handleConfirmEstimate}
      currentTokenBalance={userAssets.tokenBalance}
      subscriptionTier={userAssets.subscriptionTier}
    />

    {/* 新手引导组件 */}
    <OnboardingTour 
      isFirstTime={false} 
      onComplete={() => {}}
    />

    <NovaDrawer />

    {/* 未发信线索唤醒提醒弹窗 (白底 SaaS 风格) */}
    <AnimatePresence>
      {showPendingReminder && pendingLeadsCount > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/20 z-50 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden"
          >
            <div className="p-6">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center flex-shrink-0">
                  <Mail className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">You have unsent leads</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Your account has <span className="font-semibold text-gray-700">{pendingLeadsCount}</span> pending delivery tasks.
                    Ready to send?
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowPendingReminder(false)
                    router.push('/delivery-logs')
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors"
                >
                  Process Pending Leads
                </button>
                <button
                  onClick={() => setShowPendingReminder(false)}
                  className="flex-1 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium text-sm transition-colors"
                >
                  Start New Search
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* 域名健康度风险警告弹窗 */}
    <AnimatePresence>
      {showDomainHealthWarning && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[70]"
            onClick={() => { setShowDomainHealthWarning(false); setPendingLaunch(false) }}
          />
          <div className="fixed inset-0 flex items-center justify-center z-[70] p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="max-w-md w-full bg-gradient-to-br from-slate-900 to-slate-950 border-2 border-amber-500/40 rounded-3xl p-8 shadow-2xl shadow-amber-500/20"
            >
              {/* 警告图标 */}
              <div className="flex justify-center mb-6">
                <motion.div
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 border-2 border-amber-500/50 flex items-center justify-center"
                >
                  <AlertTriangle className="w-10 h-10 text-amber-400" />
                </motion.div>
              </div>

              {/* 标题 */}
              <h3 className="text-xl font-bold text-white text-center mb-4">
                ⚠️ 域名预热风险警告
              </h3>

              {/* 内容 */}
              <div className="bg-slate-800/50 rounded-2xl p-4 mb-6 border border-slate-700/50">
                <p className="text-slate-300 text-sm leading-relaxed">
                  您计划调用 <span className="text-amber-400 font-bold">{activeConfig.activeDomains || 1}</span> 个域名，
                  但当前仅有 <span className="text-emerald-400 font-bold">{domainHealth.ready}</span> 个完成预热。
                </p>
                <p className="text-slate-300 text-sm leading-relaxed mt-3">
                  强行使用未完成预热的域名，会导致<span className="text-red-400 font-bold">极高的封号风险</span>。
                </p>
                <p className="text-slate-400 text-sm mt-3">
                  是否继续？
                </p>
              </div>

              {/* 域名健康状态 */}
              <div className="flex justify-center gap-6 mb-6">
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mx-auto mb-2">
                    <Check className="w-6 h-6 text-emerald-400" />
                  </div>
                  <p className="text-2xl font-bold text-emerald-400">{domainHealth.ready}</p>
                  <p className="text-xs text-slate-500">已预热</p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mx-auto mb-2">
                    <Clock className="w-6 h-6 text-amber-400" />
                  </div>
                  <p className="text-2xl font-bold text-amber-400">{domainHealth.warming}</p>
                  <p className="text-xs text-slate-500">预热中</p>
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => {
                    setShowDomainHealthWarning(false)
                    setPendingLaunch(false)
                    toast({
                      title: '建议等待域名预热完成',
                      description: `当前 ${domainHealth.warming} 个域名正在预热中，预计 3-7 天后可全部就绪`,
                    })
                  }}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-bold text-base shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  暂不启动（建议预热）
                </button>
                <button
                  onClick={() => {
                    setShowDomainHealthWarning(false)
                    setPendingLaunch(false)
                    toast({
                      title: '已确认风险，继续启动',
                      description: '警告：使用未完成预热的域名存在极高封号风险',
                      variant: 'destructive',
                    })
                    setShowEstimateModal(true)
                  }}
                  className="w-full py-3.5 rounded-2xl bg-red-600/20 border-2 border-red-500/60 text-red-400 hover:bg-red-600/30 font-semibold text-sm transition-all"
                >
                  承担风险强制启动
                </button>
                <button
                  onClick={() => { setShowDomainHealthWarning(false); setPendingLaunch(false) }}
                  className="w-full py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 font-medium text-sm transition-all"
                >
                  返回修改
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
    </>
  )
}

// ─── Client 入口：由服务端 page 传入初始资产 ───────────────────────────────────

export function DashboardPageClient({
  initialUserAssets,
}: {
  initialUserAssets: DashboardInitialUserAssets
}) {
  return (
    <WorkbenchProvider>
      <DashboardInner initialUserAssets={initialUserAssets} />
    </WorkbenchProvider>
  )
}
 
    