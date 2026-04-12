'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mail, Filter, Search, ChevronLeft, ChevronRight, CheckCircle2, AlertCircle, Clock, Eye, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'

interface SendingLogRecord {
  id: string
  recipient: string
  fromDomain: string
  fromEmail: string
  subject: string
  status: 'SENT' | 'BOUNCED' | 'OPENED' | 'CLICKED' | 'REPLIED' | 'UNSUBSCRIBED'
  sentAt: string
  openedAt?: string
  clickedAt?: string
  repliedAt?: string
  errorMessage?: string
  messageId?: string
}

interface SendingLogsTableProps {
  campaignId?: string
}

export function SendingLogsTable({ campaignId }: SendingLogsTableProps) {
  const { toast } = useToast()
  const [logs, setLogs] = useState<SendingLogRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [limit] = useState(50)
  const [stats, setStats] = useState<any>(null)
  const [pagination, setPagination] = useState<any>(null)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [searchEmail, setSearchEmail] = useState<string>('')

  useEffect(() => {
    fetchLogs()
  }, [page, statusFilter, campaignId])

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        ...(statusFilter && { status: statusFilter }),
        ...(campaignId && { campaignId }),
        ...(searchEmail && { recipient: searchEmail })
      })

      const response = await fetch(`/api/campaigns/sending-logs/detailed?${params}`)
      if (!response.ok) throw new Error('获取失败')

      const data = await response.json()
      setLogs(data.data)
      setStats(data.stats)
      setPagination(data.pagination)
    } catch (error) {
      toast({
        title: '获取失败',
        description: error instanceof Error ? error.message : '请稍后重试',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  // 导出功能已统一移至投递流水页面

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'SENT':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />
      case 'BOUNCED':
        return <AlertCircle className="w-4 h-4 text-red-400" />
      case 'OPENED':
        return <Eye className="w-4 h-4 text-blue-400" />
      case 'CLICKED':
        return <Mail className="w-4 h-4 text-purple-400" />
      case 'REPLIED':
        return <MessageSquare className="w-4 h-4 text-green-400" />
      default:
        return <Clock className="w-4 h-4 text-slate-400" />
    }
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      SENT: '已发送',
      BOUNCED: '退信',
      OPENED: '已打开',
      CLICKED: '已点击',
      REPLIED: '已回复',
      UNSUBSCRIBED: '已退订'
    }
    return labels[status] || status
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      SENT: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      BOUNCED: 'bg-red-500/10 text-red-400 border-red-500/20',
      OPENED: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      CLICKED: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      REPLIED: 'bg-green-500/10 text-green-400 border-green-500/20',
      UNSUBSCRIBED: 'bg-slate-500/10 text-slate-400 border-slate-500/20'
    }
    return colors[status] || colors.SENT
  }

  return (
    <div className="space-y-6">
      {/* 统计卡片 */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {[
            { label: '总数', value: stats.total, color: 'slate' },
            { label: '已发送', value: stats.sent, color: 'emerald' },
            { label: '退信', value: stats.bounced, color: 'red' },
            { label: '已打开', value: stats.opened, color: 'blue' },
            { label: '已点击', value: stats.clicked, color: 'purple' },
            { label: '已回复', value: stats.replied, color: 'green' }
          ].map(stat => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`bg-${stat.color}-500/10 border border-${stat.color}-500/20 rounded-lg p-3 text-center`}
            >
              <div className={`text-2xl font-bold text-${stat.color}-400`}>{stat.value}</div>
              <div className={`text-xs text-${stat.color}-300`}>{stat.label}</div>
            </motion.div>
          ))}
        </div>
      )}

      {/* 筛选和导出 */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="搜索邮箱..."
              value={searchEmail}
              onChange={(e) => {
                setSearchEmail(e.target.value)
                setPage(1)
              }}
              className="w-full md:w-48 pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPage(1)
            }}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">全部状态</option>
            <option value="SENT">已发送</option>
            <option value="BOUNCED">退信</option>
            <option value="OPENED">已打开</option>
            <option value="CLICKED">已点击</option>
            <option value="REPLIED">已回复</option>
          </select>
        </div>
      </div>

      {/* 表格 */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">加载中...</div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-slate-400">暂无发信记录</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-800/50 border-b border-slate-700">
                  <tr>
                    <th className="text-left py-3 px-4 text-slate-400 font-semibold text-sm">收件人</th>
                    <th className="text-left py-3 px-4 text-slate-400 font-semibold text-sm">发件域名</th>
                    <th className="text-left py-3 px-4 text-slate-400 font-semibold text-sm">邮件主题</th>
                    <th className="text-left py-3 px-4 text-slate-400 font-semibold text-sm">状态</th>
                    <th className="text-left py-3 px-4 text-slate-400 font-semibold text-sm">发送时间</th>
                    <th className="text-left py-3 px-4 text-slate-400 font-semibold text-sm">交互</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log, idx) => (
                    <motion.tr
                      key={log.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: idx * 0.02 }}
                      className="border-b border-slate-800 hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="py-3 px-4 text-sm text-white font-mono">{log.recipient}</td>
                      <td className="py-3 px-4 text-sm text-slate-300">{log.fromDomain}</td>
                      <td className="py-3 px-4 text-sm text-slate-300 truncate max-w-xs">{log.subject}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium border ${getStatusColor(log.status)}`}>
                          {getStatusIcon(log.status)}
                          {getStatusLabel(log.status)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-400">
                        {new Date(log.sentAt).toLocaleString('zh-CN')}
                      </td>
                      <td className="py-3 px-4 text-sm">
                        <div className="flex gap-1">
                          {log.openedAt && <span className="text-blue-400 text-xs">📖</span>}
                          {log.clickedAt && <span className="text-purple-400 text-xs">🔗</span>}
                          {log.repliedAt && <span className="text-green-400 text-xs">💬</span>}
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 分页 */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t border-slate-800">
                <div className="text-sm text-slate-400">
                  第 {page} / {pagination.totalPages} 页 (共 {pagination.total} 条)
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    variant="outline"
                    size="sm"
                    className="border-slate-600 text-slate-300"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    onClick={() => setPage(Math.min(pagination.totalPages, page + 1))}
                    disabled={page === pagination.totalPages}
                    variant="outline"
                    size="sm"
                    className="border-slate-600 text-slate-300"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
