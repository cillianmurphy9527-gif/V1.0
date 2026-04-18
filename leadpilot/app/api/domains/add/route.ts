import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import axios from 'axios' // 👈 引入用于自动发请求的武装插件

export async function POST(request: NextRequest) {
  try {
    // 🛡️ 保留您的顶级安全防线：Token鉴权
    const token = await getToken({ req: request as any, secret: process.env.NEXTAUTH_SECRET })
    if (!token?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const domainName = String(body?.domainName || '').trim().toLowerCase()
    const warmupEnabled = Boolean(body?.warmupEnabled)

    // 🛡️ 保留您的正则防御：防格式注入
    if (!domainName || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domainName)) {
      return NextResponse.json({ error: 'Invalid domainName' }, { status: 400 })
    }

    // 1. 数据库占坑：安全落库
    const created = await prisma.domain.create({
      data: {
        userId: token.id as string,
        domainName,
        status: 'PENDING_DNS',
        warmupEnabled,
      },
      select: { id: true },
    })

    console.log(`[Auto-DNS] 正在为域名 ${domainName} 自动配置底层通道记录...`);

    // 2. 🚀 核心自动化：自动呼叫底层通道 API (以 Resend 为例)
    if (process.env.RESEND_API_KEY) {
      try {
        await axios.post('https://api.resend.com/domains', {
          name: domainName
        }, {
          headers: { 
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          }
        });
        console.log(`✅ [发信通道] 域名 ${domainName} 已成功注册并分配底层 DNS 资源！`);
      } catch (apiErr: any) {
        console.error(`❌ [发信通道] 自动添加域名失败:`, apiErr.response?.data || apiErr.message);
        // 注意：这里哪怕底层通道报错，我们也不阻断，让数据库的订单先存下来
      }
    } else {
      console.warn(`⚠️ [系统提醒] 暂未检测到 RESEND_API_KEY，跳过底层自动注册。下周填入 Key 后生效！`);
    }

    return NextResponse.json({ 
      success: true, 
      id: created.id,
      message: '域名配置成功，自动解析任务已触发'
    })
  } catch (error: any) {
    console.error('[Domains Add] Error:', error)
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}