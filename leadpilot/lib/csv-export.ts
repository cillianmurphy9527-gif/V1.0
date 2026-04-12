/**
 * CSV 导出工具函数 - 前端 Blob 下载逻辑
 * 完整的错误处理和用户反馈
 */

'use client'

/**
 * 下载 CSV 文件
 * @param url - API 端点 URL
 * @param filename - 文件名
 * @param onSuccess - 成功回调
 * @param onError - 错误回调
 */
export async function downloadCSV(
  url: string,
  filename: string,
  onSuccess?: () => void,
  onError?: (error: string) => void
) {
  let blobUrl: string | null = null

  try {
    // 1. 获取响应
    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    // 2. 获取 Blob
    const blob = await response.blob()

    // 3. 检查 Blob 是否为空
    if (blob.size === 0) {
      throw new Error('导出文件为空')
    }

    // 4. 创建 Object URL
    blobUrl = URL.createObjectURL(blob)

    // 5. 创建临时 <a> 标签
    const link = document.createElement('a')
    link.href = blobUrl
    link.download = filename
    link.style.display = 'none'

    // 6. 添加到 DOM 并触发下载
    document.body.appendChild(link)
    link.click()

    // 7. 清理 DOM
    document.body.removeChild(link)

    // 8. 延迟清理 URL（确保下载完成）
    setTimeout(() => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl)
      }
    }, 100)

    // 9. 调用成功回调
    onSuccess?.()
  } catch (error) {
    console.error('CSV download error:', error)

    // 清理 URL
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl)
    }

    // 调用错误回调
    const errorMessage = error instanceof Error ? error.message : '下载失败，请稍后重试'
    onError?.(errorMessage)
  }
}

/**
 * React Hook - CSV 导出
 */
export function useCSVExport() {
  // 动态导入 useToast 以避免服务端问题
  const useToastHook = require('@/components/ui/use-toast').useToast

  const exportCSV = async (
    url: string,
    filename: string = 'export.csv'
  ) => {
    const { toast } = useToastHook()

    await downloadCSV(
      url,
      filename,
      () => {
        toast({
          title: '✅ 导出成功',
          description: `文件 ${filename} 已下载`
        })
      },
      (error) => {
        toast({
          title: '❌ 导出失败',
          description: error,
          variant: 'destructive'
        })
      }
    )
  }

  return { exportCSV }
}
