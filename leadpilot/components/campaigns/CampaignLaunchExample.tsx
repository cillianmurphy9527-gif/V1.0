/**
 * 使用示例：在发信页面中集成预估确认弹窗
 * 
 * 文件位置：app/(dashboard)/campaigns/[id]/page.tsx 或类似的发信页面
 */

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { CampaignEstimateDialog } from '@/components/campaigns/CampaignEstimateDialog'
import { useToast } from '@/components/ui/use-toast'

export default function CampaignLaunchExample() {
  const { toast } = useToast()
  const [showEstimate, setShowEstimate] = useState(false)
  const [campaignConfig, setCampaignConfig] = useState({
    targetCount: 1000,
    enableDeepAnalysis: true,
    recipients: [] as any[]
  })

  /**
   * 用户点击「启动数字员工」按钮时触发
   * 拦截直接发送，先弹出预估确认弹窗
   */
  const handleStartCampaign = () => {
    // 验证是否有目标客户
    if (campaignConfig.targetCount === 0) {
      toast({
        title: "错误",
        description: "请先添加目标客户",
        variant: "destructive"
      })
      return
    }

    // 弹出预估确认弹窗
    setShowEstimate(true)
  }

  /**
   * 用户在预估弹窗中点击「确认启动」后执行
   * 这里才真正调用发信 API
   */
  const handleConfirmStart = async () => {
    try {
      // 真实调用批量发信 API
      const response = await fetch('/api/send-bulk-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipients: campaignConfig.recipients,
          campaignId: 'campaign-id-here'
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '启动失败')
      }

      toast({
        title: "成功",
        description: `任务已启动！已将 ${data.queued} 封邮件加入发送队列`
      })
      
      // 可选：跳转到任务监控页面
      // router.push('/dashboard/campaigns/monitor')

    } catch (err: any) {
      toast({
        title: "错误",
        description: err.message || '启动失败，请稍后重试',
        variant: "destructive"
      })
      throw err // 重新抛出，让弹窗组件处理
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">发起营销活动</h1>

      {/* 配置表单 */}
      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium mb-2">目标客户数量</label>
          <input
            type="number"
            value={campaignConfig.targetCount}
            onChange={(e) => setCampaignConfig(prev => ({ 
              ...prev, 
              targetCount: parseInt(e.target.value) || 0 
            }))}
            className="w-full px-4 py-2 border rounded-lg"
            min="1"
            max="50000"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="deepAnalysis"
            checked={campaignConfig.enableDeepAnalysis}
            onChange={(e) => setCampaignConfig(prev => ({ 
              ...prev, 
              enableDeepAnalysis: e.target.checked 
            }))}
            className="w-4 h-4"
          />
          <label htmlFor="deepAnalysis" className="text-sm font-medium">
            启用深度 AI 分析（网站爬取 + RAG 检索 + 个性化生成）
          </label>
        </div>
      </div>

      {/* 启动按钮 */}
      <Button
        onClick={handleStartCampaign}
        size="lg"
        className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
      >
        🚀 启动数字员工
      </Button>

      {/* 预估确认弹窗 */}
      <CampaignEstimateDialog
        open={showEstimate}
        onOpenChange={setShowEstimate}
        targetCount={campaignConfig.targetCount}
        enableDeepAnalysis={campaignConfig.enableDeepAnalysis}
        onConfirm={handleConfirmStart}
      />
    </div>
  )
}
