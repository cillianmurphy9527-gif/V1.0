import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')

    if (!email) {
      return NextResponse.json({ error: '缺少邮箱参数' }, { status: 400 })
    }

    // 添加到退订列表
    await prisma.unsubscribeList.upsert({
      where: { email },
      update: { unsubscribedAt: new Date() },
      create: {
        email,
        reason: '用户主动退订',
        source: 'USER_REQUEST'
      }
    })

    // 返回友好的退订确认页面
    return new NextResponse(
      `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>退订成功</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 16px;
      padding: 48px;
      max-width: 500px;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }
    .icon {
      font-size: 64px;
      margin-bottom: 24px;
    }
    h1 {
      color: #1a202c;
      font-size: 28px;
      margin-bottom: 16px;
    }
    p {
      color: #4a5568;
      font-size: 16px;
      line-height: 1.6;
      margin-bottom: 32px;
    }
    .email {
      background: #f7fafc;
      padding: 12px 20px;
      border-radius: 8px;
      font-family: monospace;
      color: #2d3748;
      margin-bottom: 24px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">✅</div>
    <h1>退订成功</h1>
    <p>您的邮箱已成功从我们的邮件列表中移除。</p>
    <div class="email">${email}</div>
    <p style="font-size: 14px; color: #718096;">
      您将不会再收到来自 LeadPilot 的营销邮件。<br>
      如有疑问，请联系我们的客服团队。
    </p>
  </div>
</body>
</html>`,
      {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      }
    )
  } catch (error) {
    console.error('Unsubscribe error:', error)
    return NextResponse.json({ error: '退订失败' }, { status: 500 })
  }
}
