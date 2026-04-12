# LeadPilot - 商业化全链路 SaaS 平台

基于 Next.js 构建的智能外贸开发信自动化平台，集成 AI 意图过滤、多语言撰写、防封轮换发送与统一收件箱。

## 技术栈

- **框架**: Next.js 14 (App Router), TypeScript
- **UI**: Tailwind CSS, Shadcn UI, Tremor.so
- **数据库**: PostgreSQL + Prisma ORM
- **任务队列**: Redis + BullMQ
- **邮件服务**: Resend
- **AI**: DeepSeek-V3

## 快速开始

```bash
# 安装依赖
npm install

# 配置环境变量
cp .env.example .env.local

# 初始化数据库
npm run db:push

# 启动开发服务器
npm run dev
```

## 环境变量

```env
DATABASE_URL="postgresql://user:password@localhost:5432/agentcross"
REDIS_URL="redis://localhost:6379"
RESEND_API_KEY="your_resend_key"
DEEPSEEK_API_KEY="your_deepseek_key"
NEXTAUTH_SECRET="your_secret"
NEXTAUTH_URL="http://localhost:3000"
```

## 项目结构

```
agentcross/
├── app/
│   ├── (marketing)/        # 营销页面
│   ├── (dashboard)/        # 仪表盘
│   └── api/                # API 路由
├── components/             # UI 组件
├── lib/                    # 工具函数
├── services/               # 业务服务层
├── prisma/                 # 数据库模型
└── workers/                # 后台任务
```

## 订阅方案

- **体验版 (Starter)**: ¥199/月 - 1域名 + 1000点
- **专业版 (Pro)**: ¥599/月 - 3域名 + 5000点 + AI过滤
- **企业版 (Max)**: ¥1299/月 - 10域名 + 15000点 + 统一收件箱

## 部署

推荐部署至 Vercel，并通过 Cloudflare 接入 CDN 与 DDoS 防护。

```bash
npm run build
vercel deploy
```
