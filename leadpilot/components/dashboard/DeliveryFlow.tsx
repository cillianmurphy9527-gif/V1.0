"use client"

import React, { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Eye, Lock, Unlock, Mail, Loader2, CheckCircle2, Sparkles,
  ChevronRight, X, RefreshCw, Zap, Database
} from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { UpgradeModal } from "@/components/dashboard/UpgradeModal"

// ─── 类型定义 ───────────────────────────────────────────────

type LeadStatus = 'MINED' | 'PENDING_WRITE' | 'PENDING_DELIVERY' | 'PENDING_SEND' | 'SENT'

interface Lead {
  id: string
  companyName: string
  contactName: string | null
  jobTitle: string | null
  country: string | null
  industry: string | null
  email: string
  phone: string | null
  isUnlocked: boolean
  source: string
  website: string | null
  linkedIn: string | null
  status: LeadStatus
  createdAt: string
  body?: string | null
  subject?: string
  deliveryStatus?: string  // 真实投递状态：PENDING_PAYMENT, SENT, DELIVERED...
}

interface EmailPreview {
  subject: string
  body: string
  language: string
  companyName: string
  contactName: string | null
}

interface DeliveryFlowProps {
  subscriptionTier?: string
}

// 试用版套餐列表
const TRIAL_TIERS = ['TRIAL', 'FREE', 'UNSUBSCRIBED', '未订阅', null, '']

// ─── 工具函数 ───────────────────────────────────────────────

function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return email
  const [local, domain] = email.split('@')
  if (local.length <= 1) return `${local}***@${domain}`
  return `${local[0]}***@${domain}`
}

function maskPhone(phone: string | null): string {
  if (!phone) return ''
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 7) return phone
  return `${digits.slice(0, 3)}****${digits.slice(-4)}`
}

function isTrialUser(tier: string | null | undefined): boolean {
  return TRIAL_TIERS.includes(tier?.toUpperCase() || '')
}

// 生成预览正文占位符（用于无 body 时快速展示）
function generatePlaceholderBody(lead: Lead): string {
  const name = lead.contactName || '[联系人姓名]'
  const company = lead.companyName || '[公司名称]'
  return `Dear ${name},

I hope this message finds you well. I came across ${company} and believe there may be a great opportunity for us to collaborate.

Based on what I've learned about ${company}'s recent activities, I wanted to reach out personally to explore how we might create value together.

Would you be open to a brief call this week? I believe a 15-minute conversation could help us identify immediate opportunities.

Looking forward to connecting.

Best regards,
[Your Name]`
}

// ─── 状态链路节点组件 ───────────────────────────────────────

type StatusNodeProps = {
  status: LeadStatus
  isActive: boolean
  isCompleted: boolean
  label: string
  icon: React.ReactNode
}

function StatusNode({ status, isActive, isCompleted, label, icon }: StatusNodeProps) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`relative flex items-center justify-center w-8 h-8 rounded-full transition-all duration-300 ${
          isCompleted
            ? 'bg-emerald-500/20 border-2 border-emerald-500'
            : isActive
              ? 'bg-blue-500/20 border-2 border-blue-500 animate-pulse'
              : 'bg-slate-800/50 border-2 border-slate-700'
        }`}
      >
        {isCompleted ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
        ) : (
          <span className={isActive ? 'text-blue-400' : 'text-slate-600'}>
            {icon}
          </span>
        )}
        {isActive && (
          <span className="absolute inset-0 rounded-full bg-blue-400/20 animate-ping" />
        )}
      </div>
      <span className={`text-xs font-medium whitespace-nowrap ${
        isCompleted ? 'text-emerald-400' : isActive ? 'text-blue-400' : 'text-slate-500'
      }`}>
        {label}
      </span>
    </div>
  )
}

function StatusPipeline({ status }: { status: LeadStatus }) {
  const nodes = [
    { key: 'MINED', label: '挖掘成功', icon: <Sparkles className="w-3 h-3" /> },
    { key: 'PENDING_WRITE', label: '待解锁撰写', icon: <Mail className="w-3 h-3" /> },
    { key: 'PENDING_DELIVERY', label: '待投递', icon: <Zap className="w-3 h-3" /> },
  ]

  const statusOrder = ['MINED', 'PENDING_WRITE', 'PENDING_DELIVERY']
  const currentIndex = statusOrder.indexOf(status)

  return (
    <div className="flex items-center gap-1">
      {nodes.map((node, index) => {
        const isCompleted = index < currentIndex
        const isActive = index === currentIndex
        return (
          <React.Fragment key={node.key}>
            <StatusNode
              status={node.key as LeadStatus}
              isActive={isActive}
              isCompleted={isCompleted}
              label={node.label}
              icon={node.icon}
            />
            {index < nodes.length - 1 && (
              <ChevronRight className={`w-3 h-3 mx-0.5 ${
                isCompleted ? 'text-emerald-500' : 'text-slate-700'
              }`} />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

// ─── 脱敏数据展示组件 ───────────────────────────────────────

interface MaskedDataProps {
  label: string
  value: string
  maskedValue: string
  isMasked: boolean
  icon?: React.ReactNode
}

function MaskedData({ label, value, maskedValue, isMasked, icon }: MaskedDataProps) {
  if (isMasked) {
    return (
      <div className="relative group">
        <div className="absolute inset-0 bg-slate-700/40 backdrop-blur-sm rounded-lg opacity-80 group-hover:opacity-60 transition-opacity" />
        <div className="relative flex items-center gap-2 py-1.5 px-3">
          {icon && <span className="text-slate-500">{icon}</span>}
          <span className="text-sm font-mono text-slate-400 tracking-wider">
            {maskedValue}
          </span>
          <Lock className="w-3 h-3 text-amber-500/70 ml-1" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 py-1.5 px-3">
      {icon && <span className="text-slate-400">{icon}</span>}
      <span className="text-sm text-slate-200">{value}</span>
    </div>
  )
}

// ─── SaaS 白底预览弹窗组件 ───────────────────────────────────────────

interface PreviewModalProps {
  isOpen: boolean
  onClose: () => void
  preview: EmailPreview | null
  isLoading: boolean
  lead: Lead | null
}

function PreviewModal({ isOpen, onClose, preview, isLoading, lead }: PreviewModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/20 z-50"
          />

          {/* 白底 SaaS 弹窗 */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 12 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none"
          >
            <div className="relative w-full max-w-2xl max-h-[88vh] bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden flex flex-col pointer-events-auto">

              {/* Header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm">
                    <Eye className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900">Email Preview</h3>
                    <p className="text-xs text-gray-400 mt-0.5">Personalized outreach · AI-generated</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-3" />
                    <p className="text-gray-600 font-medium text-sm">Generating personalized email...</p>
                    <p className="text-xs text-gray-400 mt-1">Based on {lead?.companyName || 'company'} public profile</p>
                  </div>
                ) : preview ? (
                  <div className="space-y-4">

                    {/* 收件人信息卡片 */}
                    <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm flex-shrink-0">
                          <span className="text-base font-bold text-white">
                            {(lead?.companyName || '?')[0].toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{lead?.companyName}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {lead?.contactName || 'Unknown Contact'}
                            {lead?.jobTitle && ` · ${lead.jobTitle}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          {lead?.country && <span>{lead.country}</span>}
                          {lead?.industry && <><span>·</span><span>{lead.industry}</span></>}
                        </div>
                      </div>
                    </div>

                    {/* 邮件主题 */}
                    <div className="bg-white rounded-xl p-4 border border-blue-100 shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                        <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">Subject</p>
                      </div>
                      <p className="text-base font-semibold text-gray-900 leading-snug">{preview.subject}</p>
                    </div>

                    {/* 邮件正文 */}
                    <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-400 flex-shrink-0" />
                        <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">Body</p>
                      </div>
                      <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed font-mono">
                        {preview.body}
                      </div>
                    </div>

                    {/* AI 标识 */}
                    <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg border border-blue-100">
                      <Sparkles className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                      <p className="text-xs text-blue-600 font-medium">
                        Personalized with company-specific context · Tailored outreach
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400 text-sm">
                    No preview data available
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-gray-100 bg-white">
                <button
                  onClick={onClose}
                  className="w-full py-2.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors text-sm font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ─── 主组件 ───────────────────────────────────────────────

export function DeliveryFlow({ subscriptionTier }: DeliveryFlowProps) {
  const { toast } = useToast()

  // ─── 真实数据状态 ───
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [previewModal, setPreviewModal] = useState(false)
  const [previewData, setPreviewData] = useState<EmailPreview | null>(null)
  const [generatingPreview, setGeneratingPreview] = useState(false)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)

  // 试用版判断
  const isTrial = isTrialUser(subscriptionTier)

  // ─── 获取真实数据 ───
  const fetchLeads = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/delivery-logs?limit=50')
      if (res.ok) {
        const data = await res.json()
        const logs: any[] = data.data || []

        const transformedLeads: Lead[] = logs.map((log) => ({
          id: log.id,
          companyName: log.companyName || 'Unknown Company',
          contactName: log.contactName,
          jobTitle: null,
          country: null,
          industry: null,
          email: log.recipientEmail,
          phone: null,
          isUnlocked: log.isUnlocked ?? false,
          source: 'NOVA',
          website: null,
          linkedIn: null,
          status: 'MINED' as LeadStatus,
          createdAt: log.sentAt || new Date().toISOString(),
          body: log.body || null,
          subject: log.subject || '',
          deliveryStatus: log.status || 'PENDING_PAYMENT',
        }))

        setLeads(transformedLeads)
      }
    } catch (error) {
      console.error('[DeliveryFlow] Fetch error:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLeads()
  }, [])

  // ─── 预览按钮点击处理 ─────────────────────────────────
  const handlePreviewClick = (lead: Lead, index: number) => {
    setSelectedLead(lead)

    if (isTrial && index !== 0) {
      setShowUpgradeModal(true)
      toast({
        title: 'Upgrade to unlock full generation',
        description: 'Trial users can preview only the first lead.',
        variant: 'default',
      })
      return
    }

    // 已有正文，直接用真实数据展示
    if (lead.body) {
      setPreviewData({
        subject: lead.subject || 'No Subject',
        body: lead.body,
        language: 'English',
        companyName: lead.companyName,
        contactName: lead.contactName,
      })
      setPreviewModal(true)
      return
    }

    // 无正文时，用占位符快速展示
    setPreviewData({
      subject: lead.subject || `Opportunity at ${lead.companyName}`,
      body: generatePlaceholderBody(lead),
      language: 'English',
      companyName: lead.companyName,
      contactName: lead.contactName,
    })
    setPreviewModal(true)
  }

  // ─── 关闭预览弹窗：同时清空 selectedLead，防止跨 Tab 泄漏 ───
  const handleClosePreview = () => {
    setPreviewModal(false)
    setSelectedLead(null)
  }

  // ─── 投递状态标签 ─────────────────────────────────
  const deliveryStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      'PENDING_PAYMENT': 'Pending',
      'PENDING_SEND': 'Queued',
      'SENT': 'Sent',
      'DELIVERED': 'Delivered',
      'OPENED': 'Opened',
      'CLICKED': 'Clicked',
      'REPLIED': 'Replied',
      'BOUNCED': 'Bounced',
      'FAILED': 'Failed',
    }
    return map[status] || status
  }

  const deliveryStatusStyle = (status: string) => {
    const map: Record<string, string> = {
      'PENDING_PAYMENT': 'bg-gray-100 text-gray-500 border-gray-200',
      'PENDING_SEND':    'bg-amber-50 text-amber-600 border-amber-200',
      'SENT':            'bg-blue-50 text-blue-600 border-blue-200',
      'DELIVERED':       'bg-blue-50 text-blue-600 border-blue-200',
      'OPENED':          'bg-cyan-50 text-cyan-600 border-cyan-200',
      'CLICKED':         'bg-purple-50 text-purple-600 border-purple-200',
      'REPLIED':         'bg-emerald-50 text-emerald-600 border-emerald-200',
      'BOUNCED':         'bg-red-50 text-red-500 border-red-200',
      'FAILED':          'bg-red-50 text-red-500 border-red-200',
    }
    return map[status] || 'bg-gray-100 text-gray-500 border-gray-200'
  }

  // ─── 渲染 ─────────────────────────────────────────────

  return (
    <>
      <div className="space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
            <span className="ml-3 text-slate-400">Loading...</span>
          </div>
        ) : leads.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <Mail className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-600 font-medium text-sm">No delivery records yet</p>
            <p className="text-gray-400 text-xs mt-1">Start a Nova campaign to see delivery flow here</p>
          </div>
        ) : (
          leads.map((lead, index) => {
            const isFirst = index === 0
            const showPreviewButton = isTrial ? isFirst : true
            const shouldMask = isTrial && !lead.isUnlocked

            return (
              <motion.div
                key={lead.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 hover:border-slate-700 transition-colors"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-blue-400">
                        {(lead.companyName || '?')[0].toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-white">{lead.companyName}</h4>
                      <p className="text-xs text-slate-500">
                        {lead.contactName || 'Unknown Contact'}
                        {lead.jobTitle && ` · ${lead.jobTitle}`}
                      </p>
                    </div>
                  </div>

                  <StatusPipeline status={lead.status} />
                </div>

                {/* 数据展示区 */}
                <div className="flex flex-wrap gap-2 mb-3">
                  <MaskedData
                    label="Email"
                    value={lead.email}
                    maskedValue={maskEmail(lead.email)}
                    isMasked={shouldMask}
                    icon={<Mail className="w-3 h-3" />}
                  />
                </div>

                {/* 操作区 */}
                <div className="flex items-center gap-3 pt-3 border-t border-slate-800/50">
                  {/* 预览按钮 */}
                  {showPreviewButton ? (
                    <button
                      onClick={() => handlePreviewClick(lead, index)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all text-sm font-medium shadow-sm"
                    >
                      <Eye className="w-4 h-4" />
                      Preview Email
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setShowUpgradeModal(true)
                        toast({
                          title: 'Upgrade to unlock full generation',
                          description: 'Trial users can preview only the first lead.',
                        })
                      }}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800/50 border border-slate-700/50 text-slate-500 hover:border-amber-500/30 hover:text-amber-400 transition-all text-sm font-medium cursor-pointer"
                    >
                      <Lock className="w-4 h-4" />
                      Preview Email
                    </button>
                  )}

                  {/* 投递状态标签 */}
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${deliveryStatusStyle(lead.deliveryStatus || 'PENDING_PAYMENT')}`}>
                    {deliveryStatusLabel(lead.deliveryStatus || 'PENDING_PAYMENT')}
                  </span>

                  {/* 公司信息 */}
                  <div className="flex items-center gap-2 text-xs text-slate-500 ml-auto">
                    <span>{lead.country || '—'}</span>
                    <span>·</span>
                    <span>{lead.industry || '—'}</span>
                  </div>

                  {/* 解锁状态 */}
                  {lead.isUnlocked ? (
                    <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                      <Unlock className="w-3 h-3 text-emerald-400" />
                      <span className="text-xs text-emerald-400 font-medium">Unlocked</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">
                      <Lock className="w-3 h-3 text-amber-400" />
                      <span className="text-xs text-amber-400 font-medium">Locked</span>
                    </div>
                  )}
                </div>
              </motion.div>
            )
          })
        )}

        {/* 刷新按钮 */}
        {leads.length > 0 && (
          <button
            onClick={fetchLeads}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-700/50 text-slate-500 hover:text-slate-300 hover:border-slate-600 transition-all text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        )}
      </div>

      {/* 预览弹窗 — 状态完全封装在 DeliveryFlow 内部，关闭时清空 selectedLead */}
      <PreviewModal
        isOpen={previewModal}
        onClose={handleClosePreview}
        preview={previewData}
        isLoading={generatingPreview}
        lead={selectedLead}
      />

      {/* 升级弹窗 */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        feature="Full AI Generation"
        currentTier={subscriptionTier || 'Trial'}
        targetTier="Pro"
        price={599}
      />
    </>
  )
}

export type { Lead, LeadStatus, EmailPreview }
