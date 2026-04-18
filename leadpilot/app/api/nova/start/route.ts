import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { Queue } from 'bullmq';
import Redis from 'ioredis';

const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379');
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;

const connection = new Redis({
  host: REDIS_HOST,
  port: REDIS_PORT,
  password: REDIS_PASSWORD,
  maxRetriesPerRequest: null,
});

const novaQueue = new Queue('nova-jobs', { connection });

// 辅助函数：把前端传来的数组提纯成字符串
function joinList(arr: any, fallback: string): string {
  if (Array.isArray(arr) && arr.length > 0) {
    return arr.map((x) => String(x).trim()).filter(Boolean).join(' ');
  }
  return fallback;
}

export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request as any, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.id) return NextResponse.json({ error: '请先登录' }, { status: 401 });

    const body = await request.json();
    
    // 🚨 架构师修复：尝试获取直接的 keyword，如果没有，就把表单里的维度拼起来！
    let finalKeyword = body.keyword || body.prompt || body.query || body.searchQuery;

    if (!finalKeyword) {
      const region = joinList(body.targetRegions, '');
      const industry = joinList(body.targetIndustries, '');
      const persona = joinList(body.targetPersonas, '');
      
      // 拼装：比如 "德国 精密机械 CEO/总裁"
      finalKeyword = `${region} ${industry} ${persona}`.trim();
    }

    if (!finalKeyword) {
      console.error("[API 拦截] 无法提取有效搜索词。前端数据:", body);
      return NextResponse.json({ error: '缺少必填参数: 目标配置为空' }, { status: 400 });
    }

    const jobId = `NOVA-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // 🎯 投递任务
    await novaQueue.add('start-nova', {
      jobId,
      userId: token.id,
      keyword: finalKeyword // 泥头车现在会收到极其精准的指令
    });

    console.log(`[主站发令台] 已将任务 [${finalKeyword}] 下发至远洋舰队队列，任务号: ${jobId}`);

    return NextResponse.json({ success: true, jobId, message: '指令已下达，泥头车已出动' });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}