import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'

export type AdminRole = 'SUPER_ADMIN' | 'FINANCE' | 'OPS'

// 超管邮箱绝对白名单
const SUPER_ADMIN_EMAILS = [
  'admin@leadpilot.cn',
  'admin@example.com',
]

/**
 * 校验请求是否来自合法的内部管理员。
 * allowedRoles 为空时，只要 adminRole 非 null 即可通过。
 * 返回 { session, user } 表示通过，返回 NextResponse 表示失败。
 */
export async function requireAdminRole(
  allowedRoles?: AdminRole[]
): Promise<
  | { ok: true; session: Awaited<ReturnType<typeof getServerSession>>; adminRole: string }
  | { ok: false; response: NextResponse }
> {
  const session = await getServerSession(authOptions)

  // 未登录
  if (!session?.user?.id) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  const userEmail = (session.user as any).email as string | null | undefined
  const adminRole = (session.user as any).adminRole as string | null | undefined
  const userRole = (session.user as any).role as string | null | undefined

  console.log('[requireAdminRole] 当前用户信息:', {
    userId: session.user.id,
    email: userEmail,
    adminRole: adminRole,
    userRole: userRole,
  })

  // 【核心修复】：超管邮箱绝对白名单放行
  const isSuperAdminEmail = userEmail && SUPER_ADMIN_EMAILS.includes(userEmail.toLowerCase())

  // 【核心修复】：兼容多种角色字段判断
  const hasAdminRole = !!(
    adminRole || // 数据库中的 adminRole 字段
    userRole === 'ADMIN' ||
    userRole === 'SUPER_ADMIN' ||
    userRole === 'admin'
  )

  // 如果既不是超管邮箱，也没有 admin 角色，则拒绝
  if (!isSuperAdminEmail && !hasAdminRole) {
    console.error('[requireAdminRole] 403 拦截: 当前用户权限不足', {
      email: userEmail,
      adminRole: adminRole,
      userRole: userRole,
    })
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Forbidden: 无管理员权限', details: { email: userEmail, adminRole, userRole } },
        { status: 403 }
      ),
    }
  }

  // 有角色限制时，校验是否在允许列表内（超管邮箱不受此限制）
  if (!isSuperAdminEmail && allowedRoles && allowedRoles.length > 0) {
    const effectiveRole = adminRole || userRole
    if (effectiveRole && !allowedRoles.includes(effectiveRole as AdminRole)) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: `Forbidden: 当前角色 ${effectiveRole} 无权访问此接口` },
          { status: 403 }
        ),
      }
    }
  }

  // 超管邮箱放行，使用默认的 SUPER_ADMIN 角色
  const effectiveRole = isSuperAdminEmail ? 'SUPER_ADMIN' : (adminRole || userRole || 'UNKNOWN')

  console.log('[requireAdminRole] 鉴权通过:', {
    email: userEmail,
    effectiveRole: effectiveRole,
    isSuperAdminEmail: isSuperAdminEmail,
  })

  return { ok: true, session, adminRole: effectiveRole as string }
}
