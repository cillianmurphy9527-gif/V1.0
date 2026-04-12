'use client'

import { useState } from 'react'
import { Menu, X, Shield } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface NavItem {
  name: string
  href: string
  icon: React.ElementType
  description: string
}

interface MobileNavProps {
  navItems: NavItem[]
  userEmail: string
  onLogout: () => void
}

export function MobileNav({ navItems, userEmail, onLogout }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()

  return (
    <>
      {/* 移动端顶部 Navbar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-xl border-b border-slate-800">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => setIsOpen(true)}
            className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <Menu className="w-6 h-6 text-white" />
          </button>
          
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-amber-500" />
            <span className="text-lg font-bold text-white">管理后台</span>
          </div>
          
          <div className="w-10" /> {/* 占位，保持居中 */}
        </div>
      </div>

      {/* 移动端抽屉遮罩 */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* 移动端抽屉菜单 */}
      <div
        className={`md:hidden fixed top-0 left-0 bottom-0 w-80 max-w-[85vw] bg-slate-950 border-r border-slate-800 z-50 transform transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* 抽屉头部 */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-amber-500" />
            <span className="text-xl font-bold text-white">管理后台</span>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
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
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                    isActive
                      ? "bg-amber-500/20 border border-amber-500/30 text-amber-400"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent"
                  }`}
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{item.name}</div>
                    <div className={`text-xs mt-0.5 ${isActive ? 'text-amber-400/70' : 'text-slate-500'}`}>
                      {item.description}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </nav>

        {/* 底部用户信息 */}
        <div className="p-4 border-t border-slate-800 space-y-3">
          <div className="px-3 py-3 bg-slate-800/40 rounded-lg border border-slate-700/50">
            <div className="text-xs text-slate-500 mb-1">登录账号</div>
            <div className="text-sm text-white font-medium truncate">
              {userEmail}
            </div>
          </div>
          <button
            onClick={() => {
              setIsOpen(false)
              onLogout()
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-semibold transition-all"
          >
            退出登录
          </button>
        </div>
      </div>
    </>
  )
}
