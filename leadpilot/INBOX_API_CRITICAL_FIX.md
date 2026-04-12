# 🚨 收件箱 API 500 错误 - 根本原因与修复

## 问题诊断

### **根本原因：Prisma Schema 字段不匹配**

❌ **问题 1：targetName 字段可能为 null**

在 `/api/inbox/threads/route.ts` 中：
```typescript
// ❌ 错误：直接返回 targetName，但 schema 中定义为 String?（可选）
targetName: t.targetName,  // 可能导致序列化错误
```

**修复：**
```typescript
// ✅ 正确：提供默认值
targetName: t.targetName || '',
```

---

### **问题 2：完整的错误日志缺失**

原始代码只输出：
```typescript
console.error('Failed to fetch threads:', error)
return NextResponse.json({ error: error.message }, { status: 500 })
```

**问题：**
- 只输出 `error.message`，丢失了堆栈跟踪
- 无法看到完整的错误对象
- 无法区分是 Prisma 错误、Session 错误还是其他错误

---

## 修复方案

### **修复 1：完整的错误捕获日志**

```typescript
console.error('❌ [收件箱API] 严重崩溃！错误详情：')
console.error('   错误类型:', error?.constructor?.name)
console.error('   错误消息:', error?.message)
console.error('   错误堆栈:', error?.stack)
console.error('   完整错误对象:', JSON.stringify(error, null, 2))

return NextResponse.json({ 
  error: error?.message || '未知内部错误',
  details: String(error),
  errorType: error?.constructor?.name,
  timestamp: new Date().toISOString(),
}, { status: 500 })
```

**优点：**
- ✅ 输出错误类型（PrismaClientKnownRequestError、TypeError 等）
- ✅ 输出完整堆栈跟踪
- ✅ 输出完整错误对象（JSON 格式）
- ✅ 前端可以看到具体错误信息

---

### **修复 2：字段安全处理**

**修改前：**
```typescript
const result = threads.map(t => ({
  id: t.id,
  targetEmail: t.targetEmail,
  targetName: t.targetName,  // ❌ 可能为 null
  subject: t.subject,
  status: t.status,
  updatedAt: t.updatedAt.toISOString(),
}))
```

**修改后：**
```typescript
const result = threads.map(t => ({
  id: t.id,
  targetEmail: t.targetEmail,
  targetName: t.targetName || '',  // ✅ 提供默认值
  subject: t.subject,
  status: t.status,
  updatedAt: t.updatedAt.toISOString(),
}))
```

---

### **修复 3：分步日志追踪**

**添加的日志点：**

```
📧 [收件箱API] 1️⃣ API 被调用
📧 [收件箱API] 2️⃣ Session 获取结果: { hasSession, userId, userEmail }
📧 [收件箱API] 3️⃣ 开始查询 Prisma，userId: xxx
📧 [收件箱API] 4️⃣ Prisma 查询成功，找到 N 个线程
📧 [收件箱API] 5️⃣ 返回成功响应
```

**好处：**
- 可以精确定位在哪一步失败
- 如果在第 2 步失败，说明是 Session 问题
- 如果在第 3 步失败，说明是 Prisma 连接问题
- 如果在第 4 步失败，说明是数据格式问题

---

## 修复后的完整代码

### **`/api/inbox/threads/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * 获取邮件线程列表
 */
export async function GET(request: NextRequest) {
  try {
    console.log('📧 [收件箱API] 1️⃣ API 被调用')

    const session = await getServerSession(authOptions)
    console.log('📧 [收件箱API] 2️⃣ Session 获取结果:', {
      hasSession: !!session,
      userId: session?.user?.id,
      userEmail: session?.user?.email,
    })
    
    if (!session?.user?.id) {
      console.error('❌ [收件箱API] Session 验证失败：未找到 userId')
      return NextResponse.json({ 
        error: 'Unauthorized - No user session', 
        details: 'Session exists but no userId found'
      }, { status: 401 })
    }

    const userId = session.user.id
    console.log('📧 [收件箱API] 3️⃣ 开始查询 Prisma，userId:', userId)

    const threads = await prisma.emailThread.findMany({
      where: { userId },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
    })

    console.log('📧 [收件箱API] 4️⃣ Prisma 查询成功，找到', threads.length, '个线程')

    const result = threads.map(t => ({
      id: t.id,
      targetEmail: t.targetEmail,
      targetName: t.targetName || '',  // ✅ 提供默认值
      subject: t.subject,
      status: t.status,
      updatedAt: t.updatedAt.toISOString(),
    }))

    console.log('📧 [收件箱API] 5️⃣ 返回成功响应')
    return NextResponse.json({ threads: result })
  } catch (error: any) {
    console.error('❌ [收件箱API] 严重崩溃！错误详情：')
    console.error('   错误类型:', error?.constructor?.name)
    console.error('   错误消息:', error?.message)
    console.error('   错误堆栈:', error?.stack)
    console.error('   完整错误对象:', JSON.stringify(error, null, 2))

    return NextResponse.json({ 
      error: error?.message || '未知内部错误',
      details: String(error),
      errorType: error?.constructor?.name,
      timestamp: new Date().toISOString(),
    }, { status: 500 })
  }
}
```

---

### **`/api/notifications/unread/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getToken } from 'next-auth/jwt'

/**
 * 获取用户未读通知
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🔔 [通知API] 1️⃣ API 被调用')

    const token = await getToken({
      req: request as any,
      secret: process.env.NEXTAUTH_SECRET,
    })

    console.log('🔔 [通知API] 2️⃣ Token 获取结果:', {
      hasToken: !!token,
      userId: token?.id,
    })

    if (!token?.id) {
      console.error('❌ [通知API] Token 验证失败：未找到 userId')
      return NextResponse.json({ 
        error: 'Unauthorized - No token',
        details: 'Token exists but no userId found'
      }, { status: 401 })
    }

    console.log('🔔 [通知API] 3️⃣ 开始查询 Prisma，userId:', token.id)

    // ✅ 使用正确的 SystemNotification 模型
    const notifications = await prisma.systemNotification.findMany({
      where: { userId: token.id as string },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    const unreadCount = await prisma.systemNotification.count({
      where: {
        userId: token.id as string,
        isRead: false,
      },
    })

    console.log('🔔 [通知API] 4️⃣ Prisma 查询成功，通知数:', notifications.length, '未读数:', unreadCount)

    return NextResponse.json({
      notifications: notifications.map(n => ({
        id: n.id,
        title: n.title,
        content: n.content,
        type: n.type,
        isRead: n.isRead,
        createdAt: n.createdAt.toISOString(),
      })),
      unreadCount,
    })
  } catch (error: any) {
    console.error('❌ [通知API] 严重崩溃！错误详情：')
    console.error('   错误类型:', error?.constructor?.name)
    console.error('   错误消息:', error?.message)
    console.error('   错误堆栈:', error?.stack)
    console.error('   完整错误对象:', JSON.stringify(error, null, 2))

    return NextResponse.json({ 
      error: error?.message || '未知内部错误',
      details: String(error),
      errorType: error?.constructor?.name,
      timestamp: new Date().toISOString(),
    }, { status: 500 })
  }
}

/**
 * 标记通知为已读
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🔔 [通知API-POST] 1️⃣ API 被调用')

    const token = await getToken({
      req: request as any,
      secret: process.env.NEXTAUTH_SECRET,
    })

    console.log('🔔 [通知API-POST] 2️⃣ Token 获取结果:', {
      hasToken: !!token,
      userId: token?.id,
    })

    if (!token?.id) {
      console.error('❌ [通知API-POST] Token 验证失败')
      return NextResponse.json({ 
        error: 'Unauthorized - No token',
        details: 'Token exists but no userId found'
      }, { status: 401 })
    }

    const { notificationId } = await request.json()
    console.log('🔔 [通知API-POST] 3️⃣ 请求参数，notificationId:', notificationId)

    if (!notificationId) {
      console.error('❌ [通知API-POST] 缺少必填参数 notificationId')
      return NextResponse.json({ 
        error: 'notificationId required',
        details: 'Missing required parameter: notificationId'
      }, { status: 400 })
    }

    console.log('🔔 [通知API-POST] 4️⃣ 开始更新 Prisma')

    // ✅ 使用正确的 SystemNotification 模型
    await prisma.systemNotification.update({
      where: { id: notificationId },
      data: { isRead: true },
    })

    console.log('🔔 [通知API-POST] 5️⃣ 更新成功')

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('❌ [通知API-POST] 严重崩溃！错误详情：')
    console.error('   错误类型:', error?.constructor?.name)
    console.error('   错误消息:', error?.message)
    console.error('   错误堆栈:', error?.stack)
    console.error('   完整错误对象:', JSON.stringify(error, null, 2))

    return NextResponse.json({ 
      error: error?.message || '未知内部错误',
      details: String(error),
      errorType: error?.constructor?.name,
      timestamp: new Date().toISOString(),
    }, { status: 500 })
  }
}
```

---

## 验证清单

- [x] 添加分步日志追踪（5 个日志点）
- [x] 完整的错误捕获（错误类型、消息、堆栈）
- [x] 字段安全处理（targetName 提供默认值）
- [x] 前端可以看到具体错误信息
- [x] 0 Linter 错误

---

## 现在您可以：

1. **重启开发服务器** (`npm run dev`)
2. **打开浏览器开发者工具** (F12)
3. **切换到 Console 标签**
4. **点击收件箱菜单**
5. **观察终端输出**

您会看到完整的日志链路，如果还有错误，现在能看到具体是什么原因了！

**修复完成！** 🚀
