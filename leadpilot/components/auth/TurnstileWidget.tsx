"use client"

import { useEffect, useRef } from "react"

/**
 * Cloudflare Turnstile 人机验证组件
 * 
 * 使用说明：
 * 1. 在 Cloudflare Dashboard 创建 Turnstile 站点
 * 2. 获取 Site Key 和 Secret Key
 * 3. 在 .env.local 中配置：
 *    NEXT_PUBLIC_TURNSTILE_SITE_KEY=your-site-key
 *    TURNSTILE_SECRET_KEY=your-secret-key
 * 4. 在登录/注册页面引入此组件
 * 
 * 文档：https://developers.cloudflare.com/turnstile/
 */

interface TurnstileWidgetProps {
  siteKey?: string
  onVerify: (token: string) => void
  onError?: () => void
  onExpire?: () => void
  theme?: 'light' | 'dark' | 'auto'
  size?: 'normal' | 'compact'
}

export default function TurnstileWidget({
  siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '',
  onVerify,
  onError,
  onExpire,
  theme = 'dark',
  size = 'normal'
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)

  useEffect(() => {
    // 如果没有配置 Site Key，显示提示
    if (!siteKey) {
      console.warn('⚠️ Turnstile Site Key 未配置，请在 .env.local 中添加 NEXT_PUBLIC_TURNSTILE_SITE_KEY')
      return
    }

    // 加载 Turnstile 脚本
    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
    script.async = true
    script.defer = true
    
    script.onload = () => {
      if (containerRef.current && (window as any).turnstile) {
        // 渲染 Turnstile 组件
        widgetIdRef.current = (window as any).turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme: theme,
          size: size,
          callback: (token: string) => {
            console.log('✅ Turnstile 验证成功')
            onVerify(token)
          },
          'error-callback': () => {
            console.error('❌ Turnstile 验证失败')
            onError?.()
          },
          'expired-callback': () => {
            console.warn('⏰ Turnstile 验证过期')
            onExpire?.()
          }
        })
      }
    }

    document.body.appendChild(script)

    // 清理
    return () => {
      if (widgetIdRef.current && (window as any).turnstile) {
        (window as any).turnstile.remove(widgetIdRef.current)
      }
      if (script.parentNode) {
        script.parentNode.removeChild(script)
      }
    }
  }, [siteKey, theme, size, onVerify, onError, onExpire])

  // 如果没有配置 Site Key，显示提示
  if (!siteKey) {
    return (
      <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
        <div className="flex items-center gap-2 text-yellow-400 text-sm">
          <span>⚠️</span>
          <span>Turnstile 未配置，请添加 NEXT_PUBLIC_TURNSTILE_SITE_KEY</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-center">
      <div ref={containerRef} />
    </div>
  )
}

/**
 * 使用示例：
 * 
 * import TurnstileWidget from '@/components/auth/TurnstileWidget'
 * 
 * function LoginPage() {
 *   const [turnstileToken, setTurnstileToken] = useState('')
 * 
 *   const handleLogin = async () => {
 *     const response = await fetch('/api/auth/login', {
 *       method: 'POST',
 *       headers: { 'Content-Type': 'application/json' },
 *       body: JSON.stringify({
 *         email,
 *         password,
 *         turnstileToken // 传递验证 token
 *       })
 *     })
 *   }
 * 
 *   return (
 *     <div>
 *       <input type="email" />
 *       <input type="password" />
 *       
 *       <TurnstileWidget
 *         onVerify={(token) => setTurnstileToken(token)}
 *         theme="dark"
 *       />
 *       
 *       <button onClick={handleLogin}>登录</button>
 *     </div>
 *   )
 * }
 */
