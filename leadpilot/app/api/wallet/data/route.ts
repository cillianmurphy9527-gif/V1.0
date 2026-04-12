import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const token = await getToken({
      req: request as any,
      secret: process.env.NEXTAUTH_SECRET,
    })

    if (!token?.id) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
    }

    const userId = token.id as string

    // 只查询确定存在且核心必要的数据
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        companyName: true,
        subscriptionTier: true,
        tokenBalance: true,
        trialEndsAt: true,
        createdAt: true,
        extraDomains: true,
        exportCredits: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 })
    }

    // 可选业务数据：即使某些表未落地，也不让接口崩溃
    const [walletResult, ordersResult, userAssetsResult, domainsResult] = await Promise.allSettled([
      prisma.wallet.findUnique({
        where: { userId },
        select: {
          emailCredits: true,
          leadCredits: true,
          aiTokens: true,
        },
      }),
      prisma.order.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          createdAt: true,
          plan: true,
          amount: true,
          status: true,
          orderType: true,
          tradeNo: true,
        },
      }),
      prisma.userAsset.findMany({
        where: { userId },
        select: {
          id: true,
          assetType: true,
          unlockedAt: true,
        },
      }),
      prisma.domain.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          domainName: true,
          status: true,
          createdAt: true,
        },
      }),
    ])

    const wallet = walletResult.status === 'fulfilled' && walletResult.value
      ? walletResult.value
      : {
          emailCredits: 0,
          leadCredits: 0,
          aiTokens: user.tokenBalance || 0,
        }

    const orders = ordersResult.status === 'fulfilled' ? ordersResult.value : []
    const userAssets = userAssetsResult.status === 'fulfilled' ? userAssetsResult.value : []
    const monthlyDomains = domainsResult.status === 'fulfilled' ? domainsResult.value : []

    return NextResponse.json({
      user,
      wallet,
      orders,
      userAssets,
      monthlyDomains,
    })
  } catch (error: any) {
    console.error('[Wallet_API_Error]:', error)
    return NextResponse.json(
      {
        error: '获取钱包数据失败',
        wallet: { emailCredits: 0, leadCredits: 0, aiTokens: 0 },
        orders: [],
        userAssets: [],
        monthlyDomains: [],
      },
      { status: 500 }
    )
  }
}




