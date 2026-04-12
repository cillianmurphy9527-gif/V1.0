'use client'

import { useState } from 'react'
import { useDebounce } from '@/lib/debounce'
import { useToast } from '@/components/ui/use-toast'

/**
 * 防抖按钮组件 - 用于所有关键操作
 * 自动处理 Loading 状态和防穿透
 */
interface DebounceButtonProps {
  onClick: () => Promise<void>
  children: React.ReactNode
  disabled?: boolean
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost'
  size?: 'default' | 'sm' | 'lg'
  className?: string
  showLoadingText?: boolean
  loadingText?: string
}

export function DebounceButton({
  onClick,
  children,
  disabled = false,
  variant = 'default',
  size = 'default',
  className = '',
  showLoadingText = true,
  loadingText = '处理中...'
}: DebounceButtonProps) {
  const { execute, loading } = useDebounce(onClick)
  const { toast } = useToast()

  const handleClick = async () => {
    try {
      await execute()
    } catch (error) {
      toast({
        title: '操作失败',
        description: error instanceof Error ? error.message : '请稍后重试',
        variant: 'destructive'
      })
    }
  }

  const isDisabled = disabled || loading

  const variantClasses = {
    default: 'bg-blue-600 hover:bg-blue-500 text-white disabled:bg-blue-600/50',
    destructive: 'bg-red-600 hover:bg-red-500 text-white disabled:bg-red-600/50',
    outline: 'border border-slate-600 text-slate-300 hover:bg-slate-800 disabled:opacity-50',
    secondary: 'bg-slate-700 hover:bg-slate-600 text-white disabled:bg-slate-700/50',
    ghost: 'text-slate-300 hover:bg-slate-800 disabled:opacity-50'
  }

  const sizeClasses = {
    default: 'px-4 py-2 text-sm',
    sm: 'px-3 py-1.5 text-xs',
    lg: 'px-6 py-3 text-base'
  }

  return (
    <button
      onClick={handleClick}
      disabled={isDisabled}
      className={`
        rounded-lg font-semibold transition-all duration-200
        flex items-center justify-center gap-2
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${isDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `}
    >
      {loading && (
        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      )}
      <span>
        {loading && showLoadingText ? loadingText : children}
      </span>
    </button>
  )
}
