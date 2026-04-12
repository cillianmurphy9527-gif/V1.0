'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, Zap, HeadphonesIcon } from 'lucide-react'

interface AlertMessage {
  id: string
  title: string
  content: string
  createdAt: string
}

export function GlobalRetentionAlert() {
  const [alert, setAlert] = useState<AlertMessage | null>(null)
  const [dismissing, setDismissing] = useState(false)

  useEffect(() => {
    // 延迟 2s，等页面加载稳定后再检查，避免影响首屏性能
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/user/check-retention')
        if (!res.ok) return
        const data = await res.json()
        if (data?.alert) setAlert(data.alert)
      } catch {
        // 静默失败，不影响正常使用
      }
    }, 2000)
    return () => clearTimeout(timer)
  }, [])

  const markRead = async (action: 'template' | 'support' | 'mall' | 'later') => {
    if (!alert || dismissing) return
    setDismissing(true)
    try {
      const res = await fetch('/api/user/check-retention', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId: alert.id }),
      })
      if (!res.ok) {
        setDismissing(false)
        return
      }
    } catch {
      setDismissing(false)
      return
    }

    setAlert(null)
    setDismissing(false)

    if (action === 'template') {
      window.location.href = '/dashboard'
    } else if (action === 'mall') {
      window.location.href = '/dashboard/wallet'
    } else if (action === 'later') {
      window.location.href = '/dashboard'
    } else {
      window.open('https://work.weixin.qq.com/kfid/kfc_support', '_blank')
    }
  }

  return (
    <AnimatePresence>
      {alert && (
        <>
          {/* 遮罩层：不可点击关闭 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200]"
          />

          {/* 弹窗 */}
          <div className="fixed inset-0 flex items-center justify-center z-[200] p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 24 }}
              transition={{ type: 'spring', stiffness: 280, damping: 24 }}
              className="relative w-full max-w-lg"
            >
              {/* 外层光晕 */}
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/30 via-red-500/20 to-purple-500/20 rounded-3xl blur-3xl" />

              <div className="relative bg-slate-900 border border-orange-500/40 rounded-3xl overflow-hidden shadow-2xl">
                {/* 顶部彩条 */}
                <div className="h-1 w-full bg-gradient-to-r from-orange-500 via-red-500 to-purple-500" />

                <div className="p-8">
                  {/* 图标 */}
                  <div className="flex justify-center mb-6">
                    <div className="relative">
                      <div className="absolute inset-0 bg-orange-500/30 rounded-full blur-2xl animate-pulse" />
                      <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-xl shadow-orange-500/40">
                        <AlertTriangle className="w-8 h-8 text-white" />
                      </div>
                    </div>
                  </div>

                  {/* 标题 */}
                  <h2 className="text-xl font-bold text-white text-center mb-3 leading-snug">
                    {alert.title}
                  </h2>

                  {/* 正文 */}
                  <p className="text-slate-400 text-sm text-center leading-relaxed mb-2">
                    {alert.content}
                  </p>
                  <p className="text-slate-600 text-xs text-center mb-8">
                    您订阅的套餐持续计费中，不跑通流程意味着白白浪费预算。
                  </p>

                  {/* 主操作按钮 */}
                  <div className="space-y-3">
                    <button
                      onClick={() => markRead('template')}
                      disabled={dismissing}
                      className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl font-bold text-white text-base bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 shadow-xl shadow-blue-500/30 transition-all disabled:opacity-60"
                    >
                      <Zap className="w-5 h-5" />
                      一键载入官方模板，跑通拓客流程
                    </button>

                    <button
                      onClick={() => markRead('support')}
                      disabled={dismissing}
                      className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl font-semibold text-slate-300 text-sm border border-slate-700 hover:border-slate-500 hover:bg-slate-800/60 transition-all disabled:opacity-60"
                    >
                      <HeadphonesIcon className="w-4 h-4" />
                      联系在线客服 / 专属顾问
                    </button>

                    <button
                      type="button"
                      onClick={() => markRead('mall')}
                      disabled={dismissing}
                      className="w-full py-2 text-sm text-cyan-400/90 hover:text-cyan-300 underline-offset-2 hover:underline disabled:opacity-50"
                    >
                      进入增值商城（关闭此提示）
                    </button>
                  </div>

                  {/* 免责小字 */}
                  <p className="text-slate-700 text-xs text-center mt-5">
                    此提示仅出现一次，处理后不再重复弹出
                  </p>
                  <button
                    type="button"
                    onClick={() => markRead('later')}
                    disabled={dismissing}
                    className="w-full mt-2 text-xs text-slate-500 hover:text-slate-400 disabled:opacity-50"
                  >
                    稍后再说，返回工作台
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}

