/**
 * 多域名交替轮换算法 (Round-Robin Domain Rotation)
 * 
 * 防封号核心：在批量发送中动态切换发信域名
 * 例如：第1封用 a.com，第2封用 b.com，第3封用 c.com
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ─── 获取用户绑定的发信域名 ────────────────────────
export async function getUserDomains(userId: string): Promise<string[]> {
  try {
    const domains = await prisma.domain.findMany({
      where: {
        userId,
        status: 'ACTIVE',
      },
      select: { domainName: true },
      orderBy: { createdAt: 'asc' },
    })

    return domains.map(d => d.domainName)
  } catch (error) {
    console.error('[GetUserDomains] Error:', error)
    return []
  }
}

// ─── 轮换域名选择器 ────────────────────────────────
export function selectDomainByIndex(domains: string[], index: number): string {
  if (domains.length === 0) {
    throw new Error('No domains available for rotation')
  }
  return domains[index % domains.length]
}

// ─── 获取下一个域名索引 ────────────────────────────
export function getNextDomainIndex(currentIndex: number, totalDomains: number): number {
  return (currentIndex + 1) % totalDomains
}

// ─── 批量发送邮件时的域名轮换 ────────────────────
export async function sendEmailsWithDomainRotation(
  userId: string,
  recipients: Array<{ email: string; subject: string; body: string }>,
  sendFunction: (email: string, subject: string, body: string, fromDomain: string) => Promise<void>
): Promise<{ sent: number; failed: number }> {
  const domains = await getUserDomains(userId)

  if (domains.length === 0) {
    throw new Error('User has no active domains for sending')
  }

  let sent = 0
  let failed = 0

  for (let i = 0; i < recipients.length; i++) {
    const recipient = recipients[i]
    // 【核心算法】使用取模运算动态切换域名
    const domain = selectDomainByIndex(domains, i)
    // 随机选用欧美常见高管名字，极大提升邮件打开率
    const senderNames = ['alex', 'david', 'michael', 'sarah', 'jessica'];
    const randomName = senderNames[Math.floor(Math.random() * senderNames.length)];
    const fromEmail = `${randomName}@${domain}`;

    try {
      await sendFunction(recipient.email, recipient.subject, recipient.body, fromEmail)
      sent++
      console.log(`[DomainRotation] Email ${i + 1}/${recipients.length} sent from ${fromEmail}`)
    } catch (error) {
      failed++
      console.error(`[DomainRotation] Failed to send email ${i + 1} from ${fromEmail}:`, error)
    }
  }

  return { sent, failed }
}

// ─── 获取用户可用域名数量 ────────────────────────
export async function getUserDomainCount(userId: string): Promise<number> {
  try {
    const count = await prisma.domain.count({
      where: {
        userId,
        status: 'ACTIVE',
      },
    })
    return count
  } catch (error) {
    console.error('[GetUserDomainCount] Error:', error)
    return 0
  }
}

// ─── 验证用户是否有足够的域名 ────────────────────
export async function validateUserDomains(userId: string, minRequired: number = 1): Promise<boolean> {
  const count = await getUserDomainCount(userId)
  return count >= minRequired
}

// ─── 获取域名轮换统计 ────────────────────────────
export async function getDomainRotationStats(userId: string) {
  try {
    const domains = await getUserDomains(userId)
    const count = domains.length

    return {
      totalDomains: count,
      domains,
      rotationPattern: count > 0 ? `Rotating every ${count} emails` : 'No domains available',
    }
  } catch (error) {
    console.error('[GetDomainRotationStats] Error:', error)
    return {
      totalDomains: 0,
      domains: [],
      rotationPattern: 'Error retrieving stats',
    }
  }
}
