"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  User, 
  Mail, 
  Phone, 
  Building2, 
  Save, 
  Loader2,
  Upload,
  Lock,
  Shield,
  Briefcase,
  Globe,
  CheckCircle2,
  X,
  MessageSquare
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"

// ─── SMS 验证码弹窗 ───────────────────────────────────────────────
interface SmsModalProps {
  phone:        string
  onConfirm:    (code: string) => Promise<void>
  onClose:      () => void
  isSubmitting: boolean
}

function SmsVerificationModal({ phone, onConfirm, onClose, isSubmitting }: SmsModalProps) {
  const { toast } = useToast()
  const [code, setCode]           = useState('')
  const [sending, setSending]     = useState(false)
  const [countdown, setCountdown] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current) }, [])

  const startCountdown = () => {
    setCountdown(60)
    timerRef.current = setInterval(() => {
      setCountdown(p => { if (p <= 1) { clearInterval(timerRef.current!); timerRef.current = null; return 0 } return p - 1 })
    }, 1000)
  }

  const handleSend = async () => {
    if (sending || countdown > 0) return
    setSending(true)
    try {
      const res  = await fetch('/api/auth/send-code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone }) })
      const data = await res.json()
      if (res.ok) {
        toast({ title: '✅ 验证码已发送', description: data.betaMode ? `内测验证码：${data.code}` : `已发送至 ${phone.slice(0,3)}****${phone.slice(-4)}` })
        startCountdown()
      } else {
        toast({ title: '发送失败', description: data.error || '请稍后重试', variant: 'destructive' })
      }
    } catch {
      toast({ title: '发送失败', description: '网络错误', variant: 'destructive' })
    } finally { setSending(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <motion.div initial={{ opacity:0, scale:0.95, y:16 }} animate={{ opacity:1, scale:1, y:0 }} exit={{ opacity:0, scale:0.95, y:16 }}
        className="relative bg-slate-900 border border-slate-700 rounded-3xl p-8 w-full max-w-md mx-4 shadow-2xl"
      >
        <button onClick={onClose} className="absolute top-5 right-5 text-slate-500 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mb-4">
            <MessageSquare className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-xl font-bold text-white">身份安全验证</h2>
          <p className="text-sm text-slate-400 mt-2 leading-relaxed">
            为保障账号安全，请验证您的身份。<br />验证码将发送至 <span className="text-emerald-400 font-semibold">{phone ? `${phone.slice(0,3)}****${phone.slice(-4)}` : '绑定手机号'}</span>
          </p>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">短信验证码</label>
            <div className="flex gap-3">
              <input type="text" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g,'').slice(0,6))}
                placeholder="6 位验证码"
                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-center text-lg tracking-[0.4em] placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
              />
              <button onClick={handleSend} disabled={sending || countdown > 0}
                className="flex-shrink-0 px-4 py-3 rounded-xl text-sm font-semibold bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/30 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap transition-all"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : countdown > 0 ? `${countdown}s` : '获取验证码'}
              </button>
            </div>
          </div>
          <Button onClick={() => onConfirm(code)} disabled={isSubmitting || code.length !== 6}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 text-base font-semibold disabled:opacity-50"
          >
            {isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />提交中...</> : '确认修改'}
          </Button>
        </div>
      </motion.div>
    </div>
  )
}

export default function ProfilePage() {
  const { toast } = useToast()
  const router = useRouter()
  const { update: updateSession } = useSession()
  const [isSaving,  setIsSaving]  = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const [profile, setProfile] = useState({
    name: '', company: '', industry: '机械制造',
    website: '', businessDesc: '', avatar: '', phone: '', email: '', createdAt: ''
  })

  // 安全面板独立 state
  const [origEmail,    setOrigEmail]    = useState('')
  const [secEmail,     setSecEmail]     = useState('')
  const [secPassword,  setSecPassword]  = useState('')
  const [showSmsModal, setShowSmsModal] = useState(false)
  const [isSecSaving,  setIsSecSaving]  = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/user/assets')
        if (res.ok) {
          const data = await res.json()
          // data.phone = 真实手机号（登录凭证，锁死不可改）
          // data.email = DB email 字段（可能存的是手机号副本或真实联系邮箱）
          // 规则：若 email 看起来像纯数字手机号，说明是登录副本，邮箱框留空
          const isPhoneLike = (s: string) => /^\d{8,}$/.test(s.replace(/[\s\-+]/g, ''))
          const phone        = data.phone || ''
          const contactEmail = data.email && !isPhoneLike(data.email) ? data.email : ''

          setProfile(prev => ({
            ...prev,
            name:         data.name        || '',
            company:      data.companyName || '',
            avatar:       data.image        || '',
            email:        contactEmail,
            phone,
            website:      data.website      || '',
            businessDesc: data.businessDesc || '',
            industry:    data.industry     || '机械制造',
          }))
          setSecEmail(contactEmail)
          setOrigEmail(contactEmail)
        }
      } catch { /* keep defaults */ } finally { setIsLoading(false) }
    }
    load()
  }, [])

  // ── 保存企业信息 ─────────────────────────────────────────────
  const handleSave = async (section: string) => {
    if (isSaving) return
    setIsSaving(true)
    try {
      console.log("提交的表单数据:", { name: profile.name, companyName: profile.company, image: profile.avatar, website: profile.website, businessDesc: profile.businessDesc, industry: profile.industry })
      const res = await fetch('/api/user/assets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: profile.name, companyName: profile.company, image: profile.avatar, website: profile.website, businessDesc: profile.businessDesc, industry: profile.industry }),
      })
      if (res.ok) {
        const data = await res.json().catch(() => ({}))
        toast({ title: `✅ ${section}已保存`, description: data?.message || '信息更新成功' })
        // 1. 强制刷新 NextAuth 全局会话（用于其他轻量级文本字段同步）
        await updateSession({ image: profile.avatar })
        // 2. 发送全局广播，通知 Header 瞬间更新头像（绕过 Cookie 大小限制）
        window.dispatchEvent(new CustomEvent('avatarUpdate', { detail: profile.avatar }))
        router.refresh()
      } else {
        const err = await res.json().catch(() => ({}))
        toast({ title: '保存失败', description: err?.error || '请稍后重试', variant: 'destructive' })
      }
    } catch {
      toast({ title: '保存失败', description: '网络错误', variant: 'destructive' })
    } finally { setIsSaving(false) }
  }

  // ── 安全设置：拦截 + 弹窗 ────────────────────────────────────
  const handleSecurityIntent = () => {
    const emailChanged    = secEmail.trim() !== origEmail
    const passwordChanged = secPassword.trim().length > 0
    if (!emailChanged && !passwordChanged) {
      toast({ title: '未检测到修改', description: '邮箱和密码均未发生变动', variant: 'destructive' })
      return
    }
    setShowSmsModal(true)
  }

  const handleSecurityConfirm = async (code: string) => {
    setIsSecSaving(true)
    try {
      const res = await fetch('/api/user/security', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email:    secEmail.trim()    || undefined,
          password: secPassword.trim() || undefined,
          code,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        toast({ title: '✅ 安全信息已更新', description: '邮箱/密码修改成功' })
        // 更新邮箱状态（前端本地同步）
        setOrigEmail(secEmail.trim())
        setProfile(prev => ({ ...prev, email: secEmail.trim() }))
        setSecPassword('')
        setShowSmsModal(false)
        // 头像广播（如果头像也有变化）
        if (profile.avatar) {
          window.dispatchEvent(new CustomEvent('avatarUpdate', { detail: profile.avatar }))
        }
        router.refresh()
      } else {
        toast({ title: '修改失败', description: data.error || '请稍后重试', variant: 'destructive' })
      }
    } catch {
      toast({ title: '修改失败', description: '网络错误', variant: 'destructive' })
    } finally { setIsSecSaving(false) }
  }

  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 使用 URL.createObjectURL 进行高效本地预览（不产生 Base64）
    const previewUrl = URL.createObjectURL(file)
    setProfile(prev => ({ ...prev, avatar: previewUrl }))

    // 静默上传到服务器
    setIsUploadingAvatar(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      const data = await res.json()

      if (res.ok && data.url) {
        // 上传成功后，用服务器返回的短 URL 替换本地预览
        URL.revokeObjectURL(previewUrl) // 释放内存
        setProfile(prev => ({ ...prev, avatar: data.url }))
      } else {
        toast({ title: '上传失败', description: data.error || '请重试', variant: 'destructive' })
        // 失败时保留本地预览（临时 Blob URL）
      }
    } catch {
      toast({ title: '上传失败', description: '网络错误', variant: 'destructive' })
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    )
  }

  return (
    <>
      <AnimatePresence>
        {showSmsModal && (
          <SmsVerificationModal
            phone={profile.phone}
            onConfirm={handleSecurityConfirm}
            onClose={() => setShowSmsModal(false)}
            isSubmitting={isSecSaving}
          />
        )}
      </AnimatePresence>

      <div className="min-h-screen bg-slate-950 text-white">
      <div className="container mx-auto px-6 py-8">

        {/* 页面标题 */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">个人资料</h1>
          <p className="text-slate-400">管理您的企业信息与账户安全</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">

          {/* ── 企业信息 ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:col-span-2"
          >
            <div className="bg-slate-900/50 border border-slate-700 rounded-3xl p-8">
              <div className="flex items-center gap-3 mb-6 pb-6 border-b border-slate-700">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <Briefcase className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">企业信息</h2>
                  <p className="text-sm text-slate-400">展示给客户的企业形象</p>
                </div>
              </div>

              {/* 头像 */}
              <div className="flex items-center gap-6 mb-8 pb-8 border-b border-slate-700">
                <div className="relative">
                  {profile.avatar ? (
                    <img src={profile.avatar} alt="Avatar" className="w-24 h-24 rounded-full object-cover" />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-3xl font-bold">
                      {(profile.name || profile.email || 'U').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <label className={`absolute bottom-0 right-0 w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-all ${isUploadingAvatar ? 'bg-slate-600 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500'}`}>
                    {isUploadingAvatar ? (
                      <Loader2 className="w-4 h-4 text-white animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4 text-white" />
                    )}
                    <input type="file" accept="image/*" onChange={handleAvatarUpload} disabled={isUploadingAvatar} className="hidden" />
                  </label>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white mb-1">{profile.name || profile.email || '用户'}</h3>
                  <p className="text-slate-400 text-sm">{profile.email}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs text-emerald-400">已认证企业</span>
                  </div>
                </div>
              </div>

              {/* 表单 */}
              <div className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">用户名</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                      <input
                        type="text"
                        value={profile.name}
                        onChange={(e) => setProfile({...profile, name: e.target.value})}
                        className="w-full bg-slate-800/50 border border-slate-700 rounded-xl pl-11 pr-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">公司名称</label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                      <input
                        type="text"
                        value={profile.company}
                        onChange={(e) => setProfile({...profile, company: e.target.value})}
                        className="w-full bg-slate-800/50 border border-slate-700 rounded-xl pl-11 pr-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">所属行业</label>
                    <select
                      value={profile.industry}
                      onChange={(e) => setProfile({...profile, industry: e.target.value})}
                      className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    >
                      <option value="机械制造">机械制造</option>
                      <option value="电子科技">电子科技</option>
                      <option value="化工材料">化工材料</option>
                      <option value="纺织服装">纺织服装</option>
                      <option value="食品饮料">食品饮料</option>
                      <option value="旅游服务">旅游服务</option>
                      <option value="其他">其他</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">公司官网</label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                      <input
                        type="url"
                        value={profile.website}
                        onChange={(e) => setProfile({...profile, website: e.target.value})}
                        placeholder="https://example.com"
                        className="w-full bg-slate-800/50 border border-slate-700 rounded-xl pl-11 pr-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">业务描述</label>
                  <textarea
                    value={profile.businessDesc}
                    onChange={(e) => setProfile({...profile, businessDesc: e.target.value})}
                    rows={3}
                    placeholder="简要描述您的主营业务和优势..."
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-all"
                  />
                </div>

                <div className="pt-4">
                  <Button
                    onClick={() => handleSave('企业信息')}
                    disabled={isSaving}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-8"
                  >
                    {isSaving ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />保存中...</>
                    ) : (
                      <><Save className="w-4 h-4 mr-2" />保存企业信息</>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>

          {/* ── 右侧：账户安全 ── */}
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-slate-900/50 border border-slate-700 rounded-3xl p-6"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">账户安全</h2>
                  <p className="text-xs text-slate-400">保护您的账户安全</p>
                </div>
              </div>

              <div className="space-y-4">
                {/* 手机号：物理锁死，不可修改 */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">手机号</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                    <input
                      type="text"
                      value={profile.phone}
                      disabled
                      className="w-full bg-slate-800/30 border border-slate-700/50 rounded-xl pl-10 pr-4 py-2.5 text-slate-500 cursor-not-allowed text-sm select-none"
                    />
                  </div>
                  <p className="text-xs text-slate-600 mt-1.5">手机号为账号核心身份凭证，不可直接修改。</p>
                </div>

                {/* 邮箱：可编辑 */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">邮箱</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="email"
                      value={secEmail}
                      onChange={e => setSecEmail(e.target.value)}
                      className="w-full bg-slate-800/50 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all text-sm"
                    />
                  </div>
                </div>

                {/* 新密码：可编辑 */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">修改密码</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="password"
                      value={secPassword}
                      onChange={e => setSecPassword(e.target.value)}
                      placeholder="不修改请留空"
                      className="w-full bg-slate-800/50 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all text-sm"
                    />
                  </div>
                </div>

                <Button
                  onClick={handleSecurityIntent}
                  disabled={isSecSaving}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  {isSecSaving
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />保存中...</>
                    : <><Save className="w-4 h-4 mr-2" />保存安全设置</>
                  }
                </Button>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
    </>
  )
} 