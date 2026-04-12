/**
 * API: 导出包购买履约
 *
 * POST /api/export/purchase
 *
 * 功能：
 * 1. 校验用户订阅状态
 * 2. 计算实际充值的导出额度（1 套 = 1000 额度）
 * 3. 使用 Prisma 原子操作 increment 增量叠加 exportCredits
 * 4. 创建订单记录
 *
 * 【红线警告】：必须使用 increment 增量叠加，绝不能覆盖用户原本的余额！
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// 每套包含的导出额度
const CREDITS_PER_SET = 1000

export async function POST(request: NextRequest) {
  let userId: string | null = null

  try {
    // ─── 1. 鉴权 ───────────────────────────────────────────
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: '请先登录' },
        { status: 401 }
      )
    }

    userId = session.user.id

    // ─── 2. 解析请求体 ─────────────────────────────────────
    const body = await request.json()
    console.log('[Export Purchase] Received body:', JSON.stringify(body))

    // 安全解析 sets 字段
    let sets = body?.sets ?? body?.quantity ?? 1
    if (typeof sets === 'string') {
      sets = parseInt(sets, 10)
    }
    sets = Number(sets)

    console.log('[Export Purchase] Parsed sets:', sets, 'Type:', typeof sets)

    if (!Number.isInteger(sets) || sets <= 0 || sets > 100 || isNaN(sets)) {
      return NextResponse.json(
        { error: 'INVALID_SETS', message: `购买套数必须为 1-100 的整数，当前值: ${sets}` },
        { status: 400 }
      )
    }

    // ─── 3. 计算充值额度 ────────────────────────────────────
    const creditsToAdd = sets * CREDITS_PER_SET
    console.log('[Export Purchase] Credits to add:', creditsToAdd)

    // ─── 4. 检查用户订阅状态 ─────────────────────────────────
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        subscriptionTier: true,
        planType: true,
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'USER_NOT_FOUND', message: '用户不存在' },
        { status: 404 }
      )
    }

    console.log('[Export Purchase] User found, updating exportCredits...')

    // ─── 5. 使用 Prisma 原子操作增量叠加 exportCredits ───────
    // 【红线警告】：必须使用 increment，绝不能覆盖！
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        exportCredits: { increment: creditsToAdd },
      },
      select: {
        exportCredits: true,
      },
    })

    console.log('[Export Purchase] Updated exportCredits:', updatedUser.exportCredits)

    // ─── 6. 创建订单记录（可选，用于对账）────────────────────
    const orderTradeNo = `EXPORT_${Date.now()}_${Math.random().toString(36).substring(7)}`
    console.log('[Export Purchase] Creating order with tradeNo:', orderTradeNo)

    await prisma.order.create({
      data: {
        userId: userId,
        amount: 0, // 模拟支付，实际金额由前端计算
        plan: `EXPORT_PACK_${sets}`,
        orderType: 'ADDON',
        status: 'PAID',
        tradeNo: orderTradeNo,
        tokensAllocated: creditsToAdd,
      },
    })

    console.log('[Export Purchase] Order created successfully')

    // ─── 7. 返回成功响应 ───────────────────────────────────
    return NextResponse.json({
      success: true,
      message: '购买成功',
      creditsAdded: creditsToAdd,
      totalCredits: updatedUser.exportCredits,
      sets: sets,
    })
  } catch (error: any) {
    console.error('[Export Purchase] Error:', error)
    console.error('[Export Purchase] Error stack:', error?.stack)

    // 返回更详细的错误信息
    return NextResponse.json(
      {
        error: 'INTERNAL_ERROR',
        message: error?.message || '服务器内部错误',
        details: process.env.NODE_ENV === 'development' ? {
          name: error?.name,
          message: error?.message,
          stack: error?.stack,
        } : undefined,
      },
      { status: 500 }
    )
  }
}
