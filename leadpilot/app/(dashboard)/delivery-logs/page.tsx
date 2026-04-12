"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import {
  Download, Mail, RefreshCw, Search, ChevronLeft, ChevronRight,
  Database, Users, Diamond, Lock, Unlock, CheckSquare, Square, Loader2,
  KeyRound, Eye, X
} from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { Dialog, DialogContent } from "@/components/ui/dialog"

type LogStatus = 'SENT' | 'DELIVERED' | 'OPENED' | 'CLICKED' | 'REPLIED' | 'BOUNCED' | 'FAILED' | 'PENDING_PAYMENT'

interface DeliveryLog {
  id: string
  sentAt: string
  recipientEmail: string
  companyName: string | null
  contactName: string | null
  fromDomain: string
  subject: string
  body: string | null
  status: LogStatus
  openCount: number
  clickCount: number
  errorMessage: string | null
  leadId: string | null
  isUnlocked: boolean
}

interface Lead {
  id: string
  companyName: string
  contactName: string | null
  jobTitle: string | null
  country: string | null
  email: string
  isUnlocked: boolean
  source: string
  website: string | null
  linkedIn: string | null
  industry: string | null
  createdAt: string
}

const LOG_STATUS_LABEL: Record<string, string> = {
  SENT: '已发送',
  DELIVERED: '已投递',
  OPENED: '已打开',
  CLICKED: '已点击',
  REPLIED: '已回复',
  BOUNCED: '退信',
  FAILED: '失败',
  PENDING_PAYMENT: '待发送', // 真实业务流转状态：待发送/草稿
}

const LOG_STATUS_STYLE: Record<string, string> = {
  SENT:      'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  DELIVERED: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  OPENED:    'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  CLICKED:   'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20',
  REPLIED:   'bg-purple-500/10 text-purple-400 border border-purple-500/20',
  BOUNCED:   'bg-red-500/10 text-red-400 border border-red-500/20',
  FAILED:    'bg-red-500/10 text-red-400 border border-red-500/20',
  PENDING_PAYMENT: 'bg-slate-500/10 text-slate-400 border border-slate-500/20', // 中性草稿灰
}

const LEAD_SOURCE_LABEL: Record<string, string> = {
  NOVA: 'Nova 挖掘',
  IMPORT: '手动导入',
  CAMPAIGN: '活动生成',
}

const PAGE_SIZE = 20

function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!domain) return email
  const maskedLocal = local.length > 1 ? local[0] + '***' + local.slice(-1) : local + '***'
  return `${maskedLocal}@${domain}`
}

export default function DataAssetCenterPage() {
  const { toast } = useToast()
  const router = useRouter()

  const [activeTab, setActiveTab] = useState<'logs' | 'leads'>('logs')

  const [logs, setLogs] = useState<DeliveryLog[]>([])
  const [logTotal, setLogTotal] = useState(0)
  const [logPage, setLogPage] = useState(1)
  const [logLoading, setLogLoading] = useState(true)
  const [logSearch, setLogSearch] = useState('')
  const [showLogExportModal, setShowLogExportModal] = useState(false)
  const [logExporting, setLogExporting] = useState(false)

  const [leads, setLeads] = useState<Lead[]>([])
  const [leadTotal, setLeadTotal] = useState(0)
  const [leadPage, setLeadPage] = useState(1)
  const [leadLoading, setLeadLoading] = useState(true)
  const [leadQuota, setLeadQuota] = useState(0)
  const [leadSearch, setLeadSearch] = useState('')

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [unlocking, setUnlocking] = useState(false)
  const [showUnlockModal, setShowUnlockModal] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [exporting, setExporting] = useState(false)

  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [selectedLogForPreview, setSelectedLogForPreview] = useState<DeliveryLog | null>(null)

  useEffect(() => {
    if (activeTab === 'logs') fetchLogs()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logPage, logSearch, activeTab])

  const fetchLogs = async () => {
    setLogLoading(true)
    try {
      const params = new URLSearchParams({ page: String(logPage), limit: String(PAGE_SIZE), search: logSearch })
      const r = await fetch(`/api/delivery-logs?${params}`)
      if (r.ok) {
        const d = await r.json()
        const raw: any[] = d.data || []
        setLogs(raw.map((l: any) => ({
          id: l.id,
          sentAt: l.sentAt ? new Date(l.sentAt).toLocaleString('zh-CN') : '—',
          recipientEmail: l.recipientEmail || '—',
          companyName: l.companyName || null,
          contactName: l.contactName || null,
          fromDomain: l.senderDomain || '—',
          subject: l.subject || '—',
          body: l.body || null,
          status: (l.status || 'SENT') as LogStatus,
          openCount: l.openCount ?? 0,
          clickCount: l.clickCount ?? 0,
          errorMessage: l.errorMessage || null,
          leadId: l.leadId || null,
          isUnlocked: l.isUnlocked ?? false,
        })))
        setLogTotal(d.pagination?.total || 0)
      }
    } catch {
      setLogs([])
    } finally {
      setLogLoading(false)
    }
  }

  const handleLogExportClick = () => {
    if (logs.length === 0) {
      toast({ title: '暂无数据', description: '当前没有可导出的投递记录', variant: 'destructive' })
      return
    }
    setShowLogExportModal(true)
  }

  const handleLogConfirmExport = async () => {
    setLogExporting(true)
    try {
      const headers = ['发送时间', '收件人邮箱', '公司名称', '联系人', '发送域名', '邮件主题', '状态', '打开次数', '点击次数', '错误信息']
      const rows = logs.map(l => [
        l.sentAt,
        l.recipientEmail,
        l.companyName || '',
        l.contactName || '',
        l.fromDomain,
        `"${l.subject.replace(/"/g, '""')}"`,
        LOG_STATUS_LABEL[l.status] || l.status,
        l.openCount,
        l.clickCount,
        l.errorMessage || '',
      ])
      const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `投递流水-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      URL.revokeObjectURL(url)
      document.body.removeChild(a)
      setShowLogExportModal(false)
      toast({ title: '导出成功', description: `${logs.length} 条投递记录已导出` })
    } catch {
      toast({ title: '导出失败', description: '请稍后重试', variant: 'destructive' })
    } finally {
      setLogExporting(false)
    }
  }

  const logTotalPages = Math.max(1, Math.ceil(logTotal / PAGE_SIZE))

  useEffect(() => {
    if (activeTab === 'leads') {
      fetchLeads()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadPage, activeTab])

  const fetchLeads = async () => {
    setLeadLoading(true)
    try {
      const params = new URLSearchParams({ page: String(leadPage), limit: String(PAGE_SIZE) })
      const r = await fetch(`/api/leads?${params}`)
      if (r.ok) {
        const d = await r.json()
        const raw: any[] = d.data || []
        setLeads(raw.map((l: any) => ({
          id: l.id,
          companyName: l.companyName,
          contactName: l.contactName,
          jobTitle: l.jobTitle,
          country: l.country,
          email: l.email,
          isUnlocked: l.isUnlocked ?? false,
          source: l.source,
          website: l.website || null,
          linkedIn: l.linkedIn || null,
          industry: l.industry || null,
          createdAt: l.createdAt ? new Date(l.createdAt).toLocaleString('zh-CN') : '—',
        })))
        setLeadTotal(d.pagination?.total || 0)
        setLeadQuota(d.exportQuota ?? 0)
        setSelectedIds(new Set())
      }
    } catch {
      setLeads([])
    } finally {
      setLeadLoading(false)
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredLeads.length && filteredLeads.length > 0) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredLeads.map(l => l.id)))
    }
  }

  const filteredLeads = leadSearch.trim()
    ? leads.filter(l =>
        l.companyName.toLowerCase().includes(leadSearch.toLowerCase()) ||
        (l.contactName || '').toLowerCase().includes(leadSearch.toLowerCase()) ||
        l.email.toLowerCase().includes(leadSearch.toLowerCase())
      )
    : leads

  const unlockedLeads = filteredLeads.filter(l => l.isUnlocked)
  const lockedLeads = filteredLeads.filter(l => !l.isUnlocked)

  const handleUnlock = async (leadIds: string[]) => {
    setUnlocking(true)
    try {
      const r = await fetch('/api/leads/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadIds }),
      })
      const data = await r.json()

      if (r.status === 403) {
        toast({
          title: '额度不足',
          description: data.message || '解锁额度不足，请前往充值',
          variant: 'destructive',
          action: (
            <button onClick={() => router.push('/store')}
              className="px-3 py-1.5 bg-white text-amber-600 rounded-lg text-xs font-semibold hover:bg-gray-100 border border-amber-200">
              前往充值
            </button>
          ),
        })
        return
      }

      if (!r.ok) {
        toast({ title: '解锁失败', description: data.error || '请稍后重试', variant: 'destructive' })
        return
      }

      toast({
        title: '解锁成功',
        description: `已解锁 ${data.unlockedCount} 条线索，剩余 ${data.remainingQuota} 额度`,
      })
      setShowUnlockModal(false)
      setSelectedIds(new Set())
      await fetchLeads()
    } catch {
      toast({ title: '解锁失败', description: '网络错误，请稍后重试', variant: 'destructive' })
    } finally {
      setUnlocking(false)
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const r = await fetch('/api/leads/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: unlockedLeads.length }),
      })

      if (r.status === 400) {
        const data = await r.json()
        if (data.error === 'NO_UNLOCKED_LEADS') {
          toast({ title: '没有可导出的线索', description: '请先解锁目标线索后再导出', variant: 'destructive' })
          setShowExportModal(false)
          return
        }
      }

      if (!r.ok) throw new Error('导出失败')

      const blob = await r.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `线索库-${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      setShowExportModal(false)
      toast({ title: '导出成功', description: `${unlockedLeads.length} 条已解锁线索已导出为 Excel` })
    } catch {
      toast({ title: '导出失败', description: '请稍后重试', variant: 'destructive' })
    } finally {
      setExporting(false)
    }
  }

  const leadTotalPages = Math.max(1, Math.ceil(leadTotal / PAGE_SIZE))

  const tabs = [
    { id: 'logs' as const, label: '投递流水', icon: Mail },
    { id: 'leads' as const, label: '目标线索库', icon: Database },
  ]

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="container mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
            <Database className="w-9 h-9 text-blue-400" />
            数据资产中心
          </h1>
          <p className="text-slate-400">你的投递记录与高价值线索，统一管理、安全导出</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-slate-900/60 p-1 rounded-2xl border border-slate-800 w-fit">
          {tabs.map(tab => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* ─── Tab 1: 投递流水 ─────────────────────────── */}
        {activeTab === 'logs' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            {/* Toolbar */}
            <div className="mb-6 flex items-center justify-between w-full gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={logSearch}
                  onChange={e => { setLogSearch(e.target.value); setLogPage(1) }}
                  placeholder="搜索邮箱、公司名或联系人…"
                  className="w-full pl-11 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center gap-3">
                <button onClick={fetchLogs}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 hover:border-slate-600 transition-all text-sm">
                  <RefreshCw className={`w-4 h-4 ${logLoading ? 'animate-spin' : ''}`} />
                  刷新
                </button>
                <button onClick={handleLogExportClick} disabled={logExporting}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 hover:border-slate-600 transition-all text-sm font-medium">
                  <Download className="w-4 h-4" />
                  导出流水记录
                </button>
              </div>
            </div>

            {/* Table */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="bg-slate-900/50 border border-slate-700 rounded-3xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700 bg-slate-800/50">
                      {['收件人情报', '主题 · 域名', '互动追踪', '状态', '发送时间'].map(h => (
                        <th key={h} className="text-left py-4 px-5 text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {logLoading ? (
                      <tr>
                        <td colSpan={5} className="py-20 text-center">
                          <RefreshCw className="w-8 h-8 text-slate-600 animate-spin mx-auto mb-3" />
                          <p className="text-slate-500 text-sm">加载中…</p>
                        </td>
                      </tr>
                    ) : logs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-20 text-center">
                          <Mail className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                          <p className="text-slate-500 font-medium">暂无投递记录</p>
                          <p className="text-slate-600 text-sm mt-1">启动 Nova 发信后，投递流水将在此实时显示</p>
                        </td>
                      </tr>
                    ) : logs.map((log, i) => (
                      <motion.tr key={log.id}
                        initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                        className="border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors group">

                        <td className="py-4 px-5">
                          {log.isUnlocked && (log.contactName || log.companyName) ? (
                            <div className="flex items-start gap-3">
                              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/25 flex items-center justify-center flex-shrink-0 mt-0.5">
                                <span className="text-sm font-bold text-blue-400">
                                  {(log.contactName || log.companyName || '?')[0].toUpperCase()}
                                </span>
                              </div>
                              <div className="flex flex-col gap-0.5 min-w-0">
                                {log.contactName && (
                                  <span className="text-sm font-semibold text-white leading-tight truncate max-w-[160px]" title={log.contactName}>
                                    {log.contactName}
                                  </span>
                                )}
                                {log.companyName && (
                                  <span className="text-xs text-slate-400 leading-tight truncate max-w-[160px] flex items-center gap-1" title={log.companyName}>
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block flex-shrink-0" />
                                    {log.companyName}
                                  </span>
                                )}
                                <span className="text-xs font-mono text-blue-400/80 mt-1 truncate max-w-[180px]" title={log.recipientEmail}>
                                  {log.recipientEmail}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-1.5">
                                <Lock className="w-3 h-3 text-amber-500/70 flex-shrink-0" />
                                <span className="text-xs font-mono text-amber-400/70">
                                  {maskEmail(log.recipientEmail)}
                                </span>
                              </div>
                              {log.companyName && (
                                <span className="text-xs text-slate-600 leading-tight truncate max-w-[160px]">
                                  {log.companyName}
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        <td className="py-4 px-5">
                          <div className="flex flex-col gap-1 max-w-[280px]">
                            <span className="text-sm text-slate-200 truncate" title={log.subject}>{log.subject}</span>
                            <span className="text-xs font-mono text-slate-500 truncate">via {log.fromDomain}</span>
                          </div>
                        </td>

                        <td className="py-4 px-5">
                          <div className="flex items-center gap-2.5">
                            <div className="group relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition-all duration-200 cursor-default"
                              title={`打开 ${log.openCount} 次`}
                              style={log.openCount > 0
                                ? { background: 'linear-gradient(135deg, rgba(34,211,238,0.12), rgba(6,182,212,0.08))', borderColor: 'rgba(34,211,238,0.35)', boxShadow: '0 0 12px rgba(34,211,238,0.08)' }
                                : { backgroundColor: 'rgba(51,65,85,0.25)', borderColor: 'rgba(51,65,85,0.5)' }
                              }>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                                style={log.openCount > 0 ? { color: '#22d3ee', filter: 'drop-shadow(0 0 4px rgba(34,211,238,0.6))' } : { color: '#475569' }}>
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                <circle cx="12" cy="12" r="3"/>
                              </svg>
                              <span className="text-xs font-bold tabular-nums"
                                style={log.openCount > 0 ? { color: '#22d3ee', textShadow: '0 0 8px rgba(34,211,238,0.4)' } : { color: '#475569' }}>
                                {log.openCount}
                              </span>
                              {log.openCount > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-cyan-400 opacity-75 animate-ping" />
                              )}
                            </div>

                            <div className="group relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition-all duration-200 cursor-default"
                              title={`点击 ${log.clickCount} 次`}
                              style={log.clickCount > 0
                                ? { background: 'linear-gradient(135deg, rgba(168,85,247,0.14), rgba(139,92,246,0.08))', borderColor: 'rgba(168,85,247,0.35)', boxShadow: '0 0 12px rgba(168,85,247,0.08)' }
                                : { backgroundColor: 'rgba(51,65,85,0.25)', borderColor: 'rgba(51,65,85,0.5)' }
                              }>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                                style={log.clickCount > 0 ? { color: '#a855f7', filter: 'drop-shadow(0 0 4px rgba(168,85,247,0.6))' } : { color: '#475569' }}>
                                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                              </svg>
                              <span className="text-xs font-bold tabular-nums"
                                style={log.clickCount > 0 ? { color: '#a855f7', textShadow: '0 0 8px rgba(168,85,247,0.4)' } : { color: '#475569' }}>
                                {log.clickCount}
                              </span>
                              {log.clickCount > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-purple-400 opacity-75 animate-ping" />
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="py-4 px-5">
                          <div className="relative group inline-block">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold cursor-default transition-all ${
                              LOG_STATUS_STYLE[log.status] || LOG_STATUS_STYLE.SENT
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                log.status === 'SENT' ? 'bg-emerald-400' :
                                log.status === 'DELIVERED' ? 'bg-blue-400' :
                                log.status === 'OPENED' ? 'bg-blue-400' :
                                log.status === 'CLICKED' ? 'bg-cyan-400' :
                                log.status === 'REPLIED' ? 'bg-purple-400' :
                                'bg-red-400'
                              } ${(log.status === 'OPENED' || log.status === 'CLICKED' || log.status === 'REPLIED') ? 'animate-pulse' : ''}`} />
                              {LOG_STATUS_LABEL[log.status] || log.status}
                            </span>
                            {log.errorMessage && (
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 rounded-xl bg-slate-800 border border-red-500/30 shadow-2xl shadow-red-500/10
                                opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none">
                                <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-slate-800 border-r border-b border-red-500/30" />
                                <div className="text-xs font-semibold text-red-400 mb-1.5 flex items-center gap-1.5">
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400">
                                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                                  </svg>
                                  投递详情
                                </div>
                                <p className="text-xs text-slate-300 leading-relaxed break-words">{log.errorMessage}</p>
                              </div>
                            )}
                          </div>
                        </td>

                        <td className="py-4 px-5 text-sm text-slate-400 whitespace-nowrap">{log.sentAt}</td>

                        <td className="py-4 px-5">
                          {i === 0 ? (
                            <button
                              onClick={() => {
                                setSelectedLogForPreview(log)
                                setShowPreviewModal(true)
                              }}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30 hover:bg-blue-500/25 transition-all flex items-center gap-1.5">
                              <Eye className="w-3.5 h-3.5" />
                              预览信件
                            </button>
                          ) : (
                            <button
                              onClick={() => router.push('/billing')}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 transition-all flex items-center gap-1.5">
                              🔒 解锁 (升级)
                            </button>
                          )}
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {!logLoading && logs.length > 0 && (
                <div className="flex items-center justify-between px-5 py-4 border-t border-slate-800">
                  <span className="text-sm text-slate-500">共 {logTotal} 条记录，第 {logPage}/{logTotalPages} 页</span>
                  <div className="flex gap-2">
                    <button onClick={() => setLogPage(p => Math.max(1, p - 1))} disabled={logPage === 1}
                      className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-white disabled:opacity-40 flex items-center justify-center transition-all">
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button onClick={() => setLogPage(p => Math.min(logTotalPages, p + 1))} disabled={logPage === logTotalPages}
                      className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-white disabled:opacity-40 flex items-center justify-center transition-all">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}

        {/* ─── Tab 2: 目标线索库 ──────────────────────── */}
        {activeTab === 'leads' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            {/* Toolbar */}
            <div className="mb-6 flex items-center justify-between w-full gap-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={leadSearch}
                  onChange={e => { setLeadSearch(e.target.value); setLeadPage(1) }}
                  placeholder="搜索公司名、联系人或邮箱…"
                  className="pl-11 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 w-56"
                />
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl">
                  <Diamond className="w-4 h-4 text-amber-400" />
                  <span className="text-sm text-slate-400">剩余额度</span>
                  <span className="text-sm font-bold text-amber-400">{leadQuota} 条</span>
                </div>
                <button
                  onClick={() => setShowExportModal(true)}
                  disabled={unlockedLeads.length === 0}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/50 transition-all text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Download className="w-4 h-4" />
                  导出已解锁 ({unlockedLeads.length})
                </button>
                {lockedLeads.length > 0 && (
                  <button
                    onClick={() => {
                      setSelectedIds(new Set(lockedLeads.map(l => l.id)))
                      setShowUnlockModal(true)
                    }}
                    disabled={leadQuota === 0}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/50 transition-all text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <KeyRound className="w-4 h-4" />
                    批量解锁 ({lockedLeads.length})
                  </button>
                )}
              </div>
            </div>

            {/* 批量操作工具栏 */}
            {selectedIds.size > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 flex items-center gap-4 px-5 py-3 bg-blue-600/10 border border-blue-500/20 rounded-2xl"
              >
                <span className="text-sm text-blue-400 font-medium">
                  已选择 <span className="text-blue-300 font-bold">{selectedIds.size}</span> 条线索
                </span>
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    onClick={() => {
                      setShowUnlockModal(true)
                    }}
                    disabled={unlocking || leadQuota === 0}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/50 transition-all text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {unlocking ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                    解锁 {selectedIds.size} 条
                  </button>
                  <button
                    onClick={() => setSelectedIds(new Set())}
                    className="px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700 transition-all text-sm"
                  >
                    取消选择
                  </button>
                </div>
              </motion.div>
            )}

            {/* Table */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="bg-slate-900/50 border border-slate-700 rounded-3xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700 bg-slate-800/50">
                      <th className="py-4 px-3 w-10">
                        <button
                          onClick={toggleSelectAll}
                          className="flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                        >
                          {selectedIds.size === filteredLeads.length && filteredLeads.length > 0
                            ? <CheckSquare className="w-4 h-4 text-blue-400" />
                            : <Square className="w-4 h-4" />
                          }
                        </button>
                      </th>
                      {['公司名称', '联系人', '职位', '国家', '行业', '社交/网站', '邮箱', '来源', '入库时间', '操作'].map(h => (
                        <th key={h} className="text-left py-4 px-5 text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {leadLoading ? (
                      <tr>
                        <td colSpan={11} className="py-20 text-center">
                          <RefreshCw className="w-8 h-8 text-slate-600 animate-spin mx-auto mb-3" />
                          <p className="text-slate-500 text-sm">加载中…</p>
                        </td>
                      </tr>
                    ) : filteredLeads.length === 0 && leadSearch ? (
                      <tr>
                        <td colSpan={11} className="py-20 text-center">
                          <Search className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                          <p className="text-slate-500 font-medium">未找到匹配的线索</p>
                          <p className="text-slate-600 text-sm mt-1">尝试其他关键词</p>
                        </td>
                      </tr>
                    ) : filteredLeads.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="py-20 text-center">
                          <Users className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                          <p className="text-slate-500 font-medium">暂无目标线索</p>
                          <p className="text-slate-600 text-sm mt-1">Nova 挖掘到的高价值线索将在此显示</p>
                        </td>
                      </tr>
                    ) : filteredLeads.map((lead, i) => (
                      <motion.tr key={lead.id}
                        initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                        className={`border-b border-slate-800/60 transition-colors ${
                          selectedIds.has(lead.id) ? 'bg-blue-600/5' : 'hover:bg-slate-800/30'
                        }`}>
                        <td className="py-4 px-3">
                          <button
                            onClick={() => toggleSelect(lead.id)}
                            className="flex items-center justify-center transition-colors"
                          >
                            {selectedIds.has(lead.id)
                              ? <CheckSquare className="w-4 h-4 text-blue-400" />
                              : <Square className="w-4 h-4 text-slate-600" />
                            }
                          </button>
                        </td>
                        <td className="py-4 px-5 text-sm text-white font-medium">{lead.companyName}</td>
                        <td className="py-4 px-5 text-sm text-slate-300">{lead.contactName || '—'}</td>
                        <td className="py-4 px-5 text-sm text-slate-400">{lead.jobTitle || '—'}</td>
                        <td className="py-4 px-5 text-sm text-slate-400">{lead.country || '—'}</td>
                        <td className="py-4 px-5 text-sm text-slate-400">{lead.industry || '—'}</td>
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-2">
                            {lead.website ? (
                              <a href={lead.website} target="_blank" rel="noopener noreferrer"
                                title={lead.website}
                                className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center justify-center transition-colors">
                                <span className="text-sm leading-none">🌐</span>
                              </a>
                            ) : null}
                            {lead.linkedIn ? (
                              <a href={lead.linkedIn} target="_blank" rel="noopener noreferrer"
                                title={lead.linkedIn}
                                className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center justify-center transition-colors">
                                <span className="text-sm leading-none">💼</span>
                              </a>
                            ) : null}
                            {!lead.website && !lead.linkedIn && (
                              <span className="text-slate-600 text-sm">—</span>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-5 text-sm">
                          <span className={`font-mono ${lead.isUnlocked ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {lead.email}
                          </span>
                        </td>
                        <td className="py-4 px-5 text-sm">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                            {LEAD_SOURCE_LABEL[lead.source] || lead.source}
                          </span>
                        </td>
                        <td className="py-4 px-5 text-sm text-slate-400 whitespace-nowrap">{lead.createdAt}</td>
                        <td className="py-4 px-5">
                          {lead.isUnlocked ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <Unlock className="w-3 h-3" />
                              已解锁
                            </span>
                          ) : (
                            <button
                              onClick={() => handleUnlock([lead.id])}
                              disabled={leadQuota === 0}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <Lock className="w-3 h-3" />
                              解锁（1额度）
                            </button>
                          )}
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {!leadLoading && filteredLeads.length > 0 && (
                <div className="flex items-center justify-between px-5 py-4 border-t border-slate-800">
                  <span className="text-sm text-slate-500">
                    {leadSearch
                      ? `搜索「${leadSearch}」共 ${filteredLeads.length} 条线索`
                      : `共 ${leadTotal} 条线索，第 ${leadPage}/${leadTotalPages} 页`}
                  </span>
                  <div className="flex gap-2">
                    <button onClick={() => setLeadPage(p => Math.max(1, p - 1))} disabled={leadPage === 1}
                      className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-white disabled:opacity-40 flex items-center justify-center transition-all">
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button onClick={() => setLeadPage(p => Math.min(leadTotalPages, p + 1))} disabled={leadPage === leadTotalPages}
                      className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-white disabled:opacity-40 flex items-center justify-center transition-all">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}

        {/* ─── 所有弹窗完全独立于 Tabs，放置在根层级 ──────────────────────── */}

        {/* 投递流水导出确认弹窗 */}
        <Dialog open={showLogExportModal} onOpenChange={setShowLogExportModal}>
          <DialogContent className="max-w-md p-0 overflow-hidden">
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
                  <Download className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">导出投递报告</h3>
                  <p className="text-sm text-slate-400">投递流水数据导出</p>
                </div>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-4 mb-5 border border-slate-700">
                <p className="text-slate-300 text-sm leading-relaxed">
                  本次将导出 <span className="text-blue-400 font-bold">{logs.length}</span> 条投递记录。
                </p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowLogExportModal(false)} disabled={logExporting}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-slate-700 border border-slate-600 text-slate-300 font-medium text-sm hover:bg-slate-600 transition-all disabled:opacity-50">
                  取消
                </button>
                <button onClick={handleLogConfirmExport} disabled={logExporting}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  {logExporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  确认导出
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* 解锁线索弹窗 */}
        <Dialog open={showUnlockModal} onOpenChange={setShowUnlockModal}>
          <DialogContent className="max-w-md p-0 overflow-hidden">
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
                  <KeyRound className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">解锁线索</h3>
                  <p className="text-sm text-slate-400">解锁后明文邮箱可见，永久有效</p>
                </div>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-4 mb-5 border border-slate-700">
                <p className="text-slate-300 text-sm leading-relaxed">
                  本次将解锁 <span className="text-amber-400 font-bold">{selectedIds.size}</span> 条线索。
                </p>
                <div className="mt-3 pt-3 border-t border-slate-700 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <div className="w-2 h-2 rounded-full bg-amber-400" />
                    <span>将消耗 <span className="text-amber-400 font-semibold">{selectedIds.size}</span> 条导出额度</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <div className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span>解锁后剩余 <span className="text-emerald-400 font-semibold">{leadQuota - selectedIds.size}</span> 条额度</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowUnlockModal(false)} disabled={unlocking}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-slate-700 border border-slate-600 text-slate-300 font-medium text-sm hover:bg-slate-600 transition-all disabled:opacity-50">
                  取消
                </button>
                <button onClick={() => handleUnlock(Array.from(selectedIds))} disabled={unlocking}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-semibold text-sm shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  {unlocking ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                  确认解锁
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* 导出已解锁线索弹窗 */}
        <Dialog open={showExportModal} onOpenChange={setShowExportModal}>
          <DialogContent className="max-w-md p-0 overflow-hidden">
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                  <Download className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">导出已解锁线索</h3>
                  <p className="text-sm text-slate-400">明文邮箱 Excel 导出，无需额度扣费</p>
                </div>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-4 mb-5 border border-slate-700">
                <p className="text-slate-300 text-sm leading-relaxed">
                  本次将导出 <span className="text-emerald-400 font-bold">{unlockedLeads.length}</span> 条已解锁线索。
                </p>
                <div className="mt-3 pt-3 border-t border-slate-700 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <div className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span>已解锁线索，明文邮箱直接导出</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <div className="w-2 h-2 rounded-full bg-slate-500" />
                    <span>本次导出 <span className="text-white font-semibold">不消耗</span> 导出额度</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowExportModal(false)} disabled={exporting}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-slate-700 border border-slate-600 text-slate-300 font-medium text-sm hover:bg-slate-600 transition-all disabled:opacity-50">
                  取消
                </button>
                <button onClick={handleExport} disabled={exporting}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-semibold text-sm shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  确认导出
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

 {/* 唯一的邮件预览弹窗 (纯白美式高级 SaaS 皮肤) */}
 <Dialog open={showPreviewModal} onOpenChange={(open) => {
          setShowPreviewModal(open)
          if (!open) setSelectedLogForPreview(null)
        }}>
          <DialogContent className="max-w-2xl max-h-[85vh] p-0 overflow-hidden border border-slate-200 shadow-2xl rounded-2xl sm:rounded-3xl">
            <div className="bg-white h-full flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/80">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-center">
                    <Eye className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 tracking-tight">AI 信件预览</h3>
                    <p className="text-sm text-slate-500 font-medium mt-0.5">Nova 智能生成模型</p>
                  </div>
                </div>
                <button
                  onClick={() => { setShowPreviewModal(false); setSelectedLogForPreview(null) }}
                  className="p-2.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 overflow-y-auto max-h-[calc(85vh-90px)] bg-white">
                {selectedLogForPreview && (
                  <div className="space-y-6">
                   {/* 收件人卡片 (严格脱敏保密版) */}
                   <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                      <div className="flex items-center gap-4 mb-4">
                        <div className={`w-12 h-12 rounded-full border flex items-center justify-center flex-shrink-0 ${
                          selectedLogForPreview.isUnlocked ? 'bg-slate-100 border-slate-200' : 'bg-amber-50 border-amber-200'
                        }`}>
                          {selectedLogForPreview.isUnlocked ? (
                            <span className="text-lg font-bold text-slate-600">
                              {(selectedLogForPreview.companyName || '?')[0].toUpperCase()}
                            </span>
                          ) : (
                            <Lock className="w-5 h-5 text-amber-500" />
                          )}
                        </div>
                        <div>
                          <p className={`text-base font-bold ${selectedLogForPreview.isUnlocked ? 'text-slate-900' : 'text-slate-400'}`}>
                            {selectedLogForPreview.isUnlocked ? (selectedLogForPreview.companyName || '未知公司') : '*** (解锁后可见公司名)'}
                          </p>
                          <p className="text-sm text-slate-500 mt-0.5">
                            {selectedLogForPreview.isUnlocked ? (selectedLogForPreview.contactName || '未知联系人') : '*** (解锁后可见联系人)'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200/60">
                        {selectedLogForPreview.isUnlocked ? (
                          <Mail className="w-4 h-4 text-slate-400" />
                        ) : (
                          <Lock className="w-4 h-4 text-amber-500/70" />
                        )}
                        <span className={`font-mono font-medium ${selectedLogForPreview.isUnlocked ? 'text-slate-700' : 'text-amber-600/90'}`}>
                          {selectedLogForPreview.isUnlocked ? selectedLogForPreview.recipientEmail : maskEmail(selectedLogForPreview.recipientEmail)}
                        </span>
                        <span className="text-slate-300 mx-2">|</span>
                        <span className="text-slate-500">发件域: <span className="font-medium text-slate-700">{selectedLogForPreview.fromDomain}</span></span>
                      </div>
                    </div>

                    {/* 邮件主题 */}
                    <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                        邮件主题
                      </p>
                      <p className="text-base text-slate-900 font-semibold leading-relaxed">{selectedLogForPreview.subject}</p>
                    </div>

                    {/* 邮件正文 */}
                    <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                        邮件正文
                      </p>
                      <div className="text-sm text-slate-700 whitespace-pre-wrap leading-loose font-mono bg-white p-5 rounded-xl border border-slate-200 shadow-inner min-h-[160px]">
                        {selectedLogForPreview.body || '暂无邮件正文'}
                      </div>
                    </div>

                    {/* 底部状态栏 */}
                    <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-slate-500">信件状态</span>
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${
                          selectedLogForPreview.status === 'PENDING_PAYMENT' 
                            ? 'bg-slate-100 text-slate-600 border border-slate-200' 
                            : 'bg-blue-50 text-blue-600 border border-blue-100'
                        }`}>
                          <span className={`w-2 h-2 rounded-full ${
                            selectedLogForPreview.status === 'SENT' ? 'bg-emerald-500' :
                            selectedLogForPreview.status === 'PENDING_PAYMENT' ? 'bg-slate-400' :
                            'bg-blue-500'
                          }`} />
                          {LOG_STATUS_LABEL[selectedLogForPreview.status] || selectedLogForPreview.status}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-slate-400">
                        生成于 {selectedLogForPreview.sentAt}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  )
}