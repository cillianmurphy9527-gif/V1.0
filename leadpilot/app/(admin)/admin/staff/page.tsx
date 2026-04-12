'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  UserCog, Plus, Trash2, RefreshCw, ShieldCheck,
  AlertCircle, Loader2, X, ChevronDown
} from 'lucide-react'

type StaffMember = {
  id: string
  email: string | null
  phone: string
  adminRole: string
  createdAt: string
}

const ROLE_OPTIONS = [
  { value: 'SUPER_ADMIN', label: '超级管理员', color: 'text-amber-400 bg-amber-500/20 border-amber-500/40' },
  { value: 'FINANCE',     label: '财务',       color: 'text-emerald-400 bg-emerald-500/20 border-emerald-500/40' },
  { value: 'OPS',         label: '运营',       color: 'text-blue-400 bg-blue-500/20 border-blue-500/40' },
]

function RoleBadge({ role }: { role: string }) {
  const opt = ROLE_OPTIONS.find(r => r.value === role)
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${opt?.color ?? 'text-slate-400 bg-slate-800 border-slate-700'}`}>
      <ShieldCheck className="w-3 h-3" />
      {opt?.label ?? role}
    </span>
  )
}

function AddStaffModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [email, setEmail] = useState('')
  const [adminRole, setAdminRole] = useState('FINANCE')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/admin/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), adminRole }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '添加失败')
      onSuccess(); onClose()
    } catch (err: any) { setError(err.message) }
    finally { setLoading(false) }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl">
          <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center"><Plus className="w-5 h-5 text-amber-400" /></div>
            <div><h2 className="text-lg font-bold text-white">添加内部员工</h2><p className="text-xs text-slate-400">为已注册用户分配管理角色</p></div>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">用户邮箱</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="输入已注册用户的邮箱" required
                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">分配角色</label>
              <div className="relative">
                <select value={adminRole} onChange={e => setAdminRole(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500 appearance-none transition-all">
                  {ROLE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
              <p className="mt-1.5 text-xs text-slate-500">
                {adminRole === 'SUPER_ADMIN' && '可访问所有功能，包括用户管理与权限配置'}
                {adminRole === 'FINANCE' && '仅可访问财务大盘、订单管理、退款审批'}
                {adminRole === 'OPS' && '仅可访问订单管理、系统配置、广播与工单'}
              </p>
            </div>
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="flex-1 py-3 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 transition-all font-medium">取消</button>
              <button type="submit" disabled={loading} className="flex-1 py-3 rounded-lg bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 disabled:opacity-50 text-white font-semibold transition-all flex items-center justify-center gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {loading ? '添加中...' : '确认添加'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}

export default function StaffPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editRole, setEditRole] = useState('')

  const adminRole = (session?.user as any)?.adminRole as string | undefined
  const isSuperAdmin = adminRole === 'SUPER_ADMIN' || session?.user?.role === 'SUPER_ADMIN'

  const fetchStaff = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/admin/staff')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '获取失败')
      setStaff(data.staff)
    } catch (err: any) { setError(err.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/admin-login'); return }
    if (status === 'authenticated') fetchStaff()
  }, [status, fetchStaff, router])

  const handleDelete = async (userId: string) => {
    if (!confirm('确认撤销该员工的管理权限？')) return
    setDeletingId(userId)
    try {
      const res = await fetch(`/api/admin/staff?userId=${userId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '撤销失败')
      fetchStaff()
    } catch (err: any) { alert(err.message) }
    finally { setDeletingId(null) }
  }

  const handleRoleChange = async (userId: string) => {
    try {
      const res = await fetch('/api/admin/staff', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, adminRole: editRole }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '更新失败')
      setEditingId(null); fetchStaff()
    } catch (err: any) { alert(err.message) }
  }

  if (status === 'loading') return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 text-amber-500 animate-spin" /></div>

  if (!isSuperAdmin) return (
    <div className="p-10">
      <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
        <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0" />
        <div><div className="text-white font-semibold">访问被拒绝</div><div className="text-slate-400 text-sm mt-0.5">仅超级管理员可访问员工权限管理页面</div></div>
      </div>
    </div>
  )

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center"><UserCog className="w-6 h-6 text-amber-400" /></div>
          <div><h1 className="text-2xl font-bold text-white">员工与权限管理</h1><p className="text-slate-400 text-sm mt-0.5">管理内部员工的系统访问角色</p></div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchStaff} disabled={loading} className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 transition-all text-sm">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />刷新
          </button>
          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-semibold transition-all text-sm shadow-lg shadow-amber-500/20">
            <Plus className="w-4 h-4" />添加员工
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {ROLE_OPTIONS.map(opt => (
          <div key={opt.value} className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl">
            <RoleBadge role={opt.value} />
            <p className="text-xs text-slate-500 mt-2">
              {opt.value === 'SUPER_ADMIN' && '可访问所有功能模块，包括用户管理、财务、权限配置'}
              {opt.value === 'FINANCE' && '仅可访问财务大盘、订单管理、退款审批'}
              {opt.value === 'OPS' && '仅可访问订单管理、系统配置、广播与工单大厅'}
            </p>
          </div>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 mb-6 bg-red-500/10 border border-red-500/30 rounded-xl">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">内部员工列表</h2>
          <span className="text-xs text-slate-500">{staff.length} 人</span>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 text-amber-500 animate-spin" /></div>
        ) : staff.length === 0 ? (
          <div className="py-16 text-center">
            <UserCog className="w-12 h-12 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">暂无内部员工</p>
            <p className="text-slate-600 text-xs mt-1">点击「添加员工」为用户分配管理角色</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {staff.map(member => (
              <div key={member.id} className="px-6 py-4 flex items-center gap-4 hover:bg-slate-800/30 transition-colors">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {(member.email?.[0] ?? member.phone?.[0] ?? '?').toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white truncate">{member.email || '—'}</div>
                  <div className="text-xs text-slate-500 mt-0.5">手机：{member.phone} · 加入：{new Date(member.createdAt).toLocaleDateString('zh-CN')}</div>
                </div>
                <div className="flex-shrink-0">
                  {editingId === member.id ? (
                    <div className="flex items-center gap-2">
                      <select value={editRole} onChange={e => setEditRole(e.target.value)}
                        className="px-3 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-white text-xs focus:outline-none focus:ring-2 focus:ring-amber-500">
                        {ROLE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                      </select>
                      <button onClick={() => handleRoleChange(member.id)} className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs rounded-lg font-medium transition-colors">保存</button>
                      <button onClick={() => setEditingId(null)} className="px-3 py-1.5 border border-slate-700 text-slate-400 hover:text-white text-xs rounded-lg transition-colors">取消</button>
                    </div>
                  ) : (
                    <button onClick={() => { setEditingId(member.id); setEditRole(member.adminRole) }} className="hover:opacity-80 transition-opacity">
                      <RoleBadge role={member.adminRole} />
                    </button>
                  )}
                </div>
                <button onClick={() => handleDelete(member.id)} disabled={deletingId === member.id}
                  className="flex-shrink-0 p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-50 transition-all" title="撤销管理权限">
                  {deletingId === member.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      {showAddModal && <AddStaffModal onClose={() => setShowAddModal(false)} onSuccess={fetchStaff} />}
    </div>
  )
}


