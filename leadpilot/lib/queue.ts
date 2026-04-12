/**
 * BullMQ 队列系统 - VIP 插队与优先级调度
 * 
 * 核心特性：
 * 1. 根据用户套餐等级注入优先级
 * 2. 旗舰版 (MAX) → priority: 1（最高）
 * 3. 专业版 (PRO) → priority: 2
 * 4. 入门版 (STARTER) → priority: 3（普通）
 */

import { prisma } from '@/lib/prisma'

// ─── 获取用户优先级 ────────────────────────────────
export async function getUserPriority(userId: string): Promise<number> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { subscriptionTier: true },
    })

    if (!user) return 3 // 默认普通优先级

    switch (user.subscriptionTier) {
      case 'MAX':
        return 1 // 最高优先级（VIP 插队）
      case 'PRO':
        return 2 // 中等优先级
      case 'STARTER':
      default:
        return 3 // 普通优先级
    }
  } catch (error) {
    console.error('[GetUserPriority] Error:', error)
    return 3
  }
}

// ─── 任务数据结构 ────────────────────────────────
export interface EmailJobData {
  userId: string
  to: string
  subject: string
  body: string
  domain: string
  domainIndex: number
}

export interface SearchJobData {
  userId: string
  country: string
  industry: string
  limit: number
}

// ─── 发送邮件任务生产者 ────────────────────────────
export async function createEmailJob(
  userId: string,
  emailData: {
    to: string
    subject: string
    body: string
    domain: string
    domainIndex: number
  }
): Promise<EmailJobData> {
  return {
    userId,
    ...emailData,
  }
}

// ─── 客户搜索任务生产者 ────────────────────────────
export async function createSearchJob(
  userId: string,
  searchParams: {
    country: string
    industry: string
    limit: number
  }
): Promise<SearchJobData> {
  return {
    userId,
    ...searchParams,
  }
}

// ─── 获取优先级配置 ────────────────────────────────
export function getPriorityConfig(priority: number) {
  return {
    priority,
    attempts: 3,
    backoff: {
      type: 'exponential' as const,
      delay: 2000,
    },
    removeOnComplete: true,
  }
}
