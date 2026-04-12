'use client'

import {
  Zap, Mail, Target, FileText, Globe, Sparkles,
  Briefcase, TrendingUp, Users, Shield, Package,
  CreditCard, Gift, Tag, Clock, CheckCircle2,
  AlertCircle, Info, Star, Crown, Rocket,
  Settings, Search, Send, BarChart3, Database,
  Code, Headphones, Download
} from 'lucide-react'

// 所有可用的图标名称映射
const ICON_MAP = {
  Zap,
  Mail,
  Target,
  FileText,
  Globe,
  Sparkles,
  Briefcase,
  TrendingUp,
  Users,
  Shield,
  Package,
  CreditCard,
  Gift,
  Tag,
  Clock,
  CheckCircle2,
  AlertCircle,
  Info,
  Star,
  Crown,
  Rocket,
  Settings,
  Search,
  Send,
  BarChart3,
  Database,
  Code,
  Headphones,
  Download,
} as const

export type IconName = keyof typeof ICON_MAP

interface IconRendererProps {
  name: IconName
  className?: string
  size?: number
}

/**
 * 将图标名称字符串转换为对应的 Lucide React 图标组件
 * 用法: <IconRenderer name="Zap" size={24} className="text-amber-500" />
 */
export function IconRenderer({ name, className = '', size = 24 }: IconRendererProps) {
  const Icon = ICON_MAP[name]

  if (!Icon) {
    // 如果找不到图标，返回一个默认图标
    return <Info className={className} size={size} />
  }

  return <Icon className={className} size={size} />
}

/**
 * 根据商品类型获取默认图标
 */
export function getIconByType(type: string): IconName {
  const typeIconMap: Record<string, IconName> = {
    'subscription': 'Shield',
    'token': 'Zap',
    'email': 'Mail',
    'lead': 'Target',
    'domain': 'Globe',
    'template': 'Briefcase',
    'strategy': 'TrendingUp',
    'custom': 'Sparkles',
    'export': 'Download',
  }
  return typeIconMap[type] || 'Package'
}

/**
 * 根据商品 ID 获取图标
 */
export function getIconById(id: string): IconName {
  if (id.startsWith('token')) return 'Zap'
  if (id.startsWith('email')) return 'Mail'
  if (id.startsWith('lead')) return 'Target'
  if (id.startsWith('domain')) return 'Globe'
  if (id.startsWith('template')) return 'Briefcase'
  if (id.startsWith('strategy')) return 'TrendingUp'
  if (id.startsWith('ai-custom')) return 'Sparkles'
  if (id.startsWith('service-ip')) return 'Shield'
  if (id.startsWith('service-api')) return 'Code'
  if (id.startsWith('service-onboarding')) return 'Headphones'
  if (id === 'STARTER' || id === 'PRO' || id === 'MAX') return 'Shield'
  if (id.startsWith('EXPORT')) return 'Download'
  return 'Package'
}
