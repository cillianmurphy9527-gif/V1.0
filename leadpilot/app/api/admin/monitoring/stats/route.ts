import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminRole } from '@/lib/admin-auth'
import { ApiBalanceService } from '@/lib/services/ApiBalanceService'

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. 🛡️ 鉴权 (超级管理员、财务、运维专用)
    const auth = await requireAdminRole(['SUPER_ADMIN', 'FINANCE', 'OPS'])
    if (!auth || !auth.ok) {
      return auth?.response || NextResponse.json({ error: '权限不足' }, { status: 401 })
    }

    // 2. 🛰️ 动态探针：实时抓取 Apollo / Hunter / ZeroBounce / DeepSeek 等余额
    const apiBalances = await ApiBalanceService.getAllBalances();

    // 3. 📊 成本雷达：抓取近 30 天消耗统计
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const apiLogs = await prisma.systemCostLog.groupBy({
      by: ['provider'],
      _sum: { usageAmount: true, costCny: true },
      where: { createdAt: { gte: thirtyDaysAgo } }
    });

    // 4. 🏢 物理资产：固定采购清单
    const fixedCosts = await prisma.fixedCost.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' }
    });

    // 5. 🔍 全量布线检查 (已根据老板审查建议：全量补回)
    const envStatus = {
      // AI 核心
      deepseek: !!process.env.DEEPSEEK_API_KEY,
      gemini: !!process.env.GEMINI_API_KEY,
      openai: !!process.env.OPENAI_API_KEY,
      // 获客与清洗
      apollo: !!process.env.APOLLO_API_KEY,
      hunter: !!process.env.HUNTER_API_KEY,
      zerobounce: !!process.env.ZEROBOUNCE_API_KEY,
      // 投递与域名
      resend: !!process.env.RESEND_API_KEY,
      namecheap: !!process.env.NAMECHEAP_API_KEY,
      smartlead: !!process.env.SMARTLEAD_API_KEY,
      // 阿里云与基建 (🌟 补回)
      oss: !!process.env.OSS_ACCESS_KEY,
      aliyun_sms: !!process.env.ALIYUN_SMS_KEY,
      database: !!process.env.DATABASE_URL,
      redis: !!process.env.REDIS_URL,
      // 安全与监控 (🌟 补回)
      turnstile: !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
      sentry: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
      // 支付网关
      wechat: !!process.env.WECHAT_PAY_SECRET,
      alipay: !!process.env.ALIPAY_PRIVATE_KEY
    }

    return NextResponse.json({ 
      apiBalances, 
      apiLogs, 
      fixedCosts, 
      envStatus 
    })
    
  } catch (error: any) {
    console.error('❌ [监控API报错]:', error);
    return NextResponse.json({ error: error.message || '获取监控数据失败' }, { status: 500 })
  }
}