/**
 * 全站防抖工具函数
 * 防止用户连点导致的重复请求和系统崩溃
 */

import { useCallback, useRef, useState } from 'react'

/**
 * useDebounce Hook - 防抖按钮
 * 用于所有关键操作按钮（提交、支付、保存等）
 */
export function useDebounce(callback: () => Promise<void>, delay: number = 300) {
  const [loading, setLoading] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const execute = useCallback(async () => {
    // 如果已经在加载中，直接返回
    if (loading) return

    setLoading(true)

    try {
      await callback()
    } catch (error) {
      console.error('Debounced callback error:', error)
    } finally {
      setLoading(false)
    }
  }, [callback, loading])

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    setLoading(false)
  }, [])

  return { execute, loading, cancel }
}

/**
 * 防穿透函数 - 用于 onClick 处理
 * 确保按钮在加载期间被禁用
 */
export function createSafeClickHandler(
  callback: () => Promise<void>,
  onError?: (error: Error) => void
) {
  let isExecuting = false

  return async () => {
    // 防穿透：如果已经在执行，直接返回
    if (isExecuting) return

    isExecuting = true

    try {
      await callback()
    } catch (error) {
      console.error('Safe click handler error:', error)
      if (onError && error instanceof Error) {
        onError(error)
      }
    } finally {
      isExecuting = false
    }
  }
}

/**
 * 防抖装饰器 - 用于异步函数
 */
export function debounce<T extends (...args: any[]) => Promise<any>>(
  func: T,
  delay: number = 300
): T {
  let timeoutId: NodeJS.Timeout | null = null
  let isExecuting = false

  return (async (...args: any[]) => {
    if (isExecuting) return

    isExecuting = true

    if (timeoutId) {
      clearTimeout(timeoutId)
    }

    try {
      return await func(...args)
    } finally {
      isExecuting = false
    }
  }) as T
}
