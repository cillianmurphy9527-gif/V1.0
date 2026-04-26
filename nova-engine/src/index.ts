// nova-engine/src/index.ts 完全替换
import { NovaEngine } from './services/engine';

async function main() {
  console.log("🔥 NOVA 泥头车节点启动 | 监控模式: 实时实弹");
  const engine = new NovaEngine();

  // 这里假设你通过命令行或消息队列触发任务
  const taskId = process.argv[2];
  const country = process.argv[3] || 'Germany';
  const industry = process.argv[4] || 'Manufacturing';

  if (taskId) {
    await engine.runTask(taskId, country, industry);
  } else {
    console.log("ℹ️ 等待调度指令...");
  }
}

main().catch(err => {
  console.error("❌ 引擎崩溃:", err);
  process.exit(1);
});