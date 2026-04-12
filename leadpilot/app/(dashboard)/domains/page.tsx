"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Globe, RefreshCw, Sparkles, ShieldCheck, ToggleLeft, ToggleRight, Loader2, AlertTriangle, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import Link from "next/link"

type DomainItem = {
  id: string
  domainName: string
  status: string
  warmupEnabled: boolean
  warmupDay?: number
  warmupScore?: number
  isReady?: boolean
  dailyLimit: number
  sentToday: number
  createdAt: string
}

type UserAssets = {
  subscriptionTier?: string
}

type RecommendStatus = "IDLE" | "SEARCHING" | "READY"
type DeployStep = "IDLE" | "BUYING" | "DNS" | "DONE" | "FAILED"
type Candidate = {
  id: string
  domain: string
  hint?: string
  deployStep: DeployStep
  progress: number // 0-100
}

// 强启发信风险拦截弹窗
type RiskModal = {
  domain: DomainItem
  onConfirm: () => void
  onCancel: () => void
}

export default function DomainsPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [domains, setDomains] = useState<DomainItem[]>([])
  const [assets, setAssets] = useState<UserAssets | null>(null)

  const [brandName, setBrandName] = useState("")
  const [recommendStatus, setRecommendStatus] = useState<string>("IDLE")
  const isSearching = recommendStatus === "SEARCHING"
  const isReady = recommendStatus === "READY"
  const [recommendMsg, setRecommendMsg] = useState<string>("")
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [selectedDomains, setSelectedDomains] = useState<Candidate[]>([])
  const [deployingAll, setDeployingAll] = useState(false)
  const [deployingId] = useState<string | null>(null)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  // 强启发信风险拦截弹窗
  const [riskModal, setRiskModal] = useState<RiskModal | null>(null)

  const loadDomains = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/domains/list")
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "加载失败")
      setDomains(data?.domains || [])
    } catch (e: any) {
      toast({ title: "加载失败", description: e?.message || "无法加载域名池", variant: "destructive" })
      setDomains([])
    } finally {
      setLoading(false)
    }
  }

  const loadAssets = async () => {
    try {
      const res = await fetch("/api/user/assets")
      const data = await res.json()
      if (res.ok) setAssets(data)
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    loadDomains()
    loadAssets()
    return () => {
      timersRef.current.forEach(t => clearTimeout(t))
      timersRef.current = []
    }
  }, [])

  const tier = String(assets?.subscriptionTier || "").toUpperCase()
  const domainQuota = useMemo(() => {
    if (tier === "MAX" || tier === "ULTIMATE") return 10
    if (tier === "PRO") return 3
    return 1
  }, [tier])
  const used = domains.length
  const quotaFull = used >= domainQuota

  const sanitizeBrand = (brand: string) =>
    brand.trim().toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 18) || "brand"

  // 获取信誉分对应的颜色和状态
  const getScoreColor = (score: number) => {
    if (score >= 80) return { bar: "from-emerald-500 to-green-400", text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", label: "已就绪" }
    if (score >= 50) return { bar: "from-amber-500 to-orange-400", text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", label: "预热中" }
    return { bar: "from-red-500 to-rose-400", text: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", label: "高风险" }
  }

  const handleRecommend = async () => {
    if (recommendStatus === "SEARCHING") return
    if (brandName.trim().length < 2) {
      toast({ title: "请输入品牌名", description: "例如：leadpilot", variant: "destructive" })
      return
    }
    setRecommendStatus("SEARCHING")
    setRecommendMsg("正在调用 AI 为您生成专属域名方案...")
    setCandidates([])
    try {
      const res = await fetch("/api/domains/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand: brandName }),
      })
      const data = await res.json()
      const suggestions: { domain: string; hint?: string }[] = data?.suggestions || []
      const base = sanitizeBrand(brandName)
      // 每次调用随机打乱后缀池，确保「换一批」体验真实变化
      const suffixPool = [
        ['.com', '.co', '.io', '.ai', '.net'],
        ['.io', '.net', '.co', '.ai', '.com'],
        ['.ai', '.com', '.co', '.net', '.io'],
        ['.co', '.ai', '.io', '.com', '.net'],
        ['.net', '.io', '.ai', '.co', '.com'],
      ]
      const suffixes = suffixPool[Math.floor(Math.random() * suffixPool.length)]
      const hintPool = [
        '主推 · .com 优先', '商务感 · 总部形象', 'B2B 专属通道',
        '科技感 · 国际范', '简洁 · 好记易传播', '品牌域名首选',
        '新兴后缀 · 印象深', '出海利器 · 高权重',
      ]
      const shuffleHints = () => hintPool.sort(() => Math.random() - 0.5)
      const hints = shuffleHints()
      const fallback = [
        { domain: `get${base}${suffixes[0]}`,    hint: hints[0] },
        { domain: `${base}hq${suffixes[1]}`,     hint: hints[1] },
        { domain: `${base}-b2b${suffixes[2]}`,   hint: hints[2] },
        { domain: `use${base}${suffixes[3]}`,    hint: hints[3] },
        { domain: `${base}app${suffixes[4]}`,    hint: hints[4] },
      ]
      const list = suggestions.length > 0 ? suggestions : fallback
      setCandidates(list.slice(0, 5).map((s: any, idx: number) => ({
        id: `${s.domain}-${idx}`,
        domain: s.domain,
        hint: s.hint,
        deployStep: "IDLE" as DeployStep,
        progress: 0,
      })))
      setRecommendStatus("READY")
      setRecommendMsg("")
    } catch {
      toast({ title: "推荐失败", description: "请稍后重试", variant: "destructive" })
      setRecommendStatus("IDLE")
    }
  }

  const addToCart = (c: Candidate) => {
    if (selectedDomains.find(s => s.id === c.id)) {
      toast({ title: "已在清单中", description: `${c.domain} 已在待购清单`, variant: "destructive" })
      return
    }
    const totalAfter = domains.length + selectedDomains.length + 1
    if (totalAfter > domainQuota) {
      toast({ title: "配额不足", description: `您的套餐最多支持 ${domainQuota} 个域名，请升级或移除已选项`, variant: "destructive" })
      return
    }
    setSelectedDomains(prev => [...prev, c])
    toast({ title: "已加入待购清单", description: `${c.domain}` })
  }

  const removeFromCart = (id: string) => {
    setSelectedDomains(prev => prev.filter(s => s.id !== id))
  }

  const deployAll = async () => {
    if (selectedDomains.length === 0) return
    if (deployingAll) return
    setDeployingAll(true)
    let successCount = 0
    for (const c of selectedDomains) {
      try {
        const addRes = await fetch("/api/domains/add", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ domainName: c.domain, warmupEnabled: true }),
        })
        const addData = await addRes.json()
        if (!addRes.ok) throw new Error(addData?.error || "创建失败")
        await fetch("/api/domains/update", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ domainId: addData?.id, active: true }),
        }).catch(() => {})
        successCount++
      } catch (e: any) {
        toast({ title: `❌ ${c.domain} 部署失败`, description: e?.message, variant: "destructive" })
      }
    }
    setDeployingAll(false)
    if (successCount > 0) {
      toast({ title: `✅ 成功部署 ${successCount} 个域名`, description: "已加入域名池并启用发信" })
      setSelectedDomains([])
      setCandidates([])
      setRecommendStatus("IDLE")
      setBrandName("")
      await loadDomains()
      await loadAssets()
    }
  }


  const toggleWarmup = async (d: DomainItem, enabled: boolean) => {
    // optimistic
    setDomains((prev) => prev.map((x) => (x.id === d.id ? { ...x, warmupEnabled: enabled } : x)))
    try {
      const res = await fetch("/api/domains/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domainId: d.id, warmupEnabled: enabled }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "操作失败")
      toast({ title: enabled ? "预热已开启" : "预热已关闭", description: enabled ? "系统将每天自动进行 P2P 养号操作" : "已停止预热" })
    } catch (e: any) {
      setDomains((prev) => prev.map((x) => (x.id === d.id ? { ...x, warmupEnabled: d.warmupEnabled } : x)))
      toast({ title: "操作失败", description: e?.message || "请稍后重试", variant: "destructive" })
    }
  }

  const toggleActive = async (d: DomainItem, enabled: boolean) => {
    // 当用户试图启用发信时，检查预热信誉分
    if (enabled) {
      const score = d.warmupScore ?? 0
      // 如果信誉分低于 80，弹出风险拦截弹窗
      if (score < 80) {
        setRiskModal({
          domain: d,
          onConfirm: async () => {
            // 用户确认后执行启用操作
            setRiskModal(null)
            const nextStatus = "ACTIVE"
            setDomains((prev) => prev.map((x) => (x.id === d.id ? { ...x, status: nextStatus } : x)))
            try {
              const res = await fetch("/api/domains/update", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ domainId: d.id, active: true }),
              })
              const data = await res.json()
              if (!res.ok) throw new Error(data?.error || "操作失败")
              toast({ title: "已启用发信", description: `域名 ${d.domainName} 已强制启用发信，风险自负` })
            } catch (e: any) {
              setDomains((prev) => prev.map((x) => (x.id === d.id ? { ...x, status: d.status } : x)))
              toast({ title: "操作失败", description: e?.message || "请稍后重试", variant: "destructive" })
            }
          },
          onCancel: () => {
            setRiskModal(null)
            toast({ title: "操作已取消", description: "建议继续使用自动预热，待信誉分达到 80 后再启用发信" })
          },
        })
        return
      }
    }

    // 正常放行：信誉分 >= 80
    const nextStatus = enabled ? "ACTIVE" : "PENDING_DNS"
    setDomains((prev) => prev.map((x) => (x.id === d.id ? { ...x, status: nextStatus } : x)))
    try {
      const res = await fetch("/api/domains/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domainId: d.id, active: enabled }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "操作失败")
      toast({ title: enabled ? "已启用发信" : "已暂停发信", description: enabled ? "该域名将参与发信轮换" : "该域名将从轮换中移除" })
    } catch (e: any) {
      setDomains((prev) => prev.map((x) => (x.id === d.id ? { ...x, status: d.status } : x)))
      toast({ title: "操作失败", description: e?.message || "请稍后重试", variant: "destructive" })
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="container mx-auto px-6 py-8 max-w-6xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
              <Globe className="w-9 h-9 text-emerald-400" />
              域名池智能管家
            </h1>
            <p className="text-slate-400">
              全自动生成、全自动配置、全自动预热与轮换。你只需要输入品牌名，剩下交给系统。
            </p>
          </div>
          <Button
            onClick={loadDomains}
            variant="outline"
            className="border-slate-700 text-slate-300 hover:bg-slate-800 flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            刷新
          </Button>
        </div>

        {/* ─── 套餐域名配额展示 ───────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <ShieldCheck className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="font-bold text-white">套餐域名配额</div>
                <div className="text-sm text-slate-400">
                  {tier === "PRO"
                    ? "专业版特权：您可免费生成 3 个独立发信域名"
                    : tier === "MAX" || tier === "ULTIMATE"
                      ? "旗舰版特权：您可免费生成 10 个独立发信域名"
                      : "入门版特权：您可免费生成 1 个独立发信域名"}
                </div>
              </div>
            </div>
            <div className="sm:ml-auto flex items-center gap-3">
              <div className="text-sm text-slate-400">已用</div>
              <div className="text-white font-extrabold text-xl">
                {Math.min(used, domainQuota)}/{domainQuota}
              </div>
              <Link href="/billing" className="text-xs text-blue-400 underline">购买域名扩展包</Link>
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Sparkles className="w-5 h-5 text-cyan-300" />
            <div className="font-semibold">智能推荐与挑选部署</div>
            <span className="ml-auto text-xs text-slate-500">全自动 · 无需手动 DNS</span>
          </div>
          <div className="grid md:grid-cols-3 gap-3 items-stretch">
            <input
              value={brandName}
              onChange={e => setBrandName(e.target.value)}
              placeholder="请输入您的产品或品牌名（例如：leadpilot）"
              className="md:col-span-2 w-full bg-slate-800/60 border border-slate-700 rounded-2xl px-5 py-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              disabled={recommendStatus === "SEARCHING" || !!deployingId}
            />
            <button
              type="button"
              onClick={handleRecommend}
              disabled={isSearching || !!deployingId}
              className="w-full rounded-2xl px-4 py-4 font-extrabold text-white bg-gradient-to-r from-cyan-500 via-blue-600 to-violet-600 hover:from-cyan-400 hover:via-blue-500 hover:to-violet-500 shadow-2xl shadow-cyan-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSearching ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" /> 部署中...
                </>
              ) : (
                <>
                  <span className="text-lg">🔍</span> 智能推荐可用域名
                </>
              )}
            </button>
          </div>

          {/* 第一阶段：搜索 loading */}
          {isSearching && (
            <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-200 flex items-center gap-3">
              <Loader2 className="w-4 h-4 animate-spin text-cyan-300" />
              <div className="text-slate-300">{recommendMsg || "正在全球域名库中检索可用方案..."}</div>
            </div>
          )}

          {/* 第二阶段：推荐列表与抉择 */}
          {isReady && candidates.length > 0 && (
            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/40">
              <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-2">
                <div className="text-sm font-semibold text-white">AI 推荐方案</div>
                {quotaFull && selectedDomains.length === 0 && (
                  <span className="text-xs font-bold text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                    配额已满，请升级套餐
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleRecommend}
                  disabled={isSearching}
                  className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 hover:bg-slate-800/60 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSearching ? "animate-spin" : ""}`} />
                  换一批
                </button>
              </div>
              <div className="divide-y divide-slate-800/80">
                {candidates.map((c) => {
                  const inCart = !!selectedDomains.find(s => s.id === c.id)
                  const cartFull = domains.length + selectedDomains.length >= domainQuota
                  return (
                    <div key={c.id} className="px-4 py-4">
                      <div className="flex flex-col md:flex-row md:items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-semibold truncate">{c.domain}</span>
                            {c.hint && (
                              <span className="text-[10px] text-slate-400 bg-slate-800/60 border border-slate-700 px-2 py-0.5 rounded-full">
                                {c.hint}
                              </span>
                            )}
                            {inCart && <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">✓ 已选</span>}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">点击右侧加入待购清单，确认后一键部署。</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => addToCart(c)}
                          disabled={inCart || (cartFull && !inCart)}
                          className={`w-full md:w-auto rounded-xl px-4 py-2.5 text-sm font-bold text-white transition-all flex items-center justify-center gap-2 ${
                            inCart
                              ? "bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 cursor-default"
                              : cartFull
                                ? "bg-slate-800/60 border border-slate-700 text-slate-500 cursor-not-allowed"
                                : "bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 shadow-lg shadow-blue-500/20"
                          }`}
                        >
                          {inCart ? "✓ 已加入清单" : "＋ 加入待购清单"}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 购物车：待部署清单 + 确认部署按钮 */}
          {selectedDomains.length > 0 && (
            <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-bold text-emerald-300">🛒 待购清单（{selectedDomains.length} 个）</span>
                <span className="text-xs text-slate-500">点击 × 可移除</span>
              </div>
              <div className="flex flex-wrap gap-2 mb-4">
                {selectedDomains.map(s => (
                  <span key={s.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700 text-sm text-white">
                    {s.domain}
                    <button onClick={() => removeFromCart(s.id)} className="text-slate-400 hover:text-red-400 transition-colors">×</button>
                  </span>
                ))}
              </div>
              <button
                type="button"
                onClick={deployAll}
                disabled={deployingAll}
                className="w-full py-3 rounded-xl font-extrabold text-white bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-600 hover:from-emerald-400 hover:via-cyan-400 hover:to-blue-500 shadow-xl shadow-emerald-500/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {deployingAll ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> 正在部署中...</>
                ) : (
                  <>🚀 确认消耗额度并一键部署 {selectedDomains.length} 个域名</>
                )}
              </button>
            </div>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-slate-900/60 border border-slate-800 rounded-3xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800 flex items-center">
            <div className="font-semibold">我的域名池</div>
            <div className="ml-auto text-xs text-slate-500">{domains.length} 个域名</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-800/40 border-b border-slate-800">
                <tr>
                  {["域名", "启用发信", "自动预热", "信誉分 / 健康度", "今日已发", "创建时间"].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-slate-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="py-12 text-center text-slate-400">加载中...</td></tr>
                ) : domains.length === 0 ? (
                  <tr><td colSpan={6} className="py-12 text-center text-slate-600">暂无域名。输入品牌名，一键生成你的发信域名矩阵。</td></tr>
                ) : (
                  domains.map(d => {
                    const score = d.warmupScore ?? 0
                    const scoreColors = getScoreColor(score)
                    return (
                    <tr key={d.id} className="border-b border-slate-800/60 hover:bg-slate-800/20 transition-colors">
                      <td className="py-4 px-4 text-white font-medium">{d.domainName}</td>
                      <td className="py-4 px-4">
                        <button
                          type="button"
                          onClick={() => toggleActive(d, d.status !== "ACTIVE")}
                          className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                            d.status === "ACTIVE"
                              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                              : "bg-slate-800/40 border-slate-700 text-slate-400 hover:text-white"
                          }`}
                        >
                          {d.status === "ACTIVE" ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                          {d.status === "ACTIVE" ? "启用中" : "已暂停"}
                        </button>
                      </td>
                      <td className="py-4 px-4">
                        <button
                          type="button"
                          onClick={() => toggleWarmup(d, !d.warmupEnabled)}
                          className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                            d.warmupEnabled
                              ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-200"
                              : "bg-slate-800/40 border-slate-700 text-slate-400 hover:text-white"
                          }`}
                        >
                          {d.warmupEnabled ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                          {d.warmupEnabled ? "预热中" : "未预热"}
                        </button>
                        {d.warmupEnabled && (
                          <div className="text-[11px] text-slate-500 mt-1">系统将每天自动进行 P2P 养号操作</div>
                        )}
                      </td>
                      <td className="py-4 px-4 min-w-[160px]">
                        <div className={`rounded-xl border p-3 ${scoreColors.bg} ${scoreColors.border}`}>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] text-slate-400">信誉分: {score}/100</span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${scoreColors.bg} ${scoreColors.text}`}>
                              {scoreColors.label}
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-800/60 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${score}%` }}
                              transition={{ duration: 0.8, ease: "easeOut" }}
                              className={`h-full bg-gradient-to-r ${scoreColors.bar} rounded-full`}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-slate-300">{d.sentToday}</td>
                      <td className="py-4 px-4 text-slate-500 text-xs">{new Date(d.createdAt).toLocaleString("zh-CN")}</td>
                    </tr>
                  )})
                )}
              </tbody>
            </table>
          </div>

        </motion.div>

        {/* ─── 强启发信风险拦截弹窗 ───────────────────────────────────── */}
        <AnimatePresence>
          {riskModal && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={riskModal.onCancel}
                className="fixed inset-0 bg-black/70 backdrop-blur-xl z-50"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
              >
                <div className="relative w-full max-w-md bg-slate-900/95 backdrop-blur-2xl border border-red-500/30 rounded-3xl shadow-2xl shadow-red-500/10 overflow-hidden pointer-events-auto">
                  {/* 顶部警示条 */}
                  <div className="h-1.5 bg-gradient-to-r from-red-500 via-rose-500 to-red-500" />

                  <div className="p-8">
                    {/* 警示图标和标题 */}
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500/20 to-rose-500/10 border border-red-500/30 flex items-center justify-center shadow-lg shadow-red-500/10">
                        <AlertTriangle className="w-7 h-7 text-red-400" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-white tracking-tight">强行发信风险警示</h3>
                        <p className="text-slate-400 text-sm mt-0.5">Domain Warmup Risk Warning</p>
                      </div>
                    </div>

                    {/* 风险信息 */}
                    <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-5 mb-6">
                      <div className="flex items-center gap-3 mb-3">
                        <Globe className="w-5 h-5 text-red-400" />
                        <span className="text-white font-semibold">{riskModal.domain.domainName}</span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-400">当前信誉分</span>
                          <span className="bg-gradient-to-r from-red-400 to-rose-400 bg-clip-text text-transparent font-bold text-lg">
                            {riskModal.domain.warmupScore ?? 0}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-400">安全启用线</span>
                          <span className="text-slate-300 font-medium">≥ 80</span>
                        </div>
                        <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden mt-3">
                          <div className="h-full bg-gradient-to-r from-red-500 to-rose-400 rounded-full" style={{ width: `${((riskModal.domain.warmupScore ?? 0) / 100) * 100}%` }} />
                        </div>
                      </div>
                    </div>

                    {/* 警示内容 */}
                    <div className="space-y-3 mb-8">
                      <p className="text-slate-300 text-sm leading-relaxed">
                        该域名的预热信誉分仅为 <span className="text-red-400 font-bold">{riskModal.domain.warmupScore ?? 0}</span>，远未达到安全线 (80)。
                      </p>
                      <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3">
                        <p className="text-amber-300/90 text-xs leading-relaxed flex items-start gap-2">
                          <span className="text-amber-400 font-bold mt-0.5">⚠</span>
                          此时强行启用发信极易导致：
                        </p>
                        <ul className="text-amber-300/70 text-xs mt-2 ml-5 space-y-1 list-disc list-inside">
                          <li>发信账号被邮件服务商封禁</li>
                          <li>域名信誉彻底摧毁，难以恢复</li>
                          <li>进入黑名单，影响后续所有域名</li>
                        </ul>
                      </div>
                      <p className="text-slate-500 text-xs italic">
                        平台对此不承担任何责任，请谨慎操作。
                      </p>
                    </div>

                    {/* 按钮组 */}
                    <div className="flex gap-3">
                      <button
                        onClick={riskModal.onCancel}
                        className="flex-1 py-3.5 rounded-xl bg-slate-800/60 border border-slate-700 text-slate-300 text-sm font-bold hover:bg-slate-700/60 transition-all flex items-center justify-center gap-2"
                      >
                        <RefreshCw className="w-4 h-4" />
                        取消（继续自动预热）
                      </button>
                      <button
                        onClick={riskModal.onConfirm}
                        className="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-sm font-bold shadow-lg shadow-red-500/20 transition-all flex items-center justify-center gap-2"
                      >
                        <AlertTriangle className="w-4 h-4" />
                        已知晓风险，强行启用
                      </button>
                    </div>
                  </div>

                  {/* 关闭按钮 */}
                  <button
                    onClick={riskModal.onCancel}
                    className="absolute top-4 right-4 w-8 h-8 rounded-xl bg-slate-800/60 hover:bg-slate-700/60 flex items-center justify-center text-slate-400 hover:text-white transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

