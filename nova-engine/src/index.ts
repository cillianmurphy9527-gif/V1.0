import * as dotenv from 'dotenv';
import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { runEngine } from './services/engine';

dotenv.config();

const connection = new Redis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: 6379,
  maxRetriesPerRequest: null,
});

console.log(`\n=============================================`);
console.log(`[Nova Engine] 🚀 泥头车已就绪 | 正在监听指令...`);
console.log(`=============================================\n`);

const worker = new Worker('nova-jobs', async (job) => {
  // 🌟 修复红线：删除了未使用的 userId，明确使用 jobId
  const { keyword, campaignId, jobId, targetCount } = job.data;
  
  console.log(`\n🚨 [收到指令] 关键词: [${keyword}] | 目标数量: [${targetCount || 10}]`);
  console.log(`🆔 [身份验证] CampaignID: [${campaignId || '缺失'}] | 任务号: [${jobId}]`);
  
  try {
    await runEngine(keyword, campaignId, targetCount || 10);
    console.log(`✅ [任务结束] 关键词 [${keyword}] 处理完毕。`);
  } catch (error: any) {
    console.error(`❌ [任务崩溃] 致命异常:`, error.message);
  }
}, { 
    connection,
    concurrency: 10 
});

worker.on('error', err => console.error('[系统故障]', err));