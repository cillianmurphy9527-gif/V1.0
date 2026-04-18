/**
 * 🚀 Nova Engine (香港轻量云 - 泥头车引擎)
 * 核心职责：监听 Redis 队列 -> 拉取任务 -> 四步清洗 -> 发回战报
 */

import * as dotenv from 'dotenv';
import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { runEngine } from './services/engine';

dotenv.config();

// 1. 连接您的基础设施 (Redis)
const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379');
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;

const connection = new Redis({
  host: REDIS_HOST,
  port: REDIS_PORT,
  password: REDIS_PASSWORD,
  maxRetriesPerRequest: null,
});

console.log(`\n=============================================`);
console.log(`[Nova Engine] 🚀 远洋舰队 (泥头车) 启动就绪！`);
console.log(`[Nova Engine] 📡 正在监听 Redis 主控指令...`);
console.log(`=============================================\n`);

// 2. 开启全天候雷达，死死盯住 'nova-jobs' 队列
const worker = new Worker('nova-jobs', async (job) => {
  const { jobId, keyword, userId } = job.data;
  
  console.log(`\n🚨 [雷达警报] 收到来自主站的实弹攻击指令！`);
  console.log(`🎯 [任务目标] 关键词: [${keyword}] | 指挥官ID: [${userId}] | 任务编号: [${jobId}]`);
  
  try {
    // 3. 收到指令，踩下油门！把前端传来的“真实搜索词”喂给引擎
    await runEngine(keyword);
    console.log(`✅ [任务完成] 关键词 [${keyword}] 的搜刮任务已结束，进入静默待机。`);
  } catch (error: any) {
    console.error(`❌ [任务坠毁] 执行 [${keyword}] 任务时发生致命异常:`, error.message);
    throw error;
  }
}, { connection,
     concurrency: 10 // 👈 关键魔法：允许 10 个任务同时起跑！
});

// 监听错误，防止进程崩溃
worker.on('error', err => {
  console.error('[雷达故障] Worker 发生异常:', err);
});