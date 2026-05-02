import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'

export type AdminRole = 'SUPER_ADMIN' | 'FINANCE' | 'OPS'

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

  const adminRole = (session.user as any).adminRole as string | null | undefined
  const userRole = (session.user as any).role as string | null | undefined

  console.log('[requireAdminRole] 当前用户信息:', {
    userId: session.user.id,
    email: (session.user as any).email,
    adminRole: adminRole,
    userRole: userRole,
  })

  // 判断是否有管理员权限：adminRole 非空 或 userRole 为 ADMIN/SUPER_ADMIN
  const hasAdminRole = !!(
    adminRole ||
    userRole === 'ADMIN' ||
    userRole === 'SUPER_ADMIN'
  )

  if (!hasAdminRole) {
    console.error('[requireAdminRole] 403 拦截: 当前用户权限不足', {
      adminRole: adminRole,
      userRole: userRole,
    })
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Forbidden: 无管理员权限' },
        { status: 403 }
      ),
    }
  }

  // 有角色限制时，校验是否在允许列表内
  if (allowedRoles && allowedRoles.length > 0) {
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

  const effectiveRole = (adminRole || userRole || 'UNKNOWN') as string

  console.log('[requireAdminRole] 鉴权通过:', {
    email: (session.user as any).email,
    effectiveRole: effectiveRole,
  })

  return { ok: true, session, adminRole: effectiveRole }
}