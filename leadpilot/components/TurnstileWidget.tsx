"use client"

import { useEffect, useRef } from "react"

interface TurnstileWidgetProps {
  onVerify: (token: string) => void
  onExpire?: () => void
  theme?: "light" | "dark" | "auto"
}

/**
 * Cloudflare Turnstile 人机验证组件
 *
 * 容错模式：
 * - 如果 NEXT_PUBLIC_TURNSTILE_SITE_KEY 未配置，组件不渲染，
 *   并立即回调 onVerify('dev-bypass') 让父组件直接放行。
 * - 如果已配置，加载官方脚本并渲染验证框。
 */
export function TurnstileWidget({ onVerify, onExpire, theme = "dark" }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string | null>(null)
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

  useEffect(() => {
    // ── 容错降级：无 Key 则直接放行 ──────────────────────────
    if (!siteKey) {
      onVerify('dev-bypass')
      return
    }

    // ── 加载 Turnstile 官方脚本 ──────────────────────────────
    const scriptId = 'cf-turnstile-script'
    const render = () => {
      if (!containerRef.current || !(window as any).turnstile) return
      if (widgetId.current) return // 已渲染，跳过
      widgetId.current = (window as any).turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme,
        callback: (token: string) => onVerify(token),
        'expired-callback': () => {
          onExpire?.()
          onVerify('')
        },
      })
    }

    if (document.getElementById(scriptId)) {
      // 脚本已存在，直接尝试渲染
      render()
    } else {
      const script = document.createElement('script')
      script.id = scriptId
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
      script.async = true
      script.defer = true
      script.onload = render
      document.head.appendChild(script)
    }

    return () => {
      if (widgetId.current && (window as any).turnstile) {
        try { (window as any).turnstile.remove(widgetId.current) } catch {}
        widgetId.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey])

  // 无 Key 时不渲染任何 DOM
  if (!siteKey) return null

  return <div ref={containerRef} className="mt-2" />
}
