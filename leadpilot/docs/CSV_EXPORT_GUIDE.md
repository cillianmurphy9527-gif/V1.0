/**
 * CSV 导出链路修复 - 完整指南
 * 
 * 修复内容：
 * 1. 后端容错处理 - 即使数据为空也返回 200 OK
 * 2. 前端 Blob 下载 - 使用 URL.createObjectURL 而不是 window.location
 * 3. 错误处理 - 使用 toast 而不是 alert
 */

// ============================================
// 后端 API 容错处理
// ============================================

/**
 * ✅ 正确的做法：
 * 
 * 1. 即使数据为空，也返回 200 OK
 * 2. 返回包含表头的 CSV 文件
 * 3. 设置正确的 Content-Type 和 Content-Disposition
 * 4. 即使出错，也返回表头而不是 500 错误
 * 
 * 文件：app/api/export/sending-logs/route.ts
 */

// ============================================
// 前端 Blob 下载逻辑
// ============================================

/**
 * ✅ 正确的做法：
 * 
 * 1. 使用 await response.blob() 获取二进制数据
 * 2. 使用 URL.createObjectURL(blob) 创建 URL
 * 3. 创建临时 <a> 标签并设置 href 和 download
 * 4. 添加到 DOM、点击、移除
 * 5. 延迟清理 URL.revokeObjectURL()
 * 
 * 文件：lib/csv-export.ts
 */

// ============================================
// 使用方式
// ============================================

/**
 * 方式 1：使用 CSVExportButton 组件（推荐）
 */
import { CSVExportButton } from '@/components/ui/CSVExportButton'

export function Example1() {
  return (
    <CSVExportButton
      url="/api/export/sending-logs"
      filename="sending-logs.csv"
      label="导出发信日志"
    />
  )
}

/**
 * 方式 2：使用 useCSVExport Hook
 */
import { useCSVExport } from '@/lib/csv-export'

export function Example2() {
  const { exportCSV } = useCSVExport()

  return (
    <button onClick={() => exportCSV('/api/export/sending-logs', 'logs.csv')}>
      导出
    </button>
  )
}

/**
 * 方式 3：直接使用 downloadCSV 函数
 */
import { downloadCSV } from '@/lib/csv-export'

export function Example3() {
  const handleExport = async () => {
    await downloadCSV(
      '/api/export/sending-logs',
      'logs.csv',
      () => console.log('成功'),
      (error) => console.error('失败:', error)
    )
  }

  return <button onClick={handleExport}>导出</button>
}

// ============================================
// 错误处理
// ============================================

/**
 * ❌ 错误的做法：
 * 
 * 1. 使用 alert() 弹窗
 * 2. 数据为空时返回 500 错误
 * 3. 使用 window.location.href 下载
 * 4. 不清理 Object URL
 * 5. 不处理网络错误
 */

/**
 * ✅ 正确的做法：
 * 
 * 1. 使用 toast 通知
 * 2. 数据为空时返回 200 OK + 表头
 * 3. 使用 URL.createObjectURL + <a> 标签
 * 4. 延迟清理 URL.revokeObjectURL()
 * 5. 完整的 try-catch 错误处理
 */

// ============================================
// 后端 API 检查清单
// ============================================

/**
 * [ ] 返回正确的 Content-Type: text/csv; charset=utf-8
 * [ ] 返回正确的 Content-Disposition: attachment; filename="..."
 * [ ] 即使数据为空，也返回 200 OK
 * [ ] 返回包含表头的 CSV
 * [ ] 处理所有可能的错误
 * [ ] 不返回 500 错误（除非服务器真的崩溃了）
 * [ ] 设置 Cache-Control: no-cache
 */

// ============================================
// 前端下载检查清单
// ============================================

/**
 * [ ] 使用 await response.blob()
 * [ ] 检查 response.ok
 * [ ] 检查 blob.size > 0
 * [ ] 使用 URL.createObjectURL(blob)
 * [ ] 创建临时 <a> 标签
 * [ ] 设置 download 属性
 * [ ] 添加到 DOM 并点击
 * [ ] 移除 <a> 标签
 * [ ] 延迟清理 URL
 * [ ] 使用 toast 而不是 alert
 * [ ] 显示 Loading 状态
 * [ ] 处理所有错误
 */

// ============================================
// 常见问题
// ============================================

/**
 * Q: 为什么不能使用 window.location.href?
 * A: 因为 window.location.href 会导航到新页面，
 *    而且不能处理 Blob 数据。应该使用 <a> 标签。
 * 
 * Q: 为什么要延迟清理 URL?
 * A: 因为浏览器需要时间来完成下载。
 *    立即清理会导致下载失败。
 * 
 * Q: 为什么要检查 blob.size?
 * A: 因为空的 Blob 可能表示数据获取失败。
 *    应该提示用户。
 * 
 * Q: 为什么要设置 Cache-Control?
 * A: 因为导出的文件是动态生成的，
 *    不应该被浏览器缓存。
 * 
 * Q: 为什么数据为空时还要返回表头?
 * A: 因为这样用户可以看到数据结构，
 *    而且不会导致前端崩溃。
 */
