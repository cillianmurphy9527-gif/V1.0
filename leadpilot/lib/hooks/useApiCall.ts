/**
 * 全局 API 调用 Hook - 统一错误处理和 Loading 态管理
 * 
 * 核心功能：
 * 1. 自动处理 loading 状态
 * 2. 统一捕获异常并显示 Toast
 * 3. 防止重复提交（防抖）
 * 4. 支持成功/失败回调
 */

import { useState } from 'react'
import { useToast } from '@/components/ui/use-toast'

interface UseApiCallOptions {
  onSuccess?: (data: any) => void
  onError?: (error: string) => void
  successMessage?: string
  errorMessage?: string
}

export function useApiCall<T = any>(options: UseApiCallOptions = {}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<T | null>(null)
  const { toast } = useToast()

  const execute = async (
    url: string,
    config?: RequestInit
  ): Promise<{ success: boolean; data?: T; error?: string }> => {
    // 防止重复提交
    if (loading) {
      return { success: false, error: '请求进行中，请勿重复提交' }
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(url, {
        ...config,
        headers: {
          'Content-Type': 'application/json',
          ...config?.headers,
        },
      })

      const responseData = await response.json()

      if (!response.ok) {
        // 处理各种 HTTP 错误状态码
        let errorMsg = responseData.error || responseData.message || '请求失败'

        // 友好化错误信息
        if (response.status === 401) {
          errorMsg = '未登录或登录已过期，请重新登录'
        } else if (response.status === 403) {
          errorMsg = responseData.error || '权限不足'
        } else if (response.status === 404) {
          errorMsg = '请求的资源不存在'
        } else if (response.status === 429) {
          errorMsg = '请求过于频繁，请稍后再试'
        } else if (response.status === 500) {
          errorMsg = options.errorMessage || '服务器开小差了，请稍后再试'
        }

        throw new Error(errorMsg)
      }

      setData(responseData)

      // 显示成功提示
      if (options.successMessage) {
        toast({
          title: options.successMessage,
          variant: 'default',
        })
      }

      // 执行成功回调
      if (options.onSuccess) {
        options.onSuccess(responseData)
      }

      return { success: true, data: responseData }

    } catch (err: any) {
      const errorMessage = err.message || options.errorMessage || '网络开小差了，请稍后再试'
      
      setError(errorMessage)

      // 显示错误 Toast
      toast({
        title: '操作失败',
        description: errorMessage,
        variant: 'destructive',
      })

      // 执行错误回调
      if (options.onError) {
        options.onError(errorMessage)
      }

      return { success: false, error: errorMessage }

    } finally {
      setLoading(false)
    }
  }

  return {
    loading,
    error,
    data,
    execute,
  }
}

/**
 * 使用示例：
 * 
 * const { loading, execute } = useApiCall({
 *   successMessage: '注册成功！',
 *   onSuccess: (data) => router.push('/dashboard')
 * })
 * 
 * const handleSubmit = async () => {
 *   await execute('/api/auth/register', {
 *     method: 'POST',
 *     body: JSON.stringify({ phone, password })
 *   })
 * }
 * 
 * <Button onClick={handleSubmit} disabled={loading}>
 *   {loading ? <Loader2 className="animate-spin" /> : '注册'}
 * </Button>
 */
