/**
 * React Hook: 收件箱 AI 意图分析集成
 * 
 * 封装分析逻辑，处理权限拦截和 UI 更新
 */

import { useState } from 'react'
import { useToast } from '@/components/ui/use-toast'

export interface AnalysisResult {
  intent: 'POSITIVE' | 'INQUIRY' | 'REJECTION' | 'NEGOTIATION' | 'COMPLAINT' | 'SPAM' | 'UNKNOWN'
  confidence: number
  summary: string
  sentiment: 'positive' | 'neutral' | 'negative'
  suggestedAction: string
  keywords: string[]
}

interface AnalyzeOptions {
  onSuccess?: (result: AnalysisResult) => void
  onError?: (error: string) => void
}

// ─── 意图标签配置 ────────────────────────────────
const INTENT_CONFIG = {
  POSITIVE: {
    label: '积极回应',
    color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    icon: '✓',
  },
  INQUIRY: {
    label: '询价咨询',
    color: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    icon: '?',
  },
  REJECTION: {
    label: '拒绝',
    color: 'bg-red-500/20 text-red-300 border-red-500/40',
    icon: '✕',
  },
  NEGOTIATION: {
    label: '讨价还价',
    color: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    icon: '⚖',
  },
  COMPLAINT: {
    label: '投诉',
    color: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
    icon: '!',
  },
  SPAM: {
    label: '垃圾邮件',
    color: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
    icon: '⊘',
  },
  UNKNOWN: {
    label: '未知',
    color: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
    icon: '?',
  },
}

export function useInboxAnalyze() {
  const { toast } = useToast()
  const [analyzing, setAnalyzing] = useState(false)

  // ─── 分析邮件意图 ────────────────────────────────
  const analyzeEmail = async (
    emailId: string,
    emailContent: string,
    senderEmail: string,
    options: AnalyzeOptions = {}
  ): Promise<AnalysisResult | null> => {
    setAnalyzing(true)
    try {
      const response = await fetch('/api/inbox/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailId,
          emailContent,
          senderEmail,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        
        // ─── 权限拦截处理 ────────────────────────────
        if (response.status === 403) {
          toast({
            title: '功能需要升级',
            description: error.message || 'AI 意图分析仅专业版及以上可用',
            variant: 'destructive',
          })
          options.onError?.(error.message)
          return null
        }

        if (response.status === 429) {
          toast({
            title: '配额已用尽',
            description: error.message || '本月 AI 算力已用尽',
            variant: 'destructive',
          })
          options.onError?.(error.message)
          return null
        }

        throw new Error(error.error || 'Analysis failed')
      }

      const data = await response.json()
      const result = data.analysis as AnalysisResult

      toast({
        title: '分析完成',
        description: `意图：${INTENT_CONFIG[result.intent].label}（置信度 ${result.confidence}%）`,
      })

      options.onSuccess?.(result)
      return result
    } catch (error) {
      console.error('[InboxAnalyze] Error:', error)
      const errorMessage = error instanceof Error ? error.message : '未知错误'
      toast({
        title: '分析失败',
        description: errorMessage,
        variant: 'destructive',
      })
      options.onError?.(errorMessage)
      return null
    } finally {
      setAnalyzing(false)
    }
  }

  // ─── 获取意图标签配置 ────────────────────────────
  const getIntentConfig = (intent: string) => {
    return INTENT_CONFIG[intent as keyof typeof INTENT_CONFIG] || INTENT_CONFIG.UNKNOWN
  }

  // ─── 获取情感颜色 ────────────────────────────────
  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return 'text-emerald-400'
      case 'negative':
        return 'text-red-400'
      case 'neutral':
      default:
        return 'text-slate-400'
    }
  }

  return {
    analyzeEmail,
    analyzing,
    getIntentConfig,
    getSentimentColor,
  }
}
