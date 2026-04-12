# LeadPilot《主理人商业交付与运营白皮书》（封版）

本文件面向**非技术背景的创始人/主理人**，目标是让你拿到服务器后能把系统“一键点火”，并在出现问题时知道该看哪里、该怎么排查。

---

## 1) 点火指南（拿到服务器后怎么跑起来）

### 你需要准备什么

- **一台云服务器**：建议 2C4G 起步（并发与队列建议 4C8G）
- **一个域名**：例如 `app.yourdomain.com`
- **数据库**：建议生产使用 PostgreSQL（RDS / Supabase / 自建）
- （推荐）**Redis**：用于队列与支付幂等锁，能显著提升稳定性

### 最简启动流程（大白话）

- **第 1 步：把代码部署到服务器**
  - 方式 A：直接在服务器 `git clone`（私有仓库用部署密钥）
  - 方式 B：CI/CD（更推荐），你只需要把环境变量填好

- **第 2 步：准备生产环境变量**
  - 项目根目录已提供 `.env.production` 模板（仅模板，不含真实密钥）
  - 你要做的是：把 `.env.production` 复制为你部署平台要求的环境变量（或同名文件）
  - 最关键的三项是：
    - `NEXTAUTH_SECRET`（自己生成强随机）
    - `NEXTAUTH_URL`（线上域名）
    - `DATABASE_URL`（生产数据库连接）

- **第 3 步：初始化数据库**
  - 如果你使用 Prisma：
    - 常见做法是 `prisma db push` 或迁移（看你当前项目策略）

- **第 4 步：启动服务**
  - 以 Node 方式为例：
    - `npm install`
    - `npm run build`
    - `npm run start`

---

## 2) 采购对账（哪些第三方服务需要第一时间充值/开通）

下面按“跑通主业务的优先级”给你列一个采购清单。

### 必须优先开通（否则主链路跑不通）

- **邮箱清洗：ZeroBounce**
  - 用途：避免垃圾邮箱导致退信飙升，保护域名信誉
  - 对应 Key：`ZEROBOUNCE_API_KEY`

- **域名购买/管理：Namecheap（或你实际域名供应商）**
  - 用途：域名池策略、自动化购买/轮换（如你启用）
  - 对应 Key：`NAMECHEAP_API_KEY`, `NAMECHEAP_API_USER`

- **AI 引擎：DeepSeek + Gemini（至少要有一个）**
  - 用途：Nova 写信、意图/评分、知识库问答
  - 对应 Key：`DEEPSEEK_API_KEY`, `GEMINI_API_KEY`

### 强烈推荐开通（可显著降低故障率与客服压力）

- **Sentry**
  - 用途：前端白屏/后端异常第一时间定位
  - 对应 Key：`NEXT_PUBLIC_SENTRY_DSN`

- **Redis**
  - 用途：任务队列、支付幂等锁、防并发雪崩
  - 对应 Key：`REDIS_URL`（推荐）或 `REDIS_HOST/REDIS_PORT`

### 视业务而定（你的商业策略决定）

- **Apollo / Hunter**
  - 用途：B2B 线索数据源（获客规模取决于预算）
  - 对应 Key：`APOLLO_API_KEY`, `HUNTER_API_KEY`

- **Cloudflare Turnstile**
  - 用途：注册/登录防机器刷号
  - 对应 Key：`NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`

- **微信/支付宝/短信**
  - 用途：如果你要在国内收款/做短信登录
  - 对应 Key：`WECHAT_PAY_SECRET`, `ALIPAY_PRIVATE_KEY`, `ALIYUN_SMS_*`

---

## 3) 救火指南（用户说“发信卡住/前端白屏”怎么办）

### A. 用户反馈“发信卡住了”

优先按下面顺序排查：

- **1）看【天眼监控板】**
  - 位置：后台监控页（你已内置）
  - 重点看是否有这些节点变成 PENDING：
    - Redis（队列）
    - 数据库（DATABASE_URL）
    - 邮箱服务/清洗（ZeroBounce / Workspace）

- **2）看队列是否不可用**
  - 典型症状：发信请求返回 “任务排队失败（队列不可用），已退还算力”
  - 处理：
    - 检查 Redis 是否在线
    - 检查 `REDIS_URL` 是否填对

- **3）看退信熔断**
  - 典型症状：某用户 `isSendingSuspended=true`
  - 处理：
    - 先让用户换域名/做清洗
    - 再考虑后台解禁（如果你确认风险可控）

### B. 用户反馈“前端白屏/按钮点了没反应”

- **1）先看 Sentry**
  - 你需要确保已配置 `NEXT_PUBLIC_SENTRY_DSN`
  - 在 Sentry 里优先看：
    - 最新的 Release
    - Top Issues（出现频率最高的报错）
    - 关联用户（如果你在上报里带了 userId/email）

- **2）再看服务器日志**
  - 关键字：
    - `❌ [AI 容灾]` / `⚠️ [AI 容灾]`：AI 主脑失败切换备用脑的日志
    - `QUEUE_UNAVAILABLE`：队列不可用且已退还算力
    - `IDEMPOTENT_CONFLICT`：支付/充值幂等拦截（用户连点导致）

---

## 4) 封版工具（上线前一次性做的“清理动作”）

### 一键清空开发/压测脏数据（保留 SUPER_ADMIN 与元数据）

脚本：`scripts/prepare-production.ts`

- **只统计不删除（推荐先跑一次）**

```bash
node --experimental-strip-types scripts/prepare-production.ts
```

- **真实执行删除（谨慎）**

```bash
node --experimental-strip-types scripts/prepare-production.ts --apply
```

执行后你会看到每个表删除的数量统计。

