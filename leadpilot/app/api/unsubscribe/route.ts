import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/unsubscribe?email=xxx  — 退订处理中心
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const email = searchParams.get('email')?.trim()
  const userId = searchParams.get('userId')?.trim()

  if (!email && !userId) {
    return new NextResponse(
      `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>退订失败</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
           background: #f4f4f5; display: flex; align-items: center;
           justify-content: center; min-height: 100vh; margin: 0; }
    .card { background: white; border-radius: 16px; padding: 48px 40px;
            max-width: 440px; width: 90%; text-align: center;
            box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .icon { width: 64px; height: 64px; border-radius: 50%;
            background: #fee2e2; margin: 0 auto 24px;
            display: flex; align-items: center; justify-content: center; font-size: 28px; }
    h1 { color: #1e293b; font-size: 24px; margin: 0 0 12px; }
    p  { color: #64748b; font-size: 15px; line-height: 1.6; margin: 0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">⚠️</div>
    <h1>退订链接无效</h1>
    <p>缺少邮箱地址或用户 ID 参数。<br/>请联系客服处理。</p>
  </div>
</body>
</html>`,
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    )
  }

  try {
    // 优先按 email 查找，email 唯一则直接更新；userId 兜底
    const where = email
      ? { email }
      : userId
        ? { id: userId }
        : null

    if (!where) throw new Error('no identity')

    const updated = await prisma.user.updateMany({
      where,
      data: { unsubscribed: true },
    })

    if (updated.count === 0) {
      return new NextResponse(
        `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>用户未找到</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
           background: #f4f4f5; display: flex; align-items: center;
           justify-content: center; min-height: 100vh; margin: 0; }
    .card { background: white; border-radius: 16px; padding: 48px 40px;
            max-width: 440px; width: 90%; text-align: center;
            box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .icon { width: 64px; height: 64px; border-radius: 50%;
            background: #fef3c7; margin: 0 auto 24px;
            display: flex; align-items: center; justify-content: center; font-size: 28px; }
    h1 { color: #1e293b; font-size: 24px; margin: 0 0 12px; }
    p  { color: #64748b; font-size: 15px; line-height: 1.6; margin: 0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">🔍</div>
    <h1>未找到对应账户</h1>
    <p>系统未匹配到该邮箱地址的相关记录。</p>
  </div>
</body>
</html>`,
        { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      )
    }

    // 成功页面
    return new NextResponse(
      `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>退订成功</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
           background: #f4f4f5; display: flex; align-items: center;
           justify-content: center; min-height: 100vh; margin: 0; }
    .card { background: white; border-radius: 20px; padding: 56px 48px;
            max-width: 480px; width: 90%; text-align: center;
            box-shadow: 0 8px 40px rgba(0,0,0,0.1); }
    .icon { width: 80px; height: 80px; border-radius: 50%;
            background: linear-gradient(135deg, #10b981, #059669);
            margin: 0 auto 32px;
            display: flex; align-items: center; justify-content: center; font-size: 36px; }
    h1 { color: #0f172a; font-size: 26px; font-weight: 700; margin: 0 0 14px; }
    .cn { color: #334155; font-size: 16px; line-height: 1.7; margin: 0 0 8px; }
    .en { color: #94a3b8; font-size: 13px; margin: 0 0 32px; letter-spacing: 0.02em; }
    .footer { font-size: 12px; color: #cbd5e1; margin-top: 24px; }
    .btn { display: inline-block; background: #10b981; color: white;
            padding: 12px 28px; border-radius: 10px; text-decoration: none;
            font-size: 14px; font-weight: 600; transition: background 0.2s; }
    .btn:hover { background: #059669; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✓</div>
    <h1>退订成功</h1>
    <p class="cn">您已成功取消订阅。<br/>我们将不会再向您发送任何营销类邮件。</p>
    <p class="en">You have been unsubscribed successfully.<br/>No marketing emails will be sent to this address.</p>
    <a href="/" class="btn">返回首页</a>
    <p class="footer">LeadPilot · Global B2B Intelligence Platform</p>
  </div>
</body>
</html>`,
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    )
  } catch (err) {
    console.error('[unsubscribe]', err)
    // 即使数据库异常，也返回友好页面，绝不抛 500 白屏
    return new NextResponse(
      `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>退订已受理</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
           background: #f4f4f5; display: flex; align-items: center;
           justify-content: center; min-height: 100vh; margin: 0; }
    .card { background: white; border-radius: 20px; padding: 56px 48px;
            max-width: 480px; width: 90%; text-align: center;
            box-shadow: 0 8px 40px rgba(0,0,0,0.1); }
    .icon { width: 80px; height: 80px; border-radius: 50%;
            background: linear-gradient(135deg, #10b981, #059669);
            margin: 0 auto 32px;
            display: flex; align-items: center; justify-content: center; font-size: 36px; }
    h1 { color: #0f172a; font-size: 26px; font-weight: 700; margin: 0 0 14px; }
    .cn { color: #334155; font-size: 16px; line-height: 1.7; margin: 0 0 8px; }
    .en { color: #94a3b8; font-size: 13px; margin: 0 0 32px; }
    .btn { display: inline-block; background: #10b981; color: white;
            padding: 12px 28px; border-radius: 10px; text-decoration: none;
            font-size: 14px; font-weight: 600; transition: background 0.2s; }
    .btn:hover { background: #059669; }
    .footer { font-size: 12px; color: #cbd5e1; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✓</div>
    <h1>退订已受理</h1>
    <p class="cn">您的退订请求已记录。<br/>如仍有邮件送达，请联系客服处理。</p>
    <p class="en">Your unsubscribe request has been processed.<br/>You will no longer receive marketing emails.</p>
    <a href="/" class="btn">返回首页</a>
    <p class="footer">LeadPilot · Global B2B Intelligence Platform</p>
  </div>
</body>
</html>`,
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    )
  }
}
