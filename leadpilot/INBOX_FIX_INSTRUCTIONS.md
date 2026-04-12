# 收件箱数据链路修复说明

## 问题诊断

前端报错：『加载失败：无法加载收件箱数据』

**根本原因：**
1. ❌ Prisma Schema 中 EmailThread 和 EmailMessage 模型字段与前端期望不匹配
2. ❌ 通知 API 返回的数据格式不正确

## 修复步骤

### 第一步：更新数据库模型

已修复 `prisma/schema.prisma` 中的模型定义：

```prisma
model EmailThread {
  id          String         @id @default(uuid())
  userId      String
  targetEmail String         // 收件人邮箱
  targetName  String?        // 收件人姓名
  subject     String         // 邮件主题
  status      String         @default("PENDING") // PENDING, REPLIED, CLOSED
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt
  user        User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  messages    EmailMessage[]
}

model EmailMessage {
  id         String      @id @default(uuid())
  threadId   String
  from       String      // 发件人邮箱
  to         String      // 收件人邮箱
  subject    String      // 邮件主题
  body       String      // 邮件正文
  sentAt     DateTime    @default(now()) // 发送时间
  isFromUser Boolean     @default(false) // 是否是用户发送的
  createdAt  DateTime    @default(now())
  thread     EmailThread @relation(fields: [threadId], references: [id], onDelete: Cascade)
}
```

**执行数据库迁移：**

```bash
cd /Users/liuyijia/Desktop/leadpoilt
npx prisma db push
npx prisma generate
```

### 第二步：修复 API 返回格式

已修复 `/api/notifications/unread/route.ts`：
- ✅ 添加字段映射，确保返回 `title`、`content`、`type`、`isRead`、`createdAt`
- ✅ 日期格式化为 ISO 字符串

### 第三步：验证 API 路由

已确认以下 API 都有完整实现：

1. ✅ `GET /api/inbox/threads` - 获取邮件列表
   - 权限校验：getServerSession
   - 返回字段：id, targetEmail, targetName, subject, status, updatedAt

2. ✅ `GET /api/inbox/threads/[threadId]` - 获取邮件详情
   - 权限校验：getServerSession + 所有权验证
   - 返回完整 thread 对象（包含 messages 数组）

3. ✅ `POST /api/inbox/generate-reply` - 发送回复
   - 权限校验：getServerSession
   - 真实发送邮件并保存记录

4. ✅ `POST /api/inbox/analyze` - AI 意图分析
   - 权限校验：getServerSession
   - 套餐权限检查（PRO/MAX）

5. ✅ `GET /api/notifications/unread` - 获取通知
   - 权限校验：getToken
   - 返回格式化的通知列表

## 修复后的数据流

```
前端 fetch('/api/inbox/threads')
  ↓
后端 getServerSession() 验证身份
  ↓
Prisma 查询 emailThread.findMany({ where: { userId } })
  ↓
返回 JSON { threads: [...] }
  ↓
前端 setThreads(data.threads)
  ↓
渲染邮件列表
```

## 测试清单

执行数据库迁移后，测试以下功能：

- [ ] 打开收件箱页面，不再报错
- [ ] 左侧列表显示邮件（如果有数据）
- [ ] 点击邮件，右侧显示详情
- [ ] 输入回复内容，点击发送
- [ ] 点击 AI 分析按钮，显示分析结果
- [ ] 通知标签显示系统通知

## 注意事项

⚠️ **数据库迁移会清空现有的 EmailThread 和 EmailMessage 表数据！**

如果生产环境有重要数据，请先备份：

```bash
# 备份数据库
cp prisma/dev.db prisma/dev.db.backup

# 执行迁移
npx prisma db push

# 如果出错，恢复备份
cp prisma/dev.db.backup prisma/dev.db
```
