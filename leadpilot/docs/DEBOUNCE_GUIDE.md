/**
 * 全站防抖应用指南
 * 
 * 所有关键操作按钮必须使用以下方式之一来防止穿透：
 */

// ============================================
// 方式 1：使用 DebounceButton 组件（推荐）
// ============================================

import { DebounceButton } from '@/components/ui/DebounceButton'

export function ExampleComponent1() {
  const handleSubmit = async () => {
    const response = await fetch('/api/campaigns/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ /* data */ })
    })
    if (!response.ok) throw new Error('提交失败')
  }

  return (
    <DebounceButton
      onClick={handleSubmit}
      variant="default"
      size="lg"
    >
      启动 Agent
    </DebounceButton>
  )
}

// ============================================
// 方式 2：使用 useDebounce Hook
// ============================================

import { useDebounce } from '@/lib/debounce'

export function ExampleComponent2() {
  const { execute, loading } = useDebounce(async () => {
    const response = await fetch('/api/payment/checkout', {
      method: 'POST'
    })
    if (!response.ok) throw new Error('支付失败')
  })

  return (
    <button
      onClick={execute}
      disabled={loading}
      className="px-4 py-2 bg-blue-600 disabled:bg-blue-600/50 rounded-lg"
    >
      {loading ? '处理中...' : '立即支付'}
    </button>
  )
}

// ============================================
// 方式 3：使用 createSafeClickHandler
// ============================================

import { createSafeClickHandler } from '@/lib/debounce'

export function ExampleComponent3() {
  const handleSave = createSafeClickHandler(
    async () => {
      const response = await fetch('/api/settings/save', {
        method: 'POST'
      })
      if (!response.ok) throw new Error('保存失败')
    },
    (error) => {
      console.error('保存出错:', error)
    }
  )

  return (
    <button onClick={handleSave} className="px-4 py-2 bg-green-600 rounded-lg">
      保存设置
    </button>
  )
}

// ============================================
// 关键操作按钮清单
// ============================================

/**
 * 必须应用防抖的按钮：
 * 
 * 1. 启动 Agent 按钮
 *    - 位置：/dashboard 页面
 *    - 操作：POST /api/campaigns/start
 *    - 优先级：⭐⭐⭐ 最高
 * 
 * 2. 支付/充值按钮
 *    - 位置：/billing 页面
 *    - 操作：POST /api/payment/checkout
 *    - 优先级：⭐⭐⭐ 最高
 * 
 * 3. 提交表单按钮
 *    - 位置：所有表单
 *    - 操作：POST /api/*/submit
 *    - 优先级：⭐⭐ 高
 * 
 * 4. 导出数据按钮
 *    - 位置：数据表格
 *    - 操作：GET /api/*/export
 *    - 优先级：⭐⭐ 高
 * 
 * 5. 删除/确认按钮
 *    - 位置：所有确认对话框
 *    - 操作：DELETE /api/*
 *    - 优先级：⭐⭐ 高
 * 
 * 6. 保存设置按钮
 *    - 位置：设置页面
 *    - 操作：POST /api/settings/save
 *    - 优先级：⭐ 中
 */

// ============================================
// 防抖最佳实践
// ============================================

/**
 * ✅ DO:
 * 
 * 1. 所有异步操作都应该有 Loading 状态
 * 2. 按钮在 Loading 时应该被禁用
 * 3. 显示加载中的菊花图或文字
 * 4. 提供清晰的成功/失败反馈
 * 5. 使用 toast 通知而不是 alert
 * 
 * ❌ DON'T:
 * 
 * 1. 不要使用 alert() 弹窗
 * 2. 不要在 onClick 中直接调用异步函数
 * 3. 不要忘记 disabled 属性
 * 4. 不要在加载中时允许重复点击
 * 5. 不要使用 setTimeout 来模拟防抖
 */
