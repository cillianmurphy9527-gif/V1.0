/**
 * 系统通知服务
 * 负责在关键业务事件时发送系统通知给用户
 */

import { prisma } from '@/lib/prisma'

export enum NotificationType {
  REGISTRATION = 'REGISTRATION',      // 注册成功
  PURCHASE = 'PURCHASE',              // 购买成功
  REFUND = 'REFUND',                  // 退款进度
  TICKET_REPLY = 'TICKET_REPLY',      // 工单回复
  SYSTEM = 'SYSTEM',                  // 系统通知
}

interface NotificationPayload {
  userId: string
  title: string
  content: string
  type: NotificationType
  actionUrl?: string
}

/**
 * 发送系统通知
 */
export async function sendNotification(payload: NotificationPayload) {
  try {
    const notification = await prisma.systemNotification.create({
      data: {
        userId: payload.userId,
        title: payload.title,
        content: payload.content,
        type: payload.type,
        actionUrl: payload.actionUrl,
        isRead: false,
      },
    })

    console.log(`✅ 通知已发送: ${payload.title} -> ${payload.userId}`)
    return notification
  } catch (error) {
    console.error('Failed to send notification:', error)
    throw error
  }
}

/**
 * 注册成功通知
 */
export async function notifyRegistrationSuccess(userId: string, email: string) {
  return sendNotification({
    userId,
    title: '🎉 欢迎加入 LeadPilot',
    content: `
      <p>亲爱的用户，欢迎加入 LeadPilot！</p>
      <p>你已成功注册账户，现在可以开始使用我们的服务了。</p>
      <p><strong>你的账户邮箱：</strong> ${email}</p>
      <p>立即前往 <a href="/dashboard" style="color: #3b82f6; text-decoration: underline;">仪表板</a> 开始你的外贸获客之旅吧！</p>
    `,
    type: NotificationType.REGISTRATION,
    actionUrl: '/dashboard',
  })
}

/**
 * 购买成功通知
 */
export async function notifyPurchaseSuccess(
  userId: string,
  planName: string,
  amount: number,
  tradeNo: string
) {
  return sendNotification({
    userId,
    title: '✅ 订单支付成功',
    content: `
      <p>恭喜！你的订单已支付成功。</p>
      <p><strong>套餐：</strong> ${planName}</p>
      <p><strong>金额：</strong> ¥${amount}</p>
      <p><strong>订单号：</strong> ${tradeNo}</p>
      <p>你现在可以享受该套餐的所有功能。如有问题，请 <a href="/support" style="color: #3b82f6; text-decoration: underline;">联系客服</a>。</p>
    `,
    type: NotificationType.PURCHASE,
    actionUrl: '/billing',
  })
}

/**
 * 退款进度通知
 */
export async function notifyRefundProgress(
  userId: string,
  status: 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'COMPLETED',
  amount: number,
  reason?: string
) {
  const statusMap = {
    REQUESTED: '已收到退款申请',
    APPROVED: '退款已批准',
    REJECTED: '退款已拒绝',
    COMPLETED: '退款已完成',
  }

  const statusEmoji = {
    REQUESTED: '📋',
    APPROVED: '✅',
    REJECTED: '❌',
    COMPLETED: '💰',
  }

  return sendNotification({
    userId,
    title: `${statusEmoji[status]} 退款${statusMap[status]}`,
    content: `
      <p>你的退款申请状态已更新。</p>
      <p><strong>状态：</strong> ${statusMap[status]}</p>
      <p><strong>金额：</strong> ¥${amount}</p>
      ${reason ? `<p><strong>备注：</strong> ${reason}</p>` : ''}
      <p>如有疑问，请 <a href="/support" style="color: #3b82f6; text-decoration: underline;">联系客服</a>。</p>
    `,
    type: NotificationType.REFUND,
    actionUrl: '/billing',
  })
}

/**
 * 工单回复通知
 */
export async function notifyTicketReply(
  userId: string,
  ticketId: string,
  ticketTitle: string,
  replyContent: string
) {
  return sendNotification({
    userId,
    title: `💬 工单有新回复：${ticketTitle}`,
    content: `
      <p>你的工单有新回复。</p>
      <p><strong>工单标题：</strong> ${ticketTitle}</p>
      <p><strong>最新回复：</strong></p>
      <blockquote style="border-left: 3px solid #3b82f6; padding-left: 12px; margin: 12px 0; color: #94a3b8;">
        ${replyContent}
      </blockquote>
      <p><a href="/support" style="color: #3b82f6; text-decoration: underline;">查看完整工单</a></p>
    `,
    type: NotificationType.TICKET_REPLY,
    actionUrl: '/support',
  })
}

/**
 * 批量发送通知（用于广播）
 */
export async function sendBulkNotifications(
  userIds: string[],
  title: string,
  content: string,
  type: NotificationType = NotificationType.SYSTEM
) {
  try {
    const result = await prisma.systemNotification.createMany({
      data: userIds.map(userId => ({
        userId,
        title,
        content,
        type,
        isRead: false,
      })),
    })

    console.log(`✅ 批量通知已发送: ${title} -> ${result.count} 位用户`)
    return result
  } catch (error) {
    console.error('Failed to send bulk notifications:', error)
    throw error
  }
}

/**
 * 标记通知为已读
 */
export async function markNotificationAsRead(notificationId: string) {
  return prisma.systemNotification.update({
    where: { id: notificationId },
    data: { isRead: true },
  })
}

/**
 * 标记所有通知为已读
 */
export async function markAllNotificationsAsRead(userId: string) {
  return prisma.systemNotification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  })
}
