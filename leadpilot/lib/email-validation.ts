import { prisma } from '@/lib/prisma'
import { isEmailUnsubscribed, isUserSendingSuspended } from './email-compliance'

/**
 * 发信前置检查中间件
 * 在所有发送邮件的 API 中调用此函数进行合规检查
 */

export interface EmailValidationResult {
  canSend: boolean
  reason?: string
  filteredEmails?: string[]
}

/**
 * 检查用户是否可以发送邮件
 */
export async function validateEmailSending(userId: string): Promise<EmailValidationResult> {
  // 1. 检查用户是否被暂停发信
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      isSendingSuspended: true,
      bounceCount: true,
      subscriptionTier: true,
      trialEndsAt: true
    }
  })

  if (!user) {
    return { canSend: false, reason: "用户不存在" }
  }

  if (user.isSendingSuspended) {
    return { 
      canSend: false, 
      reason: `发信权限已暂停（退信次数: ${user.bounceCount}），请联系客服` 
    }
  }

  // 2. 检查试用是否过期
  if (user.subscriptionTier === 'TRIAL' && user.trialEndsAt && user.trialEndsAt < new Date()) {
    return { 
      canSend: false, 
      reason: "试用期已结束，请升级套餐" 
    }
  }

  return { canSend: true }
}

/**
 * 批量验证收件人邮箱列表
 * 过滤掉已退订的邮箱
 */
export async function validateRecipients(emails: string[]): Promise<EmailValidationResult> {
  if (!emails || emails.length === 0) {
    return { canSend: false, reason: "收件人列表为空" }
  }

  // 批量查询退订列表
  const unsubscribed = await prisma.unsubscribeList.findMany({
    where: {
      email: { in: emails }
    },
    select: { email: true }
  })

  const unsubscribedSet = new Set(unsubscribed.map(u => u.email))
  const filteredEmails = emails.filter(email => !unsubscribedSet.has(email))

  if (filteredEmails.length === 0) {
    return { 
      canSend: false, 
      reason: "所有收件人均已退订" 
    }
  }

  if (unsubscribed.length > 0) {
    console.log(`⚠️ 已过滤 ${unsubscribed.length} 个已退订邮箱`)
  }

  return { 
    canSend: true, 
    filteredEmails 
  }
}

/**
 * 完整的发信前检查流程
 * 在发送邮件前调用此函数
 */
export async function checkBeforeSending(
  userId: string, 
  recipients: string[]
): Promise<EmailValidationResult> {
  // 1. 检查用户发信权限
  const userCheck = await validateEmailSending(userId)
  if (!userCheck.canSend) {
    return userCheck
  }

  // 2. 检查并过滤收件人
  const recipientCheck = await validateRecipients(recipients)
  if (!recipientCheck.canSend) {
    return recipientCheck
  }

  return {
    canSend: true,
    filteredEmails: recipientCheck.filteredEmails
  }
}
