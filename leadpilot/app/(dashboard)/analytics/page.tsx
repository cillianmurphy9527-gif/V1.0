"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { 
  TrendingUp, 
  Mail, 
  Users, 
  DollarSign,
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { useApiCall } from "@/lib/hooks/useApiCall"
import Link from "next/link"

type EmailIntent = 'HIGH_INTENT' | 'NEED_FOLLOWUP' | 'AUTO_REPLY' | 'REJECTED'

interface EmailClassification {
  threadId: string
  targetEmail: string
  subject: string
  intent: EmailIntent
  intentLabel: string
  createdAt: string
}

interface InboxStats {
  highIntent: number
  needFollowup: number
  autoReply: number
  rejected: number
  total: number
}

export default function AnalyticsPage() {
  const [stats, setStats] = useState<InboxStats>({
    highIntent: 0,
    needFollowup: 0,
    autoReply: 0,
    rejected: 0,
    total: 0
  })
  const [highPriorityEmails, setHighPriorityEmails] = useState<EmailClassification[]>([])

  const { loading, execute } = useApiCall({
    onSuccess: (data) => {
      setStats(data.stats)
      setHighPriorityEmails(data.highPriorityEmails || [])
    }
  })

  useEffect(() => {
    fetchInboxAnalytics()
  }, [])

  const fetchInboxAnalytics = async () => {
    await execute('/api/analytics/inbox')
  }

  const getPercentage = (value: number) => {
    return stats.total > 0 ? Math.round((value / stats.total) * 100) : 0
  }

  const getIntentStyle = (intent: EmailIntent) => {
    switch (intent) {
      case 'HIGH_INTENT':
        return {
          bg: 'bg-emerald-500/10',
          border: 'border-emerald-500/30',
          text: 'text-emerald-400',
          icon: '🟢'
        }
      case 'NEED_FOLLOWUP':
        return {
          bg: 'bg-yellow-500/10',
          border: 'border-yellow-500/30',
          text: 'text-yellow-400',
          icon: '🟡'
        }
      case 'AUTO_REPLY':
        return {
          bg: 'bg-red-500/10',
          border: 'border-red-500/30',
          text: 'text-red-400',
          icon: '🔴'
        }
      case 'REJECTED':
        return {
          bg: 'bg-slate-500/10',
          border: 'border-slate-500/30',
          text: 'text-slate-400',
          icon: '⚫'
        }
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="container mx-auto px-6 py-8">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold mb-2">数据分析</h1>
            <p className="text-slate-400">实时监控业务数据和 AI 洞察</p>
          </div>
        </div>

        {/* 核心指标卡片 */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          {[
            { icon: Mail,       label: '总发送量',     value: loading ? '…' : String(stats.total),                        color: 'blue'   },
            { icon: TrendingUp, label: '高意向回复',   value: loading ? '…' : String(stats.highIntent),                  color: 'green'  },
            { icon: Users,      label: '需跟进',       value: loading ? '…' : String(stats.needFollowup),               color: 'purple' },
            { icon: DollarSign, label: '自动/退信',    value: loading ? '…' : String(stats.autoReply + stats.rejected), color: 'orange' }
          ].map((stat, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-slate-900/50 border border-slate-700 rounded-2xl p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <stat.icon className={`w-8 h-8 text-${stat.color}-400`} />
              </div>
              <div className="text-3xl font-bold text-white mb-1">{stat.value}</div>
              <div className="text-sm text-slate-400">{stat.label}</div>
            </motion.div>
          ))}
        </div>

        {/* 收件箱 AI 洞察模块 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-slate-900/50 border border-slate-700 rounded-3xl p-8"
        >
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">收件箱 AI 洞察</h2>
              <p className="text-slate-400">今日新增未读邮件意图分类</p>
            </div>
            <Button
              onClick={fetchInboxAnalytics}
              disabled={loading}
              variant="outline"
              size="sm"
              className="border-slate-600 text-slate-300 hover:bg-slate-800"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <TrendingUp className="w-4 h-4 mr-2" />
              )}
              刷新数据
            </Button>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
            </div>
          ) : stats.total === 0 ? (
            <EmptyState
              icon={Mail}
              title="暂无邮件数据"
              description="开始发送邮件后，这里将显示 AI 分析的收件箱洞察"
              actionLabel="前往发送邮件"
              onAction={() => window.location.href = '/dashboard'}
            />
          ) : (
            <div className="grid lg:grid-cols-2 gap-8">
              {/* 左侧：环形图 */}
              <div>
                <div className="relative">
                  <svg viewBox="0 0 200 200" className="w-full max-w-sm mx-auto">
                    <circle cx="100" cy="100" r="80" fill="none" stroke="rgb(51, 65, 85)" strokeWidth="20" />
                    
                    {(() => {
                      let offset = 0
                      const radius = 80
                      const circumference = 2 * Math.PI * radius
                      
                      return [
                        { value: stats.highIntent, color: 'rgb(52, 211, 153)' },
                        { value: stats.needFollowup, color: 'rgb(251, 191, 36)' },
                        { value: stats.autoReply, color: 'rgb(248, 113, 113)' },
                        { value: stats.rejected, color: 'rgb(148, 163, 184)' }
                      ].map((segment, index) => {
                        const percentage = getPercentage(segment.value)
                        const strokeDasharray = `${(percentage / 100) * circumference} ${circumference}`
                        const strokeDashoffset = -offset * circumference / 100
                        offset += percentage
                        
                        return (
                          <circle
                            key={index}
                            cx="100"
                            cy="100"
                            r={radius}
                            fill="none"
                            stroke={segment.color}
                            strokeWidth="20"
                            strokeDasharray={strokeDasharray}
                            strokeDashoffset={strokeDashoffset}
                            transform="rotate(-90 100 100)"
                            className="transition-all duration-1000"
                          />
                        )
                      })
                    })()}
                  </svg>

                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-4xl font-bold text-white">{stats.total}</div>
                      <div className="text-sm text-slate-400 mt-1">总邮件数</div>
                    </div>
                  </div>
                </div>

                <div className="mt-8 space-y-3">
                  {[
                    { label: '🟢 高意向 (询价/要资料)', value: stats.highIntent, color: 'emerald' },
                    { label: '🟡 需跟进 (疑问/砍价)', value: stats.needFollowup, color: 'yellow' },
                    { label: '🔴 自动回复/休假 (OOO)', value: stats.autoReply, color: 'red' },
                    { label: '⚫ 明确拒绝', value: stats.rejected, color: 'slate' }
                  ].map((item, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.6 + index * 0.1 }}
                      className="flex items-center justify-between p-3 bg-slate-800/30 rounded-xl"
                    >
                      <span className="text-sm text-slate-300">{item.label}</span>
                      <div className="flex items-center gap-3">
                        <span className={`text-lg font-bold text-${item.color}-400`}>
                          {item.value}
                        </span>
                        <span className="text-sm text-slate-500">
                          {getPercentage(item.value)}%
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* 右侧：高优先级待处理列表 */}
              <div>
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-orange-400" />
                  高优先级待处理
                </h3>

                <div className="space-y-3">
                  {highPriorityEmails.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-20" />
                      <p>暂无待处理邮件</p>
                    </div>
                  ) : (
                    highPriorityEmails.map((email, index) => {
                      const style = getIntentStyle(email.intent)
                      
                      return (
                        <motion.div
                          key={email.threadId}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.7 + index * 0.1 }}
                          className="group bg-slate-800/50 border border-slate-700 rounded-xl p-4 hover:border-blue-500/50 transition-all cursor-pointer"
                        >
                          <Link href={`/inbox?thread=${email.threadId}`}>
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1">
                                <div className="font-semibold text-white mb-1 group-hover:text-blue-400 transition-colors">
                                  {email.targetEmail}
                                </div>
                                <div className="text-sm text-slate-400 truncate">
                                  {email.subject}
                                </div>
                              </div>
                              <ArrowRight className="w-5 h-5 text-slate-600 group-hover:text-blue-400 transition-colors flex-shrink-0 ml-3" />
                            </div>

                            <div className="flex items-center justify-between">
                              <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${style.bg} border ${style.border}`}>
                                <span>{style.icon}</span>
                                <span className={`text-xs font-medium ${style.text}`}>
                                  {email.intentLabel}
                                </span>
                              </div>
                              <span className="text-xs text-slate-500">
                                {new Date(email.createdAt).toLocaleString('zh-CN', {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </div>
                          </Link>
                        </motion.div>
                      )
                    })
                  )}
                </div>

                {highPriorityEmails.length > 0 && (
                  <Link href="/inbox">
                    <Button
                      className="w-full mt-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white"
                    >
                      查看全部收件箱
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
