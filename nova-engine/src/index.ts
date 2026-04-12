import * as dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { runEngine } from './services/engine';

dotenv.config();
const prisma = new PrismaClient();

async function main() {
  console.log("[Nova Engine] 🚀 NOVA 清洗引擎点火中...\n");
  try {
    const count = await prisma.userLead.count();
    console.log(`[Nova Engine] ✅ 数据库接入成功！当前金库共有 ${count} 条线索。\n`);

    // ── 启动五步清洗与发信衔接引擎 ─────────────────────
    //   Step1: mockProxycurl       → 发现公司域名 + LinkedIn
    //   Step2: mockHunter → mockSnov → 获取邮箱（串联容错）
    //   Step3: mockSmtpVerify      → SMTP 验证，INVALID 丢弃
    //   Step4: saveToDatabase     → upsert，isUnlocked=true (READY_FOR_OUTREACH)
    //   Step5: triggerOutreachPreparation → 发信队列衔接
    //
    await runEngine('all');
    // ──────────────────────────────────────────────────

  } catch (error) {
    console.error('[Nova Engine] ❌ 运行异常:', error);
  } finally {
    await prisma.$disconnect();
    console.log('[Nova Engine] 👀 任务完成。');
  }
}

main();
