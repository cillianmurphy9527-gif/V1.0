"use client"

import { ReactNode, useEffect, useState, useCallback } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { signOut } from "next-auth/react"
import { useSession } from "next-auth/react"
import { Home, Mail, BarChart3, Settings, Wallet, Database, X, Zap, Clock, LifeBuoy, LogOut, User, CreditCard, Send, Globe } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import FeedbackButton from "@/components/FeedbackButton"
import { GlobalRetentionAlert } from "@/components/GlobalRetentionAlert"
import { getPlan } from "@/config/pricing"

// ─── Tier Badge ────────────────────────────────────────────────────
function TierBadge({ tier }: { tier: string }) {
  // 统一使用 pricing.ts 的 getPlan 获取真实名称
  const plan = tier ? getPlan(tier as any) : null
  const planName = plan?.name || tier || '未订阅'
  const isMax     = tier === 'MAX'     || tier === 'ULTIMATE' || tier === '规模化版'
  const isPro     = tier === 'PRO'     || tier === '增长版'
  const isStarter = tier === 'STARTER' || tier === '试运营版'
  const isTrial   = !tier || tier === 'FREE' || tier === 'TRIAL' || tier === 'UNSUBSCRIBED' || tier === '试用' || tier === '未订阅'
  if (!tier) return null
  if (isMax) return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full font-extrabold border border-amber-400/30 bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-300 shadow-[0_0_20px_rgba(245,158,11,0.15)] backdrop-blur-sm">
      <span>👑</span> {planName}
    </span>
  )
  if (isPro) return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full font-bold bg-gradient-to-r from-blue-500/20 to-violet-500/20 text-blue-300 border border-blue-400/20 shadow-[0_0_16px_rgba(59,130,246,0.1)] backdrop-blur-sm">
      <span>🚀</span> {planName}
    </span>
  )
  if (isStarter) return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full font-medium bg-slate-800/60 text-slate-300 border border-white/5 backdrop-blur-sm">
      <span>🌱</span> {planName}
    </span>
  )
  if (isTrial) return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full font-bold bg-gradient-to-r from-violet-500/20 to-purple-500/20 text-violet-300 border border-violet-400/20 shadow-[0_0_12px_rgba(139,92,246,0.1)] backdrop-blur-sm">
      <span>🎁</span> 免费试用
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full font-medium bg-slate-800/60 text-slate-400 border border-white/5 backdrop-blur-sm">
      {planName}
    </span>
  )
}

function TrialWarningModal({ onClose, trialEndsAt }: { onClose: () => void; trialEndsAt: Date }) {
  const daysLeft = Math.ceil((trialEndsAt.getTime() - Date.now()) / 86400000)
  return (
    <>
      <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
        className="fixed inset-0 bg-black/60 backdrop-blur-xl z-[100]" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-[100] p-4">
        <motion.div initial={{opacity:0,scale:0.95,y:20}} animate={{opacity:1,scale:1,y:0}} exit={{opacity:0,scale:0.95,y:20}}
          className="relative max-w-md w-full"
        >
          {/* Glow effect */}
          <div className="absolute -inset-1 bg-gradient-to-r from-amber-500/20 via-orange-500/10 to-red-500/20 rounded-3xl blur-2xl" />
          <div className="relative bg-slate-900/80 backdrop-blur-2xl border border-amber-500/20 rounded-3xl p-10 shadow-2xl shadow-black/20">
            <button onClick={onClose} className="absolute top-5 right-5 w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all flex items-center justify-center">
              <X className="w-4 h-4" />
            </button>
            <div className="flex justify-center mb-8">
              <div className="relative">
                <div className="absolute inset-0 bg-amber-500/20 rounded-full blur-2xl animate-pulse" />
                <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-xl shadow-amber-500/20">
                  <Clock className="w-10 h-10 text-white" />
                </div>
              </div>
            </div>
            <h2 className="text-2xl font-bold text-white text-center mb-3 tracking-tight">免费试用即将结束</h2>
            <p className="text-slate-400 text-center mb-2 text-sm">
              您的免费试用仅剩<span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent font-bold text-xl mx-2">{daysLeft} 天</span>
            </p>
            <p className="text-slate-500 text-sm text-center mb-10 leading-relaxed">为避免拓客任务中断，请及时升级套餐</p>
            <div className="mb-10">
              <div className="flex justify-between text-xs text-slate-500 mb-2">
                <span>试用期进度</span>
                <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent font-medium">剩余 {daysLeft}/7 天</span>
              </div>
              <div className="h-1.5 bg-slate-800/80 rounded-full overflow-hidden backdrop-blur-sm">
                <motion.div
                  initial={{width:0}} animate={{width:`${(daysLeft/7)*100}%`}} transition={{duration:0.8,ease:'easeOut'}}
                  className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full"
                />
              </div>
            </div>
            <div className="space-y-3">
              <Link href="/billing" onClick={onClose}>
                <button className="w-full flex items-center justify-center gap-2.5 py-4 rounded-xl font-bold text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 shadow-lg shadow-amber-500/20 transition-all text-base">
                  <Zap className="w-5 h-5" />立即升级
                </button>
              </Link>
              <button onClick={onClose} className="w-full py-3 rounded-xl text-slate-500 hover:text-slate-400 text-sm transition-colors">今日不再提示</button>
            </div>
          </div>
        </motion.div>
      </div>
    </>
  )
}

function UserAvatarMenu() {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const { data: session, update: updateSession } = useSession()

  // 头像本地状态 + CustomEvent 毫秒级同步（绕过 JWT Cookie 4KB 限制）
  const [localAvatar, setLocalAvatar] = useState('')

  useEffect(() => {
    // 同步 session 初始值
    if (session?.user?.image) setLocalAvatar(session.user.image)

    // 监听全局头像更新广播
    const handleAvatarUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<string>
      if (customEvent.detail) setLocalAvatar(customEvent.detail)
    }

    window.addEventListener('avatarUpdate', handleAvatarUpdate)
    return () => window.removeEventListener('avatarUpdate', handleAvatarUpdate)
  }, [session?.user?.image])

  const displayAvatar = localAvatar || session?.user?.image || ''
  const userName = session?.user?.name || session?.user?.email?.split('@')[0] || '用户'
  const userInitial = userName.charAt(0).toUpperCase()

  const handleLogout = async () => {
    await signOut({ redirect: false })
    router.push("/login")
    router.refresh()
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-white font-bold hover:shadow-lg hover:shadow-blue-500/20 transition-all hover:scale-105 active:scale-95 overflow-hidden"
      >
        {displayAvatar ? (
          <img src={displayAvatar} alt={userName} className="w-full h-full object-cover" />
        ) : (
          userInitial
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -8 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 mt-3 w-64 bg-slate-900/80 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl shadow-black/20 z-50 overflow-hidden"
            >
              {/* 用户信息头 */}
              <div className="px-5 py-4 border-b border-white/5 bg-gradient-to-r from-white/5 to-transparent">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-blue-500/20 overflow-hidden">
                    {displayAvatar ? (
                      <img src={displayAvatar} alt={userName} className="w-full h-full object-cover" />
                    ) : (
                      userInitial
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate tracking-tight">{userName}</p>
                    <p className="text-xs text-slate-500 truncate mt-0.5">{session?.user?.email || '—'}</p>
                  </div>
                </div>
              </div>

              {/* 菜单项 */}
              <div className="py-2">
                <Link href="/profile">
                  <button
                    onClick={() => setIsOpen(false)}
                    className="w-full flex items-center gap-3 px-5 py-3 text-slate-400 hover:text-white hover:bg-white/5 transition-all text-sm"
                  >
                    <User className="w-4 h-4" />
                    <span>个人资料</span>
                  </button>
                </Link>

                <Link href="/billing">
                  <button
                    onClick={() => setIsOpen(false)}
                    className="w-full flex items-center gap-3 px-5 py-3 text-slate-400 hover:text-white hover:bg-white/5 transition-all text-sm"
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>账单与订阅</span>
                  </button>
                </Link>

                {/* 分割线 */}
                <div className="my-2 border-t border-white/5 mx-5" />

                {/* 退出登录 */}
                <button
                  onClick={() => {
                    setIsOpen(false)
                    handleLogout()
                  }}
                  className="w-full flex items-center gap-3 px-5 py-3 text-red-400/80 hover:text-red-300 hover:bg-red-500/5 transition-all text-sm"
                >
                  <LogOut className="w-4 h-4" />
                  <span>退出登录</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [showTrialModal, setShowTrialModal] = useState(false)
  const [userTier, setUserTier] = useState('')
  const [tokenBalance, setTokenBalance] = useState<number | null>(null)
  const [trialEndsAt, setTrialEndsAt] = useState<Date | null>(null)

  const refreshAssets = useCallback(() => {
    fetch('/api/user/assets').then(r => r.ok ? r.json() : null).then(d => {
      if (d?.subscriptionTier) setUserTier(d.subscriptionTier)
      if (typeof d?.tokenBalance === 'number') setTokenBalance(d.tokenBalance)
      if (d?.trialEndsAt) {
        const t = new Date(d.trialEndsAt)
        if (!Number.isNaN(t.getTime())) setTrialEndsAt(t)
      } else {
        setTrialEndsAt(null)
      }
    }).catch(() => {})
  }, [])

  useEffect(() => {
    refreshAssets()
    const handler = () => refreshAssets()
    window.addEventListener('leadpilot:payment-success', handler)
    return () => window.removeEventListener('leadpilot:payment-success', handler)
  }, [refreshAssets])

  const isActive = (path: string) => pathname === path

  // 试用期警告
  useEffect(() => {
    if (!trialEndsAt) return
    const daysLeft = Math.ceil((trialEndsAt.getTime() - Date.now()) / 86400000)
    if (daysLeft > 0 && daysLeft <= 3) {
      const key = `trial_warned_${new Date().toDateString()}`
      if (!localStorage.getItem(key)) {
        const t = setTimeout(() => {
          setShowTrialModal(true)
          localStorage.setItem(key, '1')
        }, 1500)
        return () => clearTimeout(t)
      }
    }
  }, [trialEndsAt])

  const NAV = [
    { href: '/dashboard',        Icon: Home,      label: '指挥中心' },
    { href: '/inbox',            Icon: Mail,      label: '收件箱' },
    { href: '/delivery-logs',   Icon: Send,      label: '投递流水' },
    { href: '/analytics',        Icon: BarChart3,  label: '数据分析' },
    { href: '/dashboard/wallet',  Icon: Wallet,    label: '商城' },
    { href: '/billing',          Icon: CreditCard, label: '钱包' },
    { href: '/domains',          Icon: Globe,     label: '域名池' },
    { href: '/knowledge-base',   Icon: Database,  label: '知识库' },
    { href: '/profile',         Icon: Settings,  label: '个人资料' },
    { href: '/support',         Icon: LifeBuoy, label: '帮助支持' },
  ]

  return (
    <div className="min-h-screen bg-slate-950 antialiased">
      {/* 全局网格背景 */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(59,130,246,0.08),transparent)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_60%_40%_at_50%_0%,#000_40%,transparent_100%)]" />
      </div>

      <AnimatePresence>
        {showTrialModal && trialEndsAt && (
          <TrialWarningModal onClose={() => setShowTrialModal(false)} trialEndsAt={trialEndsAt} />
        )}
      </AnimatePresence>

      {/* 顶部导航栏 - 毛玻璃质感 */}
      <nav className="sticky top-0 z-50 border-b border-white/5 bg-slate-950/60 backdrop-blur-2xl">
        <div className="max-w-[1440px] mx-auto w-full px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="relative">
                <div className="absolute inset-0 bg-blue-500/20 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity" />
                <Image src="/logo.png" alt="LeadPilot" width={32} height={32} className="relative" />
              </div>
              <span className="text-xl font-bold text-white tracking-tight group-hover:bg-gradient-to-r group-hover:from-blue-400 group-hover:to-cyan-400 group-hover:bg-clip-text group-hover:text-transparent transition-all">LeadPilot</span>
            </Link>

            {/* 导航 */}
            <div className="flex items-center gap-1">
              {NAV.map(({ href, Icon, label }) => (
                <Link key={href} href={href}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-200 ${
                    isActive(href)
                      ? 'text-white bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-500/20 shadow-[0_0_20px_rgba(59,130,246,0.15)]'
                      : 'text-slate-500 hover:text-slate-200 hover:bg-white/5 border border-transparent hover:border-white/5'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive(href) ? 'text-blue-400' : ''}`} />
                  <span className="text-sm font-medium tracking-tight">{label}</span>
                </Link>
              ))}
              <Link href="/affiliate"
                className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-200 ${
                  isActive('/affiliate')
                    ? 'text-white bg-gradient-to-r from-orange-500/20 to-amber-500/20 border border-orange-500/20 shadow-[0_0_20px_rgba(249,115,22,0.15)]'
                    : 'text-slate-500 hover:text-slate-200 hover:bg-white/5 border border-transparent hover:border-white/5'
                }`}
              >
                <span className="text-base">🔥</span>
                <span className="text-sm font-medium tracking-tight">全球合伙人</span>
              </Link>
            </div>

            {/* 右侧 */}
            <div className="flex items-center gap-4">
              <UserAvatarMenu />
            </div>
          </div>
        </div>
      </nav>

      <main className="relative">
        <div className="max-w-[1440px] mx-auto w-full px-6 py-8">{children}</div>
      </main>

      <FeedbackButton />
      <GlobalRetentionAlert />
    </div>
  )
}
