import { ApiBalanceService } from '@/lib/services/ApiBalanceService';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminRole } from '@/lib/admin-auth';

// ─── 成本费率常量（对齐财务大盘） ────────────────────────────────
const AI_COST_PER_1K_TOKENS = parseFloat(process.env.AI_COST_PER_1K_TOKENS || '0.001')
const EMAIL_COST_PER_SEND = parseFloat(process.env.EMAIL_COST_PER_SEND || '0.007')

export async function GET() {
  try {
    // 1. 🛡️ 鉴权
    const auth = await requireAdminRole(['SUPER_ADMIN', 'FINANCE', 'OPS']);
    if (!auth.ok) return auth.response;

    // ====================================================================
    // 💰 第一部分：全局收入与退款 (真实数据)
    // ====================================================================
    const paidAgg = await prisma.order.aggregate({
      where: { status: 'PAID' },
      _sum: { amount: true }
    });
    const totalRevenue = paidAgg._sum.amount ?? 0;

    const refundAgg = await prisma.order.aggregate({
      where: { status: 'REFUNDED' },
      _sum: { amount: true }
    });
    const totalRefund = refundAgg._sum.amount ?? 0;
    const netRevenue = totalRevenue - totalRefund;

    // ====================================================================
    // 🩸 第二部分：全口径成本追踪 (精算到厘)
    // ====================================================================
    // A. AI 算力成本 (DeepSeek / OpenAI)
    const tokenTxs = await prisma.tokenTransaction.aggregate({
      where: { amount: { lt: 0 }, reason: { notIn: ['ADMIN_BAN_CONFISCATE', 'REFUND'] } },
      _sum: { amount: true }
    });
    const aiCost = (Math.abs(tokenTxs._sum.amount ?? 0) / 1000) * AI_COST_PER_1K_TOKENS;

    // B. 邮件投递成本 (Resend)
    const emailsSent = await prisma.sendingLog.count({
      where: { status: { in: ['SENT', 'OPENED', 'CLICKED', 'REPLIED'] } }
    });
    const emailCost = emailsSent * EMAIL_COST_PER_SEND;

    // C. 外部采购成本 (精准匹配真实技术栈)
    const externalCosts = await prisma.systemCostLog.groupBy({
      by: ['provider'],
      _sum: { costCny: true }
    });

    let apolloCost = 0, 
        hunterCost = 0, 
        zeroBounceCost = 0, 
        namecheapCost = 0, 
        smartleadCost = 0, // 🌟 新增 Smartlead 统计
        otherCost = 0;

    externalCosts.forEach(item => {
      const cost = item._sum.costCny ?? 0;
      switch(item.provider) {
        case 'APOLLO': apolloCost += cost; break;      // 🌟 修正为 APOLLO
        case 'HUNTER': hunterCost += cost; break;
        case 'ZEROBOUNCE': zeroBounceCost += cost; break;
        case 'NAMECHEAP': namecheapCost += cost; break;
        case 'SMARTLEAD': smartleadCost += cost; break; // 🌟 接入 Smartlead
        default: 
          // 排除掉已经单独核算的 AI 和邮件供应商
          if(item.provider !== 'OPENAI' && item.provider !== 'DEEPSEEK' && item.provider !== 'RESEND') {
             otherCost += cost; 
          }
          break;
      }
    });

    const totalExternalCost = apolloCost + hunterCost + zeroBounceCost + namecheapCost + smartleadCost + otherCost;
    const realHardCost = aiCost + emailCost + totalExternalCost;

    // ====================================================================
    // 📈 第三部分：纯利润与运营指标
    // ====================================================================
    const netProfit = netRevenue - realHardCost;

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const newUsers = await prisma.user.count({ where: { createdAt: { gte: startOfToday } } });
    const queuedTasks = await prisma.campaign.count({ where: { status: 'RUNNING' } });

    // ====================================================================
    // 🛢️ 第四部分：抓取真实的 API 水位
    // ====================================================================
    const realApiBalances = await ApiBalanceService.getAllBalances();

    // ====================================================================
    // 📤 返回给总指挥部前端
    // ====================================================================
    return NextResponse.json({
      todayStats: {
        newUsers,
        totalRevenue,
        totalRefund,
        netRevenue,
        creditsConsumed: realHardCost,
        emailsSent,
        queuedTasks,
        netProfit
      },
      // 🌟 这里必须传给前端，否则看板的饼图/列表会显示 0
      costBreakdown: {
        aiCost, 
        emailCost, 
        apolloCost, 
        hunterCost, 
        zeroBounceCost, 
        namecheapCost, 
        smartleadCost, // 🌟 返回给前端展示
        otherCost 
      },
      apiBalances: realApiBalances
    });

  } catch (error: any) {
    console.error("❌ 无法生成大盘数据:", error);
    return NextResponse.json({ error: '数据审计失败' }, { status: 500 });
  }
}