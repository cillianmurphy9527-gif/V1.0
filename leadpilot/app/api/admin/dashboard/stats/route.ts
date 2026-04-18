import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminRole } from '@/lib/admin-auth';

/**
 * GET /api/admin/dashboard/stats
 * Admin 全局数据大盘：严格读取真实数据库，绝不使用 Mock 数据
 */
export async function GET() {
  try {
    // 1. 🛡️ 鉴权
    const auth = await requireAdminRole(['SUPER_ADMIN', 'FINANCE', 'OPS']);
    if (!auth.ok) return auth.response;

    // ====================================================================
    // 💰 第一部分：计算真实入账 (只统计状态为 PAID 且未全额退款的订单)
    // ====================================================================
    const paidOrders = await prisma.order.findMany({
      where: { 
        status: 'PAID',
        refundStatus: { not: 'COMPLETED' } // 排除已退款的
      }
    });
    const totalRevenue = paidOrders.reduce((sum, order) => sum + order.amount, 0);

    // ====================================================================
    // 🩸 第二部分：严格计算“发生过”的真实硬成本
    // ====================================================================
    
    // A. 算力消耗成本
    // 逻辑：只抓取流水表里 amount < 0 的记录，并且排除掉管理员手动清空、封禁和退款扣除的算力
    const tokenTxs = await prisma.tokenTransaction.findMany({
      where: { 
        amount: { lt: 0 },
        reason: { notIn: ['ADMIN_BAN_CONFISCATE', 'REFUND'] } 
      }
    });
    const tokensConsumed = tokenTxs.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
    
    // 【成本定价器】：假设每 1,000,000 Token 调用 DeepSeek 等接口的成本是 2.0 元 (您可自行调整)
    const tokenCost = (tokensConsumed / 1000000) * 2.0;

    // B. 域名基建成本
    // 逻辑：不管送了多少域名额度，只看数据库里真正由系统向海外注册局买下的域名数
    const domainCount = await prisma.domain.count();
    
    // 【成本定价器】：假设每个发信域名的硬成本是 120 元 (包含首年注册+代理费)
    const domainCost = domainCount * 120.0;

    // 最终硬成本 = 实际消耗的 API 费 + 实际买下的域名费
    const realHardCost = tokenCost + domainCost;

    // ====================================================================
    // 📈 第三部分：计算纯利与其他指标
    // ====================================================================
    const netProfit = totalRevenue - realHardCost;

    // 获取今日新增用户
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const newUsers = await prisma.user.count({
      where: { createdAt: { gte: startOfToday } }
    });
    
    // 获取正在排队运行的拓客任务
    const queuedTasks = await prisma.campaign.count({
      where: { status: 'RUNNING' }
    });

    // ====================================================================
    // 📤 返回给前端大盘
    // ====================================================================
    return NextResponse.json({
      todayStats: {
        newUsers: newUsers,
        totalRevenue: totalRevenue,
        creditsConsumed: realHardCost, // 前端显示的“API真实硬成本”
        emailsSent: 0, // 后续接上发信服务后统计
        queuedTasks: queuedTasks,
        filteredLeads: 0,
        netProfit: netProfit
      },
      // 保留以下空数组，防止前端图表组件因找不到数据而崩溃
      recentActivities: [],
      revenueTrend: [],
      mrrBreakdown: { subscription: 0, addon: 0 }
    });

  } catch (error: any) {
    console.error("❌ 无法生成大盘数据:", error);
    return NextResponse.json({ error: '数据审计失败' }, { status: 500 });
  }
}