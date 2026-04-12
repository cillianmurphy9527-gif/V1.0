"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Trash2, Plus, Save, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"

interface KnowledgeManagerProps {
  isOpen: boolean
  onClose: () => void
  knowledge: string[]
  onSave: (updatedKnowledge: string[]) => void
}

export function KnowledgeManager({ isOpen, onClose, knowledge, onSave }: KnowledgeManagerProps) {
  const [editableKnowledge, setEditableKnowledge] = useState<string[]>(knowledge)
  const [newItem, setNewItem] = useState('')
  const [showNewInput, setShowNewInput] = useState(false)

  // 更新某个知识点
  const handleUpdate = (index: number, value: string) => {
    const updated = [...editableKnowledge]
    updated[index] = value
    setEditableKnowledge(updated)
  }

  // 删除某个知识点
  const handleDelete = (index: number) => {
    const updated = editableKnowledge.filter((_, i) => i !== index)
    setEditableKnowledge(updated)
  }

  // 添加新知识点
  const handleAdd = () => {
    if (newItem.trim()) {
      setEditableKnowledge([...editableKnowledge, newItem.trim()])
      setNewItem('')
      setShowNewInput(false)
    }
  }

  // 保存并关闭
  const handleSave = () => {
    onSave(editableKnowledge.filter(item => item.trim()))
    onClose()
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* 背景遮罩 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* 侧边抽屉 */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-2xl bg-slate-900 border-l border-slate-700 shadow-2xl z-50 flex flex-col"
          >
            {/* 头部 */}
            <div className="flex-shrink-0 border-b border-slate-700 p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">AI 核心知识库</h2>
                    <p className="text-sm text-slate-400 mt-1">企业资产</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <p className="text-slate-400 text-sm leading-relaxed">
                查看、修改或新增 AI 已掌握的业务卖点，这些内容将直接决定开发信的质量。
              </p>
            </div>

            {/* 可编辑列表 */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {editableKnowledge.map((item, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="group relative"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <textarea
                        value={item}
                        onChange={(e) => handleUpdate(index, e.target.value)}
                        className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none transition-all"
                        rows={2}
                      />
                    </div>
                    <button
                      onClick={() => handleDelete(index)}
                      className="flex-shrink-0 w-10 h-10 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 hover:border-red-500/40 transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-5 h-5 mx-auto" />
                    </button>
                  </div>
                </motion.div>
              ))}

              {/* 新增输入框 */}
              {showNewInput && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="space-y-3"
                >
                  <textarea
                    value={newItem}
                    onChange={(e) => setNewItem(e.target.value)}
                    placeholder="例如：近期针对欧洲渠道商有 20% 的返佣政策"
                    className="w-full bg-slate-800/50 border-2 border-purple-500/50 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                    rows={3}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={handleAdd}
                      size="sm"
                      className="bg-purple-600 hover:bg-purple-500 text-white"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      确认添加
                    </Button>
                    <Button
                      onClick={() => {
                        setShowNewInput(false)
                        setNewItem('')
                      }}
                      size="sm"
                      variant="outline"
                      className="border-slate-600 text-slate-300 hover:bg-slate-800"
                    >
                      取消
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* 添加新卖点按钮 */}
              {!showNewInput && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowNewInput(true)}
                  className="w-full border-2 border-dashed border-slate-600 hover:border-purple-500/50 rounded-xl p-6 text-slate-400 hover:text-purple-400 transition-all group"
                >
                  <div className="flex items-center justify-center gap-2">
                    <Plus className="w-5 h-5" />
                    <span className="font-medium">手动添加新卖点 (Add new manual context)</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    补充最新政策、临时优惠或其他重要信息
                  </p>
                </motion.button>
              )}
            </div>

            {/* 底部操作栏 */}
            <div className="flex-shrink-0 border-t border-slate-700 p-6 bg-slate-900/80 backdrop-blur-xl">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm text-slate-400">
                  共 <span className="text-white font-bold">{editableKnowledge.length}</span> 条知识点
                </div>
                <div className="text-xs text-slate-500">
                  修改后将立即生效
                </div>
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={onClose}
                  variant="outline"
                  className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-800"
                >
                  取消
                </Button>
                <Button
                  onClick={handleSave}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-lg shadow-purple-500/30"
                >
                  <Save className="w-4 h-4 mr-2" />
                  💾 保存并更新 AI 大脑
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
