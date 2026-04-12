/**
 * 发信任务预估配置
 * 
 * 此文件定义了真实的 Token 消耗标准和并发限制
 * 所有预估计算都基于这些真实数据，禁止使用假数据
 */

// ============================================
// Token 消耗标准（根据实际 AI 调用成本调整）
// ============================================
export const TOKEN_COST_CONFIG = {
  // 基础邮件生成（使用模板 + 简单变量替换）
  BASE_EMAIL_GENERATION: 10,
  
  // 深度 AI 分析（GPT-4 级别的个性化内容生成）
  DEEP_ANALYSIS: 20,
  
  // 网站数据爬取与解析（爬虫 + HTML 解析 + 结构化提取）
  WEBSITE_SCRAPING: 8,
  
  // RAG 知识库检索（向量搜索 + 上下文拼接）
  RAG_RETRIEVAL: 3,
  
  // AI 意向评分（基于网站内容判断客户意向）
  INTENT_SCORING: 5,
  
  // 邮件主题优化（A/B 测试生成多个主题）
  SUBJECT_OPTIMIZATION: 4,
  
  // 跟进邮件生成（基于首封邮件的上下文）
  FOLLOW_UP_GENERATION: 12,
} as const

// ============================================
// 并发速率限制（每小时发送上限）
// ============================================
export const HOURLY_RATE_LIMITS = {
  TRIAL: 50,      // 试用版：每小时 50 封
  STARTER: 200,   // 入门版：每小时 200 封
  PRO: 500,       // 专业版：每小时 500 封
  MAX: 1000,      // 旗舰版：每小时 1000 封
} as const

// ============================================
// 套餐标签映射
// ============================================
export const TIER_LABELS = {
  TRIAL: '试用版',
  STARTER: '入门版',
  PRO: '专业版',
  MAX: '旗舰版'
} as const

// ============================================
// 风控阈值配置
// ============================================
export const RISK_CONTROL_CONFIG = {
  // 退信率阈值（超过此数量自动暂停发信）
  BOUNCE_THRESHOLD: 10,
  
  // 单次任务最大目标数量
  MAX_TARGETS_PER_TASK: 50000,
  
  // 试用版单次任务最大目标数量
  TRIAL_MAX_TARGETS: 100,
  
  // 最低余额警告阈值（低于此值时前端显示警告）
  LOW_BALANCE_WARNING: 1000,
} as const

// ============================================
// 预估成功率配置
// ============================================
export const SUCCESS_RATE_CONFIG = {
  // 新用户默认成功率（无历史数据时使用）
  DEFAULT_SUCCESS_RATE: 85,
  
  // 最低成功率（即使历史数据很差，也不低于此值）
  MIN_SUCCESS_RATE: 60,
  
  // 最高成功率（即使历史数据很好，也不高于此值）
  MAX_SUCCESS_RATE: 95,
} as const

/**
 * 计算单个 Lead 的 Token 消耗
 */
export function calculateTokenPerLead(enableDeepAnalysis: boolean): number {
  let total = TOKEN_COST_CONFIG.BASE_EMAIL_GENERATION

  if (enableDeepAnalysis) {
    total += TOKEN_COST_CONFIG.DEEP_ANALYSIS
    total += TOKEN_COST_CONFIG.WEBSITE_SCRAPING
    total += TOKEN_COST_CONFIG.RAG_RETRIEVAL
    total += TOKEN_COST_CONFIG.INTENT_SCORING
  }

  return total
}

/**
 * 计算预估工作时长
 */
export function calculateEstimatedTime(
  targetCount: number,
  subscriptionTier: keyof typeof HOURLY_RATE_LIMITS
): {
  hours: number
  minutes: number
  display: string
} {
  const hourlyLimit = HOURLY_RATE_LIMITS[subscriptionTier] || 100
  const hours = Math.ceil(targetCount / hourlyLimit)
  const minutes = hours * 60

  let display = ''
  if (hours < 1) {
    const mins = Math.ceil(targetCount / (hourlyLimit / 60))
    display = `约 ${mins} 分钟`
  } else if (hours === 1) {
    display = '约 1 小时'
  } else if (hours < 24) {
    display = `约 ${hours} 小时`
  } else {
    const days = Math.ceil(hours / 24)
    display = `约 ${days} 天`
  }

  return { hours, minutes, display }
}

/**
 * 获取套餐标签
 */
export function getTierLabel(tier: string): string {
  return TIER_LABELS[tier as keyof typeof TIER_LABELS] || tier
}

/**
 * 获取套餐的每小时发送限制
 */
export function getHourlyLimit(tier: string): number {
  return HOURLY_RATE_LIMITS[tier as keyof typeof HOURLY_RATE_LIMITS] || 100
}
