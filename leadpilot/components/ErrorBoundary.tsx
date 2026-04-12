"use client"

import React, { Component, ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home, Zap, FileWarning } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props { children: ReactNode; fallback?: ReactNode }
interface State { hasError: boolean; error: Error | null; errorInfo: React.ErrorInfo | null }

/**
 * 全局错误边界 - 智能分类错误，精准指引用户
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('💥 全局错误边界捕获:', error, errorInfo)
    this.setState({ error, errorInfo })
  }

  private classifyError(error: Error | null): {
    type: 'file_too_large' | 'out_of_credits' | 'network' | 'unknown'
    title: string
    description: string
    action?: { label: string; href?: string; onClick?: () => void }
  } {
    const msg = error?.message?.toLowerCase() || ''
    if (msg.includes('10mb') || msg.includes('file too large') || msg.includes('payload too large')) {
      return {
        type: 'file_too_large',
        title: '文件太重啦（超过 10MB）！系统嚼不烂~',
        description: '请将文件压缩后重新上传。推荐在线压缩工具，免费且快速。',
        action: { label: '前往压缩工具 (ilovepdf.com)', href: 'https://www.ilovepdf.com/compress_pdf' },
      }
    }
    if (msg.includes('credits') || msg.includes('quota') || msg.includes('insufficient') || msg.includes('算力')) {
      return {
        type: 'out_of_credits',
        title: '老板，算力粮草已空！',
        description: '为了不耽误您的业务，请立即补充算力加油包，恢复 AI 全速运转。',
        action: { label: '前往充值', href: '/billing#addon-section' },
      }
    }
    if (msg.includes('fetch') || msg.includes('network') || msg.includes('econnrefused')) {
      return {
        type: 'network',
        title: '网络连接中断',
        description: '请检查您的网络连接，或稍后再试。',
        action: { label: '刷新重试', onClick: () => window.location.reload() },
      }
    }
    return {
      type: 'unknown',
      title: '哎呀，出了点小问题',
      description: '系统遇到了一个意外错误，请尝试刷新页面。如果问题持续，请联系技术支持。',
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children
    if (this.props.fallback) return this.props.fallback

    const info = this.classifyError(this.state.error)
    const isCredits = info.type === 'out_of_credits'
    const isFile    = info.type === 'file_too_large'

    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-lg w-full">
          <div className="flex justify-center mb-8">
            <div className="relative">
              <div className={`absolute inset-0 rounded-full blur-2xl animate-pulse ${
                isCredits ? 'bg-amber-500/30' : isFile ? 'bg-orange-500/30' : 'bg-red-500/20'
              }`} />
              <div className={`relative w-24 h-24 rounded-full flex items-center justify-center ${
                isCredits
                  ? 'bg-gradient-to-br from-amber-500 to-orange-500'
                  : isFile
                  ? 'bg-gradient-to-br from-orange-500 to-red-500'
                  : 'bg-gradient-to-br from-red-500 to-rose-600'
              }`}>
                {isCredits ? <Zap className="w-12 h-12 text-white" />
                  : isFile ? <FileWarning className="w-12 h-12 text-white" />
                  : <AlertTriangle className="w-12 h-12 text-white" />}
              </div>
            </div>
          </div>

          <h1 className="text-2xl font-bold text-white text-center mb-3">{info.title}</h1>
          <p className="text-slate-400 text-center mb-8">{info.description}</p>

          {process.env.NODE_ENV === 'development' && (
            <div className="bg-slate-900/50 border border-slate-700 rounded-2xl p-5 mb-6">
              <p className="text-xs text-slate-500 mb-2">错误详情（仅开发模式可见）：</p>
              <p className="font-mono text-sm text-red-400 break-all">{this.state.error?.message}</p>
            </div>
          )}

          <div className="flex flex-col gap-3">
            {info.action && (
              info.action.href ? (
                <a href={info.action.href} target={info.action.href.startsWith('http') ? '_blank' : '_self'}
                  rel="noopener noreferrer"
                  className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white transition-all ${
                    isCredits
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 shadow-lg shadow-amber-500/30'
                      : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500'
                  }`}
                >
                  {isCredits && <Zap className="w-5 h-5" />}
                  {info.action.label}
                </a>
              ) : (
                <button onClick={info.action.onClick}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 transition-all"
                >
                  <RefreshCw className="w-5 h-5" />{info.action.label}
                </button>
              )
            )}
            <div className="flex gap-3">
              <Button onClick={() => window.location.reload()} variant="outline"
                className="flex-1 border-slate-700 hover:bg-slate-800 text-white py-5"
              >
                <RefreshCw className="w-4 h-4 mr-2" />刷新页面
              </Button>
              <Button onClick={() => { window.location.href = '/' }} variant="outline"
                className="flex-1 border-slate-700 hover:bg-slate-800 text-white py-5"
              >
                <Home className="w-4 h-4 mr-2" />返回首页
              </Button>
            </div>
          </div>

          <p className="text-xs text-slate-600 text-center mt-6">
            需要帮助？
            <a href="mailto:support@leadpilot.ai" className="text-blue-400 hover:text-blue-300 ml-1 underline">
              联系技术支持
            </a>
          </p>
        </div>
      </div>
    )
  }
}
