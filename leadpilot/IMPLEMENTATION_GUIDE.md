# 防薅羊毛与合规发信机制 - 实施指南

## 📋 已完成的工作

### 1. Prisma Schema 重构

已新增以下模型：

- **DeviceFingerprint** - 设备指纹记录表
  - 记录用户的 IP 地址和设备指纹
  - 标记是否已领取试用（trialClaimed）
  - 防止同一设备/IP 多次领取试用福利

- **IpBlacklist** - IP 黑名单表
  - 记录恶意 IP 地址
  - 支持临时封禁（设置过期时间）和永久封禁
  - 封禁原因：ABUSE（滥用）、FRAUD（欺诈）、SPAM（垃圾邮件）

- **UnsubscribeList** - 退订黑名单表
  - 记录已退订的邮箱地址
  - 来源追踪：USER_REQUEST（用户主动）、BOUNCE（退信）、COMPLAINT（投诉）

- **User 模型更新**
  - bounceCount：累计退信数量
  - isSendingSuspended：是否因退信率过高被暂停发信

### 2. 防薅羊毛注册 API

已更新 `/app/api/auth/register/route.ts`：

**核心防护逻辑：**
1. 检查 IP 是否在黑名单中
2. 检查 IP 是否已领取过试用（查询 DeviceFingerprint 表）
3. 检查设备指纹是否已领取过试用
4. 如果任一检查失败，返回 403 错误："该设备/IP 已享受过试用福利，无法重复领取"

**试用福利：**
- 7 天试用期
- 赠送 500 Tokens
- 赠送 100 封发信量

### 3. 合规发信工具库

已创建以下文件：

- `/lib/email-compliance.ts` - 合规检查核心函数
- `/lib/email-validation.ts` - 发信前验证中间件
- `/lib/device-fingerprint.ts` - 前端设备指纹采集

### 4. 管理后台 API

- `/app/api/admin/blacklist/route.ts` - IP/邮箱黑名单管理
- `/app/api/admin/users/risk/route.ts` - 高风险用户管理
- `/app/api/email/unsubscribe/route.ts` - 退订处理
- `/app/api/email/webhook/route.ts` - 邮件服务商回调
- `/app/api/email/send/route.ts` - 发信示例（集成合规检查）

## 🚀 下一步操作

### 立即执行数据库迁移

```bash
npx prisma db push
```

这将创建新的数据表：
- DeviceFingerprint
- IpBlacklist  
- UnsubscribeList

并更新 User 表，添加 bounceCount 和 isSendingSuspended 字段。

### 前端集成（注册页面）

在注册表单中引入设备指纹采集：

```typescript
import { generateDeviceFingerprint } from '@/lib/device-fingerprint'

const handleRegister = async () => {
  const deviceFingerprint = generateDeviceFingerprint()
  
  const response = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone,
      password,
      username,
      verificationCode,
      turnstileToken,
      deviceFingerprint, // 新增字段
      inviteCode
    })
  })
}
```

### 发送邮件时集成合规检查

在所有发送邮件的地方，使用 `checkBeforeSending` 函数：

```typescript
import { checkBeforeSending } from '@/lib/email-validation'

// 发送前检查
const validation = await checkBeforeSending(userId, recipients)

if (!validation.canSend) {
  return { error: validation.reason }
}

// 使用过滤后的收件人列表
const validRecipients = validation.filteredEmails
```

## 🔐 环境变量配置

已更新 `.env` 文件，请确保配置以下密钥：

- `TURNSTILE_SECRET_KEY` - Cloudflare Turnstile 密钥
- `UNSUBSCRIBE_SECRET` - 退订链接加密密钥
- `EMAIL_WEBHOOK_SECRET` - 邮件服务商 Webhook 验证密钥

## 📊 核心防护机制

### 防薅羊毛
- ✅ IP 地址检查（同一 IP 只能领取一次）
- ✅ 设备指纹检查（同一设备只能领取一次）
- ✅ IP 黑名单机制（封禁恶意 IP）
- ✅ 试用福利限制（500 Tokens + 100 封邮件）

### 合规发信
- ✅ 退订列表检查（发信前自动过滤）
- ✅ 退信率监控（超过 10 次自动暂停）
- ✅ 用户投诉处理（自动加入退订列表）
- ✅ 一键退订链接（符合 CAN-SPAM 法规）

## 🎯 工作流程

### 用户注册流程
1. 前端采集设备指纹
2. 后端检查 IP/设备指纹是否已领取试用
3. 通过检查后创建用户并发放试用福利
4. 记录设备指纹到数据库

### 邮件发送流程
1. 检查用户是否被暂停发信
2. 批量过滤已退订的邮箱
3. 发送邮件（仅发给有效收件人）
4. 监听 Webhook 回调处理退信/投诉

### 风控触发流程
1. 邮件服务商回调退信事件
2. 系统记录退信并增加计数
3. 退信数 >= 10 时自动暂停发信
4. 发送系统通知给用户
5. 管理员审核后可手动恢复

## ✅ 完成状态

所有代码已编写完成，现在请执行：

```bash
npx prisma db push
```

执行后，防薅羊毛和合规发信机制将立即生效。
