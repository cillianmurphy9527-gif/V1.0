/**
 * 设备指纹采集工具
 * 用于在注册页面采集浏览器特征，防止同一设备多次领取试用
 */

export function generateDeviceFingerprint(): string {
  const features = [
    // 屏幕信息
    screen.width,
    screen.height,
    screen.colorDepth,
    screen.pixelDepth,
    
    // 时区
    new Date().getTimezoneOffset(),
    
    // 语言
    navigator.language,
    
    // 平台
    navigator.platform,
    
    // User Agent
    navigator.userAgent,
    
    // 硬件并发数
    navigator.hardwareConcurrency || 'unknown',
    
    // 设备内存（如果支持）
    (navigator as any).deviceMemory || 'unknown',
    
    // Canvas 指纹
    getCanvasFingerprint(),
    
    // WebGL 指纹
    getWebGLFingerprint(),
  ]

  // 将所有特征拼接成字符串
  const fingerprintString = features.join('|')
  
  // 返回原始字符串（服务端会进行 SHA256 哈希）
  return fingerprintString
}

/**
 * Canvas 指纹
 */
function getCanvasFingerprint(): string {
  try {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    
    if (!ctx) return 'no-canvas'
    
    canvas.width = 200
    canvas.height = 50
    
    ctx.textBaseline = 'top'
    ctx.font = '14px Arial'
    ctx.fillStyle = '#f60'
    ctx.fillRect(125, 1, 62, 20)
    ctx.fillStyle = '#069'
    ctx.fillText('LeadPilot 🚀', 2, 15)
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)'
    ctx.fillText('Device ID', 4, 17)
    
    return canvas.toDataURL()
  } catch (e) {
    return 'canvas-error'
  }
}

/**
 * WebGL 指纹
 */
function getWebGLFingerprint(): string {
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl') as WebGLRenderingContext
    
    if (!gl) return 'no-webgl'
    
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
    if (!debugInfo) return 'no-debug-info'
    
    const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL)
    const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
    
    return `${vendor}|${renderer}`
  } catch (e) {
    return 'webgl-error'
  }
}

/**
 * 在注册表单中使用示例：
 * 
 * const handleRegister = async () => {
 *   const deviceFingerprint = generateDeviceFingerprint()
 *   
 *   const response = await fetch('/api/auth/register', {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify({
 *       phone,
 *       password,
 *       username,
 *       verificationCode,
 *       turnstileToken,
 *       deviceFingerprint, // 传递设备指纹
 *       inviteCode
 *     })
 *   })
 *   
 *   // 处理响应...
 * }
 */
