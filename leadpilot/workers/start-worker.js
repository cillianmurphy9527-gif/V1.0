#!/usr/bin/env node

/**
 * BullMQ Worker 启动脚本
 * 
 * 使用方法：
 * node workers/start-worker.js
 * 
 * 或在 package.json 中添加：
 * "scripts": {
 *   "worker": "node workers/start-worker.js"
 * }
 */

require('dotenv').config()

// 动态导入 Worker
async function startWorker() {
  try {
    console.log('🚀 Starting Email Worker...')
    console.log('📍 Redis:', process.env.REDIS_HOST || 'localhost', ':', process.env.REDIS_PORT || '6379')
    
    // 导入 Worker
    const { emailWorker } = await import('./email-worker')
    
    console.log('✅ Email Worker started successfully')
    console.log('⏳ Waiting for jobs...')
    
    // 优雅关闭
    process.on('SIGTERM', async () => {
      console.log('📴 Received SIGTERM, closing worker...')
      await emailWorker.close()
      process.exit(0)
    })

    process.on('SIGINT', async () => {
      console.log('📴 Received SIGINT, closing worker...')
      await emailWorker.close()
      process.exit(0)
    })

  } catch (error) {
    console.error('❌ Failed to start worker:', error)
    process.exit(1)
  }
}

startWorker()
