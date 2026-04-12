# 预估评估系统 - 集成指南

## 📋 已完成的工作

### 1. 预估评估 API

**文件：** `/app/api/campaigns/estimate/route.ts`

**核心功能：**
- ✅ 真实计算 Token 消耗（基于配置文件，非 mock）
- ✅ 根据套餐等级计算并发速率和预估时长
- ✅ 对比用户当前余额（套餐余额 + 增值包余额）
- ✅ 查询用户历史发信成功率（基于真实 Lead 数据）
- ✅ 风控检查（发信暂停、试用过期、域名验证）

**请求示例：**

```typescript
POST /api/campaigns/estimate

{
  "targetCount": 1000,
  "enableDeepAnalysis": true,
  "campaignId": "optional-campaign-id"
}
```

**响应示例：**

```json
{
  "success": true,
  "estimate": {
    "targetCount": 1000,
    "enableDeepAnalysis": true,
    "tokenPerLead": 46,
    "totalTokensRequired": 46000,
    "tokenBreakdown": {
      "baseGeneration": 10,
      "deepAnalysis": 20,
      "websiteScraping": 8,
      "ragRetrieval": 3,
      "intentScoring": 5
    },
    "currentBalance": {
      "tokenBalance": 50000,
      "addonCredits": 10000,
      "total": 60000
    },
    "isSufficient": true,
    "shortfall": 0,
    "shortfallPercentage": 0,
    "estimatedTimeDisplay": "约 5 小时",
    "hourlyLimit": 200,
    "availableDomains": 3,
    "estimatedSuccessRate": 85,
    "estimatedSuccessfulSends": 850,
    "subscriptionTier": "STARTER",
    "tierLabel": "入门版"
  }
}
```

### 2. Token 消耗配置

**文件：** `/lib/campaign-estimate-config.ts`

**真实的 Token 消耗标准：**
- 基础邮件生成：10 Tokens/封
- 深度 AI 分析：20 Tokens/封
- 网站数据爬取：8 Tokens/封
- RAG 知识库检索：3 Tokens/封
- AI 意向评分：5 Tokens/封

**并发速率限制：**
- 试用版：50 封/小时
- 入门版：200 封/小时
- 专业版：500 封/小时
- 旗舰版：1000 封/小时

### 3. 前端预估确认弹窗

**文件：** `/components/campaigns/CampaignEstimateDialog.tsx`

**核心交互逻辑：**
1. 用户点击「启动数字员工」时，拦截操作
2. 自动调用 `/api/campaigns/estimate` 获取真实预估数据
3. 展示详细的 Token 消耗明细和余额对比
4. 如果余额不足，「确认启动」按钮变灰，显示「立即充值」按钮
5. 如果余额充足，点击「确认启动」才真正调用发信 API

**UI 特性：**
- 实时加载预估数据（带 loading 动画）
- Token 消耗逐项展示（透明化计算过程）
- 余额充足/不足的视觉反馈（绿色/红色）
- 预估工作时长和成功率展示
- 域名轮换策略说明

### 4. 使用示例

**文件：** `/components/campaigns/CampaignLaunchExample.tsx`

**集成步骤：**

```typescript
import { CampaignEstimateDialog } from '@/components/campaigns/CampaignEstimateDialog'

// 1. 定义状态
const [showEstimate, setShowEstimate] = useState(false)
const [targetCount, setTargetCount] = useState(1000)
const [enableDeepAnalysis, setEnableDeepAnalysis] = useState(true)

// 2. 拦截启动操作
const handleStartCampaign = () => {
  setShowEstimate(true) // 弹出预估确认
}

// 3. 确认后真正启动
const handleConfirmStart = async () => {
  const response = await fetch('/api/send-bulk-emails', {
    method: 'POST',
    body: JSON.stringify({ recipients, campaignId })
  })
  // 处理响应...
}

// 4. 渲染
<Button onClick={handleStartCampaign}>启动数字员工</Button>

<CampaignEstimateDialog
  open={showEstimate}
  onOpenChange={setShowEstimate}
  targetCount={targetCount}
  enableDeepAnalysis={enableDeepAnalysis}
  onConfirm={handleConfirmStart}
/>
```

## 🎯 核心算法说明

### Token 消耗计算

```typescript
// 快速模式
tokenPerLead = 10 (基础生成)

// 深度分析模式
tokenPerLead = 10 (基础) + 20 (深度分析) + 8 (爬取) + 3 (RAG) + 5 (评分) = 46

// 总消耗
totalTokens = tokenPerLead × targetCount
```

### 时间预估计算

```typescript
// 根据套餐的每小时发送限制
hourlyLimit = HOURLY_RATE_LIMITS[subscriptionTier]

// 预估小时数（向上取整）
estimatedHours = Math.ceil(targetCount / hourlyLimit)

// 示例：1000 封邮件，入门版 200 封/小时
// estimatedHours = Math.ceil(1000 / 200) = 5 小时
```

### 余额判断

```typescript
// 可用总额 = 套餐余额 + 增值包余额
totalAvailable = user.tokenBalance + user.addonCredits

// 是否充足
isSufficient = totalAvailable >= totalTokensRequired

// 缺口
shortfall = totalTokensRequired - totalAvailable
```

### 成功率预估

```typescript
// 查询用户历史 Lead 记录
const leads = await prisma.lead.findMany({
  where: { 
    campaign: { userId },
    status: { in: ['SENT', 'BOUNCED', 'REPLIED'] }
  }
})

// 计算成功率
successRate = (成功发送数 / 总发送数) × 100

// 新用户默认 85%，最低 60%，最高 95%
```

## 🚀 测试步骤

### 1. 测试余额充足场景

```bash
# 假设用户有 60000 Tokens
# 发送 1000 封，深度分析模式
# 需要：46 × 1000 = 46000 Tokens
# 结果：余额充足，显示「确认启动」按钮
```

### 2. 测试余额不足场景

```bash
# 假设用户只有 10000 Tokens
# 发送 1000 封，深度分析模式
# 需要：46 × 1000 = 46000 Tokens
# 缺口：36000 Tokens (78%)
# 结果：「确认启动」按钮变灰，显示「立即充值」按钮
```

### 3. 测试风控拦截

```bash
# 用户被暂停发信（isSendingSuspended = true）
# 结果：返回 403 错误，提示联系客服
```

## ⚙️ 配置调整

如需调整 Token 消耗或速率限制，修改 `/lib/campaign-estimate-config.ts`：

```typescript
export const TOKEN_COST_CONFIG = {
  BASE_EMAIL_GENERATION: 10,  // 调整基础消耗
  DEEP_ANALYSIS: 20,           // 调整深度分析消耗
  // ...
}

export const HOURLY_RATE_LIMITS = {
  STARTER: 200,  // 调整入门版速率
  PRO: 500,      // 调整专业版速率
  // ...
}
```

## ✅ 完成状态

所有代码已完成，真实调用逻辑已实现，无任何 mock 数据。

**核心文件：**
- ✅ `/app/api/campaigns/estimate/route.ts` - 预估 API
- ✅ `/lib/campaign-estimate-config.ts` - 配置文件
- ✅ `/components/campaigns/CampaignEstimateDialog.tsx` - 弹窗组件
- ✅ `/components/campaigns/EstimateContent.tsx` - 内容展示
- ✅ `/components/campaigns/CampaignLaunchExample.tsx` - 集成示例

现在可以在任何发信页面中集成此预估确认弹窗。
