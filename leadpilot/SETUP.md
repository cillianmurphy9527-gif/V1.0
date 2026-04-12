# LeadPilot 项目已初始化完成

## 已完成的核心模块

### 1. 基础架构
- ✅ Next.js 14 (App Router) + TypeScript
- ✅ Tailwind CSS + Shadcn UI 组件库
- ✅ Prisma ORM + PostgreSQL 数据库模型
- ✅ 环境配置与项目结构

### 2. 数据库模型
- ✅ User（用户、订阅、算力）
- ✅ Domain（防封域名池）
- ✅ Campaign（营销活动）
- ✅ Lead（客户线索）
- ✅ EmailThread & EmailMessage（统一收件箱）
- ✅ Notification（通知系统）

### 3. 服务层
- ✅ LLMService - DeepSeek-V3 集成（意图打分、邮件生成、翻译）
- ✅ EmailService - Resend 发送服务（盖楼参数、域名轮换、防封休眠）
- ✅ InfraService - 基础设施（域名代购、DNS 验证、健康检查）

### 4. API 端点
- ✅ `/api/email/webhook` - 接收老外回信（含 Message-ID 解析）
- ✅ `/api/inbox/threads` - 获取线程列表 & 发送回复
- ✅ `/api/inbox/threads/[threadId]` - 获取单个线程消息
- ✅ `/api/notifications/unread` - 未读通知轮询

### 5. 前端页面
- ✅ 营销落地页（定价方案、功能展示）
- ✅ Dashboard 仪表盘（Tremor 图表、实时数据）
- ✅ 统一收件箱（左右分栏、AI 辅助回复、盖楼对话）

### 6. 后台任务
- ✅ BullMQ Workers（Qualifier、Copywriter、Delivery）
- ✅ 算力与域名熔断机制
- ✅ 防封休眠逻辑

## 下一步操作

### 安装依赖
```bash
cd agentcross
npm install
```

### 配置环境变量
```bash
cp .env.example .env.local
# 编辑 .env.local 填入真实配置
```

### 初始化数据库
```bash
npm run db:push
```

### 启动开发服务器
```bash
npm run dev
```

### 启动 Workers（另开终端）
```bash
node -r ts-node/register workers/emailWorkers.ts
```

## 生产部署建议

1. **Vercel 部署前端**
   ```bash
   vercel deploy --prod
   ```

2. **Cloudflare 配置**
   - DNS 解析指向 Vercel
   - 开启 CDN 加速
   - 启用 DDoS 防护

3. **数据库迁移**
   - 使用 Supabase/PlanetScale 托管 PostgreSQL
   - 配置 Redis（Upstash/Railway）

4. **Webhook 配置**
   - 在 Resend 后台设置 Webhook URL：
     `https://yourdomain.com/api/email/webhook`

## 关键技术亮点

- **盖楼机制**：通过 `In-Reply-To` 和 `References` 确保邮件客户端完美折叠对话
- **防封策略**：随机休眠 3-7 分钟 + 域名轮换 + 每日限额
- **权限控制**：订阅方案与功能标识（`features` JSON 字段）
- **AI 过滤**：评分 < 60 自动拦截且不扣算力
- **统一收件箱**：AI 翻译 + 中文指令生成外语回复

项目已完整搭建，可直接运行开发环境或部署至生产。
