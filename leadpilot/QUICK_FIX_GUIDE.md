# LeadPilot 快速修复指南

## 🚨 必须立即修复的 8 个关键问题

### 问题 1: 环境变量配置不完整

**当前状态**: `.env.local` 中 `DATABASE_URL` 为空

**快速修复**:
```bash
# 编辑 .env.local，添加以下内容
DATABASE_URL="file:./prisma/dev.db"
DEEPSEEK_API_KEY="sk-xxxxx"  # 从 DeepSeek 获取
GEMINI_API_KEY="xxxxx"        # 从 Google Cloud 获取
RESEND_API_KEY="re_xxxxx"     # 从 Resend 获取
TURNSTILE_SECRET_KEY="xxxxx"  # 从 Cloudflare 获取
TURNSTILE_SITE_KEY="xxxxx"    # 从 Cloudflare 获取
REDIS_URL="redis://localhost:6379"  # 可选，开发环境
```

**验证**:
```bash
npm run dev
# 应该能正常启动，无数据库连接错误
```

---

### 问题 2: 硬编码测试账号暴露

**当前状态**: `lib/auth.ts` 中有三个硬编码账号

**快速修复**:

编辑 `lib/auth.ts`，删除以下代码块：

```typescript
// ❌ 删除这整个块
const HARDCODED_USERS = [
  {
    id: 'dev-admin-super',
    phone: '18342297595',
    password: 'jiaofuquan123@',
    email: 'admin@leadpilot.cn',
    role: 'ADMIN',
  },
  {
    id: 'dev-user-dashboard',
    phone: '1390504583@qq.com',
    password: 'jiaofuquan123@',
    email: '1390504583@qq.com',
    role: 'USER',
  },
  {
    id: 'dev-admin-001',
    phone: '00000000000',
    password: 'admin888@',
    email: 'admin2@leadpilot.cn',
    role: 'ADMIN',
  },
]
const hardcoded = HARDCODED_USERS.find(u => u.phone === credentials.phone)
if (hardcoded) {
  if (credentials.password !== hardcoded.password) {
    throw new Error('密码错误')
  }
  return { id: hardcoded.id, email: hardcoded.email, phone: hardcoded.phone, role: hardcoded.role }
}
```

替换为：

```typescript
// ✅ 仅在开发环境中允许测试账号
if (process.env.NODE_ENV === 'development' && process.env.ALLOW_HARDCODED_USERS === 'true') {
  const HARDCODED_USERS = [
    {
      id: 'dev-admin-super',
      phone: '18342297595',
      password: 'jiaofuquan123@',
      email: 'admin@leadpilot.cn',
      role: 'ADMIN',
    },
  ]
  const hardcoded = HARDCODED_USERS.find(u => u.phone === credentials.phone)
  if (hardcoded) {
    if (credentials.password !== hardcoded.password) {
      throw new Error('密码错误')
    }
    return { id: hardcoded.id, email: hardcoded.email, phone: hardcoded.phone, role: hardcoded.role }
  }
}
```

同时在 `lib/auth.ts` 的 JWT 回调中修复：

```typescript
// ❌ 删除这个
const DEV_IDS = ['dev-admin-super', 'dev-user-dashboard', 'dev-admin-001']
if (!DEV_IDS.includes(token.id as string)) {
  // ...
}

// ✅ 改为
if (process.env.NODE_ENV === 'development' && process.env.ALLOW_HARDCODED_USERS === 'true') {
  const DEV_IDS = ['dev-admin-super']
  if (!DEV_IDS.includes(token.id as string)) {
    // ...
  }
} else {
  // 生产环境总是从数据库查询
  const dbUser = await prisma.user.findUnique({
    where: { id: token.id as string },
    select: { role: true }
  })
  if (dbUser) {
    token.role = dbUser.role
  }
}
```

---

### 问题 3: 用户创建逻辑未实现

**当前状态**: `app/api/auth/register/route.ts` 中用户创建代码被注释

**快速修复**:

编辑 `app/api/auth/register/route.ts`，在验证通过后添加：

```typescript
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

// 在 POST 函数中，验证 Turnstile 后添加
if (!turnstileVerified) {
  return NextResponse.json(
    { error: "人机验证失败，请重试" },
    { status: 403 }
  )
}

// ✅ 添加以下代码
// 检查手机号是否已注册
const existingUser = await prisma.user.findUnique({ 
  where: { phone } 
})
if (existingUser) {
  return NextResponse.json({ error: "手机号已注册" }, { status: 409 })
}

// 创建用户
const hashedPassword = await bcrypt.hash(password, 10)
const user = await prisma.user.create({
  data: {
    phone,
    email: phone, // 用手机号作为 email
    password: hashedPassword,
    companyName: username,
    subscriptionTier: "STARTER",
    credits: 0,
    features: JSON.stringify({ canUseInbox: false, aiScoring: false }),
    role: "USER",
    tokenBalance: 50000, // STARTER 套餐初始额度
    monthlyResetAt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1),
  }
})

return NextResponse.json({
  success: true,
  message: "注册成功",
  user: { id: user.id, phone: user.phone, companyName: user.companyName }
})
```

---

### 问题 4: 短信验证码系统未实现

**当前状态**: 验证码仅打印到控制台，无法验证

**快速修复**:

编辑 `app/api/auth/send-code/route.ts`：

```typescript
import { NextRequest, NextResponse } from "next/server"
import Redis from 'ioredis'

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')

export async function POST(request: NextRequest) {
  try {
    const { phone, turnstileToken } = await request.json()

    // 验证必填字段
    if (!phone || !turnstileToken) {
      return NextResponse.json(
        { error: "缺少必填字段" },
        { status: 400 }
      )
    }

    // 验证手机号格式
    const phoneRegex = /^1[3-9]\d{9}$/
    if (!phoneRegex.test(phone)) {
      return NextResponse.json(
        { error: "手机号格式不正确" },
        { status: 400 }
      )
    }

    // 验证 Turnstile Token
    const turnstileVerified = await verifyTurnstileToken(turnstileToken)
    if (!turnstileVerified) {
      return NextResponse.json(
        { error: "人机验证失败，请重试" },
        { status: 403 }
      )
    }

    // ✅ 检查频率限制
    const lastSent = await redis.get(`sms:ratelimit:${phone}`)
    if (lastSent) {
      return NextResponse.json(
        { error: "发送过于频繁，请 60 秒后再试" },
        { status: 429 }
      )
    }

    // ✅ 生成验证码
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString()

    // ✅ 存储到 Redis（5 分钟过期）
    await redis.setex(`sms:${phone}`, 300, verificationCode)
    await redis.setex(`sms:ratelimit:${phone}`, 60, Date.now().toString())

    // 开发环境下打印验证码
    if (process.env.NODE_ENV === 'development') {
      console.log(`📱 验证码: ${verificationCode}`)
    }

    return NextResponse.json({
      success: true,
      message: "验证码已发送"
    })

  } catch (error) {
    console.error("Send code error:", error)
    return NextResponse.json(
      { error: "发送失败，请稍后重试" },
      { status: 500 }
    )
  }
}

async function verifyTurnstileToken(token: string): Promise<boolean> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY
  if (!secretKey) {
    console.error("TURNSTILE_SECRET_KEY not configured")
    return false
  }

  try {
    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: secretKey, response: token }),
      }
    )
    const data = await response.json()
    return data.success === true
  } catch (error) {
    console.error("Turnstile verification error:", error)
    return false
  }
}
```

编辑 `app/api/auth/register/route.ts`，启用验证码验证：

```typescript
// 在创建用户前添加
const storedCode = await redis.get(`sms:${phone}`)
if (!storedCode || storedCode !== verificationCode) {
  return NextResponse.json(
    { error: "验证码错误或已过期" },
    { status: 400 }
  )
}
await redis.del(`sms:${phone}`) // 验证成功后删除
```

---

### 问题 5: 数据库 Schema 与代码不同步

**当前状态**: Schema 中没有 `username` 字段

**快速修复**:

编辑 `prisma/schema.prisma`，在 User 模型中添加：

```prisma
model User {
  id               String         @id @default(uuid())
  phone            String         @unique
  email            String?        @unique
  password         String?
  username         String?        // ✅ 添加此字段
  companyName      String
  // ... 其他字段保持不变
}
```

然后运行迁移：

```bash
npx prisma migrate dev --name add_username_field
```

---

### 问题 6: 配额月度重置逻辑错误

**当前状态**: `lib/quota.ts` 中月度重置时间计算不准确

**快速修复**:

编辑 `lib/quota.ts`，修复 `checkAndDeductQuota` 函数：

```typescript
// ❌ 删除这行
monthlyResetAt: new Date(now.getFullYear(), now.getMonth() + 1, 1),

// ✅ 改为
const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
nextMonth.setHours(0, 0, 0, 0)
monthlyResetAt: nextMonth,
```

同时修复 `lib/feature-gate.ts` 中的相同问题。

---

### 问题 7: 验证码泄露风险

**当前状态**: 生产环境中可能返回验证码

**快速修复**:

编辑 `app/api/auth/send-code/route.ts`：

```typescript
// ❌ 删除这行
...(process.env.NODE_ENV === "development" && { code: verificationCode })

// ✅ 改为
// 仅在明确启用的开发环境中返回
...(process.env.NODE_ENV === 'development' && process.env.SHOW_VERIFICATION_CODE === 'true' && { code: verificationCode })
```

---

### 问题 8: 缺少 CSRF 保护

**当前状态**: 没有 CSRF token 验证

**快速修复**:

创建 `lib/csrf.ts`：

```typescript
import { cookies } from 'next/headers'
import crypto from 'crypto'

export function generateCSRFToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

export function setCSRFCookie(token: string) {
  const cookieStore = cookies()
  cookieStore.set('csrf-token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 24, // 24 小时
  })
}

export function verifyCSRFToken(token: string): boolean {
  const cookieStore = cookies()
  const storedToken = cookieStore.get('csrf-token')?.value
  return storedToken === token
}
```

在所有 POST/PUT/DELETE API 路由中添加验证：

```typescript
import { verifyCSRFToken } from '@/lib/csrf'

export async function POST(request: NextRequest) {
  try {
    const csrfToken = request.headers.get('x-csrf-token')
    if (!csrfToken || !verifyCSRFToken(csrfToken)) {
      return NextResponse.json(
        { error: 'CSRF token invalid' },
        { status: 403 }
      )
    }
    // ... 继续处理请求
  } catch (error) {
    // ...
  }
}
```

---

## 📋 验证清单

修复完成后，按以下顺序验证：

```bash
# 1. 启动开发服务器
npm run dev

# 2. 测试注册流程
# - 访问 /register
# - 输入手机号，点击"获取验证码"
# - 检查控制台是否打印验证码
# - 输入验证码，完成注册
# - 检查数据库中是否创建了用户

# 3. 测试登录流程
# - 访问 /login
# - 用注册的手机号和密码登录
# - 应该能成功登录并跳转到 /dashboard

# 4. 检查数据库
npx prisma studio
# 验证用户数据是否正确保存

# 5. 运行 linter
npm run lint
# 应该没有错误
```

---

## 🔍 检查数据库

```bash
# 打开 Prisma Studio
npx prisma studio

# 检查以下内容：
# 1. User 表中是否有新创建的用户
# 2. 用户的 subscriptionTier 是否为 STARTER
# 3. 用户的 tokenBalance 是否为 50000
# 4. 用户的 role 是否为 USER
```

---

## ⚠️ 注意事项

1. **Redis 依赖**: 短信验证码系统需要 Redis。如果没有 Redis，可以临时使用内存存储（仅开发环境）

2. **API 密钥**: 确保所有 API 密钥都已正确配置，否则相应功能无法工作

3. **数据库迁移**: 修改 Schema 后必须运行 `npx prisma migrate dev`

4. **环境变量**: 生产环境中 `NODE_ENV` 必须设置为 `production`

5. **测试账号**: 生产环境中不要启用硬编码测试账号

---

## 📞 遇到问题？

如果修复过程中遇到问题，检查以下内容：

1. 所有环境变量是否正确配置
2. Redis 是否正常运行
3. 数据库是否正常连接
4. 是否运行了 `npx prisma generate`
5. 是否运行了 `npx prisma db push` 或 `npx prisma migrate dev`

