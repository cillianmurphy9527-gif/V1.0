/**
 * 🚀 AI 终极智能路由与容灾引擎 (Model Router & Fallback)
 * * * 核心战略 (黄金组合)：
 * 1. 【双引擎分流】：简单/常规写信 → DeepSeek (极致省钱)；复杂任务/意图分析/VIP客户 → GPT-4o (保证顶级智商)。
 * 2. 【交叉容灾】：DeepSeek 挂了 → 自动切到 GPT-4o-mini 救场；GPT-4o 挂了 → 自动切回 DeepSeek 救场。
 */

import { prisma } from '@/lib/prisma'
import { TIER_CONFIG, TierType } from '@/lib/services/quota'
import {
  ADVANCED_SALES_PROMPT,
  BASIC_EMAIL_PROMPT,
  INTENT_ANALYSIS_PROMPT,
  fillPrompt,
} from '@/lib/prompts/system-prompts'

// ─── 1. 统一模型配置与交叉容灾映射 ────────────────────────
export const MODEL_CONFIG = {
  // 🟢 简单任务主炮：DeepSeek
  DEEPSEEK_BASIC: {
    id: 'deepseek-chat',
    provider: 'deepseek',
    fallback: 'gpt-4o-mini', // 🛡️ 容灾：DS宕机，切到便宜的 OpenAI 备胎
    inputCostPer1M: 0.14,
    outputCostPer1M: 0.28,
  },
  // 👑 复杂任务主炮：最强的 OpenAI
  GPT_4O: {
    id: 'gpt-4o',
    provider: 'openai',
    fallback: 'deepseek-chat', // 🛡️ 容灾：OpenAI宕机，切回 DeepSeek 救场
    inputCostPer1M: 2.50,
    outputCostPer1M: 10.00,
  },
  // ── 以下为备胎配置 ──
  GPT_4O_MINI: {
    id: 'gpt-4o-mini',
    provider: 'openai',
    fallback: null,
    inputCostPer1M: 0.15,
    outputCostPer1M: 0.60,
  }
} as const

type ModelConfigType = typeof MODEL_CONFIG[keyof typeof MODEL_CONFIG];

export enum TaskType {
  BASIC_OUTREACH = 'BASIC_OUTREACH',
  ADVANCED_OUTREACH = 'ADVANCED_OUTREACH',
  INTENT_ANALYSIS = 'INTENT_ANALYSIS',
}

function getProviderConfig(provider: 'openai' | 'deepseek') {
  if (provider === 'deepseek') {
    return {
      baseUrl: 'https://api.deepseek.com/chat/completions',
      apiKey: process.env.DEEPSEEK_API_KEY,
    }
  }
  return {
    baseUrl: 'https://api.openai.com/v1/chat/completions',
    apiKey: process.env.OPENAI_API_KEY,
  }
}

// ─── 2. 瀑布流容灾调用器 (自动抓取备胎) ───────────────────
export async function callAIWithFallback(
  prompt: string,
  primaryModel: ModelConfigType,
  options?: { responseFormat?: 'json' | 'text' }
): Promise<{ content: string; cost: number }> {
  
  const executeCall = async (model: ModelConfigType) => {
    const { baseUrl, apiKey } = getProviderConfig(model.provider as 'openai' | 'deepseek');
    if (!apiKey) throw new Error(`${model.provider.toUpperCase()}_API_KEY is missing`);

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model.id,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        ...(options?.responseFormat === 'json' && { response_format: { type: 'json_object' } }),
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`[${model.provider}] API Error: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || '';
    const cost = data.usage?.total_tokens ? (data.usage.total_tokens / 1000000) * model.inputCostPer1M : 0;
    return { content, cost };
  };

  try {
    console.log(`[AI Router] 🚀 尝试使用主引擎: ${primaryModel.provider} (${primaryModel.id})`);
    return await executeCall(primaryModel);
  } catch (error: any) {
    console.warn(`[AI Router] ⚠️ 主引擎 ${primaryModel.provider} 挂了: ${error.message}`);
    
    if (!primaryModel.fallback) throw error;

    // 触发容灾，寻找备胎
    const fallbackModelKey = Object.keys(MODEL_CONFIG).find(
      key => MODEL_CONFIG[key as keyof typeof MODEL_CONFIG].id === primaryModel.fallback
    ) as keyof typeof MODEL_CONFIG;

    const fallbackModel = MODEL_CONFIG[fallbackModelKey];
    console.warn(`[AI Router] 🔄 立即唤醒备胎引擎进行容灾: ${fallbackModel.id}`);
    
    try {
      return await executeCall(fallbackModel);
    } catch (fallbackError: any) {
      console.error(`[AI Router] ❌ 备胎也挂了！双引擎彻底阻断。`);
      throw new Error(`Dual Engine Failure`);
    }
  }
}

// ─── 3. 智能分流决策器 (DeepSeek处理简单，OpenAI处理复杂) ───
export async function getOptimalPrompt(
  taskType: TaskType,
  userId: string,
  variables?: Record<string, string>
) {
  const userQuota = await prisma.userQuota.findUnique({ where: { userId }, select: { tier: true } });
  const tierPrice = TIER_CONFIG[userQuota?.tier as TierType]?.price || 299;
  const isAdvanced = tierPrice >= 799;

  let prompt = '';
  let model: ModelConfigType;

  // 🔥 核心分流逻辑在这里！
  if (taskType === TaskType.INTENT_ANALYSIS) {
    prompt = INTENT_ANALYSIS_PROMPT;
    model = MODEL_CONFIG.GPT_4O; // 👑 复杂任务 (意图分析)：走 OpenAI
  } else if (isAdvanced && taskType === TaskType.ADVANCED_OUTREACH) {
    prompt = ADVANCED_SALES_PROMPT
      .replace('{{knowledgeBase}}', variables?.knowledgeBase || '')
      .replace('{{privateStrategy}}', variables?.privateStrategy || '');
    model = MODEL_CONFIG.GPT_4O; // 👑 高配VIP开发信：走 OpenAI
  } else {
    prompt = BASIC_EMAIL_PROMPT;
    model = MODEL_CONFIG.DEEPSEEK_BASIC; // 🟢 简单基础开发信：走 DeepSeek (省钱)
  }

  if (variables) prompt = fillPrompt(prompt, variables);
  
  return { prompt, model };
}

// ─── 业务层：最终生成方法 ────────────────────────────────
export async function generateOutreachEmail(
  userId: string,
  params: {
    companyName: string; contactName: string; jobTitle: string;
    knowledgeBase?: string; privateStrategy?: string;
  }
) {
  const taskType = params.knowledgeBase || params.privateStrategy ? TaskType.ADVANCED_OUTREACH : TaskType.BASIC_OUTREACH;
  const { prompt, model } = await getOptimalPrompt(taskType, userId, params as any);

  const response = await callAIWithFallback(prompt, model, { responseFormat: 'json' });
  
  try {
    const parsed = JSON.parse(response.content);
    return { subject: parsed.subject || '合作探讨', body: parsed.body || response.content, preview: '', cost: response.cost };
  } catch {
    return { subject: `To ${params.companyName}`, body: response.content, preview: '', cost: response.cost };
  }
}