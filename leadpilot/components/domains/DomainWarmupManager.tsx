'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Zap, ToggleLeft, AlertCircle, TrendingUp, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'

interface Domain {
  id: string
  domainName: string
  status: string
  warmupEnabled: boolean
  warmupDay: number
  dailyLimit: number
  sentToday: number
}

interface DomainWarmupManagerProps {
  domains: Domain[]
  onUpdate?: () => void
}

export function DomainWarmupManager({ domains, onUpdate }: DomainWarmupManagerProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [domainStates, setDomainStates] = useState<Record<string, any>>({})

  useEffect(() => {
    // 初始化每个域名的状态
    domains.forEach(domain => {
      fetchWarmupStatus(domain.id)
    })
  }, [domains])

  const fetchWarmupStatus = async (domainId: string) => {
    try {
      const response = await fetch(`/api/domains/warmup/status?domainId=${domainId}`)
      if (!response.ok) throw new Error('获取状态失败')

      const data = await response.json()
      setDomainStates(prev => ({
        ...prev,
        [domainId]: data.domain
      }))
    } catch (error) {
      console.error('Failed to fetch warmup status:', error)
    }
  }

  const handleToggleWarmup = async (domainId: string, currentState: boolean) => {
    setLoading(prev => ({ ...prev, [domainId]: true }))
    try {
      const response = await fetch('/api/domains/warmup/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domainId,
          enabled: !currentState
        })
      })

      if (!response.ok) throw new Error('操作失败')

      const data = await response.json()
      toast({
        title: '成功',
        description: data.message
      })

      await fetchWarmupStatus(domainId)
      onUpdate?.()
    } catch (error) {
      toast({
        title: '失败',
        description: error instanceof Error ? error.message : '请稍后重试',
        variant: 'destructive'
      })
    } finally {
      setLoading(prev => ({ ...prev, [domainId]: false }))
    }
  }

  return (
    <div className="space-y-4">
      {domains.map((domain, idx) => {
        const state = domainStates[domain.id]
        const progress = state ? (state.sentToday / state.dailyLimit) * 100 : 0

        return (
          <motion.div
            key={domain.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="bg-slate-900/50 border border-slate-800 rounded-xl p-4"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-semibold text-white">{domain.domainName}</h3>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    domain.status === 'ACTIVE'
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'bg-red-500/10 text-red-400'
                  }`}>
                    {domain.status === 'ACTIVE' ? '活跃' : '禁用'}
                  </span>
                </div>
                <p className="text-sm text-slate-400">
                  {state ? `预热第 ${state.warmupDay} 天` : '加载中...'}
                </p>
              </div>

              <Button
                onClick={() => handleToggleWarmup(domain.id, state?.warmupEnabled || false)}
                disabled={loading[domain.id]}
                variant={state?.warmupEnabled ? 'default' : 'outline'}
                size="sm"
                className={state?.warmupEnabled ? 'bg-blue-600 hover:bg-blue-500' : 'border-slate-600 text-slate-300'}
              >
                <ToggleLeft className="w-4 h-4 mr-2" />
                {state?.warmupEnabled ? '已启用' : '未启用'}
              </Button>
            </div>

            {state?.warmupEnabled && (
              <>
                {/* 每日限制进度条 */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <Calendar className="w-4 h-4" />
                      <span>今日发信限制</span>
                    </div>
                    <span className="text-sm font-semibold text-white">
                      {state.sentToday} / {state.dailyLimit}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.5 }}
                      className={`h-full ${
                        progress >= 100
                          ? 'bg-red-500'
                          : progress >= 80
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                    />
                  </div>
                </div>

                {/* 预热计划 */}
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div className="bg-slate-800/50 rounded-lg p-3">
                    <div className="text-slate-400 text-xs mb-1">预热进度</div>
                    <div className="text-lg font-bold text-blue-400">
                      第 {state.warmupDay} 天
                    </div>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-3">
                    <div className="text-slate-400 text-xs mb-1">每日上限</div>
                    <div className="text-lg font-bold text-emerald-400">
                      {state.dailyLimit}
                    </div>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-3">
                    <div className="text-slate-400 text-xs mb-1">剩余配额</div>
                    <div className="text-lg font-bold text-purple-400">
                      {state.remainingToday}
                    </div>
                  </div>
                </div>

                {/* 预热提示 */}
                {state.sentToday >= state.dailyLimit && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-start gap-3"
                  >
                    <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-amber-300">
                      <p className="font-semibold mb-1">今日配额已用尽</p>
                      <p className="text-amber-200/80">
                        请等待明天继续发信，或关闭预热模式以移除限制
                      </p>
                    </div>
                  </motion.div>
                )}
              </>
            )}

            {!state?.warmupEnabled && (
              <div className="p-3 bg-slate-800/30 rounded-lg text-sm text-slate-400">
                <p className="flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  预热模式未启用，该域名无发信限制
                </p>
              </div>
            )}
          </motion.div>
        )
      })}
    </div>
  )
}
