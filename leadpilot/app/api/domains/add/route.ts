import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import { TLD_TIERS } from '@/config/pricing'
import { AutomationService } from '@/lib/services/AutomationService' // 👈 引入咱们的底层全自动引擎

export async function POST(request: NextRequest) {
  try {
    // 🛡️ 1. 您的顶级安全防线：Token鉴权
    const token = await getToken({ req: request as any, secret: process.env.NEXTAUTH_SECRET })
    if (!token?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const domainName = String(body?.domainName || '').trim().toLowerCase()
    const warmupEnabled = Boolean(body?.warmupEnabled)
    const userTier = String(body?.tier || 'SILVER').toUpperCase() 
    
    // 接收可能传过来的外贸线索和发信内容（如果有的话）
    const leads = body?.leads || []
    const emailContent = body?.emailContent

    // 🛡️ 2. 正则防御
    if (!domainName || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domainName)) {
      return NextResponse.json({ error: 'Invalid domainName' }, { status: 400 })
    }

    // ══════════════════════════════════════════════════
    // 🚦 核心风控拦截器 (保留您完美的商业逻辑)
    // ══════════════════════════════════════════════════
    const isToxic = TLD_TIERS.TOXIC.suffixes.some(suffix => domainName.endsWith(suffix))
    if (isToxic) {
      console.warn(`[拦截] 用户 ${token.id} 试图绑定剧毒域名 ${domainName}`)
      return NextResponse.json({ error: '该后缀已被全球反垃圾邮件组织列为高危等级，系统拒绝接入！' }, { status: 403 })
    }

    if (userTier === 'SILVER') {
      const isTryingGold = TLD_TIERS.GOLD.suffixes.some(suffix => domainName.endsWith(suffix))
      if (isTryingGold) {
        return NextResponse.json({ error: '您的配额不支持购买 .com 等黄金级权威后缀，请升级套餐。' }, { status: 403 })
      }
    }

    const isGoldDomain = TLD_TIERS.GOLD.suffixes.some(suffix => domainName.endsWith(suffix))
    console.log(`[Domain-Init] 开始全自动配置：${domainName} (等级: ${isGoldDomain ? 'GOLD' : 'SILVER'})`);

    // ══════════════════════════════════════════════════
    // 🗄️ 数据库初始落库：记录任务起点
    // ══════════════════════════════════════════════════
    const dbDomain = await prisma.domain.create({
      data: {
        userId: token.id as string,
        domainName,
        status: 'PURCHASING', // 状态机第一步：购买中
        warmupEnabled,
      }
    })

    // ══════════════════════════════════════════════════
    // 🚀 核心自动化流水线 (彻底取代 Resend 废代码)
    // ══════════════════════════════════════════════════
    const emailPrefix = 'sales';
    // 给老外发信的邮箱，自动生成一个强密码
    const emailPass = `Lp${Math.random().toString(36).slice(-6)}!A`;

    try {
      // [阶段 1] 调 Namecheap 买域名 + 设 DNS
      console.log(`[1/4] 🌐 正在调用 Namecheap 购买并配置 DNS...`);
      await AutomationService.purchaseDomain(domainName);
      await prisma.domain.update({ where: { id: dbDomain.id }, data: { status: 'PENDING_DNS' } });

      // [阶段 2] 调 cPanel 盖楼建邮箱
      console.log(`[2/4] 🏗️ 正在 cPanel 制造发信账号...`);
      await AutomationService.setupCPanel(domainName, emailPrefix, emailPass);
      await prisma.domain.update({ 
        where: { id: dbDomain.id }, 
        data: { status: 'EMAIL_READY', emailAccount: `${emailPrefix}@${domainName}` } 
      });

      // [阶段 3] 调 Success.ai 加入预热池
      if (warmupEnabled) {
        console.log(`[3/4] 🔥 正在连接 Success.ai 开启全自动养号...`);
        const successId = await AutomationService.startWarmup(domainName, emailPrefix, emailPass);
        await prisma.domain.update({ 
          where: { id: dbDomain.id }, 
          data: { status: 'WARMING_UP', successId } 
        });

        // [阶段 4] 如果连线索和邮件内容都准备好了，直接开火发信！
        if (leads.length > 0 && emailContent) {
           console.log(`[4/4] 🚀 正在下发 Campaign 开发信投递任务...`);
           await AutomationService.executeCampaign(successId, leads, emailContent.subject, emailContent.body);
           await prisma.domain.update({ where: { id: dbDomain.id }, data: { status: 'CAMPAIGN_ACTIVE' } });
        }
      }
    } catch (autoError: any) {
      console.error(`❌ 自动化流水线中断:`, autoError.message);
      // 如果报错，将数据库状态改为错误，方便后续人工介入或排查
      await prisma.domain.update({ where: { id: dbDomain.id }, data: { status: 'ERROR' } });
      throw new Error(`底层自动化配置失败: ${autoError.message}`);
    }

    // ══════════════════════════════════════════════════
    // 完美收官
    // ══════════════════════════════════════════════════
    return NextResponse.json({ 
      success: true, 
      id: dbDomain.id,
      tier: isGoldDomain ? 'GOLD' : 'SILVER',
      message: `域名配置成功！底层兵工厂已建立发信邮箱，预热引擎全面启动。`
    })

  } catch (error: any) {
    console.error('[Domains Add] Error:', error)
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}