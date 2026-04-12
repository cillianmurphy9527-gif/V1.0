/**
 * React Hook: CSV 导出功能集成
 * 
 * 封装导出逻辑，处理权限拦截和错误提示
 */

import { useState } from 'react'
import { useToast } from '@/components/ui/use-toast'

interface ExportOptions {
  fileName?: string
  onSuccess?: () => void
  onError?: (error: string) => void
}

export function useExport() {
  const { toast } = useToast()
  const [exporting, setExporting] = useState(false)

  // ─── 导出 CSV ────────────────────────────────────
  const exportToCSV = async (
    data: any[],
    options: ExportOptions = {}
  ): Promise<boolean> => {
    setExporting(true)
    try {
      if (!data || data.length === 0) {
        toast({
          title: '导出失败',
          description: '没有数据可导出',
          variant: 'destructive',
        })
        return false
      }

      const response = await fetch('/api/export/csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data,
          fileName: options.fileName || 'export',
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        
        // ─── 权限拦截处理 ────────────────────────────
        if (response.status === 403) {
          toast({
            title: '功能需要升级',
            description: error.message || 'CSV 导出仅专业版及以上可用',
            variant: 'destructive',
          })
          options.onError?.(error.message)
          return false
        }

        if (response.status === 429) {
          toast({
            title: '配额已用尽',
            description: error.message || '本月 AI 算力已用尽',
            variant: 'destructive',
          })
          options.onError?.(error.message)
          return false
        }

        throw new Error(error.error || 'Export failed')
      }

      // ─── 触发浏览器下载 ────────────────────────────
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      
      // 从 Content-Disposition 头获取文件名
      const contentDisposition = response.headers.get('content-disposition')
      let fileName = options.fileName || 'export'
      
      if (contentDisposition) {
        const fileNameMatch = contentDisposition.match(/filename="(.+)"/)
        if (fileNameMatch) {
          fileName = fileNameMatch[1]
        }
      }
      
      link.setAttribute('download', fileName)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      toast({
        title: '导出成功',
        description: `已导出 ${data.length} 条数据`,
      })

      options.onSuccess?.()
      return true
    } catch (error) {
      console.error('[Export] Error:', error)
      const errorMessage = error instanceof Error ? error.message : '未知错误'
      toast({
        title: '导出失败',
        description: errorMessage,
        variant: 'destructive',
      })
      options.onError?.(errorMessage)
      return false
    } finally {
      setExporting(false)
    }
  }

  return {
    exportToCSV,
    exporting,
  }
}
