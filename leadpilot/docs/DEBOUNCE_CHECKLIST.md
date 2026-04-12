/**
 * 全站防抖应用检查清单
 * 
 * 这个文件列出了所有需要应用防抖的关键按钮
 * 请逐一检查并更新
 */

// ============================================
// 已应用防抖的按钮 ✅
// ============================================

/**
 * 1. CampaignEstimateModal - 启动按钮
 *    文件：components/dashboard/CampaignEstimateModal.tsx
 *    状态：✅ 已应用 useDebounce
 *    API：POST /api/campaigns/start
 */

/**
 * 2. SendingLogsTable - 导出按钮
 *    文件：components/campaigns/SendingLogsTable.tsx
 *    状态：✅ 已应用 handleExport 防抖
 *    API：GET /api/campaigns/sending-logs/export
 */

/**
 * 3. DomainWarmupManager - 预热开关
 *    文件：components/domains/DomainWarmupManager.tsx
 *    状态：✅ 已应用 handleToggleWarmup 防抖
 *    API：POST /api/domains/warmup/toggle
 */

// ============================================
// 需要应用防抖的按钮 ⏳
// ============================================

/**
 * 1. /billing 页面 - 充值按钮
 *    文件：app/(dashboard)/billing/page.tsx
 *    操作：handleRecharge
 *    优先级：⭐⭐⭐ 最高
 *    建议：使用 DebounceButton 组件
 */

/**
 * 2. /billing 页面 - 升级套餐按钮
 *    文件：app/(dashboard)/billing/page.tsx
 *    操作：handleSelectPlan
 *    优先级：⭐⭐⭐ 最高
 *    建议：使用 DebounceButton 组件
 */

/**
 * 3. /billing 页面 - 使用优惠券按钮
 *    文件：app/(dashboard)/billing/page.tsx
 *    操作：handleUseCoupon
 *    优先级：⭐⭐ 高
 *    建议：使用 DebounceButton 组件
 */

/**
 * 4. /billing 页面 - 退款申请按钮
 *    文件：app/(dashboard)/billing/page.tsx
 *    操作：submitRefund
 *    优先级：⭐⭐ 高
 *    建议：使用 DebounceButton 组件
 */

/**
 * 5. /dashboard 页面 - 所有表单提交按钮
 *    文件：app/(dashboard)/dashboard/page.tsx
 *    操作：各种 handle* 函数
 *    优先级：⭐⭐ 高
 *    建议：使用 DebounceButton 组件
 */

/**
 * 6. /inbox 页面 - 回复邮件按钮
 *    文件：app/(dashboard)/inbox/page.tsx
 *    操作：handleReply
 *    优先级：⭐⭐ 高
 *    建议：使用 DebounceButton 组件
 */

// ============================================
// 防抖应用步骤
// ============================================

/**
 * 对于每个需要防抖的按钮，按以下步骤操作：
 * 
 * 1. 导入防抖工具
 *    import { DebounceButton } from '@/components/ui/DebounceButton'
 *    或
 *    import { useDebounce } from '@/lib/debounce'
 * 
 * 2. 将按钮改为 DebounceButton 组件
 *    <DebounceButton onClick={handleClick}>
 *      按钮文字
 *    </DebounceButton>
 * 
 *    或使用 useDebounce Hook：
 *    const { execute, loading } = useDebounce(handleClick)
 *    <button onClick={execute} disabled={loading}>
 *      {loading ? '处理中...' : '按钮文字'}
 *    </button>
 * 
 * 3. 测试防穿透效果
 *    - 快速连点按钮 5 次
 *    - 确认只发送了 1 个请求
 *    - 确认按钮在加载中被禁用
 * 
 * 4. 验证构建
 *    npm run build
 */

// ============================================
// 防抖验证清单
// ============================================

/**
 * 构建完成后，请逐一验证：
 * 
 * [ ] 所有关键按钮都有 disabled 属性
 * [ ] 所有关键按钮都显示 Loading 状态
 * [ ] 快速连点不会发送多个请求
 * [ ] 错误时显示 toast 而不是 alert
 * [ ] 成功时显示 toast 通知
 * [ ] 按钮在加载中显示菊花图
 * [ ] 没有控制台错误
 * [ ] 构建成功
 */
