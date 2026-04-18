"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Store, Edit, Plus, Trash2, Save, X, Eye, EyeOff, LayoutTemplate } from "lucide-react"

export default function StoreCMSPage() {
  const [storeData, setStoreData] = useState<any>({ groups: [] });
  const [activeGroupId, setActiveGroupId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [editingProduct, setEditingProduct] = useState<any>(null);

  useEffect(() => { fetchStoreData(); }, []);

  const fetchStoreData = async () => {
    setLoading(true);
    const res = await fetch('/api/admin/products');
    const json = await res.json();
    if (json.success && json.data.groups) {
      setStoreData(json.data);
      if (json.data.groups.length > 0) setActiveGroupId(json.data.groups[0].id);
    }
    setLoading(false);
  };

  const handleSaveAll = async (newData: any) => {
    setStoreData(newData); // 乐观更新
    await fetch('/api/admin/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save_all', data: newData })
    });
  };

  // --- 分组管理 ---
  const addGroup = () => {
    const newGroup = { id: `g_${Date.now()}`, name: '新建分类', desc: '在这里输入分类描述', icon: 'Zap', cardType: 'quota', items: [] };
    handleSaveAll({ ...storeData, groups: [...storeData.groups, newGroup] });
    setActiveGroupId(newGroup.id);
  };

  const deleteGroup = (id: string) => {
    if(!confirm('确定删除整个分类及其所有商品吗？前端将立即消失。')) return;
    const newGroups = storeData.groups.filter((g:any) => g.id !== id);
    handleSaveAll({ ...storeData, groups: newGroups });
    if(newGroups.length > 0) setActiveGroupId(newGroups[0].id);
  };

  const updateActiveGroup = (field: string, value: string) => {
    const newGroups = storeData.groups.map((g:any) => g.id === activeGroupId ? { ...g, [field]: value } : g);
    handleSaveAll({ ...storeData, groups: newGroups });
  };

  // --- 商品管理 ---
  const toggleStatus = (productId: string) => {
    const newGroups = storeData.groups.map((g:any) => g.id === activeGroupId ? {
      ...g, items: g.items.map((i:any) => i.id === productId ? { ...i, status: i.status === 'active' ? 'inactive' : 'active' } : i)
    } : g);
    handleSaveAll({ ...storeData, groups: newGroups });
  };

  const deleteProduct = (productId: string) => {
    if(!confirm('确定删除此商品吗？')) return;
    const newGroups = storeData.groups.map((g:any) => g.id === activeGroupId ? {
      ...g, items: g.items.filter((i:any) => i.id !== productId)
    } : g);
    handleSaveAll({ ...storeData, groups: newGroups });
  };

  const saveProductEdit = () => {
    if (!editingProduct.name || !editingProduct.price) return alert("名称和价格必填");
    const isNew = !editingProduct.id;
    const prodToSave = { ...editingProduct, id: isNew ? `prod_${Date.now()}` : editingProduct.id };
    
    const newGroups = storeData.groups.map((g:any) => {
      if (g.id === activeGroupId) {
        if (isNew) return { ...g, items: [...g.items, prodToSave] };
        return { ...g, items: g.items.map((i:any) => i.id === prodToSave.id ? prodToSave : i) };
      }
      return g;
    });
    handleSaveAll({ ...storeData, groups: newGroups });
    setEditingProduct(null);
  };

  const activeGroup = storeData.groups.find((g:any) => g.id === activeGroupId);

  if (loading) return <div className="flex h-screen items-center justify-center bg-[#0B1120] text-orange-500 font-bold">正在接入中枢...</div>

  return (
    <div className="p-6 text-white min-h-screen bg-[#0B1120]">
      <div className="flex justify-between items-start mb-8 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center tracking-tight"><Store className="w-8 h-8 mr-4 text-orange-500" /> 商城模块化构建中心</h1>
          <p className="text-slate-400 text-sm mt-2">自由增删商品分类，实时配置每个商品的专属文案与阶梯定价。</p>
        </div>
        <button onClick={addGroup} className="bg-emerald-600 hover:bg-emerald-500 px-5 py-2.5 rounded-xl font-bold shadow-lg flex items-center"><Plus className="w-4 h-4 mr-2" />新建前台分类栏目</button>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* 左侧分类导航 */}
        <div className="w-full lg:w-64 flex-shrink-0 space-y-2">
          {storeData.groups.map((g:any) => (
            <button key={g.id} onClick={() => setActiveGroupId(g.id)} className={`w-full text-left px-4 py-3 rounded-xl transition-all flex items-center justify-between group ${activeGroupId === g.id ? 'bg-orange-500/10 border border-orange-500/50 text-orange-400 font-bold' : 'bg-slate-900 border border-slate-800 text-slate-400 hover:bg-slate-800'}`}>
              <span className="truncate">{g.name}</span>
              <span className="bg-slate-950 px-2 py-0.5 rounded-md text-[10px]">{g.items.length}</span>
            </button>
          ))}
        </div>

        {/* 右侧分类详情与商品管理 */}
        {activeGroup && (
          <div className="flex-1 min-w-0 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl">
            {/* 分类设置面板 */}
            <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-5 mb-8 relative">
              <div className="absolute top-4 right-4"><button onClick={() => deleteGroup(activeGroup.id)} className="text-red-500/50 hover:text-red-400 p-2"><Trash2 className="w-5 h-5" /></button></div>
              <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center"><LayoutTemplate className="w-4 h-4 mr-2" /> 分类栏目设置</h2>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div><label className="text-xs text-slate-500 mb-1 block">分类名称 (展示在前端)</label><input type="text" value={activeGroup.name} onChange={e => updateActiveGroup('name', e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:border-orange-500" /></div>
                <div><label className="text-xs text-slate-500 mb-1 block">卡片样式模型</label>
                  <select value={activeGroup.cardType} onChange={e => updateActiveGroup('cardType', e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:border-orange-500">
                    <option value="plan">核心套餐 (PlanCard)</option><option value="quota">小图标版 (QuotaCard)</option><option value="domain">横向长版 (DomainCard)</option><option value="template">模块化版 (TemplateCard)</option><option value="premium">高亮尊享版 (PremiumCard)</option>
                  </select>
                </div>
              </div>
              <div><label className="text-xs text-slate-500 mb-1 block">分类描述副标题</label><input type="text" value={activeGroup.desc} onChange={e => updateActiveGroup('desc', e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:border-orange-500" /></div>
            </div>

            {/* 商品列表 */}
            <div className="flex justify-between items-end mb-4">
              <h2 className="text-lg font-bold">分类下商品 ({activeGroup.items.length})</h2>
              <button onClick={() => setEditingProduct({ name: '', price: 99, status: 'active', modalDetail: '', allowTiers: false, tierPrices: [] })} className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center"><Plus className="w-3.5 h-3.5 mr-1" /> 新增商品至本类</button>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {activeGroup.items.map((item:any) => (
                <div key={item.id} className={`bg-slate-950 border p-4 rounded-xl flex flex-col justify-between ${item.status === 'inactive' ? 'opacity-50 border-red-900/30' : 'border-slate-800 hover:border-slate-600'}`}>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-white truncate pr-2">{item.name}</h3>
                    <div className="flex items-center gap-1">
                      <button onClick={() => toggleStatus(item.id)} className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-300">{item.status === 'active' ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 text-red-400" />}</button>
                      <button onClick={() => deleteProduct(item.id)} className="p-1.5 bg-slate-800 hover:bg-red-500/20 rounded text-slate-500 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                  <div className="text-emerald-400 font-black text-xl mb-3">¥{item.price}</div>
                  <button onClick={() => setEditingProduct({...item})} className="w-full bg-slate-800 hover:bg-slate-700 py-2 rounded-lg text-xs font-bold transition-colors">编辑属性与阶梯价</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 编辑商品弹窗 */}
      <AnimatePresence>
        {editingProduct && (
          <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4 backdrop-blur-md">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
              <div className="p-5 bg-slate-800/50 border-b border-slate-700 flex justify-between items-center"><h2 className="text-lg font-bold text-white">{editingProduct.id ? '编辑商品属性' : '新增商品'}</h2><button onClick={() => setEditingProduct(null)}><X className="text-slate-400 hover:text-white" /></button></div>
              <div className="p-6 space-y-5 overflow-y-auto flex-1 custom-scrollbar">
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-xs text-slate-400 mb-1 block">商品名称</label><input type="text" value={editingProduct.name} onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-bold outline-none focus:border-orange-500" /></div>
                  <div><label className="text-xs text-slate-400 mb-1 block">基础售价 (CNY)</label><input type="number" value={editingProduct.price} onChange={e => setEditingProduct({...editingProduct, price: Number(e.target.value)})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-emerald-400 font-bold outline-none focus:border-orange-500" /></div>
                </div>
                <div><label className="text-xs text-slate-400 mb-1 block">商品详细介绍 (支持多行)</label><textarea rows={6} value={editingProduct.modalDetail} onChange={e => setEditingProduct({...editingProduct, modalDetail: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm outline-none focus:border-orange-500 resize-none" /></div>
                
                {/* 阶梯定价模块 */}
                <div className="border border-slate-700 rounded-xl p-4 bg-slate-950/50">
                  <label className="flex items-center text-sm font-bold text-white mb-3 cursor-pointer">
                    <input type="checkbox" checked={editingProduct.allowTiers || false} onChange={e => setEditingProduct({...editingProduct, allowTiers: e.target.checked})} className="mr-2" /> 开启商品专属阶梯定价 (多买多省)
                  </label>
                  {editingProduct.allowTiers && (
                    <div className="space-y-2">
                      {(editingProduct.tierPrices||[]).map((tier:any, idx:number) => (
                        <div key={idx} className="flex items-center gap-2 bg-slate-800 p-2 rounded-lg border border-slate-700">
                          <span className="text-xs text-slate-400">起购数量≥</span>
                          <input type="number" value={tier.min} onChange={e => { const t = [...editingProduct.tierPrices]; t[idx].min = Number(e.target.value); setEditingProduct({...editingProduct, tierPrices: t})}} className="w-16 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-center text-sm text-white" />
                          <span className="text-xs text-slate-400 ml-2">单价¥</span>
                          <input type="number" value={tier.price} onChange={e => { const t = [...editingProduct.tierPrices]; t[idx].price = Number(e.target.value); setEditingProduct({...editingProduct, tierPrices: t})}} className="w-20 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-center text-sm text-emerald-400 font-bold" />
                          <button onClick={() => { const t = editingProduct.tierPrices.filter((_:any,i:number)=>i!==idx); setEditingProduct({...editingProduct, tierPrices: t})}} className="ml-auto text-slate-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      ))}
                      <button onClick={() => setEditingProduct({...editingProduct, tierPrices: [...(editingProduct.tierPrices||[]), {min: 2, price: editingProduct.price}]})} className="w-full py-2 border border-dashed border-slate-600 rounded-lg text-slate-400 text-xs font-bold hover:text-white">新增阶梯</button>
                    </div>
                  )}
                </div>
              </div>
              <div className="p-5 border-t border-slate-700 bg-slate-800/30 flex justify-end gap-3 flex-shrink-0">
                <button onClick={() => setEditingProduct(null)} className="px-5 py-2 rounded-lg text-slate-400 text-sm font-bold">取消</button>
                <button onClick={saveProductEdit} className="px-6 py-2 rounded-lg bg-orange-600 text-white text-sm font-bold shadow-lg">确定保存</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}