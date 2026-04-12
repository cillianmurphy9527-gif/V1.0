'use client'

import { AlertTriangle, CheckCircle2, Clock, Zap, Mail, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

interface EstimateData {
  targetCount: number
  tokenPerLead: number
  totalTokensRequired: number
  tokenBreakdown: {
    baseGeneration: number
    deepAnalysis: number
    websiteScraping: number
    ragRetrieval: number
    intentScoring: number
  }
  currentBalance: {
    tokenBalance: number
    addonCredits: number
    total: number
  }
  isSufficient: boolean
  shortfall: number
  shortfallPercentage: number
  estimatedTimeDisplay: string
  hourlyLimit: number
  availableDomains: number
  estimatedSuccessRate: number
  estimatedSuccessfulSends: number
  tierLabel: string
}

interface Props {
  data: EstimateData
  enableDeepAnalysis: boolean
  confirming: boolean
  onConfirm: () => void
  onRecharge: () => void
  onCancel: () => void
}

export function EstimateContent({ data, enableDeepAnalysis, confirming, onConfirm, onRecharge, onCancel }: Props) {
  return (
    <div className="space-y-4 p-6">
      {/* 任务概览 */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-5 border border-blue-200">
        <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
          <Mail className="w-5 h-5 text-blue-600" />
          任务概览
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">目标客户数量</p>
            <p className="text-2xl font-bold text-gray-900">{data.targetCount.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">分析模式</p>
            <p className="text-lg font-semibold text-gray-900">
              {enableDeepAnalysis ? '🧠 深度 AI 分析' : '⚡ 快速发送'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">预估成功率</p>
            <p className="text-2xl font-bold text-green-600">{data.estimatedSuccessRate}%</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">预计成功发送</p>
            <p className="text-2xl font-bold text-green-600">{data.estimatedSuccessfulSends.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Token 消耗详情 */}
      <div className="bg-white rounded-lg p-5 border border-gray-200">
        <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
          <Zap className="w-5 h-5 text-yellow-500" />
          Token 消耗详情
        </h3>
        <div className="space-y-2 mb-4">
          <TokenBreakdownItem 
            label="基础邮件生成" 
            tokens={data.tokenBreakdown.baseGeneration} 
            count={data.targetCount} 
          />
          {enableDeepAnalysis && (
            <>
              <TokenBreakdownItem label="深度 AI 分析" tokens={data.tokenBreakdown.deepAnalysis} count={data.targetCount} />
              <TokenBreakdownItem label="网站数据爬取" tokens={data.tokenBreakdown.websiteScraping} count={data.targetCount} />
              <TokenBreakdownItem label="知识库检索" tokens={data.tokenBreakdown.ragRetrieval} count={data.targetCount} />
              <TokenBreakdownItem label="意向评分" tokens={data.tokenBreakdown.intentScoring} count={data.targetCount} />
            </>
          )}
          <div className="border-t pt-2 mt-2">
            <div className="flex justify-between font-semibold">
              <span>总计消耗</span>
              <span className="text-lg text-blue-600">{data.totalTokensRequired.toLocaleString()} Tokens</span>
            </div>
          </div>
        </div>

        {/* 余额对比 */}
        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
          <BalanceItem label="套餐余额" value={data.currentBalance.tokenBalance} />
          <BalanceItem label="增值包余额" value={data.currentBalance.addonCredits} />
          <div className="border-t pt-2">
            <div className="flex justify-between font-semibold">
              <span>当前可用总额</span>
              <span className={`text-lg ${data.isSufficient ? 'text-green-600' : 'text-red-600'}`}>
                {data.currentBalance.total.toLocaleString()} Tokens
              </span>
            </div>
          </div>
        </div>

        {/* 余额状态提示 */}
        {!data.isSufficient ? (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-red-800">余额不足</p>
              <p className="text-red-600 text-sm mt-1">
                还需 <span className="font-bold">{data.shortfall.toLocaleString()} Tokens</span> 才能完成此任务
                （缺口 {data.shortfallPercentage}%）
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-green-800">余额充足</p>
              <p className="text-green-600 text-sm mt-1">
                任务完成后剩余 <span className="font-bold">{(data.currentBalance.total - data.totalTokensRequired).toLocaleString()} Tokens</span>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 时间预估 */}
      <div className="bg-white rounded-lg p-5 border border-gray-200">
        <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
          <Clock className="w-5 h-5 text-purple-500" />
          时间预估
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">预计工作时长</p>
            <p className="text-2xl font-bold text-purple-600">{data.estimatedTimeDisplay}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">发送速率</p>
            <p className="text-lg font-semibold text-gray-900">{data.hourlyLimit} 封/小时</p>
          </div>
        </div>
        <div className="mt-3 text-xs text-gray-500 bg-gray-50 rounded p-3">
          <p>💡 当前套餐：<span className="font-semibold">{data.tierLabel}</span></p>
          <p className="mt-1">🔄 域名轮换：每封切换域名（共 {data.availableDomains} 个域名）</p>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-3 pt-4">
        <Button variant="outline" onClick={onCancel} className="flex-1" disabled={confirming}>
          取消
        </Button>

        {data.isSufficient ? (
          <Button
            onClick={onConfirm}
            disabled={confirming}
            className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
          >
            {confirming ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                启动中...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                确认启动数字员工
              </>
            )}
          </Button>
        ) : (
          <Button
            onClick={onRecharge}
            className="flex-1 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white"
          >
            <TrendingUp className="w-4 h-4 mr-2" />
            余额不足，立即充值
          </Button>
        )}
      </div>

      {/* 风险提示 */}
      <div className="text-xs text-gray-500 text-center pt-2 border-t">
        <p>⚠️ 任务启动后将立即扣除 Token，请确认无误后再启动</p>
      </div>
    </div>
  )
}

function TokenBreakdownItem({ label, tokens, count }: { label: string, tokens: number, count: number }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-600">{label}</span>
      <span className="font-mono">
        {tokens} × {count.toLocaleString()} = {(tokens * count).toLocaleString()} Tokens
      </span>
    </div>
  )
}

function BalanceItem({ label, value }: { label: string, value: number }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-600">{label}</span>
      <span className="font-mono">{value.toLocaleString()} Tokens</span>
    </div>
  )
}
