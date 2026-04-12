// ═══════════════════════════════════════════════════════════════════
// LeadPilot 商品数据唯一真理配置
// 全站所有定价展示（官网、钱包页、升级弹窗、增值商城）均从此文件读取
// 修改价格或文案只需改此一处
// ═══════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════
// 1. 订阅套餐 (Subscription Plans)
// ══════════════════════════════════════════════════

export type PlanId = 'STARTER' | 'PRO' | 'MAX'

export interface PlanFeature {
  label: string
  value: string
  highlight?: boolean
  locked?: boolean
}

export interface Plan {
  id: PlanId
  name: string
  subtitle: string
  coreOutcome: string
  ctaText: string
  price: number
  yearlyPrice: number
  color: string
  gradient: string
  badge?: string
  features: PlanFeature[]
  quotas: {
    maxTokensPerMonth: number
    maxLeadsPerMonth: number
    maxEmailsPerMonth: number
    maxRAGFiles: number
    maxDomains: number
    maxLanguages: number
    dataRetentionDays: number
    concurrencyLevel: number
  }
}

export const PLANS: Plan[] = [
  {
    id: 'STARTER',
    name: '试运营版',
    subtitle: '适合首次做海外邮件拓客的团队',
    coreOutcome: '7 天内跑通首个自动拓客流程',
    ctaText: '立即订阅',
    price: 299,
    yearlyPrice: 239,
    color: 'text-blue-400',
    gradient: 'from-blue-600 to-cyan-500',
    features: [
      { label: '月度算力额度',   value: '50,000 tokens/月' },
      { label: '目标客户挖掘',   value: '每月最多 300 家' },
      { label: '邮件并发发送',   value: '单域名，标准速率' },
      { label: '发信域名数量',   value: '1 个专属域名' },
      { label: 'AI 邮件生成',    value: '✅ 支持（英语）' },
      { label: '多语种邮件生成', value: '🔒 不支持', locked: true },
      { label: '深度意图分析',   value: '🔒 不支持', locked: true },
      { label: 'AI 智能回复建议',value: '🔒 不支持', locked: true },
      { label: '知识库文件上传', value: '最多 3 个文件' },
      { label: '历史任务记录',   value: '保留 7 天' },
      { label: '数据导出',       value: '🔒 不支持', locked: true },
      { label: '客服响应优先级', value: '标准（24 小时）' },
    ],
    quotas: {
      maxTokensPerMonth: 50000,
      maxLeadsPerMonth: 300,
      maxEmailsPerMonth: 1000,
      maxRAGFiles: 3,
      maxDomains: 1,
      maxLanguages: 1,
      dataRetentionDays: 7,
      concurrencyLevel: 1,
    },
  },
  {
    id: 'PRO',
    name: '增长版',
    subtitle: '适合需要稳定询盘增长的外贸团队',
    coreOutcome: '稳定获取正向回复与询盘',
    ctaText: '立即订阅',
    price: 799,
    yearlyPrice: 639,
    color: 'text-purple-400',
    gradient: 'from-purple-600 to-pink-500',
    badge: '主推',
    features: [
      { label: '月度算力额度',   value: '200,000 tokens/月', highlight: true },
      { label: '目标客户挖掘',   value: '每月最多 1,000 家', highlight: true },
      { label: '邮件并发发送',   value: '加速模式（2 域名）', highlight: true },
      { label: '发信域名数量',   value: '3 个专属域名' },
      { label: 'AI 邮件生成',    value: '✅ 支持（8 语种）' },
      { label: '多语种邮件生成', value: '✅ 法/德/西/葡/意/日/韩', highlight: true },
      { label: '深度意图分析',   value: '✅ AI 意图标签 + 摘要', highlight: true },
      { label: 'AI 智能回复建议',value: '✅ 5 种预设指令' },
      { label: '知识库文件上传', value: '最多 20 个文件' },
      { label: '历史任务记录',   value: '保留 90 天' },
      { label: '数据导出',       value: '✅ CSV / Excel' },
      { label: '客服响应优先级', value: '优先（4 小时）' },
    ],
    quotas: {
      maxTokensPerMonth: 200000,
      maxLeadsPerMonth: 1000,
      maxEmailsPerMonth: 5000,
      maxRAGFiles: 20,
      maxDomains: 3,
      maxLanguages: 8,
      dataRetentionDays: 90,
      concurrencyLevel: 2,
    },
  },
  {
    id: 'MAX',
    name: '规模化版',
    subtitle: '适合多业务线并发拓客的出海企业',
    coreOutcome: '多域名并发扩量 + 团队协同',
    ctaText: '立即订阅',
    price: 1999,
    yearlyPrice: 1599,
    color: 'text-amber-400',
    gradient: 'from-amber-500 to-orange-500',
    features: [
      { label: '月度算力额度',   value: '500,000 tokens/月', highlight: true },
      { label: '目标客户挖掘',   value: '每月最多 3,000 家', highlight: true },
      { label: '邮件并发发送',   value: '极速模式（10 域名轮换）', highlight: true },
      { label: '发信域名数量',   value: '10 个专属域名', highlight: true },
      { label: 'AI 邮件生成',    value: '✅ 支持（全语种）' },
      { label: '多语种邮件生成', value: '✅ 全球 40+ 语种', highlight: true },
      { label: '深度意图分析',   value: '✅ 高级意图 + 商机评分', highlight: true },
      { label: 'AI 智能回复建议',value: '✅ 自定义指令 + 批量回复', highlight: true },
      { label: '知识库文件上传', value: '无限制（含向量检索）', highlight: true },
      { label: '历史任务记录',   value: '永久保留' },
      { label: '数据导出',       value: '✅ 全格式 + API 接入', highlight: true },
      { label: '客服响应优先级', value: '🔴 专属顾问（2 小时）', highlight: true },
    ],
    quotas: {
      maxTokensPerMonth: 500000,
      maxLeadsPerMonth: 3000,
      maxEmailsPerMonth: 50000,
      maxRAGFiles: 100,
      maxDomains: 10,
      maxLanguages: 40,
      dataRetentionDays: 36500,
      concurrencyLevel: 3,
    },
  },
]

// ══════════════════════════════════════════════════
// 2. 算力与配额包 (Quota Addons)
// ══════════════════════════════════════════════════

// 图标使用 lucide-react 组件名，例如 'Zap' 对应算力，'Mail' 对应发信
export type LucideIconName = 'Zap' | 'Mail' | 'Target' | 'FileText' | 'Globe' | 'Sparkles' | 'Briefcase' | 'TrendingUp' | 'Users' | 'Shield' | 'Settings' | 'Code' | 'Headphones'

export interface QuotaAddon {
  id: string
  name: string
  description?: string        // 向后兼容（旧字段）
  shortDesc: string              // 列表页一句话说明
  modalDetail: string            // 支付弹窗左侧详细权益说明
  price: number                  // 固定价格
  icon: LucideIconName           // lucide-react 图标名称
  badge?: string                 // 可选标签如"热门"
  // 规格字段
  tokens?: number                // 算力包专用
  leads?: number                 // 线索包专用
  emails?: number                // 发信包专用
  unit?: string                  // 向后兼容（旧字段，如 "10万 tokens"）
  validDays: number              // 有效期天数，永久用 -1
}

export const QUOTA_ADDONS: QuotaAddon[] = [
  // ── 算力包 ──
  {
    id: 'token-10w',
    name: '算力包 · 10万',
    shortDesc: 'AI 算力永久有效，不过期，可叠加',
    modalDetail: `【商品规格】
• 10万 AI tokens
• 永久有效，不设过期时间
• 可无限叠加使用

【使用场景】
• 线索挖掘与筛选
• AI 邮件生成与优化
• 意图分析与商机评分
• RAG 知识库检索

【生效机制】
• 购买后即时到账，直接充值到您的钱包余额
• 无需手动激活，购买即开通

【注意事项】
• 算力仅限本账号使用，不可转让
• 不支持退款，虚拟资产一经充值无法撤回`,
    price: 109,
    icon: 'Zap',
    tokens: 100000,
    validDays: -1, // 永久
  },
  {
    id: 'token-20w',
    name: '算力包 · 20万',
    shortDesc: '大批量首选，算力永久有效',
    price: 199,
    icon: 'Zap',
    badge: '热门',
    tokens: 200000,
    validDays: -1,
    modalDetail: `【商品规格】
• 20万 AI tokens
• 永久有效，不设过期时间
• 可无限叠加使用
• 相比单买更优惠（10万包单价 ¥109，20万包单价仅 ¥99.5/10万）

【使用场景】
• 批量线索挖掘与筛选
• 多语种邮件批量生成
• 深度 RAG 知识库检索
• 高频 AI 对话与优化

【生效机制】
• 购买后即时到账，直接充值到您的钱包余额
• 无需手动激活，购买即开通

【注意事项】
• 算力仅限本账号使用，不可转让
• 不支持退款，虚拟资产一经充值无法撤回`,
  },
  {
    id: 'token-50w',
    name: '算力包 · 50万',
    shortDesc: '企业级大批量处理，算力永久有效',
    price: 449,
    icon: 'Zap',
    tokens: 500000,
    validDays: -1,
    modalDetail: `【商品规格】
• 50万 AI tokens
• 永久有效，不设过期时间
• 可无限叠加使用
• 相比单买更优惠（10万包单价 ¥109，50万包单价仅 ¥89.8/10万）

【使用场景】
• 企业级大批量线索挖掘
• 全天候 AI 自动化任务
• 多业务线并发处理
• 专业 RAG 知识库建设

【生效机制】
• 购买后即时到账，直接充值到您的钱包余额
• 无需手动激活，购买即开通

【注意事项】
• 算力仅限本账号使用，不可转让
• 不支持退款，虚拟资产一经充值无法撤回`,
  },

  // ── 发信额度包 ──
  {
    id: 'email-5000',
    name: '发信额度包 · 5000封',
    shortDesc: '额外发信配额，当月有效',
    price: 79,
    icon: 'Mail',
    badge: '热门',
    emails: 5000,
    validDays: 30,
    modalDetail: `【商品规格】
• 5,000 封额外发信额度
• 有效期：购买后 30 天
• 当月用完可叠加购买

【使用场景】
• 活动推广期临时扩量
• 大促期间提升触达量
• 紧急跟进大批量客户

【生效机制】
• 购买后即时到账，添加到您的发信额度池
• 有效期从购买当日开始计算
• 月底不清零，按自然月计算

【注意事项】
• 发信额度仅限本账号使用，不可转让
• 过期未使用自动作废，不延期不退款`,
  },
  {
    id: 'email-20000',
    name: '发信额度包 · 2万封',
    shortDesc: '大批量发信，当月有效',
    price: 249,
    icon: 'Mail',
    emails: 20000,
    validDays: 30,
    modalDetail: `【商品规格】
• 20,000 封额外发信额度
• 有效期：购买后 30 天
• 相比单买更优惠（单封均价约 ¥0.0125）

【使用场景】
• 企业级大批量发信
• 多域名并发发信
• 长期营销活动覆盖

【生效机制】
• 购买后即时到账，添加到您的发信额度池
• 有效期从购买当日开始计算

【注意事项】
• 发信额度仅限本账号使用，不可转让
• 过期未使用自动作废，不延期不退款`,
  },

  // ── 线索额度包 ──
  {
    id: 'lead-300',
    name: '线索额度包 · 300家',
    shortDesc: '高精准 B2B 线索挖掘配额，当月有效',
    price: 199,
    icon: 'Target',
    leads: 300,
    validDays: 30,
    modalDetail: `【商品规格】
• 300 家高精准 B2B 目标客户线索
• 有效期：购买后 30 天
• 单价 ¥199/300家，均价约 ¥0.66/家

【使用场景】
• 精准行业客户挖掘
• 新市场开拓补充配额
• 快速验证目标客户画像

【生效机制】
• 购买后即时到账，添加到您的线索额度池
• 有效期从购买当日开始计算

【AI 筛选服务说明】
• 使用 AI 进行深度意图分析
• 自动过滤低质量线索
• 保留高回复率目标客户

【注意事项】
• 线索额度仅限本账号使用，不可转让
• 过期未使用自动作废，不延期不退款`,
  },
  {
    id: 'lead-1000',
    name: '线索额度包 · 1000家',
    shortDesc: '大批量企业邮箱与决策人挖掘，当月有效',
    price: 599,
    icon: 'Target',
    badge: '热门',
    leads: 1000,
    validDays: 30,
    modalDetail: `【商品规格】
• 1,000 家大批量企业邮箱与决策人线索
• 有效期：购买后 30 天
• 批量折扣：单家均价约 ¥0.60/家，相比小额包省 10%

【使用场景】
• 大规模市场开拓
• 多产品线同时挖掘
• 季度性大批量获客

【生效机制】
• 购买后即时到账，添加到您的线索额度池
• 有效期从购买当日开始计算

【AI 筛选服务说明】
• 使用 AI 进行深度意图分析
• 自动过滤低质量线索
• 保留高回复率目标客户
• 支持多维度筛选（行业、规模、地域）

【注意事项】
• 线索额度仅限本账号使用，不可转让
• 过期未使用自动作废，不延期不退款`,
  },
]

// ══════════════════════════════════════════════════
// 3. 域名扩展包 (Domain Addons)
// ══════════════════════════════════════════════════

export interface DomainAddon {
  id: string
  name: string
  description?: string         // 向后兼容
  shortDesc: string
  modalDetail: string
  price: number
  icon: LucideIconName
  badge?: string
  domainCount: number
  validDays: number // 永久 = -1
}

export const DOMAIN_ADDONS: DomainAddon[] = [
  {
    id: 'domain-1',
    name: '域名扩展 · +1个发信域名',
    shortDesc: '永久有效，小团队首选',
    price: 99,
    icon: 'Globe',
    domainCount: 1,
    validDays: -1,
    modalDetail: `【商品规格】
• 增加 1 个发信域名配额
• 永久有效，不设过期时间

【使用场景】
• 分离不同业务线的发信身份
• 新品牌独立运营
• 测试新域名邮件效果

【生效机制】
• 购买后即时到账，可在域名管理中添加
• 无需续费，永久有效

【域名配置说明】
• 需完成域名 DNS 配置才能使用
• 配置指南请参考帮助文档
• 如需协助可联系客服

【注意事项】
• 域名配额仅限本账号使用，不可转让
• 不支持退款，虚拟配额一经购买无法撤回`,
  },
  {
    id: 'domain-3',
    name: '域名扩展 · +3个发信域名',
    shortDesc: '永久有效，享套餐优惠',
    price: 249,
    icon: 'Globe',
    badge: '推荐',
    domainCount: 3,
    validDays: -1,
    modalDetail: `【商品规格】
• 增加 3 个发信域名配额
• 永久有效，不设过期时间
• 套餐优惠：单域名均价约 ¥83，相比单买省 16%

【使用场景】
• 多品牌矩阵运营
• 提升邮件并发能力
• 降低单域名发信密度

【生效机制】
• 购买后即时到账，可在域名管理中添加
• 无需续费，永久有效

【域名配置说明】
• 需完成域名 DNS 配置才能使用
• 配置指南请参考帮助文档
• 如需协助可联系客服

【注意事项】
• 域名配额仅限本账号使用，不可转让
• 不支持退款，虚拟配额一经购买无法撤回`,
  },
  {
    id: 'domain-5',
    name: '域名扩展 · +5个发信域名',
    shortDesc: '永久有效，企业级配置',
    price: 399,
    icon: 'Globe',
    domainCount: 5,
    validDays: -1,
    modalDetail: `【商品规格】
• 增加 5 个发信域名配额
• 永久有效，不设过期时间
• 套餐优惠：单域名均价约 ¥80，相比单买省 19%

【使用场景】
• 大型企业多业务线分离
• 极致提升发信吞吐量
• 专业邮件营销矩阵

【生效机制】
• 购买后即时到账，可在域名管理中添加
• 无需续费，永久有效

【域名配置说明】
• 需完成域名 DNS 配置才能使用
• 配置指南请参考帮助文档
• 如需协助可联系客服

【注意事项】
• 域名配额仅限本账号使用，不可转让
• 不支持退款，虚拟配额一经购买无法撤回`,
  },
]

// ══════════════════════════════════════════════════
// 4. 行业专属模板资产 (Template Assets)
// ══════════════════════════════════════════════════

export interface TemplateAsset {
  id: string
  name: string
  description?: string        // 向后兼容
  shortDesc: string              // 列表页一句话说明
  modalDetail: string            // 支付弹窗左侧详细权益说明
  longDesc?: string             // 向后兼容（长描述）
  price: number
  icon: LucideIconName
  badge?: string                 // 可选标签
  popular?: boolean              // 是否热门
  isCustom?: boolean             // 是否为定制包
  validDays: number              // 永久 = -1
  // 交付信息
  deliveryDays?: number          // 交付周期（天）
  deliveryMethod?: string        // 交付方式
}

export const TEMPLATE_ASSETS: TemplateAsset[] = [
  {
    id: 'template-mechanical',
    name: '行业模板包 · 机械制造',
    shortDesc: '50 套开发信模板，覆盖工业设备与零配件',
    price: 199,
    icon: 'Briefcase',
    validDays: -1,
    modalDetail: `【商品规格】
• 50 套专属开发信模板
• 覆盖细分场景：工业设备、零配件、重型机械、工程机械等
• 永久有效，终身使用

【模板内容】
• 首封开发信模板（10套）
• 价值递进跟进模板（15套）
• 逼单成交模板（10套）
• 节假日关怀模板（8套）
• 危机公关话术（7套）

【行业专属话术】
• 买家痛点深度分析
• 技术参数表达话术
• 质量认证合规描述
• 交期产能自信表达

【多语种支持】
• 英语原版
• 西班牙语、德语、法语变体（可直接使用）

【生效机制】
• 购买后即时解锁
• 可直接导入任务使用

【注意事项】
• 仅限本账号使用，不可转让
• 不支持退款，虚拟资产一经购买无法撤回`,
  },
  {
    id: 'template-electronics',
    name: '行业模板包 · 电子元器件',
    shortDesc: '50 套开发信模板，覆盖 PCB/芯片/连接器',
    price: 199,
    icon: 'Briefcase',
    validDays: -1,
    modalDetail: `【商品规格】
• 50 套专属开发信模板
• 覆盖细分场景：PCB、芯片、连接器、线束、传感器等
• 永久有效，终身使用

【模板内容】
• 首封开发信模板（10套）
• 技术方案提案模板（15套）
• 样品试用推进模板（10套）
• 交期报价跟进模板（8套）
• 长期合作邀请模板（7套）

【行业专属话术】
• 技术参数专业表达
• 供应链合规描述
• 替代方案引导话术
• 账期谈判策略

【多语种支持】
• 英语原版
• 日语、韩语变体（可直接使用）

【生效机制】
• 购买后即时解锁
• 可直接导入任务使用

【注意事项】
• 仅限本账号使用，不可转让
• 不支持退款，虚拟资产一经购买无法撤回`,
  },
  {
    id: 'template-furniture',
    name: '行业模板包 · 家居家具',
    shortDesc: '50 套开发信模板，覆盖实木/软体/户外家居',
    price: 199,
    icon: 'Briefcase',
    validDays: -1,
    modalDetail: `【商品规格】
• 50 套专属开发信模板
• 覆盖细分场景：实木家具、软体家具、户外家居、酒店家具等
• 永久有效，终身使用

【模板内容】
• 首封开发信模板（10套）
• 设计卖点提炼模板（15套）
• 展会邀约话术（10套）
• OEM/ODM 合作模板（8套）
• 案例展示跟进模板（7套）

【行业专属话术】
• 设计风格卖点表达
• 环保认证话术
• 产能规模自信展示
• 物流安装服务说明

【多语种支持】
• 英语原版
• 德语、法语变体（可直接使用）

【生效机制】
• 购买后即时解锁
• 可直接导入任务使用

【注意事项】
• 仅限本账号使用，不可转让
• 不支持退款，虚拟资产一经购买无法撤回`,
  },
  {
    id: 'template-textile',
    name: '行业模板包 · 纺织面料',
    shortDesc: '50 套开发信模板，覆盖梭织/针织/功能性面料',
    price: 199,
    icon: 'Briefcase',
    badge: '热门',
    popular: true,
    validDays: -1,
    modalDetail: `【商品规格】
• 50 套专属开发信模板
• 覆盖细分场景：梭织、针织、功能性面料、纱线、染料助剂等
• 永久有效，终身使用

【模板内容】
• 首封开发信模板（10套）
• 认证合规话术模板（15套）
• 样品寄送推进模板（10套）
• 大货跟进逼单模板（8套）
• 长期客户维护模板（7套）

【行业专属话术】
• OEKO-TEX、GOTS 等认证合规描述
• 环保可持续表达
• 产能交期专业话术
• 最小起订量引导策略

【多语种支持】
• 英语原版
• 西班牙语、葡萄牙语变体（可直接使用）

【生效机制】
• 购买后即时解锁
• 可直接导入任务使用

【注意事项】
• 仅限本账号使用，不可转让
• 不支持退款，虚拟资产一经购买无法撤回`,
  },
  {
    id: 'strategy-executive',
    name: '高管成交策略包',
    shortDesc: '针对 C-level 的高转化话术库，平均回复率提升 3 倍',
    price: 299,
    icon: 'TrendingUp',
    badge: '热门',
    popular: true,
    validDays: -1,
    modalDetail: `【商品规格】
• 高管专项话术库
• 永久有效，终身使用
• 专为 C-level（CEO、VP、采购总监）设计

【内容构成】
• 冷启动话术（5套）
• 价值共鸣话术（8套）
• 痛点激发话术（6套）
• 方案呈现话术（5套）
• 逼单成交话术（4套）
• 完整 7 步跟进序列

【策略亮点】
• 平均回复率提升 3 倍
• C-level 专属称呼与沟通策略
• 高管时间稀缺性话术应对
• 绕过秘书拦截技巧

【使用场景】
• 开发大型企业客户
• 进入高端市场
• 提升客单价与成交率

【生效机制】
• 购买后即时解锁
• 可直接导入任务使用

【注意事项】
• 仅限本账号使用，不可转让
• 不支持退款，虚拟资产一经购买无法撤回`,
  },
  {
    id: 'strategy-followup',
    name: '跟进序列策略包',
    shortDesc: '7 步自动化跟进邮件模板，从首封到逼单全覆盖',
    price: 249,
    icon: 'Mail',
    validDays: -1,
    modalDetail: `【商品规格】
• 7 步自动化跟进序列
• 永久有效，终身使用
• 可直接导入任务自动化执行

【序列构成】
• Step 1：首封开发信（触发：任务开始）
• Step 2：价值递进邮件（触发：3天后无回复）
• Step 3：案例背书邮件（触发：7天后无回复）
• Step 4：限时优惠邮件（触发：14天后无回复）
• Step 5：情感共鸣邮件（触发：21天后无回复）
• Step 6：最终逼单邮件（触发：28天后无回复）
• Step 7：沉默激活邮件（触发：35天后无回复）

【策略设计】
• 每封邮件独立主题，避免进入垃圾箱
• 渐进式价值输出，避免过度营销感
• 自动化触发，无需手动跟进

【生效机制】
• 购买后即时解锁
• 可直接导入任务使用

【注意事项】
• 仅限本账号使用，不可转让
• 不支持退款，虚拟资产一经购买无法撤回`,
  },

  // ══ 核心定制产品 ══
  {
    id: 'ai-custom-industry',
    name: 'AI 专属定制行业开发信与策略包',
    shortDesc: 'AI 深度介入，为您生成独家私有化拓客矩阵',
    price: 999,
    icon: 'Sparkles',
    badge: '独家定制',
    popular: true,
    isCustom: true,
    validDays: -1,
    deliveryDays: 3,
    deliveryMethod: '企业微信客服一对一交付',
    modalDetail: `【商品规格】
• AI 深度介入，根据您的具体业务生成独家私有化拓客矩阵
• 永久私有，不对外共享
• 交付周期：3 个工作日

【交付内容】
① 行业竞品分析报告
   - 您的竞争对手邮件策略分析
   - 行业最佳实践提炼
   - 差异化卖点定位

② 专属话术模板
   - 首封开发信（3套）
   - 跟进序列（7步 × 3变体）
   - 逼单成交话术（2套）
   - 全部支持您指定的语言

③ 目标买家画像建模
   - 精准画像描述（行业/规模/地域/痛点）
   - 优先级排序建议
   - 接触时机分析

④ 多语种变体生成
   - 覆盖您目标市场的所有主要语种
   - 本地化表达，避免机械翻译

【🚨 重要：交付方式】
购买后，请添加官方企业微信客服进行一对一交付。

请在发送好友请求时复制并填写以下信息：
【订单编号】：（请在付款后于订单页复制）
【所属行业】：
【企业规模】：
【目标市场】：
【平均客单价】：

客服收到后将安排专属 AI 策略师为您配置。

【生效机制】
• 付款成功后，客服将在 24 小时内与您联系
• AI 策略师接单后 3 个工作日内完成交付
• 交付物直接发送到您的账号

【注意事项】
• 仅限本账号使用，不可转让
• 定制内容为虚拟资产，一经开始制作不支持退款`,
  },
]

// ══════════════════════════════════════════════════
// 5. 高级特权与服务 (Premium Services)
// ══════════════════════════════════════════════════

export interface PremiumService {
  id: string
  name: string
  shortDesc: string
  modalDetail: string
  price: number
  icon: LucideIconName
  badge?: string
  popular?: boolean
  validDays: number  // 永久 = -1
  deliveryDays?: number   // 交付周期（天）
  deliveryMethod?: string  // 交付方式
}

export const PREMIUM_SERVICES: PremiumService[] = [
  {
    id: 'service-ip',
    name: '独立发信预热池与高信誉 IP',
    shortDesc: '独享高信誉 IP 通道，防封号，送达率提升 40%',
    price: 499,
    icon: 'Shield',
    validDays: 30,
    modalDetail: `【商品规格】
• 独享高信誉 IP 发信通道
• 完整隔离其他用户的垃圾邮件风险
• 专属预热池，自动完成域名预热
• 按月计费，月底自动续费

【核心权益】
• IP 信誉独立，与其他用户完全隔离
• 新域名自动预热（7天标准预热流程）
• 发送频率智能调控，避免触发封号机制
• 送达率实测提升 40% 以上
• 独立 IP 健康度监控面板

【技术实现】
• 独立 IP 池容量：10 个独立 IP
• 支持多域名轮换
• SPF / DKIM / DMARC 自动配置
• 送箱率保障：95%+
• 7x24 异常告警与自动熔断

【适用场景】
• 高价值客户精准触达
• 重要邮件确保送达
• 避免被标记为垃圾邮件
• 保护品牌声誉

【生效机制】
• 购买后 24 小时内开通
• 专属技术顾问协助域名配置
• 提供完整接入文档与技术支持

【注意事项】
• 服务按月自动续费，随时可取消
• IP 通道仅限本账号使用，不可转让
• 取消后 IP 回收，不可保留`,
  },
  {
    id: 'service-api',
    name: 'API 与 Webhook 自动化集成包',
    shortDesc: '打通飞书/钉钉/HubSpot，实现全自动数据流转',
    price: 999,
    icon: 'Code',
    badge: '热门',
    popular: true,
    validDays: -1, // 永久
    modalDetail: `【商品规格】
• 开放完整的 GraphQL / REST API 权限
• 支持 Webhook 实时推送
• 永久有效，终身授权
• 包含 API 使用培训与技术支持

【API 能力】
• 线索管理：创建/查询/更新/删除线索
• 任务管理：创建/启动/暂停/查询任务
• 数据同步：实时拉取发送数据与回复
• 统计报表：多维度分析数据导出
• 域名管理：批量添加与配置域名
• 用户管理：子账号创建与权限配置

【Webhook 支持】
• 任务状态变更推送
• 新回复通知推送
• 发送状态回调
• 数据同步回调

【集成案例】
• 飞书机器人：线索入库自动通知
• 钉钉群消息：每日发送报告推送
• HubSpot CRM：双向同步客户数据
• Zapier/Make：连接 5000+ 应用
• 自定义系统：开放接口文档与 SDK

【技术文档】
• 完整 API 文档（Swagger / OpenAPI）
• 多语言 SDK（Python / Node.js / Go）
• Postman 集成示例
• 沙盒测试环境

【生效机制】
• 购买后即时开通 API 权限
• 提供专属 API Key 与 Secret
• 7x24 技术支持响应

【注意事项】
• API 调用有频率限制（按套餐等级）
• 永久授权，不可转让
• 不支持退款，虚拟授权一经购买无法撤回`,
  },
  {
    id: 'service-onboarding',
    name: 'SaaS 零阻力全托管实施服务',
    shortDesc: '官方实施专家 1 对 1，帮您完成所有配置与首发设置',
    price: 2999,
    icon: 'Headphones',
    badge: '官方服务',
    validDays: -1, // 永久
    deliveryDays: 1,
    deliveryMethod: '官方实施专家 1 对 1 交付',
    modalDetail: `【商品规格】
• 官方实施专家 1 对 1 全程服务
• 不是买软件，而是买落地服务
• 最快速度让系统跑起来见到效果
• 永久有效，一次购买，终身受益

【🚨 重要说明】
这不是简单的技术支持！
这是从零到一帮您完成整套系统落地的实施服务。
您不仅获得工具，更获得一个已经配置好、测试好、直接可用的系统。

【服务内容】
① 业务诊断与方案设计
• 深度了解您的产品与目标市场
• 分析竞争对手邮件策略
• 制定专属拓客矩阵方案

② 系统配置
• 域名 DNS 全套配置（SPF/DKIM/DMARC）
• 邮箱账号创建与权限分配
• 发信域名预热计划制定与执行

③ 首发设置
• 首批目标客户名单筛选（最多 500 家）
• 首封开发信 AI 生成与优化
• 首轮发送策略与频率设置
• 进箱率测试与调优

④ 培训与交接
• 完整操作培训（1-2 小时）
• 日常运营 SOP 文档交付
• 常见问题处理指南

⑤ 持续支持
• 30 天内优先响应（工作日 4 小时）
• 域名问题第一时间协助处理
• 策略优化建议

【交付流程】
Day 1：需求对接与合同签署
Day 2-3：系统配置与预热启动
Day 5-7：首批线索筛选与邮件生成
Day 10：首发测试与调优
Day 14：正式运营交接

【服务承诺】
• 7 天内完成核心系统上线
• 14 天内完成首轮真实客户触达
• 全程 1 对 1 专属服务
• 不满意可申请退款（扣除已完成工作）`,
  },
]

// ══════════════════════════════════════════════════
// 便捷查询函数
// ══════════════════════════════════════════════════

export const getPlan           = (id: PlanId)         => PLANS.find(p => p.id === id)!
export const getPlanByPrice    = (price: number)      => PLANS.find(p => p.price === price)
export const getQuotaAddon     = (id: string)          => QUOTA_ADDONS.find(a => a.id === id)
export const getDomainAddon    = (id: string)          => DOMAIN_ADDONS.find(a => a.id === id)
export const getTemplateAsset  = (id: string)          => TEMPLATE_ASSETS.find(a => a.id === id)

// ══════════════════════════════════════════════════
// 辅助类型导出（供其他组件使用）
// ══════════════════════════════════════════════════

// 用于商城页面渲染的通用产品卡片类型
export type ProductType = 'subscription' | 'quota' | 'domain' | 'template' | 'premium'

export interface ProductCard {
  id: string
  name: string
  shortDesc: string
  price: number
  icon: LucideIconName
  type: ProductType
  badge?: string
  popular?: boolean
  isCustom?: boolean
}

// 将所有商品转换为统一格式供商城使用
export function getAllProducts(): ProductCard[] {
  const plans = PLANS.map(p => ({
    id: p.id,
    name: p.name,
    shortDesc: p.subtitle,
    price: p.price,
    icon: 'Shield' as LucideIconName,
    type: 'subscription' as ProductType,
    badge: p.badge,
  }))

  const quotas = QUOTA_ADDONS.map(q => ({
    id: q.id,
    name: q.name,
    shortDesc: q.shortDesc,
    price: q.price,
    icon: q.icon,
    type: 'quota' as ProductType,
    badge: q.badge,
    popular: q.badge === '热门',
  }))

  const domains = DOMAIN_ADDONS.map(d => ({
    id: d.id,
    name: d.name,
    shortDesc: d.shortDesc,
    price: d.price,
    icon: d.icon,
    type: 'domain' as ProductType,
    badge: d.badge,
    popular: d.badge === '推荐',
  }))

  const templates = TEMPLATE_ASSETS.map(t => ({
    id: t.id,
    name: t.name,
    shortDesc: t.shortDesc,
    price: t.price,
    icon: t.icon,
    type: 'template' as ProductType,
    badge: t.badge,
    popular: t.popular,
    isCustom: t.isCustom,
  }))

  const premium = PREMIUM_SERVICES.map(s => ({
    id: s.id,
    name: s.name,
    shortDesc: s.shortDesc,
    price: s.price,
    icon: s.icon,
    type: 'premium' as ProductType,
    badge: s.badge,
    popular: s.popular,
  }))

  return [...plans, ...quotas, ...domains, ...templates, ...premium]
}
