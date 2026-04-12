'use client'

import { useState } from 'react'
import { Download, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { downloadCSV } from '@/lib/csv-export'

/**
 * CSV 导出按钮组件
 * 完整的错误处理和 Blob 下载逻辑
 */
interface CSVExportButtonProps {
  url: string
  filename?: string
  label?: string
  variant?: 'default' | 'outline' | 'destructive'
  size?: 'default' | 'sm' | 'lg'
  className?: string
}

export function CSVExportButton({
  url,
  filename = 'export.csv',
  label = '导出 CSV',
  variant = 'default',
  size = 'default',
  className = ''
}: CSVExportButtonProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  const handleExport = async () => {
    setLoading(true)

    try {
      await downloadCSV(
        url,
        filename,
        () => {
          toast({
            title: '✅ 导出成功',
            description: `文件已下载：${filename}`
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
    } catch (error) {
      toast({
        title: '❌ 导出失败',
        description: error instanceof Error ? error.message : '请稍后重试',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      onClick={handleExport}
      disabled={loading}
      variant={variant}
      size={size}
      className={className}
    >
      {loading ? (
        <>
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
          导出中...
        </>
      ) : (
        <>
          <Download className="w-4 h-4 mr-2" />
          {label}
        </>
      )}
    </Button>
  )
}
