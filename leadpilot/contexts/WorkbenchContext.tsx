'use client'

import React, { createContext, useContext, useState, useCallback } from 'react'

// ─────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────

export type UserPlan = 299 | 799 | 1999

export interface Assets {
  tokens: number
  leads: number
  domains: number
  addons_purchased: string[]
}

export interface ActiveConfig {
  // 🔍 线索与知识底座
  keywordStrategy: 'aggressive' | 'balanced' | 'conservative'
  industryFilter: string[]
  companySize: string[]
  seniorityLevel: string[]
  enrichmentDepth: 'basic' | 'standard' | 'deep'
  knowledgeBaseIds: string[]
  // ✍️ AI 创作大脑
  followUpSequence: boolean
  execStrategy: boolean
  industryModel: boolean
  toneStyle: 'formal' | 'friendly' | 'persuasive' | 'technical'
  personalizationLevel: 'none' | 'mild' | 'deep'
  includeCompany: boolean
  includePainPoints: boolean
  templateVariants: number
  languageStyle: 'cn' | 'tw' | 'en'
  // 🚀 发信与并发引擎
  activeDomains: number
  sendSpeed: 'standard' | 'fast' | 'turbo'
  dedicatedIP: boolean
  dailyLimit: number
  warmupEnabled: boolean
  warmupDaily: number
  spintaxEnabled: boolean
  scheduleType: 'immediate' | 'staggered' | 'scheduled'
  scheduleTimes: string[]
  // 🧠 意图与商机流转
  aiIntentTags: boolean
  intentConfidence: number
  autoReply: boolean
  replyIntentThreshold: number
  leadScoring: 'simple' | 'standard' | 'ml'
  autoSegment: boolean
  crmSync: boolean
  // 🛡️ 系统底层保障
  SPF_enabled: boolean
  DKIM_enabled: boolean
  DMARC_policy: 'none' | 'quarantine' | 'reject'
  trackOpens: boolean
  trackClicks: boolean
  // 🛒 增值与外挂
  addon_seo: boolean
  addon_social: boolean
  addon_whatsapp: boolean
  addon_domain_pack: boolean
  addon_ml_credits: boolean
  addon_dedicated_ip: boolean
}

const DEFAULT_ACTIVE_CONFIG: ActiveConfig = {
  keywordStrategy: 'balanced',
  industryFilter: [],
  companySize: [],
  seniorityLevel: [],
  enrichmentDepth: 'standard',
  knowledgeBaseIds: [],
  toneStyle: 'friendly',
  personalizationLevel: 'mild',
  includeCompany: true,
  includePainPoints: true,
  templateVariants: 3,
  languageStyle: 'cn',
  followUpSequence: false,
  execStrategy: false,
  industryModel: false,
  activeDomains: 1,
  sendSpeed: 'standard',
  dedicatedIP: false,
  dailyLimit: 100,
  warmupEnabled: true,
  warmupDaily: 5,
  spintaxEnabled: false,
  scheduleType: 'staggered',
  scheduleTimes: [],
  aiIntentTags: false,
  intentConfidence: 70,
  autoReply: false,
  replyIntentThreshold: 70,
  leadScoring: 'standard',
  autoSegment: false,
  crmSync: false,
  SPF_enabled: true,
  DKIM_enabled: true,
  DMARC_policy: 'quarantine',
  trackOpens: true,
  trackClicks: true,
  addon_seo: false,
  addon_social: false,
  addon_whatsapp: false,
  addon_domain_pack: false,
  addon_ml_credits: false,
  addon_dedicated_ip: false,
}

const DEFAULT_ASSETS: Assets = {
  tokens: 50000,
  leads: 1200,
  domains: 3,
  addons_purchased: ['addon_seo', 'addon_social'],
}

// ─────────────────────────────────────────────
//  Context
// ─────────────────────────────────────────────

interface WorkbenchContextValue {
  userPlan: UserPlan
  assets: Assets
  activeConfig: ActiveConfig
  drawerOpen: boolean
  initialDrawerTab: string | null
  // Setters
  setUserPlan: (plan: UserPlan) => void
  setAssets: (assets: Assets) => void
  updateConfig: (updates: Partial<ActiveConfig>) => void
  resetConfig: () => void
  openDrawer: () => void
  openDrawerToTab: (tab: string) => void
  closeDrawer: () => void
  toggleDrawer: () => void
}

const WorkbenchContext = createContext<WorkbenchContextValue | null>(null)

export function WorkbenchProvider({ children }: { children: React.ReactNode }) {
  const [userPlan, setUserPlan] = useState<UserPlan>(799)
  const [assets, setAssets] = useState<Assets>(DEFAULT_ASSETS)
  const [activeConfig, setActiveConfig] = useState<ActiveConfig>(DEFAULT_ACTIVE_CONFIG)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [initialDrawerTab, setInitialDrawerTab] = useState<string | null>(null)

  const updateConfig = useCallback((updates: Partial<ActiveConfig>) => {
    setActiveConfig(prev => ({ ...prev, ...updates }))
  }, [])

  const resetConfig = useCallback(() => {
    setActiveConfig(DEFAULT_ACTIVE_CONFIG)
  }, [])

  const openDrawer = useCallback(() => {
    setInitialDrawerTab(null)
    setDrawerOpen(true)
  }, [])
  const openDrawerToTab = useCallback((tab: string) => {
    setInitialDrawerTab(tab)
    setDrawerOpen(true)
  }, [])
  const closeDrawer = useCallback(() => setDrawerOpen(false), [])
  const toggleDrawer = useCallback(() => setDrawerOpen(prev => !prev), [])

  return (
    <WorkbenchContext.Provider
      value={{
        userPlan, assets, activeConfig, drawerOpen, initialDrawerTab,
        setUserPlan, setAssets, updateConfig, resetConfig,
        openDrawer, openDrawerToTab, closeDrawer, toggleDrawer,
      }}
    >
      {children}
    </WorkbenchContext.Provider>
  )
}

export function useWorkbench() {
  const ctx = useContext(WorkbenchContext)
  if (!ctx) throw new Error('useWorkbench must be used within WorkbenchProvider')
  return ctx
}
