# 🚀 第二阶段快速集成指南

## 第一步：数据库迁移（5 分钟）

```bash
# 1. 生成迁移文件
npx prisma migrate dev --name add_notifications_and_broadcast

# 2. 验证迁移成功
npx prisma studio
# 应该能看到 SystemNotification 和 BroadcastMessage 表
```

---

## 第二步：测试收件箱功能（10 分钟）

### 访问收件箱
```
http://localhost:8080/inbox
```

### 验证功能
- [ ] 左侧显示『🔔 系统通知』频道（蓝色高亮）
- [ ] 频道上显示红点和未读数量
- [ ] 点击邮件时，右侧显示发件人邮箱地址（蓝色高亮）
- [ ] 邮件状态显示在邮箱地址旁边

---

## 第三步：测试 Admin 广播（10 分钟）

### 访问广播中心
```
http://localhost:8080/admin/broadcast
```

### 验证功能
- [ ] 侧边栏显示『📢 站内信与广播』菜单
- [ ] 可以选择目标用户（全部/入门版/专业版/旗舰版）
- [ ] 可以输入标题和内容
- [ ] 支持 HTML 富文本格式
- [ ] 点击发送后显示成功提示

### 测试发送广播
```javascript
// 在浏览器控制台执行
fetch('/api/admin/broadcast', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: '测试通知',
    content: '<p>这是一条测试通知</p>',
    targetPlan: 'ALL'
  })
})
.then(r => r.json())
.then(d => console.log(d))
```

---

## 第四步：集成业务逻辑（20 分钟）

### 在注册成功时发送通知

**文件**: `app/api/auth/register/route.ts`

```typescript
import { notifyRegistrationSuccess } from '@/services/NotificationService'

// 在用户创建成功后添加
await notifyRegistrationSuccess(user.id, user.email || user.phone)
```

### 在购买成功时发送通知

**文件**: `app/api/payment/webhook/route.ts` (需要创建)

```typescript
import { notifyPurchaseSuccess } from '@/services/NotificationService'

// 在支付成功后添加
await notifyPurchaseSuccess(userId, planName, amount, tradeNo)
```

### 在工单回复时发送通知

**文件**: `app/api/support/tickets/[ticketId]/reply/route.ts` (需要创建)

```typescript
import { notifyTicketReply } from '@/services/NotificationService'

// 在管理员回复工单后添加
await notifyTicketReply(userId, ticketId, ticketTitle, replyContent)
```

---

## 第五步：集成邮件服务（可选，待后续）

### 配置 Resend（推荐）

```typescript
// 在 NotificationService.ts 中添加
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

async function sendEmailNotification(email: string, title: string, content: string) {
  await resend.emails.send({
    from: 'noreply@leadpilot.com',
    to: email,
    subject: title,
    html: content,
  })
}
```

### 或配置阿里云邮件推送

```typescript
// 在 NotificationService.ts 中添加
import * as dm20151123 from '@alicloud/dm20151123'

const client = new dm20151123.default({
  accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID,
  accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET,
})

async function sendEmailNotification(email: string, title: string, content: string) {
  await client.singleSendMail({
    accountName: 'noreply@leadpilot.com',
    toAddress: email,
    subject: title,
    htmlBody: content,
  })
}
```

---

## 验证清单

### 数据库
- [ ] `SystemNotification` 表已创建
- [ ] `BroadcastMessage` 表已创建
- [ ] 索引已创建：`@@index([userId, isRead])`

### 前端
- [ ] 收件箱页面显示系统通知频道
- [ ] 邮箱地址在详情页显示
- [ ] 红点未读角标正常显示
- [ ] Admin 侧边栏显示广播菜单

### API
- [ ] `GET /api/notifications/unread` 返回正确数据
- [ ] `POST /api/notifications/unread` 可标记为已读
- [ ] `POST /api/admin/broadcast` 可发送广播
- [ ] `GET /api/admin/broadcast` 可获取历史

### 业务逻辑
- [ ] 注册时调用通知服务
- [ ] 购买时调用通知服务
- [ ] 工单回复时调用通知服务

---

## 常见问题

### Q: 如何测试通知功能？
A: 
1. 创建两个测试用户
2. 用 Admin 账号发送广播
3. 用普通用户账号登录，检查收件箱是否收到通知

### Q: 如何自定义通知内容？
A: 编辑 `services/NotificationService.ts` 中的通知模板

### Q: 如何添加新的通知类型？
A: 
1. 在 `NotificationType` 枚举中添加新类型
2. 创建对应的通知函数
3. 在业务逻辑中调用

### Q: 邮件发送如何对接？
A: 
1. 安装 Resend 或阿里云 SDK
2. 在 `NotificationService.ts` 中添加邮件发送逻辑
3. 在 `sendNotification()` 函数中调用邮件服务

---

## 下一步建议

1. **立即做**
   - 运行数据库迁移
   - 测试收件箱和广播功能
   - 集成业务逻辑

2. **本周做**
   - 集成邮件服务
   - 添加邮件模板
   - 完整功能测试

3. **后续优化**
   - 实现定时广播
   - 添加通知偏好设置
   - 实现通知分类和过滤

---

## 支持

如有问题，请参考：
- `PHASE_2_COMPLETION.md` - 完整功能说明
- `app/(dashboard)/inbox/page.tsx` - 收件箱实现
- `app/(admin)/admin/broadcast/page.tsx` - 广播实现
- `services/NotificationService.ts` - 通知服务

