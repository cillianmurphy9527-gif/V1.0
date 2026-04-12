"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { Phone, Lock, ArrowLeft, AlertCircle, Eye, EyeOff, Smartphone, ChevronLeft, Loader2, CheckCircle2 } from "lucide-react"
import { TurnstileWidget } from "@/components/TurnstileWidget"

// ─── 忘记密码视图 ─────────────────────────────────────────────────
function ResetPasswordView({ onBack }: { onBack: () => void }) {
  const { toast } = useToast()
  const [resetPhone,  setResetPhone]  = useState('')
  const [resetCode,   setResetCode]   = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [showNewPwd,  setShowNewPwd]  = useState(false)
  const [sending,     setSending]     = useState(false)
  const [submitting,  setSubmitting]  = useState(false)
  const [countdown,   setCountdown]   = useState(0)
  const [done,        setDone]        = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current) }, [])
  const isValidPhone = (p: string) => /^1[3-9]\d{9}$/.test(p)

  const startCountdown = () => {
    setCountdown(60)
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(timerRef.current!); timerRef.current = null; return 0 }
        return prev - 1
      })
    }, 1000)
  }

  const handleSendCode = async () => {
    if (!isValidPhone(resetPhone)) { toast({ title: '请输入正确的 11 位手机号', variant: 'destructive' }); return }
    setSending(true)
    try {
      const res  = await fetch('/api/auth/send-reset-code', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ phone: resetPhone }) })
      const data = await res.json()
      if (res.ok) { toast({ title:'✅ 验证码已发送', description: data.betaMode ? `内测验证码：${data.code}` : `已发送至 ${resetPhone.slice(0,3)}****${resetPhone.slice(-4)}` }); startCountdown() }
      else { toast({ title:'发送失败', description: data.error||'请稍后重试', variant:'destructive' }) }
    } catch { toast({ title:'网络错误', description:'请检查网络后重试', variant:'destructive' }) }
    finally { setSending(false) }
  }

  const handleReset = async () => {
    if (!isValidPhone(resetPhone)) { toast({ title:'手机号格式错误', variant:'destructive' }); return }
    if (resetCode.length !== 6)    { toast({ title:'请输入 6 位验证码', variant:'destructive' }); return }
    if (newPassword.length < 8)    { toast({ title:'密码不能少于 8 位', variant:'destructive' }); return }
    setSubmitting(true)
    try {
      const res  = await fetch('/api/auth/reset-password', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ phone: resetPhone, code: resetCode, newPassword }) })
      const data = await res.json()
      if (res.ok) { setDone(true); toast({ title:'✅ 密码重置成功', description:'请使用新密码登录' }); setTimeout(() => onBack(), 2000) }
      else { toast({ title:'重置失败', description: data.error||'请稍后重试', variant:'destructive' }) }
    } catch { toast({ title:'网络错误', description:'请检查网络后重试', variant:'destructive' }) }
    finally { setSubmitting(false) }
  }

  if (done) return (
    <div className="flex flex-col items-center gap-4 py-8">
      <CheckCircle2 className="w-16 h-16 text-emerald-400" />
      <p className="text-xl font-bold text-white">密码重置成功！</p>
      <p className="text-slate-400 text-sm">正在跳转回登录页...</p>
    </div>
  )

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">注册手机号</label>
        <div className="relative">
          <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
          <input type="tel" value={resetPhone} onChange={e=>setResetPhone(e.target.value)} placeholder="请输入注册时的手机号" autoComplete="off"
            className="w-full bg-slate-800/50 border border-slate-700 rounded-xl pl-11 pr-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">短信验证码</label>
        <div className="flex gap-3">
          <input type="text" value={resetCode} maxLength={6} onChange={e=>setResetCode(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="6 位验证码" autoComplete="off"
            className="flex-1 bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white text-center tracking-[0.4em] placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" />
          <button type="button" onClick={handleSendCode} disabled={sending||countdown>0||!isValidPhone(resetPhone)}
            className="flex-shrink-0 px-4 py-3 rounded-xl text-sm font-semibold bg-blue-600/20 border border-blue-500/40 text-blue-300 hover:bg-blue-600/30 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap transition-all">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : countdown>0 ? `${countdown}s` : '获取验证码'}
          </button>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">新密码</label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
          <input type={showNewPwd?'text':'password'} value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="至少 8 位，含大小写字母与数字" autoComplete="new-password"
            className="w-full bg-slate-800/50 border border-slate-700 rounded-xl pl-11 pr-12 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" />
          <button type="button" tabIndex={-1} onClick={()=>setShowNewPwd(p=>!p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
            {showNewPwd ? <EyeOff className="w-5 h-5"/> : <Eye className="w-5 h-5"/>}
          </button>
        </div>
      </div>
      <Button type="button" onClick={handleReset} disabled={submitting}
        className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white py-6 text-lg shadow-lg shadow-blue-500/30">
        {submitting ? <><Loader2 className="w-5 h-5 mr-2 animate-spin"/>重置中...</> : '确认重置密码'}
      </Button>
      <button type="button" onClick={onBack} className="w-full flex items-center justify-center gap-1 text-sm text-slate-500 hover:text-slate-300 transition-colors">
        <ChevronLeft className="w-4 h-4"/>返回登录
      </button>
    </div>
  )
}

export default function LoginPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [view, setView]               = useState<'login' | 'reset'>('login')
  const [loginMode, setLoginMode]     = useState<'password' | 'sms'>('password')
  const [email, setEmail]             = useState("")
  const [phone, setPhone]             = useState("")
  const [password, setPassword]       = useState("")
  const [smsCode, setSmsCode]         = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading]     = useState(false)
  const [sendingSms, setSendingSms]   = useState(false)
  const [smsCountdown, setSmsCountdown] = useState(0)
  const [error, setError]             = useState("")
  const [turnstileToken, setTurnstileToken] = useState("")

  useEffect(() => {
    if (smsCountdown <= 0) return
    const t = setTimeout(() => setSmsCountdown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [smsCountdown])

  const isValidPhone = (p: string) => /^1[3-9]\d{9}$/.test(p)

  const handleSendLoginCode = async () => {
    if (!isValidPhone(phone)) {
      toast({ title: '请输入正确的 11 位手机号', variant: 'destructive' })
      return
    }
    setSendingSms(true)
    try {
      const res = await fetch('/api/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      })
      const data = await res.json()
      if (res.ok) {
        toast({ title: '验证码已发送', description: '请查收短信' })
        setSmsCountdown(60)
      } else {
        toast({ title: '发送失败', description: data.error || '请稍后重试', variant: 'destructive' })
      }
    } catch {
      toast({ title: '网络错误', variant: 'destructive' })
    } finally {
      setSendingSms(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    const res =
      loginMode === 'password'
        ? await signIn('credentials', {
            email: email.trim(),
            password,
            redirect: false,
          })
        : await signIn('credentials', {
            phone: phone.trim(),
            code: smsCode.trim(),
            redirect: false,
          })

    setIsLoading(false)

    if (res?.error) {
      setError(res.error === 'CredentialsSignin' ? '登录失败，请检查输入' : res.error)
      return
    }

    router.push("/dashboard")
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-slate-950 relative overflow-hidden flex items-center justify-center">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)]" />
      <div className="absolute inset-0 bg-gradient-to-t from-blue-900/20 via-transparent to-transparent" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-blue-500/10 blur-[120px] rounded-full" />

      {/* Back to Home */}
      <Link href="/" className="absolute top-8 left-8 z-10">
        <Button variant="ghost" className="text-slate-400 hover:text-white hover:bg-white/5">
          <ArrowLeft className="w-4 h-4 mr-2" />
          返回首页
        </Button>
      </Link>

      {/* Login Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-md mx-4"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-3xl blur-2xl" />

        <div className="relative bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
          {/* Logo */}
          <div className="flex items-center justify-center gap-2 mb-8">
            <Image src="/logo.png" alt="LeadPilot Logo" width={32} height={32} />
            <h1 className="text-3xl font-bold text-white">LeadPilot</h1>
          </div>

          <AnimatePresence mode="wait">
          {view === 'reset' ? (
            <motion.div key="reset" initial={{ opacity:0, x:20 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-20 }} transition={{ duration:0.2 }}>
              <h2 className="text-2xl font-bold text-white text-center mb-2">找回密码</h2>
              <p className="text-slate-400 text-center mb-8">通过短信验证码重置您的密码</p>
              <ResetPasswordView onBack={() => setView('login')} />
            </motion.div>
          ) : (
            <motion.div key="login" initial={{ opacity:0, x:-20 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:20 }} transition={{ duration:0.2 }}>
          <h2 className="text-2xl font-bold text-white text-center mb-2">欢迎回来</h2>
          <p className="text-slate-400 text-center mb-8">登录您的账户继续使用</p>

          <div className="flex rounded-xl bg-slate-800/50 p-1 mb-6 border border-slate-700">
            <button
              type="button"
              onClick={() => { setLoginMode('password'); setError('') }}
              className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                loginMode === 'password' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              邮箱密码
            </button>
            <button
              type="button"
              onClick={() => { setLoginMode('sms'); setError('') }}
              className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                loginMode === 'sms' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              手机验证码
            </button>
          </div>

          <form onSubmit={handleSubmit} autoComplete="off" className="space-y-6">
            {loginMode === 'password' ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">邮箱</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="注册时使用的邮箱"
                    autoComplete="email"
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">密码</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="请输入密码"
                      autoComplete="current-password"
                      className="w-full bg-slate-800/50 border border-slate-700 rounded-xl pl-11 pr-12 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">手机号</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="请输入 11 位手机号码"
                      autoComplete="tel"
                      className="w-full bg-slate-800/50 border border-slate-700 rounded-xl pl-11 pr-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">短信验证码</label>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={smsCode}
                      onChange={(e) => setSmsCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="6 位验证码"
                      autoComplete="one-time-code"
                      className="flex-1 bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white text-center tracking-widest placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      required
                    />
                    <button
                      type="button"
                      onClick={handleSendLoginCode}
                      disabled={sendingSms || smsCountdown > 0 || !isValidPhone(phone)}
                      className="flex-shrink-0 px-4 py-3 rounded-xl text-sm font-semibold bg-blue-600/20 border border-blue-500/40 text-blue-300 hover:bg-blue-600/30 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                      {sendingSms ? <Loader2 className="w-4 h-4 animate-spin" /> : smsCountdown > 0 ? `${smsCountdown}s` : '获取验证码'}
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            {/* Turnstile 人机验证（无 Key 自动降级放行）*/}
            <TurnstileWidget
              onVerify={(token) => setTurnstileToken(token)}
              onExpire={() => setTurnstileToken('')}
              theme="dark"
            />

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white py-6 text-lg shadow-lg shadow-blue-500/30"
            >
              {isLoading ? "登录中..." : "登录"}
            </Button>
          </form>

          {/* Footer Links */}
          <div className="mt-6 flex items-center justify-center gap-4 text-sm">
            <div className="text-slate-400">
              还没有账户？{' '}
              <Link href="/register" className="text-blue-500 hover:text-blue-400 transition-colors">
                立即注册
              </Link>
            </div>
            <div className="w-px h-3 bg-slate-700"></div>
            <button type="button" onClick={() => setView('reset')}
              className="text-slate-400 hover:text-slate-300 transition-colors">
              忘记密码？
            </button>
          </div>
          </motion.div>
          )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  )
}
