"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronRight, X, SkipForward } from "lucide-react"

interface OnboardingStep {
  id: string
  title: string
  description: string
  targetSelector: string
  position: "top" | "bottom" | "left" | "right"
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "step-1",
    title: "🎯 指挥中心",
    description: "在这里输入客户画像、行业、国家等条件，AI 会自动为你搜索和筛选全球高意向客户。选择目标国家、行业和决策人，然后输入你的核心卖点。",
    targetSelector: "[data-onboarding='command-center']",
    position: "bottom"
  },
  {
    id: "step-2",
    title: "🤖 Agent 监控",
    description: "实时查看 AI 工作流的执行进度。看看 AI 正在为你做什么：搜索客户、生成邮件、发送信息。实时指标显示已挖掘的线索数、成功投递数和域名健康度。",
    targetSelector: "[data-onboarding='agent-monitor']",
    position: "bottom"
  },
  {
    id: "step-3",
    title: "📊 战报输出",
    description: "任务完成后，AI 会生成详细的战报。显示找到的客户总数、成功发送数、进箱率等关键指标。点击「新任务」开始下一轮营销。",
    targetSelector: "[data-onboarding='agent-monitor']",
    position: "bottom"
  }
]

interface OnboardingTourProps {
  isFirstTime: boolean
  onComplete: () => void
}

export function OnboardingTour({ isFirstTime, onComplete }: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [isVisible, setIsVisible] = useState(isFirstTime)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)

  useEffect(() => {
    if (!isVisible) return

    const step = ONBOARDING_STEPS[currentStep]
    const element = document.querySelector(step.targetSelector)
    
    if (element) {
      setTargetRect(element.getBoundingClientRect())
    }
  }, [currentStep, isVisible])

  const handleNext = () => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      handleComplete()
    }
  }

  const handleSkip = () => {
    handleComplete()
  }

  const handleComplete = () => {
    setIsVisible(false)
    // 保存到 localStorage，标记用户已完成新手引导
    localStorage.setItem("onboarding_completed", "true")
    onComplete()
  }

  if (!isVisible || !targetRect) return null

  const step = ONBOARDING_STEPS[currentStep]
  const isLastStep = currentStep === ONBOARDING_STEPS.length - 1

  // 计算 Tooltip 位置
  let tooltipStyle: React.CSSProperties = {}
  const offset = 20

  switch (step.position) {
    case "bottom":
      tooltipStyle = {
        top: `${targetRect.bottom + offset}px`,
        left: `${targetRect.left + targetRect.width / 2}px`,
        transform: "translateX(-50%)"
      }
      break
    case "top":
      tooltipStyle = {
        bottom: `${window.innerHeight - targetRect.top + offset}px`,
        left: `${targetRect.left + targetRect.width / 2}px`,
        transform: "translateX(-50%)"
      }
      break
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <>
          {/* 全局遮罩层 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
            onClick={handleSkip}
          />

          {/* 高亮区域 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed z-[101] pointer-events-none"
            style={{
              top: `${targetRect.top - 8}px`,
              left: `${targetRect.left - 8}px`,
              width: `${targetRect.width + 16}px`,
              height: `${targetRect.height + 16}px`,
              border: "3px solid #3b82f6",
              borderRadius: "12px",
              boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.6), 0 0 30px rgba(59, 130, 246, 0.5)"
            }}
          />

          {/* Tooltip */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            className="fixed z-[102] max-w-sm bg-gradient-to-br from-slate-900 to-slate-800 border-2 border-blue-400/50 rounded-2xl p-6 shadow-2xl shadow-blue-500/30"
            style={tooltipStyle}
          >
            {/* 步骤指示器 */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  {ONBOARDING_STEPS.map((_, idx) => (
                    <div
                      key={idx}
                      className={`h-1.5 rounded-full transition-all ${
                        idx === currentStep
                          ? "w-6 bg-blue-400"
                          : idx < currentStep
                          ? "w-1.5 bg-emerald-400"
                          : "w-1.5 bg-slate-600"
                      }`}
                    />
                  ))}
                </div>
              </div>
              <button
                onClick={handleSkip}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 标题和描述 */}
            <h3 className="text-lg font-bold text-white mb-2">{step.title}</h3>
            <p className="text-sm text-slate-300 leading-relaxed mb-6">{step.description}</p>

            {/* 操作按钮 */}
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={handleSkip}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-700/50 transition-all"
              >
                <SkipForward className="w-4 h-4 inline mr-1" />
                跳过引导
              </button>
              <button
                onClick={handleNext}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 shadow-lg shadow-blue-500/30 transition-all flex items-center justify-center gap-1"
              >
                {isLastStep ? "完成" : "下一步"}
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* 进度文本 */}
            <p className="text-xs text-slate-500 text-center mt-4">
              {currentStep + 1} / {ONBOARDING_STEPS.length}
            </p>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
