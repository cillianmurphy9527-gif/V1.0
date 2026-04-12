"use client"

import { ReactNode, useMemo } from "react"
import { useRouter, usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { 
  Shield, 
  LayoutDashboard,
  Users,
  TrendingUp,
  Ticket,
  Activity,
  MessageSquare,
  ShoppingCart,
  LogOut,
  Megaphone,
  Settings as SettingsIcon,
  User as UserIcon,
  UserCog
} from "lucide-react"
import { MobileNav } from "@/components/admin/MobileNav"

type AdminRole = 'SUPER_ADMIN' | 'FINANCE' | 'OPS' | null | undefined

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: '超级管理员',
  FINANCE: '财务',
  OPS: '运营',
  ADMIN: '管理员',
}

// 每个菜单项允许访问的角色（空数组 = 所有内部员工可见）
const ALL_NAV_ITEMS = [
  {
    name: "概览看板",
    href: "/admin",
    icon: LayoutDashboard,
    description: "全局数据总览",
    roles: [] as string[], // 所有角色可见
  },
  {
    name: "用户管理",
    href: "/admin/users",
    icon: Users,
    description: "用户资产与权限",
    roles: ['SUPER_ADMIN'],
  },
  {
    name: "财务流水",
    href: "/admin/financial",
    icon: TrendingUp,
    description: "订单与退款审核",
    roles: ['SUPER_ADMIN', 'FINANCE'],
  },
  {
    name: "卡包管理",
    href: "/admin/coupons",
    icon: Ticket,
    description: "优惠券发放",
    roles: ['SUPER_ADMIN'],
  },
  {
    name: "工单大厅",
    href: "/admin/tickets",
    icon: MessageSquare,
    description: "用户工单与回复",
    roles: ['SUPER_ADMIN', 'OPS'],
  },
  {
    name: "订单管理",
    href: "/admin/orders",
    icon: ShoppingCart,
    description: "支付与退款审核",
    roles: ['SUPER_ADMIN', 'FINANCE'],
  },
  {
    name: "Nova 监控",
    href: "/admin/monitoring",
    icon: Activity,
    description: "API 额度与队列",
    roles: ['SUPER_ADMIN'],
  },
  {
    name: "📢 站内信与广播",
    href: "/admin/broadcast",
    icon: Megaphone,
    description: "向全站用户发送通知",
    roles: ['SUPER_ADMIN', 'OPS'],
  },
  {
    name: "⚙️ 系统配置",
    href: "/admin/settings",
    icon: SettingsIcon,
    description: "CMS 配置中心",
    roles: ['SUPER_ADMIN', 'OPS'],
  },
  {
    name: "员工与权限",
    href: "/admin/staff",
    icon: UserCog,
    description: "内部员工角色管理",
    roles: ['SUPER_ADMIN'],
  },
  {
    name: "个人资料",
    href: "/admin/profile",
    icon: UserIcon,
    description: "账号与权限",
    roles: [] as string[], // 所有角色可见
  },
]

function getNavItems(adminRole: AdminRole) {
  if (!adminRole) return []
  return ALL_NAV_ITEMS.filter(item =>
    item.roles.length === 0 || item.roles.includes(adminRole)
  )
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { data: session, status } = useSession()

  const displayEmail = session?.user?.email || '—'
  const adminRole = (session?.user as any)?.adminRole as AdminRole
  const legacyRole = session?.user?.role || '—'
  // 兼容旧 role 字段：ADMIN/SUPER_ADMIN 也视为有权限
  const isAuthed = status === 'authenticated'
  const hasAccess = !!adminRole || legacyRole === 'ADMIN' || legacyRole === 'SUPER_ADMIN'

  const roleLabel = adminRole
    ? (ROLE_LABEL[adminRole] ?? adminRole)
    : (ROLE_LABEL[legacyRole] ?? legacyRole)

  const navItems = useMemo(() => {
    // 若有 adminRole 字段则按新 RBAC 过滤，否则 fallback 展示全部（兼容旧 ADMIN）
    if (adminRole) return getNavItems(adminRole)
    if (legacyRole === 'ADMIN' || legacyRole === 'SUPER_ADMIN') {
      return ALL_NAV_ITEMS
    }
    return []
  }, [adminRole, legacyRole])

  const handleLogout = async () => {
    await signOut({ redirect: false })
    router.push("/admin-login")
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* 移动端导航 */}
      <MobileNav
        navItems={navItems}
        userEmail={displayEmail}
        onLogout={handleLogout}
      />

      {/* 桌面端侧边栏 */}
      <aside className="hidden md:flex w-64 h-screen sticky top-0 border-r border-slate-800 bg-slate-950/80 backdrop-blur-xl flex-col">
        {/* Logo 区域 */}
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-6 h-6 text-amber-500" />
            <span className="text-xl font-bold text-white">管理后台</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-amber-500/20 border border-amber-500/30 rounded text-xs text-amber-400 font-medium">
              {roleLabel}
            </span>
            <span className="text-xs text-slate-500">
              {status === 'loading' ? '鉴权中' : isAuthed ? (hasAccess ? '已授权' : '权限不足') : '未登录'}
            </span>
          </div>
        </div>

        {/* 导航菜单 */}
        <nav className="flex-1 overflow-y-auto p-4">
          <div className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all group ${
                    isActive
                      ? "bg-amber-500/20 border border-amber-500/30 text-amber-400"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent"
                  }`}
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{item.name}</div>
                    <div className={`text-xs mt-0.5 ${
                      isActive ? 'text-amber-400/70' : 'text-slate-500 group-hover:text-slate-400'
                    }`}>
                      {item.description}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </nav>

        {/* 底部用户信息 + 登出 */}
        <div className="p-4 border-t border-slate-800 space-y-3">
          <div className="px-3 py-3 bg-slate-800/40 rounded-lg border border-slate-700/50">
            <div className="text-xs text-slate-500 mb-1">登录账号</div>
            <div className="text-sm text-white font-medium truncate">
              {status === 'loading'
                ? <div className="h-4 w-32 bg-slate-700 rounded animate-pulse" />
                : displayEmail}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              {status === 'loading'
                ? <div className="h-3 w-16 bg-slate-700 rounded animate-pulse mt-1" />
                : roleLabel}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-semibold transition-all shadow-lg shadow-amber-500/20"
          >
            <LogOut className="w-4 h-4" />
            <span>退出登录</span>
          </button>
        </div>
      </aside>

      {/* 主内容区 */}
      <main className="flex-1 overflow-auto pt-16 md:pt-0">
        {status === 'loading' ? (
          <div className="p-10 text-slate-400">加载中...</div>
        ) : !isAuthed ? (
          <div className="p-10">
            <div className="text-white font-semibold mb-2">需要登录</div>
            <Link className="text-blue-400 underline" href="/admin-login">前往管理员登录</Link>
          </div>
        ) : !hasAccess ? (
          <div className="p-10">
            <div className="text-white font-semibold mb-2">访问被拒绝</div>
            <div className="text-slate-400 text-sm">当前账号不具备管理员权限。</div>
          </div>
        ) : (
          children
        )}
      </main>
    </div>
  )
}
