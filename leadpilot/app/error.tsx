'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="text-center px-6">
        <div className="mb-6">
          <div className="text-6xl font-bold text-red-500 mb-4">⚠️</div>
          <h1 className="text-3xl font-bold text-white mb-2">系统遇到意外错误</h1>
          <p className="text-slate-400 mb-4">页面加载出现问题，请尝试恢复</p>
        </div>
        <button
          onClick={() => reset()}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
        >
          尝试恢复
        </button>
      </div>
    </div>
  )
}
