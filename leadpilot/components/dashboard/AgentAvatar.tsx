"use client"

import { motion, AnimatePresence } from "framer-motion"
import { Bot, Search, PenLine, Coffee } from "lucide-react"

type AgentState = 'IDLE' | 'SEARCHING' | 'WRITING' | 'COOLING'

const STATE_CONFIG: Record<AgentState, {
  icon: React.ElementType
  color: string
  bg: string
  glow: string
  pulse: boolean
  label: string
}> = {
  IDLE: {
    icon: Bot,
    color: 'text-slate-400',
    bg: 'bg-slate-800',
    glow: '',
    pulse: false,
    label: '待机中'
  },
  SEARCHING: {
    icon: Search,
    color: 'text-blue-400',
    bg: 'bg-blue-500/20',
    glow: 'shadow-blue-500/40',
    pulse: true,
    label: '搜索中'
  },
  WRITING: {
    icon: PenLine,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/20',
    glow: 'shadow-emerald-500/40',
    pulse: true,
    label: '写信中'
  },
  COOLING: {
    icon: Coffee,
    color: 'text-orange-400',
    bg: 'bg-orange-500/20',
    glow: 'shadow-orange-500/40',
    pulse: false,
    label: '冷却中'
  },
}

interface AgentAvatarProps {
  state: AgentState
  size?: number
}

export function AgentAvatar({ state, size = 48 }: AgentAvatarProps) {
  const config = STATE_CONFIG[state] ?? STATE_CONFIG.IDLE
  const Icon = config.icon

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={state}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        transition={{ duration: 0.2 }}
        className={`relative flex-shrink-0 rounded-full flex items-center justify-center ${config.bg} ${config.glow ? `shadow-lg ${config.glow}` : ''}`}
        style={{ width: size, height: size }}
      >
        {config.pulse && (
          <span className="absolute inset-0 rounded-full animate-ping opacity-30 bg-current" style={{ color: 'inherit' }} />
        )}
        <Icon className={`${config.color}`} style={{ width: size * 0.45, height: size * 0.45 }} />
      </motion.div>
    </AnimatePresence>
  )
}
