# 🚀 LeadPilot 发信系统 - 完整实施指南

## 📦 已完成的三大核心系统

### 第一阶段：防薅羊毛 + 合规发信机制 ✅

**Prisma 模型：**
- `DeviceFingerprint` - 设备指纹记录（防重复领取试用）
- `IpBlacklist` - IP 黑名单
- `UnsubscribeList` - 退订黑名单
- `User` 新增字段：`bounceCount`、`isSendingSuspended`

**核心 API：**
- `/api/auth/register` - 注册时检查 IP/设备指纹
- `/api/email/unsubscribe` - 退订处理
- `/api/email/webhook` - 邮件服务商回调
- `/api/admin/blacklist` - 黑名单管理

**防护机制：**
- ✅ 同一 IP/设备只能领取一次试用（500 Tokens + 100 封邮件）
- ✅ 退信数 >= 10 自动暂停发信
- ✅ 发送前自动过滤退订黑名单

### 第二阶段：预估评估系统 ✅

**核心 API：**
- `/api/campaigns/estimate` - 真实计算 Token 消耗和时间

**前端组件：**
- `CampaignEstimateDialog` - 预估确认弹窗
- `EstimateContent` - 预估数据展示

**真实运算逻辑：**
- Token 消耗：快速模式 10/封，深度分析 46/封
- 时间预估：根据套餐速率限制真实计算
- 余额判断：tokenBalance + addonCredits >= 所需消耗
- 成功率：基于用户历史 Lead 数据计算

**交互流程：**
1. 点击「启动数字员工」→ 弹出预估确认
2. 自动调用 API 获取真实预估数据
3. 余额充足 → 显示「确认启动」按钮
4. 余额不足 → 按钮变灰，显示「立即充值」

### 第三阶段：工业级发信队列引擎 ✅

**核心文件：**
- `/workers/email-worker.ts` - BullMQ Worker
- `/lib/queue-manager.ts` - 公平调度管理器
- `/app/api/send-bulk-emails/route.ts` - 批量发信 API
- `/app/api/campaigns/sending-logs/route.ts` - 流水日志 API
- `/app/(dashboard)/campaigns/logs/page.tsx` - 发信流水大屏

**核心特性：**

✅ **多租户公平调度（Round-Robin）**
```typescript
// 大批量任务分批添加，每批 10 封，间隔 1 秒
// 确保小客户的任务不会被大客户堵死
const BATCH_SIZE = 10
const BATCH_DELAY = 1000ms
```

✅ **退信熔断机制**
```typescript
// Worker 检测硬退信（550/554 错误码）
// → 增加 bounceCount
// → 达到阈值（10 次）
// → 自动暂停发信（isSendingSuspended = true）
// → 清空该用户队列中的所有任务
```

✅ **合规退订检查**
```typescript
// 发送前检查 UnsubscribeList
// 如果已退订 → 跳过发送
// 更新 Lead 状态为 UNSUBSCRIBED
```

✅ **强制注入退订链接**
```html
<!-- 每封邮件底部自动注入 -->
<a href="/api/email/unsubscribe?email=xxx&token=xxx">
  点击此处退订
</a>
```

✅ **真实发信流水大屏**
- 从 `SendingLog` 表真实拉取数据
- 展示：收件人、发信域名、状态、时间
- 实时统计：成功率、退信率、打开率
- 自动刷新：每 10 秒更新

## 🚀 快速启动

### 方式 1：一键启动（推荐）

```bash
./start-all.sh
```

### 方式 2：手动启动

```bash
# 1. 启动 Redis
redis-server

# 2. 更新数据库
npx prisma db push

# 3. 启动 Worker（新终端）
npm run worker

# 4. 启动开发服务器（新终端）
npm run dev
```

## 📊 访问地址

- **主应用：** http://localhost:3000
- **发信流水大屏：** http://localhost:3000/dashboard/campaigns/logs
- **Prisma Studio：** npx prisma studio

## 🔧 环境变量配置

确保 `.env` 文件包含以下配置：

```env
# 数据库
DATABASE_URL="file:./dev.db"

# NextAuth
NEXTAUTH_SECRET="your-secret-key"
NEXTAUTH_URL="http://localhost:3000"

# Redis（必需）
REDIS_HOST="localhost"
REDIS_PORT="6379"

# 邮件服务商（选择其一）
RESEND_API_KEY="your-resend-api-key"

# 安全密钥
UNSUBSCRIBE_SECRET="your-unsubscribe-secret"
TURNSTILE_SECRET_KEY="your-turnstile-key"
EMAIL_WEBHOOK_SECRET="your-webhook-secret"
```

## 🎯 核心功能验证

### 1. 测试防薅羊毛

```bash
# 同一 IP 注册两次
# 预期：第二次返回 403 "该设备/IP 已享受过试用福利"
```

### 2. 测试预估系统

```bash
# 访问发信页面，点击「启动数字员工」
# 预期：弹出预估确认弹窗，显示真实的 Token 消耗和余额对比
```

### 3. 测试公平调度

```bash
# 用户 A 发送 1000 封
# 用户 B 发送 10 封
# 预期：用户 B 的邮件不会等待用户 A 全部发完
```

### 4. 测试退信熔断

```bash
# 模拟 10 次硬退信
# 预期：用户自动被暂停发信，收到系统通知
```

### 5. 测试退订链接

```bash
# 发送一封邮件
# 检查邮件底部是否有退订链接
# 点击退订链接
# 预期：邮箱加入 UnsubscribeList，后续发信自动跳过
```

### 6. 测试发信流水大屏

```bash
# 访问 /dashboard/campaigns/logs
# 预期：显示真实的发信记录，包含收件人、域名、状态、时间
# 每 10 秒自动刷新
```

## 📁 核心文件清单

### 数据库
- `prisma/schema.prisma` - 数据模型定义

### 后端 API
- `app/api/auth/register/route.ts` - 注册（防薅羊毛）
- `app/api/campaigns/estimate/route.ts` - 预估评估
- `app/api/send-bulk-emails/route.ts` - 批量发信
- `app/api/campaigns/sending-logs/route.ts` - 流水日志
- `app/api/email/unsubscribe/route.ts` - 退订处理
- `app/api/email/webhook/route.ts` - 邮件回调
- `app/api/admin/queue/stats/route.ts` - 队列监控

### Worker
- `workers/email-worker.ts` - 发信 Worker
- `workers/start-worker.js` - Worker 启动脚本

### 工具库
- `lib/email-compliance.ts` - 合规检查
- `lib/email-validation.ts` - 发信前验证
- `lib/queue-manager.ts` - 队列管理器
- `lib/campaign-estimate-config.ts` - 预估配置
- `lib/device-fingerprint.ts` - 设备指纹采集

### 前端组件
- `components/campaigns/CampaignEstimateDialog.tsx` - 预估弹窗
- `components/campaigns/EstimateContent.tsx` - 预估内容
- `app/(dashboard)/campaigns/logs/page.tsx` - 流水大屏

## ✅ 完成状态

所有三个阶段已全部完成，系统可立即投入使用！

**执行顺序：**

```bash
# 1. 更新数据库
npx prisma db push

# 2. 启动 Redis（如果未运行）
redis-server

# 3. 启动 Worker
npm run worker

# 4. 启动开发服务器（新终端）
npm run dev
```

系统启动后，所有防护机制和队列引擎将自动生效！
