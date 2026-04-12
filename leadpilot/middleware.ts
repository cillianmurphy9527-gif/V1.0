/**
 * 铁血风控 - 全局限流中间件
 * 
 * 核心策略：
 * 1. 同一 userId 每分钟最多 10 次关键请求
 * 2. 超出直接返回 429
 * 3. 使用滑动窗口算法统计请求频率
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN']

// ─── 限流配置 ─────────────────────────────────────────
const RATE_LIMIT_CONFIG = {
  // 每分钟最大请求次数
  MAX_REQUESTS_PER_MINUTE: 10,
  
  // 滑动窗口时间（毫秒）
  WINDOW_MS: 60 * 1000, // 1 分钟
  
  // 需要限流的 API 路由前缀
  PROTECTED_ROUTES: [
    '/api/nova',
    '/api/campaigns',
    '/api/knowledge-base',
    '/api/leads',
  ],
}

// ─── 内存限流存储 ─────────────────────────────────────
// 生产环境建议使用 Redis
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

/**
 * 清理过期记录（每小时执行一次）
 */
function cleanupExpiredEntries() {
  const now = Date.now()
  for (const [key, value] of rateLimitStore.entries()) {
    if (value.resetAt < now) {
      rateLimitStore.delete(key)
    }
  }
}

// 每小时清理一次
setInterval(cleanupExpiredEntries, 60 * 60 * 1000)

/**
 * 限流检查
 * @returns { allowed: boolean, remaining: number, resetAt: number }
 */
function checkRateLimit(userId: string): {
  allowed: boolean
  remaining: number
  resetAt: number
  retryAfter?: number
} {
  const now = Date.now()
  const key = `rate_limit:${userId}`
  const entry = rateLimitStore.get(key)

  // 无记录或已过期，创建新记录
  if (!entry || entry.resetAt < now) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + RATE_LIMIT_CONFIG.WINDOW_MS,
    })
    return {
      allowed: true,
      remaining: RATE_LIMIT_CONFIG.MAX_REQUESTS_PER_MINUTE - 1,
      resetAt: now + RATE_LIMIT_CONFIG.WINDOW_MS,
    }
  }

  // 检查是否超限
  if (entry.count >= RATE_LIMIT_CONFIG.MAX_REQUESTS_PER_MINUTE) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
      retryAfter: Math.ceil((entry.resetAt - now) / 1000),
    }
  }

  // 计数 +1
  entry.count++
  return {
    allowed: true,
    remaining: RATE_LIMIT_CONFIG.MAX_REQUESTS_PER_MINUTE - entry.count,
    resetAt: entry.resetAt,
  }
}

// ─── 主中间件 ─────────────────────────────────────────
export async function middleware(request: NextRequest) {
  // 开发环境放行：跳过所有限流检查
  if (process.env.NODE_ENV === 'development') {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl

  // ─── Admin 路由绝对拦截 ──────────────────────────────
  if (pathname.startsWith('/admin')) {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    })

    if (!token || !ADMIN_ROLES.includes(token.role as string)) {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      url.searchParams.set('error', 'AccessDenied')
      return NextResponse.redirect(url)
    }
  }

  // ─── API 限流检查 ────────────────────────────────────
  const shouldRateLimit = RATE_LIMIT_CONFIG.PROTECTED_ROUTES.some(
    route => pathname.startsWith(route)
  )

  if (shouldRateLimit) {
    // 获取用户身份
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    })

    if (token?.id) {
      const result = checkRateLimit(token.id as string)

      if (!result.allowed) {
        const response = NextResponse.json(
          {
            error: '请求过于频繁，请稍后再试',
            code: 'RATE_LIMIT_EXCEEDED',
            retryAfter: result.retryAfter,
            resetAt: new Date(result.resetAt).toISOString(),
          },
          { status: 429 }
        )

        // 添加标准限流响应头
        response.headers.set('X-RateLimit-Limit', String(RATE_LIMIT_CONFIG.MAX_REQUESTS_PER_MINUTE))
        response.headers.set('X-RateLimit-Remaining', '0')
        response.headers.set('X-RateLimit-Reset', String(Math.floor(result.resetAt / 1000)))
        response.headers.set('Retry-After', String(result.retryAfter))

        return response
      }

      // 添加限流信息到响应头
      const response = NextResponse.next()
      response.headers.set('X-RateLimit-Limit', String(RATE_LIMIT_CONFIG.MAX_REQUESTS_PER_MINUTE))
      response.headers.set('X-RateLimit-Remaining', String(result.remaining))
      response.headers.set('X-RateLimit-Reset', String(Math.floor(result.resetAt / 1000)))
      
      return response
    }
  }

  return NextResponse.next()
}

// ─── 匹配规则 ─────────────────────────────────────────
export const config = {
  matcher: [
    '/admin/:path*',
    '/api/nova/:path*',
    '/api/campaigns/:path*',
    '/api/knowledge-base/:path*',
    '/api/leads/:path*',
  ],
}
