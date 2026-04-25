import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { Queue } from 'bullmq';
import Redis from 'ioredis';

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

    const body = await request.json();
    const { campaignId, targetRegions, targetIndustries, targetPersonas, pitch } = body;

    // 🛑 核心拦截：没有 ID 绝不发车
    if (!campaignId) {
      return NextResponse.json({ error: '缺少关键参数: campaignId' }, { status: 400 });
    }

    const finalKeyword = body.keyword || `${targetRegions?.[0] || ''} ${targetIndustries?.[0] || ''} ${targetPersonas?.[0] || ''}`.trim();
    const jobId = `NOVA-${Date.now()}`;

    // 🎯 身份证下发
    await novaQueue.add('start-nova', {
      jobId,
      campaignId, 
      userId: token.id,
      keyword: finalKeyword
    });

    console.log(`✅ [发令台] 任务已入队 | ID: ${campaignId} | 关键词: ${finalKeyword}`);
    return NextResponse.json({ success: true, jobId, campaignId });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}