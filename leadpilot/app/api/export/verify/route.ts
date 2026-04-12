/**
 * API: 导出校验 - 三道锁计费（铁面账房）
 *
 * 接收前端传来的数据量 count（number），返回校验结果
 *
 * 三道锁逻辑：
 * 1. FREE（免费版/试运营）- 直接拦截，HTTP 403
 * 2. FLAGSHIP（旗舰版）- 优先抵扣月度免税池（3000条），超额再用 exportCredits
 * 3. GROWTH（增长版）- 纯按量计费，直接扣 exportCredits
 *
 * 必须且只能在 Prisma 扣费成功后，才返回 HTTP 200！
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// 旗舰版免费额度常量
const FREE_LIMIT = 3000

export async function POST(request: NextRequest) {
  try {
    // ─── 1. 鉴权 ───────────────────────────────────────────
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: '请先登录' },
        { status: 401 }
      )
    }

    const userId = session.user.id

    // ─── 2. 解析请求体 ─────────────────────────────────────
    const body = await request.json()
    const count: number = body?.count

    if (!Number.isInteger(count) || count <= 0) {
      return NextResponse.json(
        { error: 'INVALID_COUNT', message: '导出数量必须为正整数' },
        { status: 400 }
      )
    }

    // ─── 3. 查询用户信息 ────────────────────────────────────
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        planType: true,
        exportCredits: true,
        usedFreeExports: true,
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'USER_NOT_FOUND', message: '用户不存在' },
        { status: 404 }
      )
    }

    const { planType, exportCredits = 0, usedFreeExports = 0 } = user

    // ─── 第一道锁：免费版/试运营 ──────────────────────────────
    if (planType === 'FREE') {
      return NextResponse.json(
        {
          error: 'UPGRADE_REQUIRED',
          message: '导出投递报告为高阶企业版专属权益。请升级至【增长版】或以上套餐。',
        },
        { status: 403 }
      )
    }

    // ─── 第三道锁：旗舰版（优先抵扣月度免税池）─────────────────
    if (planType === 'FLAGSHIP') {
      const remainingFree = FREE_LIMIT - usedFreeExports

      // 情况 A：免费额度足够
      if (count <= remainingFree) {
        await prisma.user.update({
          where: { id: userId },
          data: {
            usedFreeExports: { increment: count },
          },
        })

        return NextResponse.json(
          {
            success: true,
            message: '导出校验通过',
            usedFreeQuota: count,
            remainingFreeQuota: remainingFree - count,
            chargedCredits: 0,
          },
          { status: 200 }
        )
      }

      // 情况 B：需要额外扣除 exportCredits
      const needCredits = count - remainingFree

      if (exportCredits >= needCredits) {
        await prisma.user.update({
          where: { id: userId },
          data: {
            usedFreeExports: FREE_LIMIT,
            exportCredits: { decrement: needCredits },
          },
        })

        return NextResponse.json(
          {
            success: true,
            message: '导出校验通过',
            usedFreeQuota: remainingFree,
            chargedCredits: needCredits,
            remainingCredits: exportCredits - needCredits,
          },
          { status: 200 }
        )
      }

      // 情况 C：exportCredits 不足
      return NextResponse.json(
        {
          error: 'INSUFFICIENT_CREDITS',
          message: '尊敬的旗舰版用户，您的免税额度和导出余额均不足，请前往商城补充。',
        },
        { status: 403 }
      )
    }

    // ─── 第二道锁：增长版（纯按量计费）─────────────────────────
    if (planType === 'GROWTH') {
      if (exportCredits >= count) {
        await prisma.user.update({
          where: { id: userId },
          data: {
            exportCredits: { decrement: count },
          },
        })

        return NextResponse.json(
          {
            success: true,
            message: '导出校验通过',
            chargedCredits: count,
            remainingCredits: exportCredits - count,
          },
          { status: 200 }
        )
      }

      // exportCredits 不足
      return NextResponse.json(
        {
          error: 'INSUFFICIENT_CREDITS',
          message: '您的导出额度不足，请前往商城补充。',
        },
        { status: 403 }
      )
    }

    // ─── 兜底：未知套餐类型 ──────────────────────────────────
    return NextResponse.json(
      {
        error: 'UNKNOWN_PLAN_TYPE',
        message: '您的账户套餐类型异常，请联系客服。',
      },
      { status: 403 }
    )
  } catch (error) {
    console.error('[Export Verify] Error:', error)
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: '服务器内部错误' },
      { status: 500 }
    )
  }
}
