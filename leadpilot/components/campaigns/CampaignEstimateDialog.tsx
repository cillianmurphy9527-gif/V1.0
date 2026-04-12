'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Loader2, AlertTriangle, Zap } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { EstimateContent } from './EstimateContent'

interface EstimateData {
  targetCount: number
  enableDeepAnalysis: boolean
  tokenPerLead: number
  totalTokensRequired: number
  tokenBreakdown: {
    baseGeneration: number
    deepAnalysis: number
    websiteScraping: number
    ragRetrieval: number
    intentScoring: number
  }
  currentBalance: {
    tokenBalance: number
    addonCredits: number
    total: number
  }
  isSufficient: boolean
  shortfall: number
  shortfallPercentage: number
  estimatedTimeDisplay: string
  hourlyLimit: number
  availableDomains: number
  estimatedSuccessRate: number
  estimatedSuccessfulSends: number
  tierLabel: string
}

interface CampaignEstimateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  targetCount: number
  enableDeepAnalysis: boolean
  campaignId?: string
  onConfirm: () => Promise<void>
}

export function CampaignEstimateDialog({
  open,
  onOpenChange,
  targetCount,
  enableDeepAnalysis,
  campaignId,
  onConfirm
}: CampaignEstimateDialogProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [estimateData, setEstimateData] = useState<EstimateData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  // 当弹窗打开时，自动调用预估 API
  useEffect(() => {
    if (open) {
      fetchEstimate()
    } else {
      // 关闭时重置状态
      setEstimateData(null)
      setError(null)
    }
  }, [open])

  const fetchEstimate = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/campaigns/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetCount,
          enableDeepAnalysis,
          campaignId
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '预估失败')
      }

      setEstimateData(data.estimate)

    } catch (err: any) {
      setError(err.message || '预估计算失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = async () => {
    setConfirming(true)
    try {
      await onConfirm()
      onOpenChange(false)
    } catch (err) {
      console.error('Failed to start campaign:', err)
    } finally {
      setConfirming(false)
    }
  }

  const handleRecharge = () => {
    router.push('/dashboard/billing?action=recharge')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <Zap className="w-6 h-6 text-yellow-500" />
            任务预估确认
          </DialogTitle>
          <DialogDescription>
            请仔细核对以下预估数据，确认后将启动数字员工
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-12 h-12 animate-spin text-blue-500 mb-4" />
            <p className="text-gray-600">正在计算预估数据...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-800">预估失败</p>
              <p className="text-red-600 text-sm mt-1">{error}</p>
            </div>
          </div>
        )}

        {estimateData && (
          <EstimateContent 
            data={estimateData}
            enableDeepAnalysis={enableDeepAnalysis}
            confirming={confirming}
            onConfirm={handleConfirm}
            onRecharge={handleRecharge}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
