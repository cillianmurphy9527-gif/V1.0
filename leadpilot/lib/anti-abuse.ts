/**
 * 防薅羊毛与反欺诈工具函数
 */

import { prisma } from '@/lib/prisma'
import { headers } from 'next/headers'

/**
 * 获取请求的真实 IP 地址
 */
export function getClientIp(): string {
  const headersList = headers()
  
  const forwardedFor = headersList.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }
  
  const cfConnectingIp = headersList.get('cf-connecting-ip')
  if (cfConnectingIp) {
    return cfConnectingIp
  }
  
  const xRealIp = headersList.get('x-real-ip')
  if (xRealIp) {
    return xRealIp
  }
  
  return '127.0.0.1'
}

/**
 * 检查 IP 是否被黑名单
 */
export async function isIpBlacklisted(ipAddress: string): Promise<boolean> {
  try {
    const blacklisted = await prisma.ipBlacklist.findUnique({
      where: { ipAddress }
    })
    
    if (!blacklisted) {
      return false
    }
    
    if (blacklisted.expiresAt && blacklisted.expiresAt < new Date()) {
      await prisma.ipBlacklist.delete({
        where: { ipAddress }
      })
      return false
    }
    
    return true
  } catch (error) {
    console.error('Failed to check IP blacklist:', error)
    return false
  }
}

/**
 * 检查 IP 注册频率（防刷）
 */
export async function checkIpRegistrationCount(ipAddress: string): Promise<number> {
  try {
    const count = await prisma.ipRegistrationLog.count({
      where: { ipAddress }
    })
    return count
  } catch (error) {
    console.error('Failed to check IP registration count:', error)
    return 0
  }
}

/**
 * 记录 IP 注册日志
 */
export async function logIpRegistration(ipAddress: string, userId: string, userEmail: string): Promise<void> {
  try {
    await prisma.ipRegistrationLog.create({
      data: {
        ipAddress,
        userId,
        userEmail
      }
    })
  } catch (error) {
    console.error('Failed to log IP registration:', error)
  }
}

/**
 * 执行完整的防薅羊毛检查
 */
export async function performAntiAbuseCheck(ipAddress: string): Promise<{
  allowed: boolean
  reason?: string
}> {
  try {
    // 1. 检查 IP 黑名单
    const isBlacklisted = await isIpBlacklisted(ipAddress)
    if (isBlacklisted) {
      return {
        allowed: false,
        reason: '该 IP 已被系统安全拦截'
      }
    }
    
    // 2. 检查 IP 注册频率（限制为最多 2 个账号）
    const registrationCount = await checkIpRegistrationCount(ipAddress)
    if (registrationCount >= 2) {
      return {
        allowed: false,
        reason: '该 IP 已达到注册上限，请使用已注册账号或已开通套餐的账号进行登录。'
      }
    }
    
    return { allowed: true }
  } catch (error) {
    console.error('Anti-abuse check failed:', error)
    return { allowed: true }
  }
}
