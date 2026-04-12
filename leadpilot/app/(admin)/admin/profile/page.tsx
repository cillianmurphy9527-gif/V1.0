"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"
import { Shield, User, Mail, Phone, Crown, Plus, Lock, Save, Eye, EyeOff, Loader2, KeyRound, ShieldCheck } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

// ── 60s 倒计时 hook ────────────────────────────────────────────────
function useCountdown() {
  const [seconds, setSeconds] = useState(0)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  const start = () => {
    setSeconds(60)
    timer.current = setInterval(() => {
      setSeconds(s => {
        if (s <= 1) { clearInterval(timer.current!); return 0 }
        return s - 1
      })
    }, 1000)
  }
  useEffect(() => () => { if (timer.current) clearInterval(timer.current) }, [])
  return { seconds, start, active: seconds > 0 }
}

// ── 验证码输入行 ───────────────────────────────────────────────────
function CodeRow({ value, onChange, onSend, sending, countdown, accentClass }: {
  value: string; onChange: (v: string) => void
  onSend: () => void; sending: boolean; countdown: number; accentClass: string
}) {
  return (
    <div>
      <label className="block text-xs text-slate-400 mb-1.5 font-medium">安全验证码</label>
      <div className="flex gap-2">
        <input
          value={value} onChange={e => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="请输入 6 位验证码" maxLength={6}
          className="flex-1 bg-slate-900/60 border border-slate-700/60 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/60 tracking-widest transition-all"
        />
        <button type="button" onClick={onSend} disabled={sending || countdown > 0}
          className={`flex-shrink-0 px-4 py-3 rounded-xl text-xs font-bold transition-all disabled:cursor-not-allowed border ${countdown > 0 || sending ? 'border-slate-700 bg-slate-800/60 text-slate-500' : accentClass}`}
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : countdown > 0 ? `重新发送(${countdown}s)` : '获取验证码'}
        </button>
      </div>
    </div>
  )
}

function Avatar({ name, role }: { name: string; role: string }) {
  const letter = (name?.[0] || 'A').toUpperCase()
  const g = role === 'SUPER_ADMIN' ? 'from-amber-500 via-orange-500 to-rose-500' : 'from-blue-600 via-violet-600 to-blue-500'
  return <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${g} flex items-center justify-center shadow-2xl text-white text-3xl font-black select-none`}>{letter}</div>
}

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 bg-slate-800/40 border border-slate-700/50 rounded-xl">
      <Icon className="w-4 h-4 text-slate-500 flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-[11px] text-slate-500 mb-0.5">{label}</p>
        <p className="text-sm text-white font-medium truncate">{value || '未设置'}</p>
      </div>
    </div>
  )
}

function PasswordInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false)
  return (
    <div>
      <label className="block text-xs text-slate-400 mb-1.5 font-medium">{label}</label>
      <div className="relative">
        <input type={show ? 'text' : 'password'} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          className="w-full bg-slate-900/60 border border-slate-700/60 rounded-xl px-4 py-3 pr-10 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/60 transition-all" />
        <button type="button" onClick={() => setShow(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}

export default function AdminProfilePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()

  const [contactPhone, setContactPhone] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [infoCode, setInfoCode] = useState('')
  const [infoCodeErr, setInfoCodeErr] = useState('')
  const [savingInfo, setSavingInfo] = useState(false)
  const [sendingInfoCode, setSendingInfoCode] = useState(false)
  const infoCountdown = useCountdown()

  const [oldPwd, setOldPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [pwdCode, setPwdCode] = useState('')
  const [pwdCodeErr, setPwdCodeErr] = useState('')
  const [savingPwd, setSavingPwd] = useState(false)
  const [sendingPwdCode, setSendingPwdCode] = useState(false)
  const pwdCountdown = useCountdown()

  const [newAdminEmail, setNewAdminEmail] = useState('')
  const [newAdminPhone, setNewAdminPhone] = useState('')
  const [newAdminPassword, setNewAdminPassword] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (status === 'loading') return
    const role = session?.user?.role
    if (!role || (role !== 'ADMIN' && role !== 'SUPER_ADMIN')) router.replace('/?error=AccessDenied')
  }, [session, status, router])

  if (status === 'loading') return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const isSuperAdmin = session?.user?.role === 'SUPER_ADMIN'
  const user = session?.user

  const sendCode = async (purpose: 'update' | 'password', setSending: (v: boolean) => void, countdown: ReturnType<typeof useCountdown>) => {
    setSending(true)
    try {
      const res = await fetch('/api/admin/profile/send-code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ purpose }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || '发送失败')
      countdown.start()
      toast({ title: '✅ 验证码已发送', description: data?.message })
    } catch (e: any) { toast({ title: '❌ 发送失败', description: e?.message, variant: 'destructive' }) }
    finally { setSending(false) }
  }

  const handleSaveInfo = async () => {
    if (savingInfo) return
    if (!displayName.trim() && !contactPhone.trim()) { toast({ title: '请至少填写一个字段', variant: 'destructive' }); return }
    setInfoCodeErr('')
    setSavingInfo(true)
    try {
      const res = await fetch('/api/admin/profile/update', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ companyName: displayName.trim() || undefined, phone: contactPhone.trim() || undefined, code: infoCode.trim() }) })
      const data = await res.json()
      if (!res.ok) {
        if (data?.error?.includes('验证码')) { setInfoCodeErr(data.error); return }
        throw new Error(data?.error || '保存失败')
      }
      toast({ title: '✅ 资料已更新', description: data?.message || '基础信息保存成功' })
      setInfoCode('')
    } catch (e: any) { toast({ title: '❌ 保存失败', description: e?.message, variant: 'destructive' }) }
    finally { setSavingInfo(false) }
  }

  const handleSavePassword = async () => {
    if (savingPwd) return
    if (!oldPwd || !newPwd || !confirmPwd) { toast({ title: '请填写所有密码字段', variant: 'destructive' }); return }
    if (newPwd !== confirmPwd) { toast({ title: '两次输入的新密码不一致', variant: 'destructive' }); return }
    if (newPwd.length < 8) { toast({ title: '新密码至少 8 位', variant: 'destructive' }); return }
    setPwdCodeErr('')
    setSavingPwd(true)
    try {
      const res = await fetch('/api/admin/profile/password', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ oldPassword: oldPwd, newPassword: newPwd, code: pwdCode.trim() }) })
      const data = await res.json()
      if (!res.ok) {
        if (data?.error?.includes('验证码')) { setPwdCodeErr(data.error); return }
        throw new Error(data?.error || '修改失败')
      }
      toast({ title: '✅ 密码已修改', description: data?.message })
      setOldPwd(''); setNewPwd(''); setConfirmPwd(''); setPwdCode('')
    } catch (e: any) { toast({ title: '❌ 修改失败', description: e?.message, variant: 'destructive' }) }
    finally { setSavingPwd(false) }
  }

  const handleCreateAdmin = async () => {
    if (!isSuperAdmin || creating) return
    if (!newAdminPhone.trim()) { toast({ title: '缺少手机号', variant: 'destructive' }); return }
    setCreating(true)
    try {
      const res = await fetch('/api/admin/managers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: newAdminEmail.trim() || undefined, phone: newAdminPhone.trim(), password: newAdminPassword.trim() || undefined }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || '创建失败')
      toast({ title: '✅ 管理员已创建', description: data?.tempPassword ? `临时密码：${data.tempPassword}` : '已使用您输入的密码创建账号' })
      setNewAdminEmail(''); setNewAdminPhone(''); setNewAdminPassword('')
    } catch (e: any) { toast({ title: '❌ 创建失败', description: e?.message, variant: 'destructive' }) }
    finally { setCreating(false) }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="fixed inset-0 pointer-events-none bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-40" />
      <div className="relative z-10 container mx-auto px-6 py-10 max-w-3xl">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/30"><Shield className="w-5 h-5 text-white" /></div>
            <h1 className="text-3xl font-bold tracking-tight">Admin 个人资料</h1>
          </div>
          <p className="text-slate-500 text-sm ml-[52px]">管理您的账号信息、密码与权限配置</p>
        </motion.div>
        <div className="space-y-5">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-8">
            <div className="flex items-start gap-6 mb-8">
              <Avatar name={user?.email || user?.phone || 'A'} role={user?.role || ''} />
              <div className="flex-1 min-w-0 pt-1">
                <div className="flex items-center gap-2 mb-1.5">
                  <h2 className="text-xl font-bold text-white truncate">{user?.email || user?.phone || '管理员'}</h2>
                  {isSuperAdmin
                    ? <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-gradient-to-r from-amber-500 to-orange-500 text-white flex-shrink-0"><Crown className="w-3 h-3" /> SUPER ADMIN</span>
                    : <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-600/20 text-blue-300 border border-blue-500/30 flex-shrink-0"><Shield className="w-3 h-3" /> ADMIN</span>
                  }
                </div>
                <p className="text-slate-500 text-sm">账号 ID：<span className="font-mono text-slate-400">{user?.id}</span></p>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <InfoRow icon={Mail} label="注册邮箱" value={user?.email || ''} />
              <InfoRow icon={Phone} label="绑定手机号" value={user?.phone || ''} />
              <InfoRow icon={Shield} label="权限等级" value={user?.role || ''} />
              <InfoRow icon={User} label="账号 ID" value={user?.id || ''} />
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center"><User className="w-4 h-4 text-blue-400" /></div>
              <h2 className="text-lg font-bold text-white">基础信息</h2>
            </div>
            <div className="grid md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5 font-medium">显示名称 / 姓名</label>
                <input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="例如：张三" className="w-full bg-slate-900/60 border border-slate-700/60 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/60 transition-all" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5 font-medium">联系电话</label>
                <input value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="例如：13800138000" className="w-full bg-slate-900/60 border border-slate-700/60 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/60 transition-all" />
              </div>
            </div>
            <div className="mb-6">
              <CodeRow value={infoCode} onChange={setInfoCode} sending={sendingInfoCode} countdown={infoCountdown.seconds} onSend={() => sendCode('update', setSendingInfoCode, infoCountdown)} accentClass="border-blue-500/40 bg-blue-600/20 text-blue-300 hover:bg-blue-600/30" />
              {infoCodeErr && <p className="mt-1.5 text-xs text-rose-400 flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" />{infoCodeErr}</p>}
            </div>
            <button onClick={handleSaveInfo} disabled={savingInfo} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 shadow-lg shadow-blue-500/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed">
              {savingInfo ? <><Loader2 className="w-4 h-4 animate-spin" />保存中...</> : <><Save className="w-4 h-4" />保存基础信息</>}
            </button>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-lg bg-rose-600/20 border border-rose-500/30 flex items-center justify-center"><KeyRound className="w-4 h-4 text-rose-400" /></div>
              <h2 className="text-lg font-bold text-white">安全设置</h2>
              <span className="ml-auto text-xs text-slate-600">修改登录密码</span>
            </div>
            <div className="space-y-4 mb-4">
              <PasswordInput label="当前密码" value={oldPwd} onChange={setOldPwd} placeholder="请输入当前登录密码" />
              <div className="grid md:grid-cols-2 gap-4">
                <PasswordInput label="新密码" value={newPwd} onChange={setNewPwd} placeholder="至少 8 位" />
                <PasswordInput label="确认新密码" value={confirmPwd} onChange={setConfirmPwd} placeholder="再次输入新密码" />
              </div>
              {newPwd && confirmPwd && newPwd !== confirmPwd && <p className="text-xs text-rose-400 flex items-center gap-1"><Lock className="w-3.5 h-3.5" />两次输入的新密码不一致</p>}
              {newPwd && newPwd.length < 8 && <p className="text-xs text-amber-400 flex items-center gap-1"><Lock className="w-3.5 h-3.5" />新密码至少需要 8 位</p>}
            </div>
            <div className="mb-6">
              <CodeRow value={pwdCode} onChange={setPwdCode} sending={sendingPwdCode} countdown={pwdCountdown.seconds} onSend={() => sendCode('password', setSendingPwdCode, pwdCountdown)} accentClass="border-rose-500/40 bg-rose-600/20 text-rose-300 hover:bg-rose-600/30" />
              {pwdCodeErr && <p className="mt-1.5 text-xs text-rose-400 flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" />{pwdCodeErr}</p>}
            </div>
            <button onClick={handleSavePassword} disabled={savingPwd} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-rose-600 to-orange-500 hover:from-rose-500 hover:to-orange-400 shadow-lg shadow-rose-500/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed">
              {savingPwd ? <><Loader2 className="w-4 h-4 animate-spin" />修改中...</> : <><KeyRound className="w-4 h-4" />确认修改密码</>}
            </button>
          </motion.div>
          {isSuperAdmin && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-600/20 border border-amber-500/30 flex items-center justify-center"><Crown className="w-4 h-4 text-amber-400" /></div>
                  <h2 className="text-lg font-bold text-white">子管理员管理</h2>
                </div>
                <button onClick={handleCreateAdmin} disabled={creating} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-500 hover:to-orange-400 shadow-lg shadow-amber-500/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed">
                  {creating ? <><Loader2 className="w-4 h-4 animate-spin" />创建中...</> : <><Plus className="w-4 h-4" />确认授予 ADMIN 权限</>}
                </button>
              </div>
              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5 font-medium">新管理员邮箱（可选）</label>
                  <input value={newAdminEmail} onChange={e => setNewAdminEmail(e.target.value)} placeholder="admin@yourdomain.com" className="w-full bg-slate-900/60 border border-slate-700/60 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/60 transition-all" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5 font-medium">新管理员手机号（必填）</label>
                  <input value={newAdminPhone} onChange={e => setNewAdminPhone(e.target.value)} placeholder="例如：13800138000" className="w-full bg-slate-900/60 border border-slate-700/60 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/60 transition-all" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5 font-medium">初始密码（可选）</label>
                <input value={newAdminPassword} onChange={e => setNewAdminPassword(e.target.value)} placeholder="留空则系统生成临时密码" className="w-full bg-slate-900/60 border border-slate-700/60 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/60 transition-all" />
                <p className="mt-2 text-[11px] text-slate-600 flex items-center gap-1"><Lock className="w-3 h-3" />该接口仅 SUPER_ADMIN 可调用。</p>
              </div>
            </motion.div>
          )}
          {!isSuperAdmin && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-1"><Shield className="w-5 h-5 text-blue-300" /><span className="text-white font-bold">权限说明</span></div>
              <p className="text-slate-400 text-sm">您是普通管理员，如需添加人员请联系 <span className="text-amber-300 font-semibold">SUPER_ADMIN</span>。</p>
            </motion.div>
          )}

        </div>
      </div>
    </div>
  )
}