# NextAuth.js 身份验证与权限系统实现报告

## ✅ 已完成的工作

### 第一步：数据库源头鉴权 ✅

**文件**：`prisma/schema.prisma`

**修改内容**：
1. ✅ 在 User 模型中添加 `role` 字段
   ```prisma
   role String @default("USER") // 用户角色: USER | ADMIN
   ```

2. ✅ 添加 `email` 和 `password` 字段（用于 NextAuth）
   ```prisma
   email    String? @unique
   password String?
   ```

3. ✅ 数据库已同步：`npx prisma db push` 成功

**角色类型**：
- `USER` - 普通用户（默认）
- `ADMIN` - 管理员（上帝视角）

---

### 第二步：NextAuth.js 身份验证增强 ✅

#### 1. **核心配置文件**：`lib/auth.ts`

**关键特性**：

**a) 类型扩展**：
```typescript
declare module "next-auth" {
  interface Session {
    user: {
      id: string
      email: string
      phone: string
      role: string // 【关键】暴露给前端
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: string // 【关键】存储在 JWT 中
  }
}
```

**b) JWT 回调**（核心安全）：
```typescript
async jwt({ token, user, trigger }) {
  // 首次登录：写入 role
  if (user) {
    token.role = user.role
  }

  // 【安全增强】每次刷新时从数据库读取最新 role
  if (trigger === "update" || !user) {
    const dbUser = await prisma.user.findUnique({
      where: { id: token.id },
      select: { role: true }
    })
    if (dbUser) {
      token.role = dbUser.role // 实时更新
    }
  }

  return token
}
```

**c) Session 回调**：
```typescript
async session({ session, token }) {
  session.user = {
    id: token.id,
    email: token.email,
    phone: token.phone,
    role: token.role // 【关键】暴露给前端
  }
  return session
}
```

#### 2. **API 路由**：`app/api/auth/[...nextauth]/route.ts`

```typescript
import NextAuth from "next-auth"
import { authOptions } from "@/lib/auth"

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
```

#### 3. **AuthProvider 组件**：`components/providers/AuthProvider.tsx`

```typescript
"use client"
import { SessionProvider } from "next-auth/react"

export default function AuthProvider({ children }) {
  return <SessionProvider>{children}</SessionProvider>
}
```

#### 4. **Root Layout 集成**：`app/layout.tsx`

```typescript
import AuthProvider from "@/components/providers/AuthProvider"

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
```

---

### 第三步：管理后台权限拦截 ✅

**文件**：`app/(admin)/layout.tsx`

**核心实现**：

```typescript
"use client"
import { useSession } from "next-auth/react"

export default function AdminLayout({ children }) {
  const { data: session, status } = useSession()

  // 加载中
  if (status === "loading") {
    return <LoadingScreen />
  }

  // 未登录
  if (status === "unauthenticated") {
    router.push("/login")
    return null
  }

  // 【最高权限登录拦截鉴权】
  const userRole = session?.user?.role
  
  if (userRole !== "ADMIN") {
    return <AccessDeniedScreen currentRole={userRole} />
  }

  return <AdminPanel>{children}</AdminPanel>
}
```

**安全特性**：
- ✅ 从 `session.user.role` 读取最新权限
- ✅ 非 ADMIN 用户显示"访问被拒绝"
- ✅ 显示当前角色信息
- ✅ 提供返回工作台按钮

---

### 第四步：后端 API 权限验证示例 ✅

**文件**：`app/api/admin/test/route.ts`

```typescript
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET(request: NextRequest) {
  // 【核心安全】获取 session
  const session = await getServerSession(authOptions)

  // 未登录
  if (!session) {
    return NextResponse.json(
      { error: "未登录" },
      { status: 401 }
    )
  }

  // 【权限验证】只有 ADMIN 才能访问
  if (session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "权限不足", currentRole: session.user.role },
      { status: 403 }
    )
  }

  // 管理员操作
  return NextResponse.json({ success: true })
}
```

---

## 📦 需要安装的依赖

**请在终端执行**：

```bash
cd /Users/liuyijia/agentcross
npm install next-auth bcryptjs @types/bcryptjs
```

**依赖说明**：
- `next-auth` - NextAuth.js 核心库
- `bcryptjs` - 密码加密
- `@types/bcryptjs` - TypeScript 类型定义

---

## 🔐 安全架构总结

### 三层防护体系：

#### 1. **数据库层**（源头）
- ✅ User 表中存储 `role` 字段
- ✅ 默认值为 `USER`
- ✅ 只有数据库管理员能修改为 `ADMIN`

#### 2. **JWT Token 层**（传输）
- ✅ 登录时将 `role` 写入加密的 JWT
- ✅ 每次刷新 token 时从数据库重新读取最新 `role`
- ✅ 防止用户被降权后仍使用旧 token

#### 3. **Session 层**（应用）
- ✅ 前端通过 `useSession()` 获取 `session.user.role`
- ✅ 后端通过 `getServerSession()` 获取 `session.user.role`
- ✅ 实时验证权限状态

---

## 🎯 使用方式

### 前端权限验证：

```typescript
"use client"
import { useSession } from "next-auth/react"

export default function MyComponent() {
  const { data: session } = useSession()
  
  if (session?.user?.role === "ADMIN") {
    return <AdminFeature />
  }
  
  return <UserFeature />
}
```

### 后端权限验证：

```typescript
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "权限不足" }, { status: 403 })
  }
  
  // 管理员操作
}
```

---

## 🚀 测试步骤

### 1. 安装依赖
```bash
npm install next-auth bcryptjs @types/bcryptjs
```

### 2. 配置环境变量
在 `.env.local` 中添加：
```
NEXTAUTH_SECRET=your-super-secret-key-change-in-production
NEXTAUTH_URL=http://localhost:3000
```

### 3. 创建测试用户
在数据库中手动创建一个 ADMIN 用户：
```sql
UPDATE User SET role = 'ADMIN' WHERE email = 'admin@example.com';
```

### 4. 测试登录
- 访问 `/login`
- 使用 ADMIN 用户登录
- 访问 `/admin` - 应该能看到管理后台
- 使用普通用户登录
- 访问 `/admin` - 应该看到"访问被拒绝"

### 5. 测试 API
```bash
# 未登录
curl http://localhost:3000/api/admin/test
# 返回: {"error": "未登录"}

# 普通用户
curl -H "Cookie: next-auth.session-token=..." http://localhost:3000/api/admin/test
# 返回: {"error": "权限不足", "currentRole": "USER"}

# 管理员
curl -H "Cookie: next-auth.session-token=..." http://localhost:3000/api/admin/test
# 返回: {"success": true, "message": "欢迎，管理员"}
```

---

## ✅ 安全检查清单

- [x] 数据库中添加 `role` 字段
- [x] JWT Token 包含 `role` 信息
- [x] Session 对象暴露 `role` 给前端
- [x] 每次刷新 token 时重新读取数据库
- [x] 管理后台 Layout 验证 `role === "ADMIN"`
- [x] 后端 API 使用 `getServerSession()` 验证权限
- [x] 未登录用户重定向到登录页
- [x] 非管理员显示"访问被拒绝"
- [x] 显示当前用户角色信息

---

## 🎉 完成状态

**数据库源头鉴权**：✅ 完成
**NextAuth.js 配置**：✅ 完成
**前端权限拦截**：✅ 完成
**后端权限验证**：✅ 完成
**类型定义扩展**：✅ 完成

**待完成**：
- ⏳ 安装 npm 依赖（需要用户手动执行）
- ⏳ 配置 NEXTAUTH_SECRET 环境变量
- ⏳ 创建测试 ADMIN 用户

---

**生成时间**：2026-03-09
**系统版本**：LeadPilot v1.0
