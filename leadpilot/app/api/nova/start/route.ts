import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { QuotaManager } from '@/lib/services/quota'; // 🌟 引入配额哨兵

const connection = new Redis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
});

const novaQueue = new Queue('nova-jobs', { connection });

export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request as any, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.id) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    const userId = token.id;

    const body = await request.json();
    const { campaignId, targetRegions, targetIndustries, targetPersonas, keyword } = body;

    // 🛑 核心拦截：必须有真实的数据库 Campaign ID 才能发车
    if (!campaignId) {
      return NextResponse.json({ error: '必须先创建任务获取 campaignId' }, { status: 400 });
    }

    const finalKeyword = keyword || `${targetRegions?.[0] || ''} ${targetIndustries?.[0] || ''} ${targetPersonas?.[0] || ''}`.trim() || 'CEO';
    
    // 🌟 1. 获取前端请求的线索数量，并针对免费用户强制锁死为 3
    let targetCount = body.targetCount || 10; // 假设前端传了这个字段，如果没有默认10
    const isFree = await QuotaManager.isFreeTier(userId);
    
    if (isFree) {
        console.log(`[Nova Start] 检测到免费用户 ${userId}，强制将数量降级为 3`);
        targetCount = 3;
    }

    // 🌟 2. 核心拦截：先扣费！扣费失败直接在这里熔断，绝不让任务入队
    const deductResult = await QuotaManager.consumeLead(userId, targetCount);
    if (!deductResult.success || deductResult.error) {
       return NextResponse.json({ 
           error: deductResult.error?.message || '线索余额不足', 
           code: 'INSUFFICIENT_QUOTA' 
       }, { status: 403 });
    }

    // 生成任务ID
    const jobId = `NOVA-${Date.now()}`;

    // 🎯 身份证下发 (将修正后的 targetCount 也传给引擎)
    await novaQueue.add('start-nova', {
      jobId,
      campaignId, 
      userId,
      keyword: finalKeyword,
      targetCount // 传递修正后的数量
    });

    console.log(`✅ [发令台] 任务已入队 | ID: ${campaignId} | 关键词: ${finalKeyword} | 目标数量: ${targetCount} | 预扣额度成功`);
    return NextResponse.json({ success: true, jobId, campaignId, deducted: targetCount });

  } catch (error: any) {
    console.error('[Nova Start Error]:', error);
    // 如果抛出的是配额错误，返回 403
    if (error.name === 'QuotaServiceError') {
        return NextResponse.json({ error: error.message, code: error.code, upgrade: true }, { status: 403 });
    }
    return NextResponse.json({ error: error.message || '系统错误' }, { status: 500 });
  }
}