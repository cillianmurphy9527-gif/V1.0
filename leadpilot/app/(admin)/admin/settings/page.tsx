"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Store, Plus, Trash2, X, Eye, EyeOff, LayoutTemplate, ArrowUp, ArrowDown, Loader2, CheckCircle } from "lucide-react"

export default function StoreCMSPage() {
  const [storeData, setStoreData] = useState<any>({ groups: [] });
  const [activeGroupId, setActiveGroupId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const backupDataRef = useRef<any>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    fetchStoreData();
    return () => {
      isMounted.current = false; 
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); 
    };
  }, []);

  const fetchStoreData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/products');
      const json = await res.json();
      
      if (!isMounted.current) return;

      if (json.success && json.data.groups) {
        const sortedGroups = [...json.data.groups].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
        sortedGroups.forEach(g => {
          if(g.items) g.items.sort((a:any, b:any) => (a.sortOrder || 0) - (b.sortOrder || 0));
        });
        setStoreData({ groups: sortedGroups });
        backupDataRef.current = { groups: sortedGroups };
        if (sortedGroups.length > 0) setActiveGroupId(sortedGroups[0].id);
      }
    } catch (e) {
      if (isMounted.current) alert("初始化拉取数据失败，请检查网络！");
    } finally {
      if (isMounted.current) setLoading(false);
    }
  };

  const handleSaveAll = async (newData: any, immediate: boolean = false) => {
    const previousData = storeData; 
    
    const toSaveData = {
      groups: newData.groups.map((g: any, gIndex: number) => ({
        ...g, sortOrder: gIndex,
        items: (g.items || []).map((item: any, iIndex: number) => ({ ...item, sortOrder: iIndex }))
      }))
    };

    setStoreData(toSaveData); 

    const executeSave = async () => {
      if (!isMounted.current) return; 
      setIsSaving(true);
      try {
        const res = await fetch('/api/admin/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'save_all', data: toSaveData })
        });
        if (!res.ok) throw new Error("API 响应非 200");
        backupDataRef.current = toSaveData; 
      } catch (error) {
        console.error("保存失败", error);
        if (isMounted.current) {
          setStoreData(previousData); 
          alert("网络异常或服务器错误，刚才的修改未保存，已自动回滚！");
        }
      } finally {
        if (isMounted.current) setIsSaving(false);
      }
    };

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    if (immediate) {
      executeSave();
    } else {
      setIsSaving(true); 
      saveTimeoutRef.current = setTimeout(() => { executeSave(); }, 1200);
    }
  };

  const moveGroup = (index: number, direction: 'up' | 'down') => {
    const newGroups = [...storeData.groups];
    if (direction === 'up' && index > 0) {
      [newGroups[index - 1], newGroups[index]] = [newGroups[index], newGroups[index - 1]];
    } else if (direction === 'down' && index < newGroups.length - 1) {
      [newGroups[index], newGroups[index + 1]] = [newGroups[index + 1], newGroups[index]];
    }
    handleSaveAll({ ...storeData, groups: newGroups }, true); 
  };

  const addGroup = () => {
    const newGroup = { id: `g_${Date.now()}`, name: '新建分类', desc: '在这里输入分类描述', icon: 'Zap', cardType: 'quota', items: [] };
    handleSaveAll({ ...storeData, groups: [...storeData.groups, newGroup] }, true);
    setActiveGroupId(newGroup.id);
  };

  const deleteGroup = (id: string) => {
    if(!confirm('确定删除整个分类及其所有商品吗？前端将立即消失。')) return;
    const newGroups = storeData.groups.filter((g:any) => g.id !== id);
    handleSaveAll({ ...storeData, groups: newGroups }, true);
    if(newGroups.length > 0) setActiveGroupId(newGroups[0].id);
  };

  const updateActiveGroup = (field: string, value: string) => {
    const newGroups = storeData.groups.map((g:any) => g.id === activeGroupId ? { ...g, [field]: value } : g);
    handleSaveAll({ ...storeData, groups: newGroups }, false); 
  };

  const moveProduct = (groupId: string, index: number, direction: 'up' | 'down') => {
    const newGroups = storeData.groups.map((g: any) => {
      if (g.id !== groupId) return g;
      const newItems = [...g.items];
      if (direction === 'up' && index > 0) {
        [newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]];
      } else if (direction === 'down' && index < newItems.length - 1) {
        [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];
      }
      return { ...g, items: newItems };
    });
    handleSaveAll({ ...storeData, groups: newGroups }, true);
  };

  const toggleStatus = (productId: string) => {
    const newGroups = storeData.groups.map((g:any) => g.id === activeGroupId ? {
      ...g, items: g.items.map((i:any) => i.id === productId ? { ...i, status: i.status === 'active' ? 'inactive' : 'active' } : i)
    } : g);
    handleSaveAll({ ...storeData, groups: newGroups }, true);
  };

  const deleteProduct = (productId: string) => {
    if(!confirm('确定删除此商品吗？')) return;
    const newGroups = storeData.groups.map((g:any) => g.id === activeGroupId ? {
      ...g, items: g.items.filter((i:any) => i.id !== productId)
    } : g);
    handleSaveAll({ ...storeData, groups: newGroups }, true);
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
    handleSaveAll({ ...storeData, groups: newGroups }, true);
    setEditingProduct(null);
  };

  const activeGroup = storeData.groups.find((g:any) => g.id === activeGroupId);

  if (loading) return <div className="flex h-screen items-center justify-center bg-[#0B1120] text-orange-500 font-bold">正在接入中枢...</div>

  return (
    <div className="p-6 text-white min-h-screen bg-[#0B1120]">
      <div className="flex justify-between items-start mb-8 border-b border-slate-800 pb-6 relative">
        <div>
          <h1 className="text-3xl font-bold flex items-center tracking-tight"><Store className="w-8 h-8 mr-4 text-orange-500" /> 商城模块化构建中心</h1>
          <p className="text-slate-400 text-sm mt-2">自由增删、<span className="text-orange-400 font-bold">任意排序</span>，并实时配置每个商品的专属文案与阶梯定价。</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs font-bold text-slate-400">
            {isSaving ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin text-orange-500" /> <span className="text-orange-400">云端同步中...</span></>
            ) : (
              <><CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> <span>已同步最新状态</span></>
            )}
          </div>
          <button onClick={addGroup} className="bg-emerald-600 hover:bg-emerald-500 px-5 py-2.5 rounded-xl font-bold shadow-lg flex items-center transition-colors">
            <Plus className="w-4 h-4 mr-2" />新建前台分类栏目
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="w-full lg:w-72 flex-shrink-0 bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-xl h-fit">
           <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4 px-2">模块排序与分类</h2>
           <div className="space-y-2">
            {storeData.groups.map((g:any, index:number) => (
              <div key={g.id} className={`flex items-center w-full px-3 py-2 rounded-xl border transition-all ${activeGroupId === g.id ? 'bg-orange-500/10 border-orange-500/50 text-orange-400' : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:border-slate-600'}`}>
                <div className="flex flex-col mr-2 text-slate-600">
                  <button onClick={(e) => { e.stopPropagation(); moveGroup(index, 'up'); }} disabled={index === 0 || isSaving} className="hover:text-white disabled:opacity-30"><ArrowUp className="w-3.5 h-3.5" /></button>
                  <button onClick={(e) => { e.stopPropagation(); moveGroup(index, 'down'); }} disabled={index === storeData.groups.length - 1 || isSaving} className="hover:text-white disabled:opacity-30"><ArrowDown className="w-3.5 h-3.5" /></button>
                </div>
                <button onClick={() => setActiveGroupId(g.id)} className="flex-1 flex items-center justify-between min-w-0 text-left">
                  <span className={`truncate font-semibold text-sm ${activeGroupId === g.id ? 'text-orange-400' : 'text-slate-300'}`}>{g.name}</span>
                  <span className="bg-slate-800 px-2 py-0.5 rounded-md text-[10px] ml-2 shrink-0">{g.items.length} 货品</span>
                </button>
              </div>
            ))}
          </div>
        </div>

        {activeGroup && (
          <div className="flex-1 min-w-0 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl">
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 mb-8 relative">
              <div className="absolute top-4 right-4"><button onClick={() => deleteGroup(activeGroup.id)} disabled={isSaving} className="text-red-500/50 hover:text-red-400 p-2 disabled:opacity-50"><Trash2 className="w-5 h-5" /></button></div>
              <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center"><LayoutTemplate className="w-4 h-4 mr-2" /> 主分类配置 (自动暂存)</h2>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div><label className="text-xs text-slate-500 mb-1 block">前端展示名称</label><input type="text" value={activeGroup.name} onChange={e => updateActiveGroup('name', e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:border-orange-500 font-bold" /></div>
                <div><label className="text-xs text-slate-500 mb-1 block">卡片样式模型</label>
                  <select value={activeGroup.cardType} onChange={e => updateActiveGroup('cardType', e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 outline-none focus:border-orange-500">
                    <option value="plan">核心套餐 (PlanCard)</option><option value="quota">小图标版 (QuotaCard)</option><option value="domain">横向长版 (DomainCard)</option><option value="template">模块化版 (TemplateCard)</option><option value="premium">高亮尊享版 (PremiumCard)</option>
                  </select>
                </div>
              </div>
              <div><label className="text-xs text-slate-500 mb-1 block">分类描述 / Slogan</label><input type="text" value={activeGroup.desc} onChange={e => updateActiveGroup('desc', e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 outline-none focus:border-orange-500" /></div>
            </div>

            <div className="flex justify-between items-end mb-4 border-b border-slate-800 pb-2">
              <h2 className="text-lg font-bold flex items-center text-slate-200">
                本类商品列表 <span className="ml-2 text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">{activeGroup.items.length} 个</span>
              </h2>
              <button onClick={() => setEditingProduct({ name: '', price: 99, status: 'active', modalDetail: '', allowTiers: false, tierPrices: [], customPurchase: { enabled: false, minQty: 100, step: 100 } })} disabled={isSaving} className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center disabled:opacity-50">
                <Plus className="w-3.5 h-3.5 mr-1" /> 新增商品至本类
              </button>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {activeGroup.items.map((item:any, index:number) => (
                <div key={item.id} className={`bg-slate-950 border p-4 rounded-xl flex flex-col justify-between transition-colors ${item.status === 'inactive' ? 'opacity-40 border-red-900/30' : 'border-slate-800 hover:border-slate-600 shadow-md'}`}>
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center min-w-0 pr-2">
                       <div className="flex flex-col mr-3 text-slate-600 shrink-0 border-r border-slate-800 pr-2">
                          <button onClick={(e) => { e.stopPropagation(); moveProduct(activeGroup.id, index, 'up'); }} disabled={index === 0 || isSaving} className="hover:text-white disabled:opacity-30"><ArrowUp className="w-3.5 h-3.5" /></button>
                          <button onClick={(e) => { e.stopPropagation(); moveProduct(activeGroup.id, index, 'down'); }} disabled={index === activeGroup.items.length - 1 || isSaving} className="hover:text-white disabled:opacity-30"><ArrowDown className="w-3.5 h-3.5 mt-1" /></button>
                       </div>
                       <h3 className="font-bold text-white truncate text-base">{item.name}</h3>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => toggleStatus(item.id)} disabled={isSaving} className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 disabled:opacity-50">{item.status === 'active' ? <Eye className="w-3.5 h-3.5 text-blue-400" /> : <EyeOff className="w-3.5 h-3.5 text-red-400" />}</button>
                      <button onClick={() => deleteProduct(item.id)} disabled={isSaving} className="p-1.5 bg-slate-800 hover:bg-red-500/20 rounded text-slate-500 hover:text-red-400 disabled:opacity-50"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                  <div className="flex items-end justify-between mb-4">
                    <div className="text-emerald-400 font-black text-2xl tracking-tight">¥{item.price} <span className="text-xs font-normal text-slate-500">/基础单价</span></div>
                    {item.customPurchase?.enabled && <span className="text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded">支持动态购</span>}
                  </div>
                  <button onClick={() => setEditingProduct({...item})} className="w-full bg-slate-800 hover:bg-slate-700 py-2.5 rounded-lg text-xs font-bold text-slate-300 transition-colors border border-slate-700 hover:border-slate-600">编辑深度属性 & 定价规则</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {editingProduct && (
          <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
              <div className="p-6 bg-slate-800/80 border-b border-slate-700 flex justify-between items-center">
                 <div><h2 className="text-xl font-bold text-white tracking-tight">{editingProduct.id ? '编辑资产商品' : '上架新资产商品'}</h2></div>
                 <button onClick={() => setEditingProduct(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-950 text-slate-400 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
              </div>
              <div className="p-6 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
                
                {/* 1. 基础信息：名称与价格 */}
                <div className="grid grid-cols-2 gap-5">
                  <div><label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 block">商品展示名称</label>
                  <input type="text" value={editingProduct.name} onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white font-bold outline-none focus:border-blue-500" /></div>
                  <div><label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 block">基础定价 (CNY)</label>
                  <input type="number" value={editingProduct.price} onChange={e => setEditingProduct({...editingProduct, price: Number(e.target.value)})} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-emerald-400 font-black text-lg outline-none focus:border-blue-500" /></div>
                </div>

                {/* 🌟 2. 这是为你补回来的“商品详细介绍”大文本框！ */}
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 block">商品介绍文案 (支持多行排版)</label>
                  <textarea 
                    rows={4} 
                    value={editingProduct.modalDetail || ''} 
                    onChange={e => setEditingProduct({...editingProduct, modalDetail: e.target.value})} 
                    placeholder="输入展示给用户的详细权益介绍..." 
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-300 text-sm outline-none focus:border-blue-500 resize-none transition-colors" 
                  />
                </div>
                
                {/* 3. 自定义输入量配置 */}
                <div>
                  <label className="flex items-center text-sm font-bold text-white mb-3 cursor-pointer select-none">
                    <input type="checkbox" checked={editingProduct.customPurchase?.enabled || false} onChange={e => setEditingProduct({...editingProduct, customPurchase: { ...editingProduct.customPurchase, enabled: e.target.checked }})} className="mr-3 w-4 h-4 accent-blue-500" /> 
                    允许用户“自定义输入”购买数量？
                  </label>
                  {editingProduct.customPurchase?.enabled && (
                    <div className="grid grid-cols-2 gap-4 bg-blue-900/10 border border-blue-900/30 p-4 rounded-xl mt-2">
                       <div><label className="text-[10px] text-blue-400 mb-1 block">最低起购量</label><input type="number" value={editingProduct.customPurchase.minQty || 100} onChange={e => setEditingProduct({...editingProduct, customPurchase: { ...editingProduct.customPurchase, minQty: Number(e.target.value) }})} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white" /></div>
                       <div><label className="text-[10px] text-blue-400 mb-1 block">增长步长(倍数)</label><input type="number" value={editingProduct.customPurchase.step || 100} onChange={e => setEditingProduct({...editingProduct, customPurchase: { ...editingProduct.customPurchase, step: Number(e.target.value) }})} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white" /></div>
                    </div>
                  )}
                </div>

                {/* 4. 多买多省阶梯价配置 */}
                <div>
                  <label className="flex items-center text-sm font-bold text-white mb-3 cursor-pointer select-none">
                    <input type="checkbox" checked={editingProduct.allowTiers || false} onChange={e => setEditingProduct({...editingProduct, allowTiers: e.target.checked})} className="mr-3 w-4 h-4 accent-orange-500" /> 
                    配置“多买多省”阶梯折扣价
                  </label>
                  {editingProduct.allowTiers && (
                    <div className="space-y-3 bg-orange-900/10 border border-orange-900/30 p-4 rounded-xl mt-2">
                      {(editingProduct.tierPrices||[]).map((tier:any, idx:number) => (
                        <div key={idx} className="flex items-center gap-3 bg-slate-900 p-3 rounded-xl border border-slate-800 shadow-sm">
                          <span className="text-xs text-slate-400 font-medium">购买量 ≥</span>
                          <input type="number" value={tier.min} onChange={e => { const t = [...editingProduct.tierPrices]; t[idx].min = Number(e.target.value); setEditingProduct({...editingProduct, tierPrices: t})}} className="w-20 bg-slate-950 border border-slate-700 rounded-md px-2 py-1.5 text-center text-sm text-white font-bold" />
                          <span className="text-xs text-slate-400 ml-2 font-medium">单价 ¥</span>
                          <input type="number" value={tier.price} onChange={e => { const t = [...editingProduct.tierPrices]; t[idx].price = Number(e.target.value); setEditingProduct({...editingProduct, tierPrices: t})}} className="w-24 bg-slate-950 border border-slate-700 rounded-md px-2 py-1.5 text-center text-sm text-emerald-400 font-black" />
                          <button onClick={() => { const t = editingProduct.tierPrices.filter((_:any,i:number)=>i!==idx); setEditingProduct({...editingProduct, tierPrices: t})}} className="ml-auto text-slate-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      ))}
                      <button onClick={() => setEditingProduct({...editingProduct, tierPrices: [...(editingProduct.tierPrices||[]), {min: 500, price: Number((editingProduct.price * 0.9).toFixed(2))}]})} className="w-full mt-2 py-3 border border-dashed border-slate-700 text-slate-400 text-xs font-bold hover:text-white transition-all flex items-center justify-center">
                        <Plus className="w-3.5 h-3.5 mr-1" /> 添加新阶梯
                      </button>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="p-6 border-t border-slate-800 bg-slate-900 flex justify-between items-center">
                <button onClick={() => setEditingProduct(null)} className="px-6 py-2.5 text-slate-400 hover:text-white font-bold">取消</button>
                <button onClick={saveProductEdit} disabled={isSaving} className="px-8 py-2.5 rounded-xl bg-blue-600 text-white font-bold disabled:opacity-50 flex items-center gap-2">
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} 保存商品
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}