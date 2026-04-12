"use client"

import { motion } from "framer-motion"
import { Crown, Rocket, CheckCircle2, XCircle, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PLANS } from "@/config/pricing"

interface PricingCardsProps {
  currentPlan?: string | null
  onSelectPlan?: (planId: string) => void
  showCTA?: boolean
  ctaText?: string
}

export function PricingCards({ 
  currentPlan = null, 
  onSelectPlan,
  showCTA = true,
  ctaText = '开始使用'
}: PricingCardsProps) {
  
  const getPlanIndex = (planId: string) => {
    return PLANS.findIndex(p => p.id === planId)
  }

  const currentPlanIndex = currentPlan ? getPlanIndex(currentPlan) : -1

  const getButtonConfig = (plan: typeof PLANS[0], planIndex: number) => {
    // 未登录或没有当前套餐：显示默认 CTA
    if (!currentPlan) {
      return {
        text: plan.ctaText || ctaText,
        variant: plan.badge ? 'featured' : plan.id === 'MAX' ? 'premium' : 'default',
        disabled: false,
      }
    }

    // 当前套餐：续费
    if (planIndex === currentPlanIndex) {
      return {
        text: '续费当前套餐',
        variant: 'current',
        disabled: false,
      }
    }

    // 升级套餐
    if (planIndex > currentPlanIndex) {
      return {
        text: `升级至${plan.name}`,
        variant: plan.id === 'MAX' ? 'premium' : 'upgrade',
        disabled: false,
      }
    }

    // 降级套餐
    return {
      text: `降级至${plan.name}`,
      variant: 'downgrade',
      disabled: false,
    }
  }

  const getButtonStyles = (variant: string) => {
    const styles = {
      featured: 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 shadow-blue-500/30 hover:shadow-blue-500/50',
      premium: 'bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 shadow-purple-500/30',
      upgrade: 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 shadow-blue-500/30',
      current: 'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 shadow-emerald-500/30 border-2 border-emerald-400/50',
      downgrade: 'bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-300',
      default: 'bg-slate-800 hover:bg-slate-700 border border-white/10',
    }
    return styles[variant as keyof typeof styles] || styles.default
  }

  const handlePlanClick = (planId: string, planIndex: number) => {
    if (!onSelectPlan) return

    // 降级需要二次确认
    if (currentPlan && planIndex < currentPlanIndex) {
      if (confirm('降级将在下个计费周期生效，当前周期仍可使用现有功能。确认降级？')) {
        onSelectPlan(planId)
      }
    } else {
      onSelectPlan(planId)
    }
  }

  return (
    <div className="grid md:grid-cols-3 gap-8 max-w-7xl mx-auto items-center">
      {PLANS.map((plan, idx) => {
        const isFeatured = plan.badge === '主推'
        const isCurrent = plan.id === currentPlan
        const buttonConfig = getButtonConfig(plan, idx)
        
        return (
          <motion.div key={plan.id}
            initial={{ opacity: 0, y: isFeatured ? 20 : 0, x: idx === 0 ? -20 : idx === 2 ? 20 : 0 }}
            whileInView={{ opacity: 1, y: 0, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: idx * 0.1 }}
            whileHover={{ y: isFeatured ? -8 : -4, scale: isFeatured ? 1.02 : 1 }}
            className={`relative ${isFeatured ? 'md:scale-105' : ''}`}
          >
            {/* 当前方案标识 */}
            {isCurrent && (
              <div className="absolute -top-5 left-1/2 -translate-x-1/2 z-10">
                <div className="bg-gradient-to-r from-emerald-400 to-emerald-500 text-white px-6 py-2 rounded-full text-sm font-bold shadow-lg flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />当前方案
                </div>
              </div>
            )}

            {/* 最受欢迎标识 */}
            {isFeatured && !isCurrent && (
              <div className="absolute -top-5 left-1/2 -translate-x-1/2 z-10">
                <div className="bg-gradient-to-r from-yellow-400 to-orange-400 text-slate-900 px-6 py-2 rounded-full text-sm font-bold shadow-lg flex items-center gap-2">
                  <Crown className="w-4 h-4" />{plan.badge}
                </div>
              </div>
            )}
            {isFeatured && <div className="absolute inset-0 bg-gradient-to-br from-blue-500/30 via-cyan-500/30 to-blue-600/30 rounded-3xl blur-2xl" />}
            
            <div className={`relative h-full rounded-3xl p-8 border backdrop-blur-xl ${
              isCurrent
                ? 'bg-gradient-to-br from-emerald-900/50 via-slate-900 to-slate-900 border-2 border-emerald-400/50 shadow-2xl shadow-emerald-500/20 ring-2 ring-emerald-400/20'
                : isFeatured
                  ? 'bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 border-2 border-blue-400/50 shadow-2xl shadow-blue-500/20 p-10'
                  : plan.id === 'MAX'
                    ? 'bg-slate-900/50 border-white/10 hover:border-purple-500/30'
                    : 'bg-slate-900/50 border-white/10 hover:border-white/20'
            } transition-all duration-300`}>
              {isFeatured && <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent rounded-3xl" />}
              
              <div className="relative mb-6">
                <h3 className={`font-bold text-white mb-1 flex items-center gap-2 ${isFeatured ? 'text-3xl' : 'text-2xl'}`}>
                  {plan.name}
                  {plan.id === 'PRO' && <Sparkles className="w-6 h-6 text-blue-400" />}
                  {plan.id === 'MAX' && <Crown className="w-5 h-5 text-purple-400" />}
                </h3>
                <p className={`text-xs font-bold mb-1 ${isFeatured ? 'text-blue-300' : plan.id === 'MAX' ? 'text-amber-400' : 'text-emerald-400'}`}>✦ {plan.coreOutcome}</p>
                <p className={`text-sm ${isFeatured ? 'text-blue-300/70' : 'text-slate-500'}`}>{plan.subtitle}</p>
              </div>

              {/* 核心差异对比 */}
              {plan.id === 'PRO' && (
                <div className="relative mb-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                  <div className="text-xs font-bold text-blue-400 mb-3">✨ 专业版核心优势</div>
                  <ul className="text-xs text-blue-300 space-y-2">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-blue-400" />
                      <span><strong>双核数据源</strong>：Google + LinkedIn 精准定位</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-blue-400" />
                      <span><strong>高并发发信</strong>：日发 5000+ 封，进箱率 94%+</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-blue-400" />
                      <span><strong>AI 意图打分</strong>：自动淘汰低质线索，节省成本</span>
                    </li>
                  </ul>
                </div>
              )}
              {plan.id === 'MAX' && (
                <div className="relative mb-6 p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl">
                  <div className="text-xs font-bold text-purple-400 mb-3">🚀 旗舰版核心优势</div>
                  <ul className="text-xs text-purple-300 space-y-2">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-purple-400" />
                      <span><strong>三核数据源</strong>：Google + LinkedIn + 自定义爬虫</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-purple-400" />
                      <span><strong>极速并发</strong>：日发 20000+ 封，3 域名轮换防封</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-purple-400" />
                      <span><strong>深度意图打分</strong>：0-100 精准评分，商机识别率 98%</span>
                    </li>
                  </ul>
                </div>
              )}
              
              {/* 价格显示 */}
              <div className="relative mb-8">
                <div className="flex items-baseline gap-2 mb-2">
                  <span className={`font-bold ${isFeatured ? 'text-6xl bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent' : 'text-5xl text-white'}`}>
                    ¥{plan.price}
                  </span>
                  <span className={`${isFeatured ? 'text-blue-300' : 'text-slate-400'}`}>/月</span>
                </div>
              </div>

              {/* 功能列表 */}
              <ul className="relative space-y-3 mb-8">
                {plan.features.map(f => (
                  <li key={f.label} className={`flex items-start gap-3 ${f.locked ? 'text-slate-500' : 'text-slate-300'}`}>
                    {f.locked
                      ? <XCircle className="w-5 h-5 text-slate-600 mt-0.5 flex-shrink-0" />
                      : <CheckCircle2 className={`w-5 h-5 mt-0.5 flex-shrink-0 ${isFeatured ? 'text-blue-400' : plan.id === 'MAX' ? 'text-purple-400' : 'text-emerald-400'}`} />
                    }
                    <span className={f.highlight ? `font-semibold ${plan.id === 'PRO' ? 'text-blue-300' : plan.id === 'MAX' ? 'text-purple-300' : 'text-white'}` : f.locked ? 'line-through' : ''}>
                      <span className="text-white font-bold">{f.label}：</span>{f.value}
                    </span>
                  </li>
                ))}
              </ul>

              {/* 动态按钮 */}
              {showCTA && (
                <Button
                  onClick={() => handlePlanClick(plan.id, idx)}
                  disabled={buttonConfig.disabled}
                  className={`relative w-full text-white py-6 text-lg shadow-xl transition-all duration-300 ${getButtonStyles(buttonConfig.variant)}`}
                >
                  <Rocket className="w-5 h-5 mr-2" />
                  {buttonConfig.text}
                </Button>
              )}
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
