import { prisma } from '@/lib/prisma'

/**
 * 邮件合规检查工具库
 * 用于在发送邮件前进行退订列表和风控检查
 */

/**
 * 检查邮箱是否在退订列表中
 */
export async function isEmailUnsubscribed(email: string): Promise<boolean> {
  const unsubscribed = await prisma.unsubscribeList.findUnique({
    where: { email }
  })
  return !!unsubscribed
}

/**
 * 检查用户是否因退信率过高被暂停发信
 */
export async function isUserSendingSuspended(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isSendingSuspended: true }
  })
  return user?.isSendingSuspended || false
}

/**
 * 批量检查邮箱列表，过滤掉已退订的邮箱
 */
export async function filterUnsubscribedEmails(emails: string[]): Promise<string[]> {
  const unsubscribed = await prisma.unsubscribeList.findMany({
    where: {
      email: { in: emails }
    },
    select: { email: true }
  })
  
  const unsubscribedSet = new Set(unsubscribed.map(u => u.email))
  return emails.filter(email => !unsubscribedSet.has(email))
}

/**
 * 记录邮件退信（bounce）
 * 当退信数量超过阈值时，自动暂停用户发信权限
 */
export async function recordEmailBounce(userId: string, email: string, reason?: string): Promise<void> {
  // 增加用户的退信计数
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      bounceCount: { increment: 1 }
    },
    select: {
      bounceCount: true,
      email: true
    }
  })

  console.log(`⚠️ 用户 ${userId} 退信计数: ${user.bounceCount}`)

  // 如果是硬退信（邮箱不存在），直接加入退订列表
  if (reason?.includes('hard bounce') || reason?.includes('invalid')) {
    await prisma.unsubscribeList.create({
      data: {
        email,
        reason: reason || '硬退信 - 邮箱无效',
        source: 'BOUNCE'
      }
    }).catch(() => {
      // 可能已存在，忽略错误
    })
  }

  // 退信率风控：如果退信数量 >= 10，暂停发信权限
  const BOUNCE_THRESHOLD = 10
  if (user.bounceCount >= BOUNCE_THRESHOLD) {
    await prisma.user.update({
      where: { id: userId },
      data: { isSendingSuspended: true }
    })

    // 发送系统通知
    await prisma.systemNotification.create({
      data: {
        userId,
        title: '发信权限已暂停',
        content: `由于您的邮件退信率过高（${user.bounceCount} 次），系统已暂停您的发信权限。请联系客服处理。`,
        type: 'SYSTEM',
        actionUrl: '/dashboard/tickets'
      }
    })

    console.log(`🚨 用户 ${userId} 因退信率过高被暂停发信`)
  }
}

/**
 * 记录用户投诉（complaint）
 * 用户标记为垃圾邮件时调用
 */
export async function recordEmailComplaint(email: string, reason?: string): Promise<void> {
  await prisma.unsubscribeList.create({
    data: {
      email,
      reason: reason || '用户投诉 - 标记为垃圾邮件',
      source: 'COMPLAINT'
    }
  }).catch(() => {
    // 可能已存在，忽略错误
  })

  console.log(`🚨 邮箱因投诉加入退订列表: ${email}`)
}

/**
 * 管理员手动解除用户发信暂停
 */
export async function unsuspendUserSending(userId: string, adminId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      isSendingSuspended: false,
      bounceCount: 0 // 重置退信计数
    }
  })

  // 发送系统通知
  await prisma.systemNotification.create({
    data: {
      userId,
      title: '发信权限已恢复',
      content: '管理员已为您恢复发信权限，退信计数已重置。请注意邮件质量，避免再次被暂停。',
      type: 'SYSTEM'
    }
  })

  console.log(`✅ 管理员 ${adminId} 已解除用户 ${userId} 的发信暂停`)
}

/**
 * 检查 IP 是否在黑名单中
 */
export async function isIpBlacklisted(ipAddress: string): Promise<boolean> {
  const blocked = await prisma.ipBlacklist.findUnique({
    where: { ipAddress }
  })
  
  if (!blocked) return false
  
  // 检查是否已过期
  if (blocked.expiresAt && blocked.expiresAt < new Date()) {
    // 已过期，删除记录
    await prisma.ipBlacklist.delete({
      where: { ipAddress }
    })
    return false
  }
  
  return true
}

/**
 * 将 IP 加入黑名单
 */
export async function addIpToBlacklist(
  ipAddress: string, 
  reason: 'ABUSE' | 'FRAUD' | 'SPAM',
  expiresInDays?: number
): Promise<void> {
  const expiresAt = expiresInDays 
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
    : null

  await prisma.ipBlacklist.create({
    data: {
      ipAddress,
      reason,
      expiresAt
    }
  })

  console.log(`🚫 IP 已加入黑名单: ${ipAddress}, 原因: ${reason}`)
}
