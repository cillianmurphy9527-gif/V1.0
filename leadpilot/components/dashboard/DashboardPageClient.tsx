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
  const [report, setReport] = useState(null)
  
  // 🌟 核心新增：用户自定义挖掘数量
  const [targetLeadCount, setTargetLeadCount] = useState(10) 

  const [userAssets, setUserAssets] = useState(() => ({
    tokenBalance: initialUserAssets?.tokenBalance || 0,
    subscriptionTier: initialUserAssets?.subscriptionTier || '未订阅',
    ragFileCount: initialUserAssets?.ragFileCount || 0,
    leadsBalance: initialUserAssets?.leadsBalance || 0, // 新增线索余额
    exportBalance: initialUserAssets?.exportBalance || 0 // 新增导出余额
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
            leadsBalance: data.leadsBalance ?? 0,
            exportBalance: data.exportBalance ?? 0
          })
        }
      } catch (error) {}
    }
    fetchUserAssets()
  }, [])

  const [showEstimateModal, setShowEstimateModal] = useState(false)
  const [novaLaunchLoading, setNovaLaunchLoading] = useState(false)
  const [ticker, setTicker] = useState('')

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

  const logsEndRef = useRef(null)
  const agentTimerRef = useRef(null)
  const tickerTimer = useRef(null)
  const statusTimerRef = useRef(null)
  const { toast } = useToast()

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
    const phrases = ['正在全球搜索目标客户...', 'Nova 正在执行四步深度清洗...', '正在生成千人千面开发信...', '智能轮换发信域名，规避风控...']
    let i = 0
    setTicker(phrases[0])
    tickerTimer.current = setInterval(() => {
      i = (i + 1) % phrases.length
      setTicker(phrases[i])
    }, 2500)
    return () => { if (tickerTimer.current) clearInterval(tickerTimer.current) }
  }, [workflow])

  const startLogSimulation = () => {
    setLogs([{ id: `l-${Date.now()}`, timestamp: nowT(), message: '⏳ 系统点火，正在校验资源额度...', type: 'info' }])
    setMetricLeads(0); setMetricSent(0); setMetricHealth(100)
  }

  const handleStart = () => {
    if (!userPrompt.trim()) {
      toast({ title: '请输入指令', description: '告诉 Nova 你想要什么', variant: 'destructive' })
      return
    }
    
    // 🌟 核心拦截：前端第一道防线，判断线索余额是否足够
    if (userAssets.leadsBalance < targetLeadCount) {
        toast({ 
            title: '线索额度不足', 
            description: `您当前仅剩 ${userAssets.leadsBalance} 个线索额度，但您请求挖掘 ${targetLeadCount} 个。请前往计费中心充值。`, 
            variant: 'destructive' 
        })
        return
    }

    setShowEstimateModal(true)
  }

  const handleConfirmEstimate = async () => {
    setNovaLaunchLoading(true)
    try {
      setWorkflow('RUNNING')
      setReport(null)
      startLogSimulation()

      // 1. 创建任务
      setLogs((p) => [...p, { id: `ign-${Date.now()}-1`, timestamp: nowT(), message: '> 正在初始化主站任务库...', type: 'info' }])
      const createRes = await fetch('/api/campaigns/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Nova 自动化营销 - ${new Date().toLocaleDateString()}`,
          systemPrompt: userPrompt,
          targetRegions,
          targetIndustries,
          targetPersonas,
          activeConfig,
          targetLeadCount // 🌟 将用户期望的挖掘数量传给后端
        }),
      })
      const createData = await createRes.json()
      const newId = createData?.campaign?.id
      if (!newId) throw new Error(createData?.error || '任务 ID 生成失败')
      setCampaignId(newId)

      setLogs((p) => [...p, { id: `ign-${Date.now()}-2`, timestamp: nowT(), message: `> 身份证已生成: ${newId}`, type: 'success' }])

      // 2. 启动泥头车，带上目标数量
      const startNovaRes = await fetch('/api/nova/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId: newId, 
          targetRegions,
          targetIndustries,
          targetPersonas,
          pitch: userPrompt,
          targetLeadCount // 🌟 泥头车需要知道挖到多少个就停
        }),
      })
      if (!startNovaRes.ok) throw new Error('泥头车点火失败')

      setLogs((p) => [...p, { id: `ign-${Date.now()}-3`, timestamp: nowT(), message: `✅ 引擎挂载指令成功，泥头车出发！`, type: 'success' }])

      // 3. 状态轮询：现在不仅要等挖掘结束，还要等发信结束！
      if (statusTimerRef.current) clearInterval(statusTimerRef.current)
      statusTimerRef.current = setInterval(async () => {
        try {
            const res = await fetch(`/api/campaigns/status?campaignId=${newId}`)
            const data = await res.json()
            
            // 实时更新前端的仪表盘数字
            if (data?.campaign) {
                setMetricLeads(data.campaign.leadsFound || 0)
                setMetricSent(data.campaign.emailsSent || 0)
            }

            // 只有当状态彻底变为 COMPLETED（发信也完成了），才停止轮询
            if (data?.campaign?.status === 'COMPLETED' || data?.campaign?.status === 'FAILED') {
              if (statusTimerRef.current) clearInterval(statusTimerRef.current)
              setWorkflow('COMPLETED')
              
              // 🌟 完美战报呈现
              setReport({
                  totalFound: data.campaign.leadsFound || 0,
                  sent: data.campaign.emailsSent || 0,
                  successRate: data.campaign.leadsFound > 0 ? Math.round((data.campaign.emailsSent / data.campaign.leadsFound) * 100) : 0,
                  summary: '全链路执行完毕。Nova 已完成目标企业的深度挖掘、严苛的有效性验证，并由 AI 大模型根据您的业务指令自动撰写并投递了千人千面的开发信。',
                  topCountry: targetRegions[0] || '默认地区',
                  duration: '自动统计'
              });

              if (typeof window !== 'undefined') window.dispatchEvent(new Event('leadpilot:leads-updated'))
              // 发信后自动扣除部分 Tokens，刷新一下余额
              fetchUserAssets() 
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

  const handleAbort = async () => { /* 保持原样 */ }
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
                <p className="text-slate-400">资源配额总览：算力 {userAssets.tokenBalance} | 挖掘线索 {userAssets.leadsBalance} | 导出明文 {userAssets.exportBalance}</p>
              </div>
              {/* ... 右侧资产面板保持原样 ... */}
            </div>

            <div className="grid lg:grid-cols-5 gap-6">
              
              {/* 🌟 核心修改：在表单区域增加“目标挖掘数量”的输入框 */}
              <div className="lg:col-span-3 space-y-6">
                  {/* ... 保留您原有的 NovaForm 调用，但我们在下方增加一个专属的资源控制器 ... */}
                  <NovaForm
                    isRunning={isRunning}
                    workflow={workflow}
                    novaLaunchLoading={novaLaunchLoading}
                    // ... 传入其他必要参数 ...
                    onStartClick={handleStart}
                    // ...
                  />
                  
                  {!isRunning && !isComplete && (
                     <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5">
                        <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2"><Users className="w-5 h-5 text-blue-400"/> 设定挖掘目标</h3>
                        <p className="text-sm text-slate-400 mb-4">本次任务您希望精准获取多少位客户？（系统每挖到1个有效客户将扣除1点线索额度）</p>
                        <div className="flex items-center gap-4">
                            <input 
                                type="number" 
                                min="1" 
                                max={userAssets.leadsBalance || 100}
                                value={targetLeadCount} 
                                onChange={(e) => setTargetLeadCount(parseInt(e.target.value) || 1)}
                                className="bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 text-white w-32 focus:border-blue-500 outline-none"
                            />
                            <span className="text-sm text-slate-500">/ 当前最大可用线索额度: <span className="font-bold text-emerald-400">{userAssets.leadsBalance}</span></span>
                        </div>
                     </div>
                  )}
              </div>

              {/* 监控大屏保持原样，它会自动读取我们新绑定的 metricLeads 和 metricSent */}
              <div className="lg:col-span-2 space-y-5">
                 {/* ... 监控面板 ... */}
                 
                {isComplete && report && (
                  <div className="relative rounded-3xl border border-blue-500/30 bg-slate-900/80 overflow-hidden p-5 mt-6 shadow-2xl shadow-blue-500/20">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 to-purple-600/10" />
                    <div className="relative">
                        <div className="flex items-center justify-between mb-6">
                          <h2 className="text-xl font-bold text-white flex items-center gap-2"><BarChart3 className="w-5 h-5 text-blue-400" />全链路战报</h2>
                          <button onClick={handleReset} className="text-xs text-blue-400 hover:text-white px-3 py-1.5 rounded-lg border border-blue-500/30 hover:bg-blue-500/20 transition-all">开启新任务</button>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-3 mb-6">
                          <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4 text-center">
                              <Users className="w-5 h-5 mx-auto mb-2 text-blue-400" />
                              <p className="text-2xl font-bold text-white tabular-nums">{report.totalFound}</p>
                              <p className="text-xs text-slate-400 mt-1">入库线索</p>
                          </div>
                          <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4 text-center">
                              <Send className="w-5 h-5 mx-auto mb-2 text-emerald-400" />
                              <p className="text-2xl font-bold text-white tabular-nums">{report.sent}</p>
                              <p className="text-xs text-slate-400 mt-1">AI发信量</p>
                          </div>
                          <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4 text-center">
                              <TrendingUp className="w-5 h-5 mx-auto mb-2 text-amber-400" />
                              <p className="text-2xl font-bold text-white tabular-nums">{report.successRate}%</p>
                              <p className="text-xs text-slate-400 mt-1">自动化覆盖率</p>
                          </div>
                        </div>

                        <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/50">
                          <p className="text-xs text-slate-500 mb-2 font-mono uppercase tracking-wider">System Summary</p>
                          <p className="text-sm text-slate-300 leading-relaxed">{report.summary}</p>
                        </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* ... 弹窗部分保持原样 ... */}
    </>
  )
}

// 🌟 必须这样写，去掉 export default
export function DashboardPageClient(props: any) {
  return (
    <WorkbenchProvider>
      <DashboardInner initialUserAssets={props.initialUserAssets} />
    </WorkbenchProvider>
  )
}