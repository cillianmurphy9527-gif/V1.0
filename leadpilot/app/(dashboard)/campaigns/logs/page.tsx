'use client'

import { useState, useEffect } from 'react'
import { Mail, CheckCircle2, XCircle, Eye, MousePointer, MessageSquare, Clock, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'

interface SendingLog {
  id: string
  recipient: string
  fromDomain: string
  fromEmail: string
  subject: string
  status: string
  messageId: string | null
  errorMessage: string | null
  sentAt: string
  openedAt: string | null
  clickedAt: string | null
  repliedAt: string | null
  campaignId: string | null
}

interface Stats {
  sent: number
  bounced: number
  opened: number
  clicked: number
  replied: number
  unsubscribed: number
  successRate: number
  totalAttempts: number
}

export default function SendingLogsPage() {
  const { toast } = useToast()
  const [logs, setLogs] = useState<SendingLog[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>('')

  // 加载发信日志
  const fetchLogs = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50'
      })
      
      if (statusFilter) {
        params.append('status', statusFilter)
      }

      const response = await fetch(`/api/campaigns/sending-logs?${params}`)
      const data = await response.json()

      if (data.success) {
        setLogs(data.data)
        setStats(data.stats)
        setTotalPages(data.pagination.totalPages)
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [page, statusFilter])

  // 自动刷新（每 10 秒）
  useEffect(() => {
    const interval = setInterval(fetchLogs, 10000)
    return () => clearInterval(interval)
  }, [page, statusFilter])

  // CSV 导出函数
  // 已禁用 - 导出功能统一移至投递流水页面

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* 标题和导出按钮 */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
              <Mail className="w-10 h-10" />
              发信流水大屏
            </h1>
            <p className="text-purple-200">实时监控邮件发送状态</p>
          </div>
        </div>

        {/* 统计卡片 */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard
              icon={<CheckCircle2 className="w-6 h-6" />}
              label="成功发送"
              value={stats.sent}
              color="green"
            />
            <StatCard
              icon={<XCircle className="w-6 h-6" />}
              label="退信"
              value={stats.bounced}
              color="red"
            />
            <StatCard
              icon={<Eye className="w-6 h-6" />}
              label="已打开"
              value={stats.opened}
              color="blue"
            />
            <StatCard
              icon={<MessageSquare className="w-6 h-6" />}
              label="已回复"
              value={stats.replied}
              color="purple"
            />
          </div>
        )}

        {/* 成功率指示器 */}
        {stats && (
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 mb-6 border border-white/20">
            <div className="flex items-center justify-between mb-3">
              <span className="text-white font-semibold">发送成功率</span>
              <span className="text-3xl font-bold text-white">{stats.successRate}%</span>
            </div>
            <div className="w-full bg-white/20 rounded-full h-3 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-green-400 to-emerald-500 h-full transition-all duration-500"
                style={{ width: `${stats.successRate}%` }}
              />
            </div>
            <div className="flex justify-between text-sm text-purple-200 mt-2">
              <span>总尝试: {stats.totalAttempts}</span>
              <span>成功: {stats.sent + stats.replied}</span>
            </div>
          </div>
        )}

        {/* 筛选器 */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 mb-6 border border-white/20">
          <div className="flex items-center gap-3 flex-wrap">
            <Filter className="w-5 h-5 text-white" />
            <span className="text-white font-medium">状态筛选：</span>
            <FilterButton label="全部" value="" active={statusFilter === ''} onClick={() => setStatusFilter('')} />
            <FilterButton label="已发送" value="SENT" active={statusFilter === 'SENT'} onClick={() => setStatusFilter('SENT')} />
            <FilterButton label="退信" value="BOUNCED" active={statusFilter === 'BOUNCED'} onClick={() => setStatusFilter('BOUNCED')} />
            <FilterButton label="已打开" value="OPENED" active={statusFilter === 'OPENED'} onClick={() => setStatusFilter('OPENED')} />
            <FilterButton label="已回复" value="REPLIED" active={statusFilter === 'REPLIED'} onClick={() => setStatusFilter('REPLIED')} />
          </div>
        </div>

        {/* 日志表格 */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-white/30 border-t-white" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-20 text-purple-200">
              <Mail className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>暂无发信记录</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-white/5 border-b border-white/10">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-white">收件人</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-white">发信域名</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-white">主题</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-white">状态</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-white">发送时间</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <LogRow key={log.id} log={log} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-6">
            <Button
              variant="outline"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="bg-white/10 border-white/20 text-white hover:bg-white/20"
            >
              上一页
            </Button>
            <div className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-lg border border-white/20">
              <span className="text-white">{page} / {totalPages}</span>
            </div>
            <Button
              variant="outline"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="bg-white/10 border-white/20 text-white hover:bg-white/20"
            >
              下一页
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode, label: string, value: number, color: string }) {
  const colorClasses = {
    green: 'from-green-500 to-emerald-600',
    red: 'from-red-500 to-pink-600',
    blue: 'from-blue-500 to-cyan-600',
    purple: 'from-purple-500 to-fuchsia-600'
  }

  return (
    <div className={`bg-gradient-to-br ${colorClasses[color as keyof typeof colorClasses]} rounded-xl p-6 text-white shadow-lg`}>
      <div className="flex items-center justify-between mb-2">
        {icon}
        <span className="text-3xl font-bold">{value.toLocaleString()}</span>
      </div>
      <p className="text-sm opacity-90">{label}</p>
    </div>
  )
}

function FilterButton({ label, value, active, onClick }: { label: string, value: string, active: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
        active 
          ? 'bg-white text-purple-900' 
          : 'bg-white/10 text-white hover:bg-white/20'
      }`}
    >
      {label}
    </button>
  )
}

function LogRow({ log }: { log: SendingLog }) {
  const statusConfig = {
    SENT: { icon: <CheckCircle2 className="w-4 h-4" />, color: 'text-green-400', bg: 'bg-green-500/20', label: '已发送' },
    BOUNCED: { icon: <XCircle className="w-4 h-4" />, color: 'text-red-400', bg: 'bg-red-500/20', label: '退信' },
    OPENED: { icon: <Eye className="w-4 h-4" />, color: 'text-blue-400', bg: 'bg-blue-500/20', label: '已打开' },
    CLICKED: { icon: <MousePointer className="w-4 h-4" />, color: 'text-cyan-400', bg: 'bg-cyan-500/20', label: '已点击' },
    REPLIED: { icon: <MessageSquare className="w-4 h-4" />, color: 'text-purple-400', bg: 'bg-purple-500/20', label: '已回复' },
    UNSUBSCRIBED: { icon: <XCircle className="w-4 h-4" />, color: 'text-orange-400', bg: 'bg-orange-500/20', label: '已退订' },
  }

  const config = statusConfig[log.status as keyof typeof statusConfig] || statusConfig.SENT

  return (
    <tr className="border-b border-white/10 hover:bg-white/5 transition-colors">
      <td className="px-4 py-4">
        <div className="text-white font-medium">{log.recipient}</div>
        {log.errorMessage && (
          <div className="text-xs text-red-300 mt-1">{log.errorMessage}</div>
        )}
      </td>
      <td className="px-4 py-4">
        <div className="text-purple-200 text-sm">{log.fromDomain}</div>
        <div className="text-xs text-purple-300 mt-1">{log.fromEmail}</div>
      </td>
      <td className="px-4 py-4">
        <div className="text-white text-sm max-w-xs truncate">{log.subject}</div>
      </td>
      <td className="px-4 py-4">
        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${config.bg} ${config.color}`}>
          {config.icon}
          <span className="text-sm font-medium">{config.label}</span>
        </div>
      </td>
      <td className="px-4 py-4">
        <div className="flex items-center gap-2 text-purple-200 text-sm">
          <Clock className="w-4 h-4" />
          {new Date(log.sentAt).toLocaleString('zh-CN')}
        </div>
        {log.openedAt && (
          <div className="text-xs text-blue-300 mt-1">
            打开: {new Date(log.openedAt).toLocaleString('zh-CN')}
          </div>
        )}
        {log.repliedAt && (
          <div className="text-xs text-purple-300 mt-1">
            回复: {new Date(log.repliedAt).toLocaleString('zh-CN')}
          </div>
        )}
      </td>
    </tr>
  )
}
