'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Global Error:', error)
  }, [error])

  return (
    <html>
      <body>
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
          <div className="text-center px-6">
            <div className="mb-6">
              <div className="text-6xl font-bold text-red-500 mb-4">⚠️</div>
              <h1 className="text-3xl font-bold text-white mb-2">系统遇到严重错误</h1>
              <p className="text-slate-400 mb-4">应用程序崩溃，请尝试恢复或刷新页面</p>
            </div>
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => reset()}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
              >
                尝试恢复
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition-colors"
              >
                返回首页
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}
