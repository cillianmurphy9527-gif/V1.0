"use client"

import { motion, AnimatePresence } from "framer-motion"
import { X, Zap, Crown, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

interface UpgradeModalProps {
  isOpen: boolean
  onClose: () => void
  feature?: string
  currentTier?: string
  targetTier?: string
  price?: number
}

export function UpgradeModal({
  isOpen,
  onClose,
  feature = '此功能',
  currentTier = '体验版',
  targetTier = '专业版',
  price = 599,
}: UpgradeModalProps) {
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
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="fixed inset-0 flex items-center justify-center z-50 p-4"
          >
            <div className="relative w-full max-w-md bg-slate-900 border border-white/10 rounded-3xl p-8 shadow-2xl">
              {/* Close */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-full text-slate-500 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Icon */}
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center mx-auto mb-6 shadow-xl shadow-blue-500/30">
                <Crown className="w-8 h-8 text-white" />
              </div>

              {/* Content */}
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-white mb-2">升级解锁此功能</h2>
                <p className="text-slate-400">
                  <span className="text-blue-400 font-semibold">{feature}</span> 需要{' '}
                  <span className="text-white font-semibold">{targetTier}</span> 及以上套餐
                </p>
                <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-full">
                  <Zap className="w-4 h-4 text-blue-400" />
                  <span className="text-blue-300 text-sm font-medium">{targetTier} · ¥{price}/月</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-3">
                <Button
                  asChild
                  className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 text-white py-6 text-base font-semibold shadow-lg shadow-blue-500/30"
                >
                  <Link href="/billing" className="flex items-center justify-center gap-2">
                    <ArrowRight className="w-5 h-5" />
                    查看套餐详情
                  </Link>
                </Button>
                <Button
                  variant="ghost"
                  onClick={onClose}
                  className="w-full text-slate-400 hover:text-white"
                >
                  稍后再说
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
