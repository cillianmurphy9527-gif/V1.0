/**
 * React Hook: 收件箱 AI 功能集成
 * 
 * 封装意图分析和快捷回复的 API 调用逻辑
 * 处理错误、加载状态、权限拦截
 */

import { useState } from 'react'
import { useToast } from '@/components/ui/use-toast'
import { ReplyType } from '@/app/api/inbox/generate-reply/route'

export interface IntentAnalysisResult {
  intent: 'INQUIRY' | 'REJECTION' | 'NEGOTIATION' | 'COMPLAINT' | 'SPAM' | 'POSITIVE' | 'UNKNOWN'
  confidence: number
  summary: string
  sentiment: 'positive' | 'neutral' | 'negative'
  suggestedAction: string
  keywords: string[]
  leadScore?: number
  leadScoreReason?: string
}

interface UseInboxAIOptions {
  onAnalysisComplete?: (result: IntentAnalysisResult) => void
  onReplyGenerated?: (reply: string) => void
}

export function useInboxAI(options: UseInboxAIOptions = {}) {
  const { toast } = useToast()
  const [analyzing, setAnalyzing] = useState(false)
  const [generatingReply, setGeneratingReply] = useState(false)

  // ─── 分析邮件意图 ────────────────────────────────────
  const analyzeIntent = async (
    emailId: string,
    emailContent: string,
    senderEmail: string
  ): Promise<IntentAnalysisResult | null> => {
    setAnalyzing(true)
    try {
      const response = await fetch('/api/inbox/analyze-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailId, emailContent, senderEmail }),
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
          return null
        }

        if (response.status === 429) {
          toast({
            title: '配额已用尽',
            description: error.message || '本月 AI 算力已用尽，请等待下月重置或升级套餐',
            variant: 'destructive',
          })
          return null
        }

        throw new Error(error.error || 'Analysis failed')
      }

      const data = await response.json()
      const result = data.analysis as IntentAnalysisResult

      toast({
        title: '分析完成',
        description: `意图：${result.intent}（置信度 ${result.confidence}%）`,
      })

      options.onAnalysisComplete?.(result)
      return result
    } catch (error) {
      console.error('[AnalyzeIntent] Error:', error)
      toast({
        title: '分析失败',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive',
      })
      return null
    } finally {
      setAnalyzing(false)
    }
  }

  // ─── 生成快捷回复 ────────────────────────────────────
  const generateReply = async (
    emailId: string,
    originalEmailContent: string,
    senderEmail: string,
    replyType: ReplyType,
    targetLanguage: string = 'English',
    ragContext?: string
  ): Promise<string | null> => {
    setGeneratingReply(true)
    try {
      const response = await fetch('/api/inbox/generate-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailId,
          originalEmailContent,
          senderEmail,
          replyType,
          targetLanguage,
          ragContext,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        
        // ─── 权限拦截处理 ────────────────────────────
        if (response.status === 403) {
          toast({
            title: '功能需要升级',
            description: error.message || '快捷回复仅专业版及以上可用',
            variant: 'destructive',
          })
          return null
        }

        if (response.status === 429) {
          toast({
            title: '配额已用尽',
            description: error.message || '本月 AI 算力已用尽，请等待下月重置或升级套餐',
            variant: 'destructive',
          })
          return null
        }

        throw new Error(error.error || 'Generation failed')
      }

      const data = await response.json()
      const replyDraft = data.replyDraft as string

      toast({
        title: '回复已生成',
        description: `已生成 ${targetLanguage} 版本的回复草稿`,
      })

      options.onReplyGenerated?.(replyDraft)
      return replyDraft
    } catch (error) {
      console.error('[GenerateReply] Error:', error)
      toast({
        title: '生成失败',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive',
      })
      return null
    } finally {
      setGeneratingReply(false)
    }
  }

  return {
    analyzeIntent,
    generateReply,
    analyzing,
    generatingReply,
  }
}
