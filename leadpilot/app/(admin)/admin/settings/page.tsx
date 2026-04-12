"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Settings, Save, Plus, Trash2, Edit2, X, AlertCircle, CheckCircle2, Search } from "lucide-react"
import { Button } from "@/components/ui/button"

type SystemSetting = {
  key: string
  value: any
  category: string
  description?: string
}

type Category = 'pricing' | 'faq' | 'features' | 'general'

const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'pricing', label: '定价配置' },
  { id: 'features', label: '功能开关' },
  { id: 'faq', label: 'FAQ 内容' },
  { id: 'general', label: '通用配置' },
]

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<SystemSetting[]>([])
  const [filteredSettings, setFilteredSettings] = useState<SystemSetting[]>([])
  const [selectedCategory, setSelectedCategory] = useState<Category | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    key: '',
    value: '',
    category: 'general' as Category,
    description: '',
  })

  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deletingKey, setDeletingKey] = useState<string | null>(null)
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  useEffect(() => {
    loadSettings()
  }, [])

  useEffect(() => {
    filterSettings()
  }, [settings, selectedCategory, searchQuery])

  const loadSettings = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/settings')
      if (response.ok) {
        const data = await response.json()
        const settingsArray = Object.entries(data.settings || {}).map(([key, value]) => ({
          key,
          value,
          category: key.split('.')[0] as Category,
          description: '',
        }))
        setSettings(settingsArray)
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
      showNotification('error', '加载配置失败')
    } finally {
      setLoading(false)
    }
  }

  const filterSettings = () => {
    let filtered = settings
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(s => s.category === selectedCategory)
    }
    if (searchQuery) {
      filtered = filtered.filter(s =>
        s.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }
    setFilteredSettings(filtered)
  }

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 3000)
  }

  const handleEdit = (setting: SystemSetting) => {
    setEditingKey(setting.key)
    setFormData({
      key: setting.key,
      value: typeof setting.value === 'string' ? setting.value : JSON.stringify(setting.value, null, 2),
      category: setting.category as Category,
      description: setting.description || '',
    })
    setShowEditModal(true)
  }

  const handleNew = () => {
    setEditingKey(null)
    setFormData({ key: '', value: '', category: 'general', description: '' })
    setShowEditModal(true)
  }

  const handleSave = async () => {
    if (!formData.key || !formData.value) {
      showNotification('error', '请填写完整信息')
      return
    }

    setSaving(true)
    try {
      let parsedValue: any
      try {
        parsedValue = JSON.parse(formData.value)
      } catch {
        parsedValue = formData.value
      }

      const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: formData.key,
          value: parsedValue,
          category: formData.category,
          description: formData.description,
        }),
      })

      if (response.ok) {
        showNotification('success', editingKey ? '配置已更新' : '配置已创建')
        setShowEditModal(false)
        loadSettings()
      } else {
        const error = await response.json()
        showNotification('error', error?.error || '保存失败')
      }
    } catch (error) {
      showNotification('error', '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingKey) return
    setSaving(true)
    try {
      const response = await fetch(`/api/admin/settings?key=${deletingKey}`, { method: 'DELETE' })
      if (response.ok) {
        showNotification('success', '配置已删除')
        setShowDeleteModal(false)
        setDeletingKey(null)
        loadSettings()
      } else {
        showNotification('error', '删除失败')
      }
    } catch (error) {
      showNotification('error', '删除失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2">系统配置中心</h1>
          <p className="text-slate-400">CMS 动态配置管理</p>
        </div>
        <Button onClick={handleNew} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white">
          <Plus className="w-4 h-4" />新增配置
        </Button>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => setSelectedCategory('all')} className={`px-4 py-2 rounded-xl text-sm font-semibold ${selectedCategory === 'all' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}>全部</button>
        {CATEGORIES.map(cat => (
          <button key={cat.id} onClick={() => setSelectedCategory(cat.id)} className={`px-4 py-2 rounded-xl text-sm font-semibold ${selectedCategory === cat.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}>{cat.label}</button>
        ))}
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="搜索配置键..." className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-slate-900/50 border border-slate-700 rounded-3xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">加载中...</div>
        ) : filteredSettings.length === 0 ? (
          <div className="p-12 text-center text-slate-400">暂无配置</div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-800/50 border-b border-slate-700">
              <tr>
                <th className="text-left py-4 px-6 text-sm font-semibold text-slate-400">配置键</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-slate-400">分类</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-slate-400">值</th>
                <th className="text-right py-4 px-6 text-sm font-semibold text-slate-400">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredSettings.map((setting, index) => (
                <tr key={setting.key} className="border-b border-slate-800 hover:bg-slate-800/30">
                  <td className="py-4 px-6"><span className="text-white font-mono text-sm">{setting.key}</span></td>
                  <td className="py-4 px-6"><span className="px-2 py-1 bg-blue-500/15 border border-blue-500/30 rounded text-xs text-blue-400">{setting.category}</span></td>
                  <td className="py-4 px-6"><div className="max-w-xs truncate text-slate-300 text-sm">{typeof setting.value === 'object' ? JSON.stringify(setting.value) : String(setting.value)}</div></td>
                  <td className="py-4 px-6">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => handleEdit(setting)} className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-lg"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => { setDeletingKey(setting.key); setShowDeleteModal(true) }} className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </motion.div>

      {showEditModal && (
        <>
          <div className="fixed inset-0 bg-black/60 z-50" onClick={() => setShowEditModal(false)} />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="relative max-w-2xl w-full bg-slate-900 border border-slate-700 rounded-3xl p-8 max-h-[90vh] overflow-y-auto">
              <button onClick={() => setShowEditModal(false)} className="absolute top-5 right-5 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center"><Settings className="w-6 h-6 text-blue-400" /></div>
                <div><h3 className="text-2xl font-bold text-white">{editingKey ? '编辑配置' : '新增配置'}</h3></div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">配置键 <span className="text-red-400">*</span></label>
                  <input type="text" value={formData.key} onChange={(e) => setFormData({ ...formData, key: e.target.value })} disabled={!!editingKey} placeholder="例如：pricing.starter.price" className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white font-mono disabled:opacity-50" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">分类</label>
                  <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value as Category })} className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white">
                    {CATEGORIES.map(cat => (<option key={cat.id} value={cat.id}>{cat.label}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">值 <span className="text-red-400">*</span></label>
                  <textarea value={formData.value} onChange={(e) => setFormData({ ...formData, value: e.target.value })} rows={6} className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white font-mono text-sm" />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <Button onClick={() => setShowEditModal(false)} variant="outline" className="flex-1">取消</Button>
                <Button onClick={handleSave} disabled={saving || !formData.key || !formData.value} className="flex-1 bg-blue-600"><Save className="w-4 h-4 mr-2" />{saving ? '保存中...' : '保存'}</Button>
              </div>
            </motion.div>
          </div>
        </>
      )}

      {showDeleteModal && deletingKey && (
        <>
          <div className="fixed inset-0 bg-black/70 z-50" onClick={() => setShowDeleteModal(false)} />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-md w-full bg-slate-900 border-2 border-red-500/50 rounded-3xl p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-6"><AlertCircle className="w-8 h-8 text-red-400" /></div>
              <h3 className="text-2xl font-bold text-white mb-2">确认删除？</h3>
              <p className="text-slate-400 text-sm mb-6">配置键：<span className="text-white font-mono">{deletingKey}</span></p>
              <div className="flex gap-3">
                <Button onClick={() => setShowDeleteModal(false)} variant="outline" className="flex-1">取消</Button>
                <Button onClick={handleDelete} disabled={saving} className="flex-1 bg-red-600">{saving ? '删除中...' : '确认删除'}</Button>
              </div>
            </motion.div>
          </div>
        </>
      )}

      <AnimatePresence>
        {notification && (
          <motion.div initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -50 }} className="fixed top-6 right-6 z-[100]">
            <div className={`flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl ${notification.type === 'success' ? 'bg-emerald-500/20 border border-emerald-500/50' : 'bg-red-500/20 border border-red-500/50'}`}>
              {notification.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <AlertCircle className="w-5 h-5 text-red-400" />}
              <span className={notification.type === 'success' ? 'text-emerald-300 font-semibold' : 'text-red-300 font-semibold'}>{notification.message}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5" />
          <div><h3 className="text-white font-semibold mb-1">配置说明</h3><p className="text-slate-400 text-sm">系统配置支持 JSON 格式，修改后立即生效。请谨慎操作。</p></div>
        </div>
      </div>
    </div>
  )
}
