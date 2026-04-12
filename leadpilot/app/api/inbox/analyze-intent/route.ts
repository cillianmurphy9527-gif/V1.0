/**
 * API: AI 意图分析（旧路由保留，内部转发至 /api/inbox/analyze）
 *
 * 套餐差异与 /api/inbox/analyze 完全一致：
 * - PRO : 意图标签 + 摘要
 * - MAX : 意图标签 + 摘要 + 商机评分 leadScore (0-100)
 */

import { NextRequest, NextResponse } from 'next/server'

// 直接复用 /api/inbox/analyze 的完整实现，避免代码重复
export { POST } from '@/app/api/inbox/analyze/route'
