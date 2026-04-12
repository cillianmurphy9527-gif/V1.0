/**
 * 🛠️ 临时调试接口 — 一键生成退款假数据
 *
 * 仅用于本地开发测试，生产环境请勿暴露此接口。
 * 使用方式：GET /api/admin/debug/seed-refund
 *
 * 退款状态说明（存储在 Order.refundStatus 字段）：
 *   NONE       - 无退款申请（默认）
 *   REQUESTED  - 用户已提交退款申请（待管理员审批）
 *   APPROVED   - 管理员已批准退款
 *   REJECTED   - 管理员已拒绝退款
 *   COMPLETED  - 退款已完成
 *
 * 本接口创建 refundStatus = 'REQUESTED' 的订单，模拟「待审批」状态。
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  // 安全防护：仅允许本地开发环境调用
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: '该调试接口在生产环境中已禁用' },
      { status: 403 }
    )
  }

  try {
    // ── 1. 查找或创建测试用户 ──────────────────────────────────────
    let testUser = await prisma.user.findUnique({
      where: { email: 'test_refund@example.com' },
    })

    if (!testUser) {
      testUser = await prisma.user.create({
        data: {
          email: 'test_refund@example.com',
          phone: `1380013${String(Date.now()).slice(-4)}`, // 避免手机号重复
          companyName: '测试退款公司（Debug）',
          subscriptionTier: 'STARTER',
          features: JSON.stringify({ canUseInbox: false, aiScoring: false }),
          role: 'USER',
          tokenBalance: 0,
          credits: 0,
        },
      })
      console.log('[Debug/SeedRefund] ✅ 测试用户已创建:', testUser.id)
    } else {
      console.log('[Debug/SeedRefund] ℹ️ 测试用户已存在，复用:', testUser.id)
    }

    // ── 2. 创建一笔已付款订单，并设置退款状态为 REQUESTED ──────────
    const amounts = [99, 199, 299, 799]
    const amount = amounts[Math.floor(Math.random() * amounts.length)]
    const tradeNo = `DEBUG_REFUND_${Date.now()}`

    const order = await prisma.order.create({
      data: {
        userId: testUser.id,
        tradeNo,
        amount,
        plan: amount >= 799 ? 'PRO' : 'STARTER',
        orderType: 'SUBSCRIPTION',
        status: 'PAID',                 // 订单已付款
        refundStatus: 'REQUESTED',      // 退款申请待审批
        receiptSent: false,
        tokensAllocated: amount * 100,
        searchesAllocated: 100,
        ragFilesAllocated: 3,
      },
    })

    console.log(
      `[Debug/SeedRefund] ✅ 退款测试订单已创建:\n` +
      `  订单ID: ${order.id}\n` +
      `  流水号: ${tradeNo}\n` +
      `  金额: ¥${amount}\n` +
      `  退款状态: REQUESTED（待管理员审批）`
    )

    // ── 3. 返回生成结果 ────────────────────────────────────────────
    return NextResponse.json({
      success: true,
      message: '假退款订单已生成，请前往 Admin → 退款管理 查看',
      data: {
        user: {
          id: testUser.id,
          email: testUser.email,
          companyName: testUser.companyName,
        },
        order: {
          id: order.id,
          tradeNo: order.tradeNo,
          amount: order.amount,
          plan: order.plan,
          status: order.status,
          refundStatus: order.refundStatus,
          createdAt: order.createdAt,
        },
        hint: '在 Admin 退款管理页面，可对此订单执行「批准」或「拒绝」操作',
      },
    })
  } catch (error: any) {
    console.error('[Debug/SeedRefund] ❌ 创建失败:', error)
    return NextResponse.json(
      { success: false, error: error?.message || '创建假数据失败' },
      { status: 500 }
    )
  }
}
