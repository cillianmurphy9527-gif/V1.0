"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { 
  Megaphone,
  Send,
  Clock,
  Users,
  CheckCircle2,
  AlertCircle,
  Loader2
} from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

interface BroadcastMessage {
  id: string
  title: string
  content: string
  targetPlan?: string | null
  sentCount: number
  status: 'DRAFT' | 'SENT' | 'SCHEDULED'
  createdAt: string
  scheduledAt?: string | null
}

export default function BroadcastPage() {
  const { toast } = useToast()
  const [messages, setMessages] = useState<BroadcastMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showForm, setShowForm] = useState(false)
  
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    targetPlan: "ALL",
    scheduleTime: ""
  })

  useEffect(() => {
    fetchMessages()
  }, [])

  const fetchMessages = async () => {
    try {
      setLoading(true)
      // 使用 NextAuth Session 鉴权（浏览器自动携带 cookies，无需自定义 header）
      const res = await fetch("/api/admin/broadcast")
      if (res.ok) {
        const data = await res.json()
        setMessages(data.messages || [])
      } else {
        const err = await res.json().catch(() => ({}))
        console.error("[广播页面] 获取失败:", res.status, err)
        toast({
          title: "加载失败",
          description: err?.error || `HTTP ${res.status}`,
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error("Failed to fetch messages:", error)
      toast({
        title: "加载失败",
        description: "无法加载广播消息",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.title?.trim() || !formData.content?.trim()) {
      toast({
        title: "验证失败",
        description: "标题和内容不能为空",
        variant: "destructive"
      })
      return
    }

    try {
      setSubmitting(true)
      // 使用 NextAuth Session 鉴权（浏览器自动携带 cookies）
      const res = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title,
          content: formData.content,
          targetPlan: formData.targetPlan === "ALL" ? null : formData.targetPlan,
          scheduledAt: formData.scheduleTime ? new Date(formData.scheduleTime).toISOString() : null
        })
      })

      const data = await res.json().catch(() => ({}))

      if (res.ok) {
        toast({
          title: "✅ 广播已发送",
          description: `已推送给 ${data?.sentCount ?? 0} 位用户`
        })
        setFormData({ title: "", content: "", targetPlan: "ALL", scheduleTime: "" })
        setShowForm(false)
        fetchMessages()
      } else {
        toast({
          title: "发送失败",
          description: data?.error || `HTTP ${res.status}`,
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error("Failed to send broadcast:", error)
      toast({
        title: "发送失败",
        description: "网络错误，请稍后重试",
        variant: "destructive"
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 p-8">
      <div className="max-w-4xl mx-auto">
        {/* 页头 */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">站内广播</h1>
            <p className="text-slate-400">向全站用户发送系统通知</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-semibold rounded-lg transition-all shadow-lg shadow-amber-500/30"
          >
            <Megaphone className="w-5 h-5" />
            新建广播
          </button>
        </div>

        {/* 发送表单 */}
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 mb-8"
          >
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* 标题 */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  通知标题
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="输入通知标题"
                  disabled={submitting}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50"
                  required
                />
              </div>

              {/* 内容 */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  通知内容
                </label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="输入通知内容（支持 Markdown）"
                  disabled={submitting}
                  rows={5}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50 resize-none"
                  required
                />
              </div>

              {/* 目标用户 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    目标用户
                  </label>
                  <select
                    value={formData.targetPlan}
                    onChange={(e) => setFormData({ ...formData, targetPlan: e.target.value })}
                    disabled={submitting}
                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50"
                  >
                    <option value="ALL">全部用户</option>
                    <option value="STARTER">入门版用户</option>
                    <option value="PRO">专业版用户</option>
                    <option value="MAX">旗舰版用户</option>
                  </select>
                </div>

                {/* 定时发送 */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    定时发送（可选）
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.scheduleTime}
                    onChange={(e) => setFormData({ ...formData, scheduleTime: e.target.value })}
                    disabled={submitting}
                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50"
                  />
                </div>
              </div>

              {/* 按钮 */}
              <div className="flex items-center gap-3 pt-4">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 disabled:from-slate-600 disabled:to-slate-500 text-white font-semibold rounded-lg transition-all shadow-lg shadow-amber-500/30 disabled:shadow-none"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>发送中...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>发送广播</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  disabled={submitting}
                  className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
                  取消
                </button>
              </div>
            </form>
          </motion.div>
        )}

        {/* 历史消息 */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-white mb-4">广播历史</h2>
          {!messages || messages.length === 0 ? (
            <div className="text-center py-12">
              <Megaphone className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">暂无广播消息</p>
            </div>
          ) : (
            messages.map((msg) => (
              <motion.div
                key={msg?.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 hover:border-slate-600 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-bold text-white">{msg?.title || '无标题'}</h3>
                    <p className="text-slate-400 text-sm mt-1">
                      {typeof msg?.content === 'string' ? msg.content.substring(0, 100) : ''}...
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {msg?.status === 'SENT' && (
                      <span className="flex items-center gap-1 px-3 py-1 bg-emerald-500/20 border border-emerald-500/30 rounded-full text-xs text-emerald-400">
                        <CheckCircle2 className="w-3 h-3" />
                        已发送
                      </span>
                    )}
                    {msg?.status === 'SCHEDULED' && (
                      <span className="flex items-center gap-1 px-3 py-1 bg-blue-500/20 border border-blue-500/30 rounded-full text-xs text-blue-400">
                        <Clock className="w-3 h-3" />
                        定时中
                      </span>
                    )}
                    {msg?.status === 'DRAFT' && (
                      <span className="flex items-center gap-1 px-3 py-1 bg-slate-500/20 border border-slate-500/30 rounded-full text-xs text-slate-400">
                        草稿
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm text-slate-400">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      {msg?.targetPlan ? `${msg.targetPlan} 用户` : '全部用户'}
                    </span>
                    <span>{msg?.sentCount ?? 0} 人已接收</span>
                  </div>
                  <span>
                    {msg?.createdAt ? new Date(msg.createdAt).toLocaleString('zh-CN') : '—'}
                  </span>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
