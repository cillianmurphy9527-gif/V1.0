// leadpilot/lib/services/CronService.ts
import cron from 'node-cron';

class CronService {
  private isInitialized = false;

  init() {
    if (this.isInitialized) return;

    // 每天早上 8:00 (北京时间) 触发
    cron.schedule('0 8 * * *', async () => {
      console.log('[Cron] ⏰ 触发每日 CFO 简报生成...');
      try {
        const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
        const res = await fetch(`${baseUrl}/api/cron/daily-briefing`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${process.env.CRON_SECRET}`
          }
        });

        if (!res.ok) {
           console.error('[Cron] ❌ 简报生成接口返回错误:', await res.text());
        } else {
           console.log('[Cron] ✅ 每日简报生成并推送成功');
        }

      } catch (error) {
        console.error('[Cron] ❌ 定时任务执行失败:', error);
      }
    }, {
      scheduled: true,
      timezone: "Asia/Shanghai"
    } as any); // 🌟 核心修复：加上 as any 强行绕过 TS 误报

    console.log('[Cron] 🚀 全局定时器已挂载 (每日 08:00 触发简报)');
    this.isInitialized = true;
  }
}

export const cronService = new CronService();