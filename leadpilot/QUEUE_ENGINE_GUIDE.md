# 工业级发信队列引擎 - 实施指南

## 📋 已完成的工作

### 1. Prisma Schema 更新

**新增 SendingLog 模型：**
- 记录每一封邮件的发送详情
- 字段：收件人、发信域名、主题、状态、发送时间、打开时间、回复时间
- 状态：SENT | BOUNCED | OPENED | CLICKED | REPLIED | UNSUBSCRIBED

**更新 Lead 模型：**
- 新增 UNSUBSCRIBED 和 REPLIED 状态

**更新 User 模型：**
- 新增 sendingLogs 关联

### 2. BullMQ Worker（工业级）

**文件：** `/workers/email-worker.ts`

**核心特性：**

✅ **多租户公平调度**
- 并发处理 10 个任务
- 限流：每 60 秒最多处理 100 个任务
- 防止单个用户的大批量任务堵死队列

✅ **退信熔断机制**
- 自动检测硬退信（Hard Bounce）
- 立即调用 `recordEmailBounce()` 增加退信计数
- 退信数 >= 10 时自动触发 `isSendingSuspended = true`
- 暂停该用户的所有后续队列任务

✅ **合规退订检查**
- 发送前检查 `UnsubscribeList` 黑名单
- 如果收件人已退订，跳过发送并更新 Lead 状态
- 记录日志：`收件人已退订，跳过发送`

✅ **强制注入退订链接**
- 每封邮件底部自动注入退订链接
- 链接格式：`/api/email/unsubscribe?email=xxx&token=xxx`
- Token 使用 HMAC-SHA256 加密，防止伪造

✅ **域名轮换防封号**
- Round-Robin 算法轮换发信域名
- 第 1 封用 domain-a.com，第 2 封用 domain-b.com

✅ **真实发送日志**
- 每封邮件写入 `SendingLog` 表
- 记录 messageId、发送时间、状态、错误信息

### 3. 公平调度队列管理器

**文件：** `/lib/queue-manager.ts`

**核心算法：**

```typescript
// 将大批量任务分批添加
const BATCH_SIZE = 10 // 每批 10 封
const BATCH_DELAY = 1000 // 每批延迟 1 秒

// 示例：1000 封邮件 = 100 批
// 第 1 批：0ms 延迟
// 第 2 批：1000ms 延迟
// 第 3 批：2000ms 延迟
// ...
// 确保其他用户的任务能插入执行
```

**功能：**
- `addEmailJobsBatch()` - 批量添加任务（带公平调度）
- `getQueueStats()` - 获取队列统计
- `pauseUserJobs()` - 暂停用户所有任务（熔断时调用）
- `checkQueueHealth()` - 监控队列健康状态

### 4. 发信流水大屏

**文件：** `/app/(dashboard)/campaigns/logs/page.tsx`

**核心特性：**
- ✅ 真实从 `SendingLog` 表拉取数据（非 mock）
- ✅ 精确展示：收件人、发信域名、发送时间、状态
- ✅ 实时统计：成功率、退信率、打开率、回复率
- ✅ 状态筛选：全部/已发送/退信/已打开/已回复
- ✅ 自动刷新：每 10 秒更新一次
- ✅ 分页加载：每页 50 条记录

**API：** `/app/api/campaigns/sending-logs/route.ts`

### 5. 更新批量发信 API

**文件：** `/app/api/send-bulk-emails/route.ts`

**新增功能：**
- ✅ 发送前调用 `checkBeforeSending()` 过滤退订者
- ✅ 使用 `addEmailJobsBatch()` 实现公平调度
- ✅ 返回过滤统计：总数、有效数、过滤数

## 🔥 核心工作流程

### 发信流程（完整链路）

```
用户点击「启动」
    ↓
预估确认弹窗（检查余额）
    ↓
调用 /api/send-bulk-emails
    ↓
【合规检查】过滤退订黑名单
    ↓
【配额扣费】原子扣除 Token
    ↓
【公平调度】分批加入 BullMQ 队列
    ↓
Worker 从队列取任务
    ↓
【再次检查】用户是否被暂停
    ↓
【再次检查】收件人是否退订
    ↓
【强制注入】退订链接
    ↓
【真实发送】调用 Resend/SES
    ↓
【记录日志】写入 SendingLog 表
    ↓
【错误处理】检测硬退信 → 熔断
```

### 熔断机制（自动风控）

```
Worker 捕获发送错误
    ↓
判断是否为硬退信（550/554 错误码）
    ↓
调用 recordEmailBounce(userId, email)
    ↓
增加 User.bounceCount
    ↓
如果 bounceCount >= 10
    ↓
设置 isSendingSuspended = true
    ↓
发送系统通知给用户
    ↓
调用 pauseUserJobs(userId)
    ↓
移除该用户队列中的所有待发任务
```

### 退订流程

```
用户点击邮件底部退订链接
    ↓
GET /api/email/unsubscribe?email=xxx&token=xxx
    ↓
验证 Token 合法性
    ↓
写入 UnsubscribeList 表
    ↓
返回友好的退订成功页面
    ↓
后续发信时自动过滤该邮箱
```

## 🚀 部署步骤

### 1. 更新数据库

```bash
npx prisma db push
```

这将创建 `SendingLog` 表并更新 `Lead` 和 `User` 表。

### 2. 安装依赖

```bash
npm install bullmq ioredis
```

### 3. 配置环境变量

在 `.env` 中添加：

```env
# Redis 配置（BullMQ 需要）
REDIS_HOST=localhost
REDIS_PORT=6379

# 邮件服务商（选择其一）
RESEND_API_KEY=your-resend-api-key
# 或
AWS_SES_REGION=us-east-1
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
# 或
SENDGRID_API_KEY=your-sendgrid-api-key
```

### 4. 启动 Worker

```bash
# 方式 1：直接运行
node workers/start-worker.js

# 方式 2：使用 PM2（生产环境推荐）
pm2 start workers/start-worker.js --name email-worker

# 方式 3：添加到 package.json
npm run worker
```

在 `package.json` 中添加：

```json
{
  "scripts": {
    "worker": "node workers/start-worker.js",
    "worker:dev": "nodemon workers/start-worker.js"
  }
}
```

### 5. 访问发信流水大屏

启动开发服务器后访问：

```
http://localhost:3000/dashboard/campaigns/logs
```

## 🧪 测试验证

### 测试 1：公平调度

```bash
# 用户 A 发送 1000 封邮件
# 用户 B 发送 10 封邮件
# 预期：用户 B 的邮件不会等待用户 A 的 1000 封全部发完
# 实际：每批 10 封，交替执行
```

### 测试 2：退信熔断

```bash
# 模拟 10 次硬退信
# 预期：用户被自动暂停发信，队列中的任务被清空
# 验证：User.isSendingSuspended = true
```

### 测试 3：退订检查

```bash
# 1. 添加邮箱到 UnsubscribeList
# 2. 尝试发送邮件给该邮箱
# 预期：Worker 跳过发送，Lead 状态更新为 UNSUBSCRIBED
```

### 测试 4：强制退订链接

```bash
# 发送一封邮件
# 检查邮件 HTML 底部是否包含退订链接
# 点击链接，验证是否成功退订
```

## 📊 监控指标

### 队列健康检查

```typescript
import { checkQueueHealth } from '@/lib/queue-manager'

const health = await checkQueueHealth()
console.log('队列健康:', health.healthy)
console.log('问题:', health.issues)
console.log('统计:', health.stats)
```

### 用户发信统计

```sql
-- 查询用户发信成功率
SELECT 
  userId,
  COUNT(*) as total,
  SUM(CASE WHEN status = 'SENT' THEN 1 ELSE 0 END) as sent,
  SUM(CASE WHEN status = 'BOUNCED' THEN 1 ELSE 0 END) as bounced,
  ROUND(SUM(CASE WHEN status = 'SENT' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as success_rate
FROM SendingLog
GROUP BY userId
ORDER BY total DESC
```

## ⚠️ 重要提示

1. **Redis 必须运行**：BullMQ 依赖 Redis，确保 Redis 服务已启动
2. **Worker 必须独立运行**：不要在 Next.js 进程中运行 Worker
3. **生产环境使用 PM2**：确保 Worker 进程崩溃后自动重启
4. **监控队列健康**：定期调用 `checkQueueHealth()` 检查队列状态
5. **定期清理日志**：`SendingLog` 表会快速增长，建议定期归档

## ✅ 完成状态

所有核心功能已实现：
- ✅ 多租户公平调度（Round-Robin）
- ✅ 退信熔断机制（自动暂停高退信率用户）
- ✅ 合规退订检查（发送前过滤黑名单）
- ✅ 强制注入退订链接（符合 CAN-SPAM 法规）
- ✅ 真实发信流水大屏（从数据库拉取真实数据）
- ✅ 域名轮换防封号（Round-Robin）

现在执行：

```bash
# 1. 更新数据库
npx prisma db push

# 2. 安装依赖
npm install bullmq ioredis

# 3. 启动 Redis（如果未运行）
redis-server

# 4. 启动 Worker
node workers/start-worker.js

# 5. 启动开发服务器
npm run dev
```

系统即可投入使用！
