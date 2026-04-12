'use client'

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'

// ─────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────

export type AssetCategory = 'quota' | 'domain' | 'template' | 'premium' | 'subscription' | 'export'

export interface PurchasedAsset {
  id: string
  name: string
  category: AssetCategory
  price: number
  quantity?: number       // 额度包数量
  unit?: string           // 单位（如 "10万 tokens"）
  validDays: number        // -1 表示永久有效
  purchasedAt: string       // ISO 时间戳
  icon: string             // 图标名称
  badge?: string           // 标签
  description?: string      // 简短描述
  // 规格字段（按类型不同）
  tokens?: number          // 算力包专用
  leads?: number           // 线索包专用
  emails?: number          // 发信包专用
  domainCount?: number     // 域名包专用
  credits?: number         // 导出包专用
}

// ─────────────────────────────────────────────
//  Context
// ─────────────────────────────────────────────

interface PurchasedAssetsContextValue {
  assets: PurchasedAsset[]
  addAsset: (asset: Omit<PurchasedAsset, 'purchasedAt'>) => void
  removeAsset: (id: string) => void
  hasAsset: (id: string) => boolean
  getAssetsByCategory: (category: AssetCategory) => PurchasedAsset[]
  clearAssets: () => void
}

const PurchasedAssetsContext = createContext<PurchasedAssetsContextValue | null>(null)

// LocalStorage key
const STORAGE_KEY = 'leadpilot_purchased_assets'

// ─────────────────────────────────────────────
//  Provider
// ─────────────────────────────────────────────

export function PurchasedAssetsProvider({ children }: { children: React.ReactNode }) {
  // 从 localStorage 恢复已购资产
  const [assets, setAssets] = useState<PurchasedAsset[]>([])

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        setAssets(JSON.parse(stored))
      }
    } catch (e) {
      console.error('Failed to load purchased assets:', e)
    }
  }, [])

  // 持久化到 localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(assets))
    } catch (e) {
      console.error('Failed to save purchased assets:', e)
    }
  }, [assets])

  const addAsset = useCallback((asset: Omit<PurchasedAsset, 'purchasedAt'>) => {
    setAssets(prev => {
      // 避免重复添加
      if (prev.some(a => a.id === asset.id)) {
        return prev
      }
      return [...prev, { ...asset, purchasedAt: new Date().toISOString() }]
    })
  }, [])

  const removeAsset = useCallback((id: string) => {
    setAssets(prev => prev.filter(a => a.id !== id))
  }, [])

  const hasAsset = useCallback((id: string) => {
    return assets.some(a => a.id === id)
  }, [assets])

  const getAssetsByCategory = useCallback((category: AssetCategory) => {
    return assets.filter(a => a.category === category)
  }, [assets])

  const clearAssets = useCallback(() => {
    setAssets([])
  }, [])

  return (
    <PurchasedAssetsContext.Provider
      value={{
        assets,
        addAsset,
        removeAsset,
        hasAsset,
        getAssetsByCategory,
        clearAssets,
      }}
    >
      {children}
    </PurchasedAssetsContext.Provider>
  )
}

// ─────────────────────────────────────────────
//  Hook
// ─────────────────────────────────────────────

export function usePurchasedAssets() {
  const ctx = useContext(PurchasedAssetsContext)
  if (!ctx) throw new Error('usePurchasedAssets must be used within PurchasedAssetsProvider')
  return ctx
}
