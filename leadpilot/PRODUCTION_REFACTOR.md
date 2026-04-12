# 上线前重构完成报告

## ✅ 第一步：全局拆除 Mock 与大模型容灾切换

### LLMService.ts - AI 容灾双引擎 ✅

**已完成**：
- ✅ 移除所有 `if (process.env.NODE_ENV === 'development')` Mock 代码
- ✅ 实现 DeepSeek + Google Gemini 双引擎容灾
- ✅ 优先调用 DeepSeek，失败后 1 秒内切换至 Gemini
- ✅ 添加 10 秒超时机制
- ✅ 强化 AI 安全边界（System Prompt）

**容灾策略**：
```typescript
1. 优先调用 DeepSeek API
2. 如果超时或 500 错误，1秒内静默切换至 Google Gemini
3. 双引擎均失败才抛出错误
```

**AI 安全边界（已焊死）**：
- ✅ 绝对禁止捏造价格、折扣或任何未经授权的优惠承诺
- ✅ 严禁承诺"免费"、"包邮"、"无条件退款"等未经用户明确授权的条款
- ✅ 严格遵守反垃圾邮件法案（CAN-SPAM Act）
- ✅ 必须包含退订机制说明（"Reply STOP to unsubscribe"）
- ✅ 禁止泄露用户的商业机密、定价策略或内部信息
- ✅ 禁止生成钓鱼、诈骗或误导性内容
- ✅ 所有价格、优惠、交付承诺必须由用户明确提供，不得自行编造

**环境变量要求**：
```bash
DEEPSEEK_API_KEY=your-deepseek-key
GEMINI_API_KEY=your-gemini-key  # 备用引擎
```

---

### EmailService.ts - 邮件发送服务 ✅

**已完成**：
- ✅ 移除所有 Mock 代码
- ✅ 强制读取 `RESEND_API_KEY`
- ✅ 添加详细的日志输出
- ✅ 保留盖楼参数（In-Reply-To, References）

**环境变量要求**：
```bash
RESEND_API_KEY=your-resend-key
```

---

### InfraService.ts - 基础设施服务 ✅

**已完成**：
- ✅ 移除所有 Mock 代码
- ✅ 添加 API 密钥检查
- ✅ 标记待对接的真实 API（Namecheap, Cloudflare）

**环境变量要求**：
```bash
NAMECHEAP_API_KEY=your-namecheap-key
CLOUDFLARE_API_KEY=your-cloudflare-key
```

**待对接 API**：
- ⏳ Namecheap 域名购买 API
- ⏳ Cloudflare DNS 配置 API
- ⏳ Stripe/微信支付/支付宝支付网关
- ⏳ DNS 查询验证
- ⏳ Spamhaus/SURBL 黑名单查询

---

## ✅ 第二步：风控退款与邮件凭证机制

### 数据库 Order 模型更新 ✅

**已添加字段**：
```prisma
model Order {
  tradeNo      String?  @unique // 订单流水号（唯一）
  refundStatus String   @default("NONE") // 退款状态: NONE, REQUESTED, APPROVED, REJECTED, COMPLETED
  receiptSent  Boolean  @default(false) // 是否已发送付款凭证
}
```

**数据库推送**：
⚠️ 需要手动执行（权限问题）：
```bash
cd /Users/liuyijia/agentcross
npx prisma db push
```

---

### 订单列表 UI 重构 ⏳

**待实现**：
- ⏳ 每一行展示唯一订单号（tradeNo）
- ⏳ 新增『申请退款』按钮（提交审核工单，禁止直接退钱）
- ⏳ 新增『发送付款凭证』按钮

**文件位置**：`/app/(dashboard)/billing/page.tsx`

---

### 凭证发送逻辑 ⏳

**待实现**：
- ⏳ 创建 API 路由：`/api/billing/send-receipt`
- ⏳ 调用 Resend 接口发送 HTML 收据
- ⏳ 使用系统通知域名：`billing@leadpilot.ai`
- ⏳ 生成精美的 HTML 收据模板

---

## ⏳ 第三步：上帝视角服务监控

**待实现**：`/app/(admin)/admin/monitoring/page.tsx`

需要添加：
- ⏳ 主备模型调用状态（DeepSeek/Gemini 延迟监测）
- ⏳ 域名与发信池（Resend 本月已发送 X/50000 封，健康度 99%）
- ⏳ 数据源雷达（Apollo API 剩余查询次数）

---

## ⏳ 第四步：消除白纸恐惧症

**待实现**：`/app/(dashboard)/dashboard/page.tsx`

需要添加：
- ⏳ 3 个『高转化示例模板』Badge
- ⏳ 点击后自动填入指令输入框
- ⏳ 示例模板：
  - "给我找法国的钢筋行业的公司，给它们采购经理发消息。告诉他们我们有XXX优势，如果需要可以联系我们，我们的联系方式是：XXX"
  - "帮我找德国的机械制造公司，联系他们的销售总监..."
  - "搜索意大利的旅游供应商，给他们的业务经理发邮件..."

---

## ⏳ 第五步：个人资料翻新与全局反馈

### 个人资料页面重构 ⏳

**待实现**：`/app/(dashboard)/profile/page.tsx`

需要重构为卡片式高级 UI：
- ⏳ 『企业信息』卡片
- ⏳ 『账户安全』卡片
- ⏳ 『知识库管理』卡片

### 全局反馈按钮 ⏳

**待实现**：
- ⏳ 在全站右下角新增悬浮的『意见反馈』按钮
- ⏳ 弹出精致 Dialog 收集 Bug 或建议
- ⏳ 提交到后端 API 或第三方服务（如 Typeform）

---

## 📋 环境变量清单

**必需配置**（.env.local）：
```bash
# AI 引擎（双引擎容灾）
DEEPSEEK_API_KEY=your-deepseek-key
GEMINI_API_KEY=your-gemini-key

# 邮件服务
RESEND_API_KEY=your-resend-key

# 数据库
DATABASE_URL="file:./prisma/dev.db"

# NextAuth
NEXTAUTH_SECRET=your-super-secret-key
NEXTAUTH_URL=http://localhost:3000

# 基础设施（可选）
NAMECHEAP_API_KEY=your-namecheap-key
CLOUDFLARE_API_KEY=your-cloudflare-key
STRIPE_SECRET_KEY=your-stripe-key
```

---

## 🚀 下一步行动

### 立即执行：
1. ✅ 配置所有必需的环境变量
2. ⏳ 手动执行 `npx prisma db push` 更新数据库
3. ⏳ 重构订单列表 UI（billing/page.tsx）
4. ⏳ 实现凭证发送 API
5. ⏳ 增强监控页面
6. ⏳ 添加示例模板
7. ⏳ 重构个人资料页面
8. ⏳ 添加全局反馈按钮

### 测试清单：
- ⏳ 测试 DeepSeek API 调用
- ⏳ 测试 Gemini 容灾切换
- ⏳ 测试 Resend 邮件发送
- ⏳ 测试订单退款流程
- ⏳ 测试凭证发送功能

---

**生成时间**：2026-03-09 22:10
**状态**：第一步和第二步（部分）已完成，第三至五步待实现
