"use client"

import { useEffect } from "react"
import { motion } from "framer-motion"
import { AlertTriangle, RefreshCw, Home } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Dashboard Error]', error)
  }, [error])

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full text-center"
      >
        <div className="w-20 h-20 rounded-full bg-orange-500/10 border border-orange-500/30 flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="w-10 h-10 text-orange-400" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">页面加载出错</h1>
        <p className="text-slate-400 mb-2">该页面遇到了一个意外错误，请尝试刷新重试。</p>
        {process.env.NODE_ENV === 'development' && error?.message && (
          <p className="text-xs text-slate-600 font-mono bg-slate-900 rounded-lg px-3 py-2 mb-6 break-all">
            [dev] {error.message}
          </p>
        )}
        <div className="flex items-center justify-center gap-3">
          <Button
            onClick={reset}
            className="bg-blue-600 hover:bg-blue-500 text-white gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            刷新重试
          </Button>
          <Button variant="ghost" asChild className="text-slate-400 hover:text-white">
            <Link href="/dashboard" className="gap-2 flex items-center">
              <Home className="w-4 h-4" />
              返回工作台
            </Link>
          </Button>
        </div>
      </motion.div>
    </div>
  )
}
