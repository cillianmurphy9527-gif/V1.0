'use client'

import React from 'react'
import { useWorkbench } from '@/contexts/WorkbenchContext'
import { cn } from '@/lib/utils'

interface ConfigTag {
  label: string
  color: string
  active: boolean
}

function useConfigSummary(): ConfigTag[] {
  const { activeConfig } = useWorkbench()
  const tags: ConfigTag[] = []

  // 🔍 线索与知识底座
  if (activeConfig.keywordStrategy !== 'balanced') {
    tags.push({
      label: `关键词:${activeConfig.keywordStrategy === 'aggressive' ? '激进' : '保守'}`,
      color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
      active: true,
    })
  }
  if (activeConfig.enrichmentDepth !== 'standard') {
    tags.push({
      label: `线索深度:${activeConfig.enrichmentDepth === 'deep' ? '深度' : '基础'}`,
      color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
      active: true,
    })
  }
  if (activeConfig.industryFilter.length > 0) {
    tags.push({
      label: `行业:${activeConfig.industryFilter.length}个`,
      color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
      active: true,
    })
  }

  // ✍️ AI 创作大脑
  if (activeConfig.toneStyle !== 'friendly') {
    tags.push({
      label: `语气:${activeConfig.toneStyle}`,
      color: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      active: true,
    })
  }
  if (activeConfig.personalizationLevel !== 'mild') {
    tags.push({
      label: `个性化:${activeConfig.personalizationLevel === 'deep' ? '深度' : '无'}`,
      color: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      active: true,
    })
  }
  if (!activeConfig.includeCompany || !activeConfig.includePainPoints) {
    tags.push({
      label: '精简话术',
      color: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      active: true,
    })
  }
  if (activeConfig.templateVariants !== 3) {
    tags.push({
      label: `变体:${activeConfig.templateVariants}个`,
      color: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      active: true,
    })
  }

  // 🚀 发信与并发引擎
  if (activeConfig.warmupEnabled) {
    tags.push({
      label: `预热:${activeConfig.warmupDaily}/天`,
      color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      active: true,
    })
  }
  if (activeConfig.spintaxEnabled) {
    tags.push({
      label: 'Spintax',
      color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      active: true,
    })
  }
  if (activeConfig.scheduleType !== 'staggered') {
    tags.push({
      label: `排期:${activeConfig.scheduleType === 'immediate' ? '即时' : '定时'}`,
      color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      active: true,
    })
  }
  if (activeConfig.dailyLimit !== 100) {
    tags.push({
      label: `日限:${activeConfig.dailyLimit}`,
      color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      active: true,
    })
  }

  // 🧠 意图与商机流转
  if (activeConfig.autoReply) {
    tags.push({
      label: '自动回复',
      color: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      active: true,
    })
  }
  if (activeConfig.leadScoring !== 'standard') {
    tags.push({
      label: `评分:${activeConfig.leadScoring === 'ml' ? 'ML' : '简单'}`,
      color: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      active: true,
    })
  }
  if (activeConfig.crmSync) {
    tags.push({
      label: 'CRM同步',
      color: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      active: true,
    })
  }

  // 🛡️ 系统底层保障
  if (!activeConfig.SPF_enabled || !activeConfig.DKIM_enabled) {
    tags.push({
      label: '域名验证减弱',
      color: 'bg-red-500/20 text-red-400 border-red-500/30',
      active: true,
    })
  }
  if (!activeConfig.trackOpens || !activeConfig.trackClicks) {
    tags.push({
      label: '追踪减弱',
      color: 'bg-red-500/20 text-red-400 border-red-500/30',
      active: true,
    })
  }

  // 🛒 增值与外挂
  if (activeConfig.addon_seo) {
    tags.push({
      label: 'SEO增强',
      color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      active: true,
    })
  }
  if (activeConfig.addon_social) {
    tags.push({
      label: '社媒探测',
      color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      active: true,
    })
  }
  if (activeConfig.addon_whatsapp) {
    tags.push({
      label: 'WhatsApp',
      color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      active: true,
    })
  }

  return tags
}

export function ConfigSummary() {
  const tags = useConfigSummary()

  return (
    <div className="min-h-[36px] flex flex-wrap gap-1.5 items-center px-1">
      {tags.length === 0 ? (
        <p className="text-xs text-slate-500 italic">
          点击「高级配置」自定义引擎参数，当前使用智能默认
        </p>
      ) : (
        <>
          <span className="text-[10px] text-slate-600 uppercase tracking-widest font-medium">
            已激活
          </span>
          {tags.map((tag, i) => (
            <span
              key={i}
              className={cn(
                'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border',
                'transition-all duration-200 hover:brightness-110',
                tag.color,
              )}
            >
              {tag.label}
            </span>
          ))}
        </>
      )}
    </div>
  )
}
