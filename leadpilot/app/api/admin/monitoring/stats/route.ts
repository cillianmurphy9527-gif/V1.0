import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminRole } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const auth = await requireAdminRole(['SUPER_ADMIN', 'FINANCE', 'OPS'])
    if (!auth || !auth.ok) {
      return auth?.response || NextResponse.json({ error: '权限不足' }, { status: 401 })
    }

    // 1. 抓取近 30 天的动态 API 消耗 (用于底部成本雷达)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const apiLogs = await prisma.systemCostLog.groupBy({
      by: ['provider'],
      _sum: { usageAmount: true, costCny: true },
      where: { createdAt: { gte: thirtyDaysAgo } }
    });

    // 2. 抓取您的固定基建采购 (用于右上角物理节点)
    const fixedCosts = await prisma.fixedCost.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' }
    });

    // 3. 【史诗级加强】全节点环境连通性雷达扫描
    const envStatus = {
      // AI 双核
      deepseek: !!process.env.DEEPSEEK_API_KEY,
      gemini: !!process.env.GEMINI_API_KEY,
      // 获客双源
      apollo: !!process.env.APOLLO_API_KEY,
      hunter: !!process.env.HUNTER_API_KEY,
      // 触达与防封控
      workspace: !!process.env.WORKSPACE_API_KEY,
      namecheap: !!process.env.NAMECHEAP_API_KEY,
      zerobounce: !!process.env.EMAIL_VALIDATION_API_KEY,
      resend: !!process.env.RESEND_API_KEY,
      // 支付与安全
      wechat: !!process.env.WECHAT_PAY_SECRET,
      alipay: !!process.env.ALIPAY_PRIVATE_KEY,
      aliyun_sms: !!process.env.ALIYUN_SMS_KEY,
      turnstile: !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
      // 底层基建
      database: !!process.env.DATABASE_URL,
      redis: !!process.env.REDIS_URL,
      oss: !!process.env.OSS_ACCESS_KEY,
      sentry: !!process.env.NEXT_PUBLIC_SENTRY_DSN
    }

    return NextResponse.json({ apiLogs, fixedCosts, envStatus })
    
  } catch (error: any) {
    console.error('❌ [监控API报错]:', error);
    return NextResponse.json({ error: error.message || '获取监控数据失败' }, { status: 500 })
  }
}