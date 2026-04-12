/**
 * 全局异常捕获与保姆级引导
 * 提供统一的错误处理和用户友好的提示
 */

import { toast } from "@/components/ui/use-toast"

/**
 * 文件上传异常兜底
 */
export function handleFileUploadError(file: File, maxSizeMB = 10): boolean {
  const fileSizeMB = file.size / (1024 * 1024)
  if (fileSizeMB > maxSizeMB) {
    toast({
      title: '文件太重啦（超过 10MB）！系统嚼不烂~',
      description: `当前文件 ${fileSizeMB.toFixed(2)}MB，超出限制。推荐压缩工具：ilovepdf.com`,
      variant: 'destructive',
    })
    return false
  }
  return true
}

/**
 * API 超时异常兜底
 */
export function handleAPITimeout(error: unknown, apiName = 'API'): void {
  console.error(`${apiName} 超时:`, error)
  toast({
    title: '网络波动中...',
    description: '系统正在重试或切换备用引擎（DeepSeek → Gemini 容灾中）',
  })
}

/**
 * 无数据异常兜底
 */
export function handleNoDataFound(searchTerm: string): void {
  toast({
    title: '该维度客户较少',
    description: `搜索「${searchTerm}」暂无结果。建议放宽行业关键词或扩大地区范围后重试。`,
  })
}

/**
 * 余额不足兜底
 * 调用方应在 description 提供充值跳转按钮（在 UI 层处理）
 */
export function handleInsufficientBalance(currentBalance: number, required: number): void {
  toast({
    title: '老板，算力粮草已空，为了不耽误业务，请补充算力加油包。',
    description: `当前算力：${currentBalance} 点，本次需要：${required} 点。请前往钱包页面充值。`,
  })
}

/**
 * AI 生成失败兜底
 */
export function handleAIGenerationError(error: unknown): void {
  console.error('AI 生成失败:', error)
  toast({
    title: 'AI 暂时罢工了',
    description: '可能是网络波动或 AI 服务繁忙，系统已自动切换备用引擎，请稍后重试。',
  })
}

/**
 * 邮件发送失败兜底
 */
export function handleEmailSendError(error: unknown, recipientEmail: string): void {
  console.error('邮件发送失败:', error)
  toast({
    title: '邮件发送失败',
    description: `发送到 ${recipientEmail} 失败。可能原因：邮箱地址无效、域名被拦截或 Resend 配额已用完。`,
    variant: 'destructive',
  })
}

/**
 * 权限不足兜底
 */
export function handlePermissionDenied(requiredPlan = '专业版'): void {
  toast({
    title: '功能已锁定',
    description: `该功能需要升级到${requiredPlan}，请前往钱包页面升级套餐。`,
  })
}

/**
 * 全局错误边界处理
 */
export function handleGlobalError(error: Error, errorInfo?: unknown): void {
  console.error('全局错误:', error, errorInfo)
  toast({
    title: '哎呀，出错了',
    description: error.message || '系统遇到了一个小问题，请刷新页面重试。',
    variant: 'destructive',
  })
}

/** 通用成功提示 */
export function showSuccessToast(title: string, description?: string): void {
  toast({ title: `✅ ${title}`, description })
}

/** 通用警告提示 */
export function showWarningToast(title: string, description?: string): void {
  toast({ title: `⚠️ ${title}`, description })
}

/** 通用错误提示 */
export function showErrorToast(title: string, description?: string): void {
  toast({ title: `❌ ${title}`, description, variant: 'destructive' })
}
