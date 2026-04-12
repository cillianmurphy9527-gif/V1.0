"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Sparkles, Mail, Lock, User, ArrowLeft, Shield, Loader2, Eye, EyeOff, Phone } from "lucide-react"
import { useApiCall } from "@/lib/hooks/useApiCall"
import { useRouter } from "next/navigation"
import { generateDeviceFingerprint } from "@/lib/device-fingerprint"
import { TurnstileWidget } from "@/components/TurnstileWidget"

export default function RegisterPage() {
  const router = useRouter()
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [username, setUsername] = useState("")
  const [verificationCode, setVerificationCode] = useState("")
  const [referralCode, setReferralCode] = useState("")
  const [turnstileToken, setTurnstileToken] = useState("")
  const [countdown, setCountdown] = useState(0)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // 使用统一的 API 调用 Hook
  const { loading: isRegistering, execute: executeRegister } = useApiCall({
    successMessage: '注册成功！正在跳转...',
    onSuccess: () => {
      setTimeout(() => router.push('/login'), 1500)
    }
  })

  const { loading: isSendingCode, execute: executeSendCode } = useApiCall({
    successMessage: '验证码已发送，请查收短信',
    onSuccess: () => setCountdown(60)
  })

  // 倒计时逻辑
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  // 验证手机号格式（中国大陆 11 位）
  const isValidPhone = (phone: string) => {
    return /^1[3-9]\d{9}$/.test(phone)
  }

  // 发送验证码
  const handleSendCode = async () => {
    if (!isValidPhone(phone)) {
      setErrors(p => ({ ...p, phone: '请输入正确的 11 位手机号' }))
      return
    }

    await executeSendCode('/api/auth/send-code', {
      method: 'POST',
      body: JSON.stringify({ phone })
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // 前端验证
    const newErrors: Record<string, string> = {}

    if (password !== confirmPassword) {
      newErrors.confirmPassword = '两次输入的密码不一致'
    }

    // 密码强度校验（严格白名单模式，与后端一致）
    const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d@$!%*?&_#.\-]{8,32}$/
    if (password && !PASSWORD_REGEX.test(password)) {
      newErrors.password = '密码需为 8-32 位，必须包含大小写字母与数字，且不能含有空格或中文字符'
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!email.trim()) {
      newErrors.email = '邮箱地址不能为空'
    } else if (!emailRegex.test(email)) {
      newErrors.email = '请输入有效的邮箱地址'
    }

    if (!username.trim()) {
      newErrors.username = '请输入用户名'
    }

    if (!termsAccepted) {
      newErrors.terms = '必须同意服务条款和隐私政策'
    }

    if (!verificationCode || verificationCode.length !== 6) {
      newErrors.code = '请输入 6 位验证码'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setErrors({})

    // 采集设备指纹
    const deviceFingerprint = generateDeviceFingerprint()

    await executeRegister('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: username.trim(),
        phone,
        email,
        password,
        code: verificationCode,
        referralCode: referralCode || undefined,
        deviceFingerprint,
        turnstileToken: turnstileToken || 'dev-bypass', // 无 Key 时降级
      })
    })
  }

  return (
    <div className="min-h-screen bg-slate-950 relative overflow-hidden flex items-center justify-center py-12">
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

      {/* Register Card */}
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

          <h2 className="text-2xl font-bold text-white text-center mb-2">立即开通专属算力</h2>
          <p className="text-slate-400 text-center mb-8">开启 AI 驱动的外贸营销之旅</p>

          <form onSubmit={handleSubmit} autoComplete="off" className="space-y-5">
            {/* Username Input */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                用户名
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="例如：张三 或 公司简称"
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-xl pl-11 pr-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  required
                />
              </div>
            </div>

            {/* Email Input - 必填项 */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                邮箱地址 <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (errors.email) setErrors(p => ({ ...p, email: '' }))
                  }}
                  placeholder="例如：example@company.com"
                  className={`w-full bg-slate-800/50 border rounded-xl pl-11 pr-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:border-transparent transition-all ${
                    errors.email ? 'border-red-500/50 focus:ring-red-500' : 'border-slate-700 focus:ring-blue-500'
                  }`}
                  required
                />
              </div>
              {errors.email && <p className="text-xs text-red-400 mt-1">{errors.email}</p>}
              <p className="text-xs text-slate-500 mt-1">用于接收验证码和重要通知</p>
            </div>

            {/* Phone Input */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                手机号
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="请输入 11 位手机号码"
                  autoComplete="off"
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-xl pl-11 pr-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  required
                />
              </div>
            </div>

            {/* Verification Code Input */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                短信验证码
              </label>
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    type="text"
                    value={verificationCode}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, "").slice(0, 6)
                      setVerificationCode(value)
                      if (errors.code) setErrors(p => ({ ...p, code: '' }))
                    }}
                    placeholder="6位数字 (测试期间可填 000000)"
                    maxLength={6}
                    autoComplete="off"
                    className={`w-full bg-slate-800/50 border rounded-xl pl-11 pr-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:border-transparent transition-all ${
                      errors.code ? 'border-red-500/50 focus:ring-red-500' : 'border-slate-700 focus:ring-blue-500'
                    }`}
                    required
                  />
                </div>
                <Button
                  type="button"
                  onClick={handleSendCode}
                  disabled={!isValidPhone(phone) || countdown > 0 || isSendingCode}
                  className={`whitespace-nowrap px-6 ${
                    countdown > 0 || !isValidPhone(phone)
                      ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                      : "bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400"
                  }`}
                >
                  {countdown > 0 ? `${countdown}s 后重试` : isSendingCode ? "发送中..." : "获取验证码"}
                </Button>
              </div>
              {errors.code && <p className="text-xs text-red-400 mt-1">{errors.code}</p>}
              <p className="text-xs text-slate-500 mt-2">
                {!isValidPhone(phone) && phone.length > 0 && "请输入正确的 11 位手机号"}
              </p>
            </div>

            {/* Password Input */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                密码
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    if (errors.password) setErrors(p => ({ ...p, password: '' }))
                  }}
                  placeholder="至少 8 位，包含大小写字母与数字"
                  autoComplete="new-password"
                  className={`w-full bg-slate-800/50 border rounded-xl pl-11 pr-12 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:border-transparent transition-all ${
                    errors.password ? 'border-red-500/50 focus:ring-red-500' : 'border-slate-700 focus:ring-blue-500'
                  }`}
                  required
                  minLength={8}
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
              {errors.password && <p className="text-xs text-red-400 mt-1">{errors.password}</p>}
            </div>

            {/* Confirm Password Input */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                确认密码
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value)
                    if (errors.confirmPassword) setErrors(p => ({ ...p, confirmPassword: '' }))
                  }}
                  placeholder="请再次输入密码"
                  autoComplete="new-password"
                  className={`w-full bg-slate-800/50 border rounded-xl pl-11 pr-12 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:border-transparent transition-all ${
                    errors.confirmPassword ? 'border-red-500/50 focus:ring-red-500' : 'border-slate-700 focus:ring-blue-500'
                  }`}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.confirmPassword && <p className="text-xs text-red-400 mt-1">{errors.confirmPassword}</p>}
            </div>

            {/* Referral Code Input - 邀请码 */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                🎁 邀请码（选填）
              </label>
              <div className="relative">
                <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-orange-400" />
                <input
                  type="text"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                  placeholder="输入6位邀请码可享首单优惠"
                  maxLength={6}
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-xl pl-11 pr-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all uppercase"
                />
              </div>
              <p className="text-xs text-orange-400 mt-2">
                🎁 使用邀请码注册，首单立减 ¥100
              </p>
            </div>

            {/* 服务条款勾选框 - 强制必填 */}
            <div className={`flex items-start gap-3 p-4 rounded-xl border transition-all ${
              errors.terms
                ? 'bg-red-500/10 border-red-500/30'
                : 'bg-blue-500/10 border-blue-500/20'
            }`}>
              <input
                type="checkbox"
                id="terms"
                checked={termsAccepted}
                onChange={(e) => {
                  setTermsAccepted(e.target.checked)
                  if (e.target.checked && errors.terms) setErrors(p => ({ ...p, terms: '' }))
                }}
                className="w-5 h-5 mt-0.5 rounded border-slate-600 bg-slate-800 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <label htmlFor="terms" className={`text-sm cursor-pointer flex-1 ${
                errors.terms ? 'text-red-300' : 'text-slate-300'
              }`}>
                我已阅读并同意 <Link href="/terms" className="text-blue-400 hover:text-blue-300 underline">《服务条款》</Link> 与 <Link href="/privacy" className="text-blue-400 hover:text-blue-300 underline">《隐私政策》</Link>
                <span className="text-red-400 ml-1">*</span>
              </label>
            </div>
            {errors.terms && <p className="text-xs text-red-400 -mt-2">{errors.terms}</p>}

            {/* Turnstile 人机验证（无 Key 自动降级放行）*/}
            <TurnstileWidget
              onVerify={(token) => setTurnstileToken(token)}
              onExpire={() => setTurnstileToken('')}
              theme="dark"
            />

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isRegistering}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white py-6 text-lg shadow-lg shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRegistering ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  注册中...
                </>
              ) : (
                '创建账户'
              )}
            </Button>
          </form>

          {/* Footer Links */}
          <div className="mt-6 text-center">
            <p className="text-slate-400 text-sm">
              已有账户？{" "}
              <Link href="/login" className="text-blue-400 hover:text-blue-300 font-medium">
                立即登录
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
