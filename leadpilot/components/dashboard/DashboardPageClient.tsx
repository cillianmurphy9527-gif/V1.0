// @ts-nocheck
"use client"

import React, { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Zap, StopCircle, CheckCircle2, AlertTriangle,
  Mail, BarChart3, TrendingUp,
  Loader2, AlertCircle, Shield,
  Check, Clock, Users, Send
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
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

const TEMPLATES = [
  { label: "🌍 欧洲高端地接社", prompt: "寻找欧洲高端定制游地接社，推销中国入境游精品路线。重点强调我们在华的顶级接待资源与高净值客户定制经验，以及独家合作的五星级酒店资源。目标国家：法国、意大利、西班牙。联系方式：inbound@example.com" },
  { label: "🇩🇪 德国机械采购商", prompt: "帮我找德国的机械制造公司采购部门，介绍我们的精密零部件加工服务。优势：20年行业经验，ISO9001认证，公差±0.005mm，支持小批量定制，15天交货。联系方式：sales@example.com" },
  { label: "🇫🇷 法国钢材分销商", prompt: "锁定法国钢材分销商和工程承包商，介绍我们符合EN 10080欧盟标准的高强度钢筋产品。价格比欧洲本地供应商低20%，支持FOB深圳发货，提供完整材质证书。联系：steel@example.com" },
  { label: "🇮🇹 意大利时尚买手", prompt: "搜索意大利时装周买手和精品店采购总监，推销我们的定制成衣ODM服务。支持小批量起订（50件），14天打样，拥有OEKO-TEX认证面料。联系：fashion@example.com" },
]

const AGENT_CYCLE = ['SEARCHING', 'WRITING', 'COOLING', 'SEARCHING']

const nowT = () => new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

function TierBadge({ tier, size = 'sm' }: any) {
  const planName = tier || '未订阅'
  const isMax = tier === 'MAX' || tier === 'ULTIMATE' || tier === '旗舰版' || tier === '规模化版'
  const isPro = tier === 'PRO' || tier === '专业版' || tier === '增长版'
  const isStarter = tier === 'STARTER' || tier === '入门版' || tier === '试运营版'
  const isTrial = !tier || tier === 'FREE' || tier === 'TRIAL' || tier === 'UNSUBSCRIBED' || tier === '试用' || tier === '未订阅'
  const base = size === 'md' ? 'px-3 py-1.5 text-sm' : 'px-2.5 py-1 text-xs'
  
  if (isMax) return <span className={`inline-flex items-center gap-1 ${base} rounded-full font-extrabold border border-amber-300/50 bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 text-white shadow-[0_0_20px_rgba(245,158,11,0.8)] animate-pulse`}>👑 {planName}</span>
  if (isPro) return <span className={`inline-flex items-center gap-1 ${base} rounded-full font-bold bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-[0_0_12px_rgba(139,92,246,0.6)]`}>🚀 {planName}</span>
  if (isStarter) return <span className={`inline-flex items-center gap-1 ${base} rounded-full font-medium bg-slate-800 text-slate-300 border border-slate-700`}>🌱 {planName}</span>
  if (isTrial) return <span className={`inline-flex items-center gap-1 ${base} rounded-full font-bold bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-[0_0_12px_rgba(139,92,246,0.5)]`}>🎁 免费试用</span>
  return <span className={`inline-flex items-center gap-1 ${base} rounded-full font-medium bg-slate-800 text-slate-400 border border-slate-700`}>{planName}</span>
}

function DashboardInner({ initialUserAssets }: any) {
  const { activeConfig, userPlan, assets } = useWorkbench() as any
  const router = useRouter()

  const [workflow, setWorkflow] = useState('IDLE')
  const [agentState, setAgentState] = useState('IDLE')
  const [userPrompt, setUserPrompt] = useState('')
  const [logs, setLogs] = useState([])
  const [campaignId, setCampaignId] = useState(null)
  const [sampleIdx, setSampleIdx] = useState(0)
  const [showSampling, setShowSampling] = useState(false)
  const [emailSamples, setEmailSamples] = useState([])
  const [loadingSamples, setLoadingSamples] = useState(false)
  const [report, setReport] = useState(null)
  const [showUpgrade, setShowUpgrade] = useState(false)
  
  const [userAssets, setUserAssets] = useState(() => ({
    tokenBalance: initialUserAssets?.tokenBalance || 0,
    subscriptionTier: initialUserAssets?.subscriptionTier || '未订阅',
    ragFileCount: initialUserAssets?.ragFileCount || 0,
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
      } catch (error) {}
    }
    fetchUserAssets()
  }, [])

  const [showEstimateModal, setShowEstimateModal] = useState(false)
  const [novaLaunchLoading, setNovaLaunchLoading] = useState(false)
  const [ticker, setTicker] = useState('')

  const kbFileCount = userAssets.ragFileCount 

  const [savedTactics, setSavedTactics] = useState([
    { id:'t1', label:'🌍 欧洲高端地接社', prompt: TEMPLATES[0].prompt, color:'blue', category:'旅游' },
    { id:'t2', label:'🇩🇪 德国机械采购商', prompt: TEMPLATES[1].prompt, color:'purple', category:'机械' },
    { id:'t3', label:'🇫🇷 法国钢材分销商', prompt: TEMPLATES[2].prompt, color:'orange', category:'建材' },
    { id:'t4', label:'🇮🇹 意大利时尚买手', prompt: TEMPLATES[3].prompt, color:'pink', category:'消费' },
  ])
  
  const [showSaveTacticDialog, setShowSaveTacticDialog] = useState(false)
  const [tacticName, setTacticName] = useState('')
  const [tacticCategory, setTacticCategory] = useState('通用')
  const [tacticColor, setTacticColor] = useState('blue')
  const [targetRegions, setTargetRegions] = useState([])
  const [targetIndustries, setTargetIndustries] = useState([])
  const [targetPersonas, setTargetPersonas] = useState([])

  const [metricLeads, setMetricLeads] = useState(0)
  const [metricSent, setMetricSent] = useState(0)
  const [metricHealth, setMetricHealth] = useState(100)
  const [showAbortConfirm, setShowAbortConfirm] = useState(false)

  const [showDomainHealthWarning, setShowDomainHealthWarning] = useState(false)
  const [pendingLaunch, setPendingLaunch] = useState(false)

  const [showPendingReminder, setShowPendingReminder] = useState(false)
  const [pendingLeadsCount, setPendingLeadsCount] = useState(0)

  const logsEndRef = useRef(null)
  const logTimerRef = useRef(null)
  const agentTimerRef = useRef(null)
  const tickerTimer = useRef(null)
  const statusTimerRef = useRef(null)
  const { toast } = useToast()

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
          }
        }
      } catch (error) {}
    }

    const checkPendingLeads = async () => {
      try {
        const res = await fetch('/api/delivery-logs?pending=true&limit=1')
        if (res.ok) {
          const data = await res.json()
          const count = data.count ?? 0
          setPendingLeadsCount(count)
          if (count > 0) setShowPendingReminder(true)
        }
      } catch (error) {}
    }

    restoreRunningTask()
    checkPendingLeads()
  }, [])

  const [preflightFail, setPreflightFail] = useState(null)

  const weight = PLAN_WEIGHT[userPlan] || 1
  const extra = (assets?.addons_purchased || []).reduce((acc: number, key: string) => {
    if (key === 'domain-1') return acc + 1;
    if (key === 'domain-3') return acc + 3;
    if (key === 'domain-5') return acc + 5;
    return acc;
  }, 0)
  
  const slot = {
    used: activeConfig?.activeDomains || 1,
    max: (weight >= 3 ? 10 : weight >= 2 ? 3 : 1) + extra,
  }

  useEffect(() => { logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [logs])

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

  useEffect(() => {
    if (workflow !== 'RUNNING') { setTicker(''); return }
    const phrases = ['正在全球搜索目标客户...', 'Nova 基于 RAG 知识库生成个性化邮件...', '智能轮换发信域名，规避风控...', '实时监控进箱率与回复信号...']
    let i = 0
    setTicker(phrases[0])
    tickerTimer.current = setInterval(() => {
      i = (i + 1) % phrases.length
      setTicker(phrases[i])
    }, 2500)
    return () => { if (tickerTimer.current) clearInterval(tickerTimer.current) }
  }, [workflow])

  const startLogSimulation = () => {
    setLogs([{ id: `l-${Date.now()}`, timestamp: nowT(), message: '⏳ 等待后端任务状态...', type: 'info' }])
    setMetricLeads(0); setMetricSent(0); setMetricHealth(100)
  }

  const handleStart = () => {
    if (!userPrompt.trim()) {
      toast({ title: '请输入指令', description: '告诉 Nova 你想要什么', variant: 'destructive' })
      return
    }

    const planWeight = PLAN_WEIGHT[userPlan] || 1
    const issues = []

    if (assets?.tokens <= 0) issues.push({ label: '可用算力 Tokens 为 0', field: 'tokens' })
    if (assets?.leads <= 0) issues.push({ label: '可用线索额度为 0', field: 'leads' })
    
    const extraSlots = (assets?.addons_purchased || []).reduce((acc: number, key: string) => {
      if (key === 'domain-1') return acc + 1;
      if (key === 'domain-3') return acc + 3;
      if (key === 'domain-5') return acc + 5;
      return acc;
    }, 0)
    const maxDomains = (planWeight >= 3 ? 10 : planWeight >= 2 ? 3 : 1) + extraSlots
    
    if ((activeConfig?.activeDomains || 1) > maxDomains) issues.push({ label: `域名数(${activeConfig?.activeDomains})超出可用槽位(最大${maxDomains})`, field: 'domains' })
    if ((activeConfig?.activeDomains || 1) < 1) issues.push({ label: '出动域名数必须 ≥ 1', field: 'domains' })

    if (issues.length > 0) {
      setPreflightFail({ reason: issues[0].label, field: issues[0].field })
      toast({ title: '⚠️ 资源不足', description: issues.map(i => i.label).join(' · '), variant: 'destructive' })
      return
    }

    setPreflightFail(null)
    const dispatchCount = activeConfig?.activeDomains || 1
    if (!activeConfig?.dedicatedIP && dispatchCount > domainHealth.ready) {
      setPendingLaunch(true)
      setShowDomainHealthWarning(true)
      return
    }
    setShowEstimateModal(true)
  }

  const handleConfirmEstimate = async (estimatedLeads: number) => {
    setNovaLaunchLoading(true)
    try {
      setWorkflow('RUNNING')
      setReport(null)
      startLogSimulation()

      setLogs((p) => [...p, { id: `ign-${Date.now()}-1`, timestamp: nowT(), message: '> 正在初始化主站任务库...', type: 'info' }])

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

      setLogs((p) => [...p, { id: `ign-${Date.now()}-2`, timestamp: nowT(), message: `> 身份证已生成: ${newId}`, type: 'success' }])

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
         let errorMsg = '泥头车点火失败'
         try { 
             const errData = await startNovaRes.json()
             if (errData && errData.error) errorMsg = errData.error;
         } catch(e) {}
         throw new Error(errorMsg)
      }

      // 3. 启动主站监控
      await fetch('/api/campaigns/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId: newId, estimatedLeads, activeConfig }),
      })

      setLogs((p) => [...p, { id: `ign-${Date.now()}-3`, timestamp: nowT(), message: `✅ 引擎挂载指令成功，泥头车出发！`, type: 'success' }])

      // 4. 状态轮询
      if (statusTimerRef.current) clearInterval(statusTimerRef.current)
      statusTimerRef.current = setInterval(async () => {
        try {
            const res = await fetch(`/api/campaigns/status?campaignId=${newId}`)
            const data = await res.json()
            if (data?.campaign?.status && data.campaign.status !== 'RUNNING' && data.campaign.status !== 'PENDING') {
              if (statusTimerRef.current) clearInterval(statusTimerRef.current)
              setWorkflow('COMPLETED')
              if (typeof window !== 'undefined') window.dispatchEvent(new Event('leadpilot:leads-updated'))
            }
        } catch(e) {}
      }, 5000)

    } catch (e: any) {
      setWorkflow('IDLE')
      toast({ title: '启动失败', description: e.message || '未知错误', variant: 'destructive' })
    } finally {
      setNovaLaunchLoading(false)
      setShowEstimateModal(false)
    }
  }

  const handleAbort = async () => {
    if (!campaignId) {
      if (logTimerRef.current) clearInterval(logTimerRef.current)
      if (agentTimerRef.current) clearInterval(agentTimerRef.current)
      if (statusTimerRef.current) clearInterval(statusTimerRef.current)
      setWorkflow('IDLE'); setAgentState('IDLE'); setLogs([]); setCampaignId(null); setShowAbortConfirm(false)
      toast({ title: '任务已终止', variant: 'destructive' })
      return
    }

    try {
      await fetch('/api/campaigns/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId }),
      })
      if (statusTimerRef.current) clearInterval(statusTimerRef.current)
      setWorkflow('IDLE'); setAgentState('IDLE'); setLogs([]); setCampaignId(null); setShowAbortConfirm(false)
      toast({ title: '任务已终止', description: '后端已确认停止，所有状态已重置', variant: 'destructive' })
    } catch (e) {
      toast({ title: '网络错误', description: '无法连接到服务器，请检查网络后重试', variant: 'destructive' })
    }
  }

  const handleReset = () => { setWorkflow('IDLE'); setAgentState('IDLE'); setLogs([]); setReport(null); setUserPrompt('') }

  const isRunning = workflow === 'RUNNING'
  const isComplete = workflow === 'COMPLETED'

  return (
    <>
      <div className="min-h-screen bg-slate-950 text-white">
        <div className="container mx-auto px-6 py-8 max-w-7xl">
          <div>
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-4xl font-bold mb-1">指挥中心</h1>
                <p className="text-slate-400">知识库已就绪 · {kbFileCount} 个文件 · Nova 待命</p>
              </div>
              <div className="flex items-center gap-4">
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
                    <Link href="/billing"><Button size="sm" className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 text-xs px-4 py-1.5 h-auto">升级套餐</Button></Link>
                    <Link href="/billing"><Button size="sm" variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-800 text-xs px-4 py-1.5 h-auto">充值算力</Button></Link>
                  </div>
                </div>
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

              <div className="lg:col-span-2 space-y-5">
                <div className={`relative rounded-3xl border transition-all duration-500 ${isRunning ? 'border-emerald-500/50 bg-slate-900/90 shadow-2xl shadow-emerald-500/10' : 'border-slate-800 bg-slate-900/60'}`}>
                  <div className="relative p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="font-semibold text-white flex items-center gap-2">
                        {isRunning ? <Loader2 className="w-4 h-4 animate-spin text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-slate-500" />}
                        实时执行监控
                      </h2>
                    </div>

                    <div className="flex items-center gap-4 mb-4">
                      <AgentAvatar state={agentState} size={56} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-500 mb-0.5">Nova 状态</p>
                        <p className="text-sm font-bold text-white tracking-wide">{agentState}</p>
                        {isRunning && ticker && <p className="text-xs text-emerald-400 mt-1 truncate">{ticker}</p>}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mb-4">
                      {[
                        { label: '挖掘线索', value: metricLeads > 0 ? `${metricLeads}/500` : '—', color: 'blue' },
                        { label: '成功投递', value: metricSent > 0 ? String(metricSent) : '—', color: 'emerald' },
                        { label: '域名健康', value: isRunning ? `${metricHealth}%` : '—', color: metricHealth >= 95 ? 'emerald' : 'amber' },
                      ].map(s => (
                        <div key={s.label} className="bg-slate-800/70 border border-slate-700/50 rounded-xl p-2.5 text-center">
                          <p className={`text-base font-bold text-${s.color}-400 tabular-nums`}>{s.value}</p>
                          <p className="text-xs text-slate-600 mt-0.5">{s.label}</p>
                        </div>
                      ))}
                    </div>

                    <div className="rounded-2xl overflow-hidden border border-slate-700/50 shadow-inner">
                      <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-800/80 border-b border-slate-700/50">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                        <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                        <span className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
                        <span className="ml-auto text-xs text-slate-600 font-mono">leadpilot-agent — bash</span>
                      </div>
                      <div className="bg-slate-950 p-3 h-44 overflow-y-auto font-mono text-xs">
                        {logs.length === 0 ? (
                          <p className="text-slate-700 text-center mt-16">$ waiting for task...</p>
                        ) : logs.map((log: any) => (
                            <div key={log.id} className={`flex gap-2 py-0.5 leading-relaxed ${log.type === 'success' ? 'text-green-400' : log.type === 'warning' ? 'text-yellow-400 animate-pulse' : 'text-slate-300'}`}>
                              <span className="text-slate-600 flex-shrink-0">[{log.timestamp}]</span>
                              <span>{log.message}</span>
                            </div>
                        ))}
                        <div ref={logsEndRef} />
                      </div>
                    </div>

                    <button onClick={() => isRunning && setShowAbortConfirm(true)} disabled={!isRunning} className={`mt-4 w-full py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${isRunning ? 'bg-red-600/20 border-2 border-red-500/60 text-red-400 hover:bg-red-600/30 shadow-lg' : 'bg-slate-800/40 border border-slate-700/40 text-slate-600 cursor-not-allowed'}`}>
                      <StopCircle className="w-4 h-4" /> 紧急终止当前任务
                    </button>
                  </div>
                </div>
                
                {isComplete && report && (
                  <div className="relative rounded-3xl border border-blue-500/30 bg-slate-900/80 overflow-hidden p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="font-semibold text-white flex items-center gap-2"><BarChart3 className="w-4 h-4 text-blue-400" />战报输出</h2>
                      <button onClick={handleReset} className="text-xs text-slate-500 hover:text-white px-2 py-1 rounded-lg hover:bg-slate-800">新任务</button>
                    </div>
                    <div className="bg-slate-800/40 rounded-xl p-4">
                      <p className="text-xs text-slate-500 mb-1">执行总结</p>
                      <p className="text-sm text-slate-300">{report?.summary || ''}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

    {showAbortConfirm && (
      <div className="fixed inset-0 flex items-center justify-center z-[60] bg-black/70 p-4">
        <div className="max-w-sm w-full bg-slate-900 border-2 border-red-500/40 rounded-3xl p-8 text-center">
          <h3 className="text-xl font-bold text-white mb-2">确认终止？</h3>
          <div className="flex gap-3 mt-6">
            <button onClick={() => setShowAbortConfirm(false)} className="flex-1 py-3 rounded-xl border border-slate-600 text-slate-300 hover:bg-slate-800">取消</button>
            <button onClick={handleAbort} className="flex-1 py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-500">确认</button>
          </div>
        </div>
      </div>
    )}

    {showDomainHealthWarning && (
      <div className="fixed inset-0 flex items-center justify-center z-[70] bg-black/70 p-4">
        <div className="max-w-md w-full bg-slate-900 border-2 border-amber-500/40 rounded-3xl p-8">
          <h3 className="text-xl font-bold text-white text-center mb-4">⚠️ 风险警告</h3>
          <button onClick={() => { setShowDomainHealthWarning(false); setPendingLaunch(false); setShowEstimateModal(true); }} className="w-full py-3 mt-4 rounded-2xl bg-red-600/20 text-red-400">承担风险强制启动</button>
          <button onClick={() => setShowDomainHealthWarning(false)} className="w-full py-3 mt-2 rounded-2xl text-slate-400">取消</button>
        </div>
      </div>
    )}

    <CampaignEstimateModal isOpen={showEstimateModal} onClose={() => !novaLaunchLoading && setShowEstimateModal(false)} onConfirm={handleConfirmEstimate} currentTokenBalance={userAssets.tokenBalance} subscriptionTier={userAssets.subscriptionTier} />
    <NovaDrawer />
    </>
  )
}

export function DashboardPageClient(props: any) {
  return (
    <WorkbenchProvider>
      <DashboardInner initialUserAssets={props.initialUserAssets} />
    </WorkbenchProvider>
  )
}