"use client"

import React, { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Zap, Play, Loader2, AlertTriangle,
  Plus, Target, Building2, UserCheck, X, Settings, Star,
} from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { useWorkbench } from "@/contexts/WorkbenchContext"

export const PLAN_WEIGHT: Record<string, number> = { STARTER: 1, PRO: 2, MAX: 3 }

export const REGIONS = [
  '德国','法国','英国','意大利','西班牙','荷兰','波兰','瑞典','瑞士','比利时','奥地利','丹麦','挪威','芬兰','葡萄牙',
  '美国','加拿大','墨西哥',
  '阿联酋','沙特阿拉伯','卡塔尔','以色列','土耳其',
  '日本','韩国','澳大利亚','新加坡','印度','东南亚',
  '巴西','南非','俄罗斯',
]
export const INDUSTRIES = [
  '精密机械','五金建材','汽车配件','电子元器件','模具注塑','工业自动化','仪器仪表','紧固件',
  '纺织服装','鞋类箱包','家具家居','玩具礼品','运动户外','美妆个护','食品饮料','宠物用品',
  '半导体','新能源','医疗器械','软件SaaS','跨境电商','人工智能',
  '酒店地接','物流运输','金融服务','建筑工程','环保科技','教育培训',
]
export const PERSONAS = [
  'CEO/总裁','COO 运营总监','CFO 财务总监','CTO 技术总监','CMO 营销总监',
  '采购总监','采购经理','采购专员','供应链负责人','战略采购',
  'VP of Sales','销售总监','大客户经理','业务开发经理','渠道经理',
  '运营总监','产品经理','项目总监','物流经理',
  '研发总监','技术负责人','工程总监',
  '合伙人/Partner','董事会成员','创始人',
]

export type SavedTactic = {
  id: string
  label: string
  prompt: string
  color: string
  category: string
  country?: string
  industry?: string
  role?: string
}

export type WorkflowStateLite = 'IDLE' | 'SAMPLING_REVIEW' | 'RUNNING' | 'PAUSED' | 'COMPLETED'

function InlineConfigTags() {
  const { activeConfig } = useWorkbench()
  const ac = activeConfig
  const tags: { label: string; cls: string }[] = []
  if (ac.keywordStrategy !== 'balanced')
    tags.push({ label: `关键词:${ac.keywordStrategy === 'aggressive' ? '激进' : '保守'}`, cls: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' })
  if (ac.enrichmentDepth !== 'standard')
    tags.push({ label: `深度:${ac.enrichmentDepth === 'deep' ? '深度' : '基础'}`, cls: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' })
  if (ac.languageStyle !== 'cn')
    tags.push({ label: `语:${['en','tw','de','fr','es','pt','ja','ko','ar','ru'][{'en':0,'tw':1,'de':2,'fr':3,'es':4,'pt':5,'ja':6,'ko':7,'ar':8,'ru':9}[ac.languageStyle] ?? 0] ?? ac.languageStyle}`, cls: 'bg-purple-500/20 text-purple-400 border-purple-500/30' })
  if (ac.toneStyle !== 'friendly')
    tags.push({ label: `语气:${ac.toneStyle}`, cls: 'bg-purple-500/20 text-purple-400 border-purple-500/30' })
  if (ac.personalizationLevel !== 'mild')
    tags.push({ label: `个性:${ac.personalizationLevel === 'deep' ? '深度' : '无'}`, cls: 'bg-purple-500/20 text-purple-400 border-purple-500/30' })
  if (ac.followUpSequence) tags.push({ label: '跟进序列', cls: 'bg-purple-500/20 text-purple-400 border-purple-500/30' })
  if (ac.execStrategy) tags.push({ label: '高管策略', cls: 'bg-purple-500/20 text-purple-400 border-purple-500/30' })
  if (ac.industryModel) tags.push({ label: '行业模型', cls: 'bg-purple-500/20 text-purple-400 border-purple-500/30' })
  if (ac.sendSpeed === 'fast') tags.push({ label: '🚀 加速', cls: 'bg-blue-500/20 text-blue-400 border-blue-500/30' })
  if (ac.sendSpeed === 'turbo') tags.push({ label: '🔥 极速', cls: 'bg-blue-500/20 text-blue-400 border-blue-500/30' })
  if (ac.activeDomains > 1) tags.push({ label: `🌐 ${ac.activeDomains}域`, cls: 'bg-blue-500/20 text-blue-400 border-blue-500/30' })
  if (ac.dedicatedIP) tags.push({ label: '🏠 独享IP', cls: 'bg-blue-500/20 text-blue-400 border-blue-500/30' })
  if (ac.spintaxEnabled) tags.push({ label: 'Spintax', cls: 'bg-blue-500/20 text-blue-400 border-blue-500/30' })
  if (ac.scheduleType !== 'staggered')
    tags.push({ label: `排期:${ac.scheduleType === 'immediate' ? '即时' : '定时'}`, cls: 'bg-blue-500/20 text-blue-400 border-blue-500/30' })
  if (ac.aiIntentTags) tags.push({ label: '意图标签', cls: 'bg-amber-500/20 text-amber-400 border-amber-500/30' })
  if (ac.autoReply) tags.push({ label: '自动回复', cls: 'bg-amber-500/20 text-amber-400 border-amber-500/30' })
  if (ac.leadScoring === 'ml') tags.push({ label: 'ML评分', cls: 'bg-amber-500/20 text-amber-400 border-amber-500/30' })
  if (ac.crmSync) tags.push({ label: 'CRM同步', cls: 'bg-amber-500/20 text-amber-400 border-amber-500/30' })
  if (!ac.SPF_enabled || !ac.DKIM_enabled)
    tags.push({ label: '域名验证减弱', cls: 'bg-red-500/20 text-red-400 border-red-500/30' })
  if (ac.addon_seo) tags.push({ label: 'SEO增强', cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' })
  if (ac.addon_social) tags.push({ label: '社媒', cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' })
  if (ac.addon_whatsapp) tags.push({ label: 'WhatsApp', cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' })
  if (ac.addon_domain_pack) tags.push({ label: '域名包+5', cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' })
  if (ac.addon_ml_credits) tags.push({ label: 'ML算力包', cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' })
  if (ac.addon_dedicated_ip) tags.push({ label: '专属IP池', cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' })
  
  if (tags.length === 0) return null
  return (
    <>
      {tags.map((tag, i) => (
        <span key={i} className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${tag.cls}`}>
          {tag.label}
        </span>
      ))}
      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-700/50 text-slate-400 border border-slate-600/30">
        ⚙️ {tags.length} 项生效
      </span>
    </>
  )
}

function CreatableCombobox({
  icon: Icon, label, opts, sel, set, color, placeholder,
}: {
  icon: React.ElementType
  label: string
  opts: string[]
  sel: string[]
  set: React.Dispatch<React.SetStateAction<string[]>>
  color: string
  placeholder: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  
  const filtered = opts.filter((o) => o.toLowerCase().includes(query.toLowerCase()) && !sel.includes(o))
  const canCreate = Boolean(query.trim() && !opts.includes(query.trim()) && !sel.includes(query.trim()))
  
  const colorTag: Record<string, string> = {
    blue: 'bg-blue-500/25 text-blue-300 border-blue-500/40',
    purple: 'bg-purple-500/25 text-purple-300 border-purple-500/40',
    emerald: 'bg-emerald-500/25 text-emerald-300 border-emerald-500/40',
  }
  const tagCls = colorTag[color] || colorTag.blue
  
  const addTag = (val: string) => {
    set((p) => [...p, val])
    setQuery('')
  }
  
  return (
    <div className="relative">
      <div
        className={`bg-slate-800/70 border rounded-xl px-3 py-2.5 cursor-text transition-all ${
          open ? 'border-blue-500/60 ring-1 ring-blue-500/30' : 'border-slate-700/60 hover:border-slate-600'
        }`}
        onClick={() => {
          setOpen(true)
          setTimeout(() => inputRef.current?.focus(), 50)
        }}
      >
        <div className="flex items-center gap-1.5 mb-1.5">
          <Icon className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs font-medium text-slate-400">{label}</span>
          {sel.length > 0 && <span className="ml-auto text-xs text-slate-600">{sel.length}项</span>}
        </div>
        <div className="flex flex-wrap gap-1 min-h-[22px]">
          {sel.map((s) => (
            <span key={s} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs border ${tagCls}`}>
              {s}
              <X
                className="w-2.5 h-2.5 cursor-pointer hover:text-white"
                onClick={(e) => {
                  e.stopPropagation()
                  set((p) => p.filter((x) => x !== s))
                }}
              />
            </span>
          ))}
          {open && (
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && query.trim()) {
                  e.preventDefault()
                  addTag(canCreate ? query.trim() : filtered[0] || query.trim())
                  setQuery('')
                }
                if (e.key === 'Escape') setOpen(false)
                if (e.key === 'Backspace' && !query && sel.length) set((p) => p.slice(0, -1))
              }}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              placeholder={sel.length === 0 ? placeholder : '继续添加...'}
              className="flex-1 min-w-[80px] bg-transparent text-xs text-white placeholder-slate-600 focus:outline-none"
            />
          )}
          {!open && sel.length === 0 && <span className="text-xs text-slate-600">点击搜索或输入...</span>}
        </div>
      </div>
      <AnimatePresence>
        {open && (filtered.length > 0 || canCreate) && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-30 overflow-hidden"
          >
            <div className="max-h-48 overflow-y-auto p-1.5">
              {canCreate && (
                <button
                  type="button"
                  onMouseDown={() => addTag(query.trim())}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs text-emerald-400 hover:bg-emerald-500/15 flex items-center gap-2 font-medium transition-all"
                >
                  <Plus className="w-3 h-3" />
                  添加自定义：「{query.trim()}」
                </button>
              )}
              {filtered.map((opt) => (
                <button
                  type="button"
                  key={opt}
                  onMouseDown={() => addTag(opt)}
                  className="w-full text-left px-3 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-slate-800 hover:text-white transition-all"
                >
                  {opt}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export type NovaFormProps = {
  isRunning: boolean
  workflow: WorkflowStateLite
  novaLaunchLoading: boolean
  preflightFail: { reason: string; field?: string } | null
  onStartClick: () => void
  targetRegions: string[]
  setTargetRegions: React.Dispatch<React.SetStateAction<string[]>>
  targetIndustries: string[]
  setTargetIndustries: React.Dispatch<React.SetStateAction<string[]>>
  targetPersonas: string[]
  setTargetPersonas: React.Dispatch<React.SetStateAction<string[]>>
  userPrompt: string
  setUserPrompt: (v: string) => void
  savedTactics: SavedTactic[]
  setSavedTactics: React.Dispatch<React.SetStateAction<SavedTactic[]>>
  showSaveTacticDialog: boolean
  setShowSaveTacticDialog: (v: boolean) => void
  tacticName: string
  setTacticName: (v: string) => void
  tacticCategory: string
  setTacticCategory: (v: string) => void
  tacticColor: string
  setTacticColor: (v: string) => void
  slot: { max: number }
  storageKey?: string
}

export function NovaForm({
  isRunning,
  workflow,
  novaLaunchLoading,
  preflightFail,
  onStartClick,
  targetRegions,
  setTargetRegions,
  targetIndustries,
  setTargetIndustries,
  targetPersonas,
  setTargetPersonas,
  userPrompt,
  setUserPrompt,
  savedTactics,
  setSavedTactics,
  showSaveTacticDialog,
  setShowSaveTacticDialog,
  tacticName,
  setTacticName,
  tacticCategory,
  setTacticCategory,
  tacticColor,
  setTacticColor,
  slot,
  storageKey = 'user_templates',
}: NovaFormProps) {
  const { toast } = useToast()
  const { activeConfig, assets, openDrawer, openDrawerToTab } = useWorkbench()

  const [mounted, setMounted] = useState(false)

  // 1. 初始化从 localStorage 加载
  useEffect(() => {
    if (!storageKey) { 
      setMounted(true)
      return 
    }
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(storageKey)
        if (cached) {
          const parsed = JSON.parse(cached)
          if (Array.isArray(parsed) && parsed.length > 0) {
            setSavedTactics(parsed)
          }
        }
      } catch (_e) {}
    }
    setMounted(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 2. 战术更新时同步写入 localStorage
  useEffect(() => {
    if (!storageKey || !mounted) return
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(storageKey, JSON.stringify(savedTactics))
      } catch (_e) {}
    }
  }, [savedTactics, storageKey, mounted])

  const isReadyToLaunch =
    targetRegions.length > 0 &&
    targetIndustries.length > 0 &&
    targetPersonas.length > 0 &&
    userPrompt.trim().length > 0

  // 3. 自动生成模板
  useEffect(() => {
    if (targetRegions.length > 0 && targetIndustries.length > 0 && targetPersonas.length > 0) {
      const countries = targetRegions.join('、')
      const industries = targetIndustries.join('、')
      const roles = targetPersonas.join('、')

      const autoTemplate = `寻找${countries}的${industries}公司，目标决策人为${roles}。重点介绍[你的核心优势和卖点]，强调[差异化价值]，并附上[具体案例或数据背书]。联系邮箱：[your@email.com]`
      setUserPrompt(autoTemplate)
    }
  }, [targetRegions, targetIndustries, targetPersonas, setUserPrompt])

  const handleSelectTemplate = (tactic: SavedTactic) => {
    if (tactic.country && REGIONS.includes(tactic.country)) {
      setTargetRegions([tactic.country])
    }
    if (tactic.industry && INDUSTRIES.includes(tactic.industry)) {
      setTargetIndustries([tactic.industry])
    }
    if (tactic.role && PERSONAS.includes(tactic.role)) {
      setTargetPersonas([tactic.role])
    }
    setUserPrompt(tactic.prompt)
    toast({
      title: `⭐ 已加载战术：${tactic.label}`,
      description: '表单已自动回填，请检查参数后启动 Nova',
    })
  }

  const handleDeleteTemplate = (tacticId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setSavedTactics((prev) => prev.filter((t) => t.id !== tacticId))
    toast({ title: '🗑️ 战术已删除' })
  }

  const handleSaveTactic = () => {
    if (!userPrompt.trim()) {
      toast({ title: '请先输入指令内容', variant: 'destructive' })
      return
    }
    const metaCountry = targetRegions[0] || ''
    const metaIndustry = targetIndustries[0] || ''
    const metaRole = targetPersonas[0] || ''

    setSavedTactics((p) => [
      ...p,
      {
        id: `c-${Date.now()}`,
        label: tacticName.trim(),
        prompt: userPrompt,
        color: tacticColor,
        category: tacticCategory,
        country: metaCountry,
        industry: metaIndustry,
        role: metaRole,
      },
    ])
    toast({ title: `已保存战术：${tacticName.trim()}` })
    setShowSaveTacticDialog(false)
  }

  const handleQuickSave = () => {
    if (targetRegions.length === 0 || targetIndustries.length === 0 || targetPersonas.length === 0) {
      toast({ title: '请先选择国家、行业和决策人', variant: 'destructive' })
      return
    }
    if (!userPrompt.trim()) {
      toast({ title: '请先填写指令内容', variant: 'destructive' })
      return
    }
    const defaultName = `${targetRegions[0]}-${targetIndustries[0]}-${targetPersonas[0]}`
    const name = window.prompt('请输入战术名称（如：德国机械-CEO）', defaultName)
    if (!name || !name.trim()) return

    const newTactic: SavedTactic = {
      id: `q-${Date.now()}`,
      label: name.trim(),
      prompt: userPrompt,
      color: 'amber',
      category: targetIndustries[0],
      country: targetRegions[0],
      industry: targetIndustries[0],
      role: targetPersonas[0],
    }
    setSavedTactics((p) => [...p, newTactic])
    toast({ title: '⭐ 战术已保存', description: newTactic.label })
  }

  return (
    <>
      <motion.div
        layout
        animate={{ opacity: isRunning ? 0.5 : 1 }}
        transition={{ duration: 0.4 }}
        className={`lg:col-span-3 ${isRunning ? 'pointer-events-none' : ''}`}
        data-onboarding="command-center"
      >
        <div className="relative bg-slate-900/70 border border-slate-800 rounded-3xl p-6">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600/8 to-purple-600/8 rounded-3xl" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-5">
              <Zap className="w-5 h-5 text-blue-400" />
              <h2 className="font-semibold text-white">战术配置面板</h2>
              {isRunning && <span className="ml-auto text-xs text-slate-500">运行中已锁定</span>}
            </div>
            
            <div className="grid grid-cols-3 gap-3 mb-5">
              <CreatableCombobox key="目标国家" icon={Target} label="目标国家" opts={REGIONS as unknown as string[]} sel={targetRegions} set={setTargetRegions as React.Dispatch<React.SetStateAction<string[]>>} color="blue" placeholder="搜索或输入国家..." />
              <CreatableCombobox key="目标行业" icon={Building2} label="目标行业" opts={INDUSTRIES as unknown as string[]} sel={targetIndustries} set={setTargetIndustries as React.Dispatch<React.SetStateAction<string[]>>} color="purple" placeholder="搜索或输入行业..." />
              <CreatableCombobox key="决策人" icon={UserCheck} label="决策人" opts={PERSONAS as unknown as string[]} sel={targetPersonas} set={setTargetPersonas as React.Dispatch<React.SetStateAction<string[]>>} color="emerald" placeholder="搜索或输入职位..." />
            </div>

            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-500">我的常用战术库</span>
                  {mounted && savedTactics.length > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30">
                      {savedTactics.length} 个战术
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleQuickSave}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 text-amber-300 hover:from-amber-500/30 hover:to-orange-500/30 hover:text-amber-200 transition-all shadow-sm shadow-amber-500/10"
                >
                  <Star className="w-3 h-3" />
                  保存为常用战术
                </button>
              </div>

              {mounted && (
                savedTactics.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {savedTactics.map((t) => {
                      const colorMap: Record<string, string> = {
                        blue: 'bg-blue-500/20 border-blue-500/40 text-blue-300 hover:bg-blue-500/30 hover:border-blue-500/60',
                        purple: 'bg-purple-500/20 border-purple-500/40 text-purple-300 hover:bg-purple-500/30 hover:border-purple-500/60',
                        emerald: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30 hover:border-emerald-500/60',
                        orange: 'bg-orange-500/20 border-orange-500/40 text-orange-300 hover:bg-orange-500/30 hover:border-orange-500/60',
                        pink: 'bg-pink-500/20 border-pink-500/40 text-pink-300 hover:bg-pink-500/30 hover:border-pink-500/60',
                        red: 'bg-red-500/20 border-red-500/40 text-red-300 hover:bg-red-500/30 hover:border-red-500/60',
                        cyan: 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/30 hover:border-cyan-500/60',
                        amber: 'bg-amber-500/20 border-amber-500/40 text-amber-300 hover:bg-amber-500/30 hover:border-amber-500/60',
                      }
                      const cls = colorMap[t.color] || colorMap.blue
                      return (
                        <motion.div
                          key={t.id}
                          initial={{ opacity: 0, scale: 0.85 }}
                          animate={{ opacity: 1, scale: 1 }}
                          onClick={() => handleSelectTemplate(t)}
                          className={`group flex items-center gap-1 pl-3 pr-2 py-1.5 rounded-full text-xs font-medium border cursor-pointer select-none transition-all hover:opacity-90 ${cls}`}
                          title={`点击回填：${t.label}`}
                        >
                          {t.category && <span className="opacity-60 mr-0.5 flex-shrink-0">[{t.category}]</span>}
                          <span className="cursor-pointer hover:underline decoration-dotted underline-offset-2">
                            {t.label}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteTemplate(t.id, e)}
                            className="ml-0.5 opacity-0 group-hover:opacity-100 w-4 h-4 rounded-full bg-white/10 hover:bg-red-500/60 hover:text-red-200 flex items-center justify-center transition-all cursor-pointer flex-shrink-0"
                            title="删除此战术"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </motion.div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-xs text-slate-600 italic py-1">
                    暂无保存的战术。填写表单后点击右上角「保存为常用战术」即可收藏。
                  </div>
                )
              )}
            </div>

            <textarea
              value={userPrompt}
              onChange={(e) => setUserPrompt(e.target.value)}
              placeholder="输入您的核心卖点、价格优势或特殊推销话术..."
              rows={4}
              className="w-full bg-slate-800/60 border border-slate-700 rounded-2xl px-5 py-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm leading-relaxed transition-all"
            />

            <div className="mt-2 flex items-center gap-3 text-xs">
              {targetRegions.length === 0 && <span className="text-amber-400/80">⚠️ 请选择目标国家</span>}
              {targetIndustries.length === 0 && <span className="text-amber-400/80">⚠️ 请选择目标行业</span>}
              {targetPersonas.length === 0 && <span className="text-amber-400/80">⚠️ 请选择决策人</span>}
              {targetRegions.length > 0 && targetIndustries.length > 0 && targetPersonas.length > 0 && !userPrompt.trim() && (
                <span className="text-amber-400/80">⚠️ 请填写指令内容</span>
              )}
              {isReadyToLaunch && <span className="text-emerald-400 ml-auto">✓ 已就绪，可以启动</span>}
            </div>

            {/* --- 发信配置面板 (算力、线索等状态) --- */}
            <div className="mt-4">
              <div
                className="rounded-2xl overflow-hidden"
                style={{
                  background: 'rgba(15,18,35,0.8)',
                  border: '1px solid rgba(139,92,246,0.15)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)',
                }}
              >
                <div
                  className="h-0.5 w-full"
                  style={{ background: 'linear-gradient(90deg, transparent, rgba(139,92,246,0.6), rgba(59,130,246,0.6), transparent)' }}
                />
                <div className="px-4 py-4 space-y-2">
                  <div className="flex items-center gap-4 pb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="relative flex h-2 w-2">
                        {assets.tokens <= 0 ? (
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500 shadow-lg shadow-red-500/50" />
                        ) : (
                          <>
                            <motion.span animate={{ opacity: [0.75, 0.2, 0.75] }} transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }} className="absolute inline-flex h-full w-full rounded-full bg-emerald-400" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                          </>
                        )}
                      </span>
                      <span className={`text-[10px] font-semibold ${assets.tokens <= 0 ? 'text-red-400' : 'text-slate-500'}`}>⚡ 算力</span>
                      {assets.tokens <= 0 && <button type="button" onClick={() => openDrawerToTab('addons')} className="text-[9px] text-red-400 underline hover:text-red-300 transition-colors">[补充]</button>}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="relative flex h-2 w-2">
                        {assets.leads <= 0 ? (
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500 shadow-lg shadow-red-500/50" />
                        ) : (
                          <>
                            <motion.span animate={{ opacity: [0.75, 0.2, 0.75] }} transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }} className="absolute inline-flex h-full w-full rounded-full bg-blue-400" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-400" />
                          </>
                        )}
                      </span>
                      <span className={`text-[10px] font-semibold ${assets.leads <= 0 ? 'text-red-400' : 'text-slate-500'}`}>🎯 线索</span>
                      {assets.leads <= 0 && <button type="button" onClick={() => openDrawerToTab('addons')} className="text-[9px] text-red-400 underline hover:text-red-300 transition-colors">[补充]</button>}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="relative flex h-2 w-2">
                        {(activeConfig.activeDomains || 1) < 1 || (activeConfig.activeDomains || 1) > slot.max ? (
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500 shadow-lg shadow-red-500/50" />
                        ) : (
                          <>
                            <motion.span animate={{ opacity: [0.75, 0.2, 0.75] }} transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: 0.6 }} className="absolute inline-flex h-full w-full rounded-full bg-purple-400" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-400" />
                          </>
                        )}
                      </span>
                      <span className={`text-[10px] font-semibold ${(activeConfig.activeDomains || 1) < 1 || (activeConfig.activeDomains || 1) > slot.max ? 'text-red-400' : 'text-slate-500'}`}>🌐 域名</span>
                      {(activeConfig.activeDomains || 1) > slot.max && <button type="button" onClick={() => openDrawerToTab('addons')} className="text-[9px] text-red-400 underline hover:text-red-300 transition-colors">[补槽位]</button>}
                    </div>
                    <button
                      type="button"
                      onClick={openDrawer}
                      className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[10px] font-medium transition-all duration-150 flex-shrink-0"
                      style={{ borderColor: 'rgba(148,163,184,0.15)', color: 'rgba(148,163,184,0.7)', background: 'transparent' }}
                      onMouseEnter={(e) => {
                        ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(139,92,246,0.4)'
                        ;(e.currentTarget as HTMLButtonElement).style.color = 'rgba(167,139,250,0.9)'
                        ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(139,92,246,0.08)'
                      }}
                      onMouseLeave={(e) => {
                        ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(148,163,184,0.15)'
                        ;(e.currentTarget as HTMLButtonElement).style.color = 'rgba(148,163,184,0.7)'
                        ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                      }}
                    >
                      <Settings className="w-3 h-3" />
                      <span>高级配置</span>
                      <span className="px-1 py-0.5 rounded text-[8px] font-bold" style={{ background: 'rgba(245,158,11,0.15)', color: 'rgba(251,191,36,0.9)', border: '1px solid rgba(245,158,11,0.25)' }}>Pro</span>
                    </button>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.04)' }}>
                      <span className="text-sm flex-shrink-0">🎯</span>
                      <span className="text-xs text-slate-500 flex-shrink-0">锁定目标</span>
                      <div className="flex flex-wrap gap-1 flex-1 min-w-0">
                        {targetRegions.length > 0 ? (
                          targetRegions.slice(0, 4).map((r) => <span key={r} className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/15 text-blue-400 border border-blue-500/20">{r}</span>)
                        ) : (
                          <span className="text-[10px] text-slate-600 italic">已同步全局行业参数</span>
                        )}
                        {targetRegions.length > 4 && <span className="text-[10px] text-slate-600">+{targetRegions.length - 4}</span>}
                      </div>
                      {targetRegions.length > 0 && <span className="text-[10px] text-emerald-500 font-semibold flex-shrink-0">已就绪</span>}
                    </div>

                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.04)' }}>
                      <span className="text-sm flex-shrink-0">📝</span>
                      <span className="text-xs text-slate-500 flex-shrink-0">战术装载</span>
                      <div className="flex flex-wrap gap-1 items-center flex-1 min-w-0">
                        {userPrompt.trim() && <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-purple-500/15 text-purple-400 border border-purple-500/20 flex-shrink-0">AI 拓客指令</span>}
                        <InlineConfigTags />
                        {!userPrompt.trim() && <span className="text-[10px] text-slate-600 italic flex-shrink-0">等待输入核心指令或配置高级参数...</span>}
                      </div>
                      {userPrompt.trim() && <span className="text-[10px] text-emerald-500 font-semibold flex-shrink-0">已挂载</span>}
                    </div>

                    {(activeConfig.activeDomains || 1) > 1 || activeConfig.sendSpeed !== 'standard' || activeConfig.dedicatedIP ? (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.04)' }}>
                        <span className="text-sm flex-shrink-0">🚀</span>
                        <span className="text-xs text-slate-500 flex-shrink-0">发信引擎</span>
                        <div className="flex flex-wrap gap-1 items-center flex-1 min-w-0">
                          {(activeConfig.activeDomains || 1) > 1 && <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/15 text-blue-400 border border-blue-500/20">🌐 {activeConfig.activeDomains} 域名并发</span>}
                          {activeConfig.sendSpeed === 'fast' && <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/15 text-blue-400 border border-blue-500/20">加速模式</span>}
                          {activeConfig.sendSpeed === 'turbo' && <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-red-500/15 text-red-400 border border-red-500/20">🔥 极速模式</span>}
                          {activeConfig.dedicatedIP && <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">🏠 独享IP</span>}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onStartClick}
              disabled={workflow === 'RUNNING' || novaLaunchLoading || !isReadyToLaunch}
              className={`mt-5 w-full py-4 rounded-2xl font-bold text-white text-lg flex items-center justify-center gap-3 transition-all ${
                workflow === 'RUNNING' || novaLaunchLoading
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 cursor-wait opacity-80'
                  : !isReadyToLaunch
                    ? 'bg-gradient-to-r from-slate-700 to-slate-600 opacity-50 cursor-not-allowed'
                    : preflightFail
                      ? 'bg-gradient-to-r from-red-700 to-red-600 shadow-xl shadow-red-500/40 animate-pulse'
                      : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 shadow-xl shadow-blue-500/25 hover:shadow-blue-500/40 cursor-pointer'
              }`}
            >
              {workflow === 'RUNNING' || novaLaunchLoading ? (
                <>
                  <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="inline-block">
                    <Loader2 className="w-5 h-5" />
                  </motion.span>
                  {novaLaunchLoading ? '正在保存战术并点火...' : 'Nova 序列点火中...'}
                </>
              ) : preflightFail ? (
                <><AlertTriangle className="w-5 h-5" />⚠️ {preflightFail.reason}</>
              ) : !isReadyToLaunch ? (
                <><Play className="w-5 h-5" />启动 Nova</>
              ) : (
                <><Play className="w-5 h-5" />▷ 启动 Nova</>
              )}
            </button>
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {showSaveTacticDialog && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 pointer-events-auto" onClick={() => setShowSaveTacticDialog(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.92, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92, y: 20 }} className="fixed inset-0 flex items-center justify-center z-[51] p-4 pointer-events-none">
              <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-3xl p-7 shadow-2xl pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-white">保存为战术</h3>
                  <button type="button" onClick={() => setShowSaveTacticDialog(false)} className="p-2 rounded-full text-slate-500 hover:text-white hover:bg-white/10 transition-colors"><X className="w-4 h-4" /></button>
                </div>
                <div className="mb-4">
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">战术名称</label>
                  <input value={tacticName} onChange={(e) => setTacticName(e.target.value)} placeholder="如：德国五金硬核推销" className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
                </div>
                <div className="mb-4">
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">战术分类</label>
                  <div className="flex flex-wrap gap-2">
                    {['通用', '机械', '消费', '旅游', '科技', '建材', '纺织', '医疗', '其他'].map((cat) => (
                      <button key={cat} type="button" onClick={() => setTacticCategory(cat)} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${tacticCategory === cat ? 'bg-blue-500/25 border-blue-500/50 text-blue-300' : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-white'}`}>{cat}</button>
                    ))}
                  </div>
                </div>
                <div className="mb-6">
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">颜色标签</label>
                  <div className="flex gap-2">
                    {[{ id: 'blue', cls: 'bg-blue-500' }, { id: 'purple', cls: 'bg-purple-500' }, { id: 'emerald', cls: 'bg-emerald-500' }, { id: 'orange', cls: 'bg-orange-500' }, { id: 'pink', cls: 'bg-pink-500' }].map(({ id, cls }) => (
                      <button key={id} type="button" onClick={() => setTacticColor(id)} className={`w-8 h-8 rounded-full ${cls} ring-2 transition-all ${tacticColor === id ? 'ring-white scale-110' : 'ring-transparent opacity-60 hover:opacity-100'}`} />
                    ))}
                  </div>
                </div>
                <div className="mb-6 p-3 rounded-xl bg-slate-800/40 border border-slate-700/50">
                  <p className="text-[10px] text-slate-500 mb-2">预览</p>
                  {(() => {
                    const colorMap: Record<string, string> = { blue: 'bg-blue-500/20 border-blue-500/40 text-blue-300', purple: 'bg-purple-500/20 border-purple-500/40 text-purple-300', emerald: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300', orange: 'bg-orange-500/20 border-orange-500/40 text-orange-300', pink: 'bg-pink-500/20 border-pink-500/40 text-pink-300' }
                    return (
                      <span className={`inline-flex items-center gap-1 pl-3 pr-2 py-1.5 rounded-full text-xs font-medium border ${colorMap[tacticColor] || colorMap.blue}`}>
                        {tacticCategory && <span className="opacity-60">[{tacticCategory}]</span>}
                        {tacticName || '战术名称'}
                      </span>
                    )
                  })()}
                </div>
                <button type="button" disabled={!tacticName.trim()} onClick={handleSaveTactic} className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 disabled:opacity-40 text-white font-bold transition-all">确认保存</button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}