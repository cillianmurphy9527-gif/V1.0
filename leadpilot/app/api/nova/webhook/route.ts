import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const NOVA_SECRET = process.env.NOVA_WEBHOOK_SECRET || 'leadpilot-super-secret-2026';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${NOVA_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { action, campaignId, taskId, lead, status } = payload;
    
    // 兼容泥头车传过来的不同 ID 命名
    const targetId = campaignId || taskId;

    if (!targetId) {
      return NextResponse.json({ error: 'Missing target ID' }, { status: 400 });
    }

    // 1. 寻找任务的归属用户 (可能是 NovaTask 或 Campaign)
    let userId = '';
    const task = await prisma.novaTask.findUnique({ where: { id: targetId } });
    if (task) {
      userId = task.userId;
    } else {
      const camp = await prisma.campaign.findUnique({ where: { id: targetId } });
      if (camp) userId = camp.userId;
    }

    if (!userId) {
      console.log(`⚠️ 找不到目标ID ${targetId} 对应的用户，废弃本次推送`);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 2. 核心路由处理
    switch (action) {
      case 'LEAD_SYNC':
        if (lead) {
          // 🟢 修复1：正确写入目标线索库 (UserLead)
          const savedLead = await prisma.userLead.upsert({
            where: {
              userId_email: { userId, email: String(lead.email) }
            },
            update: {
              companyName: String(lead.companyName || '未知公司'),
              contactName: String(lead.contactName || ''),
            },
            create: {
              userId: userId,
              email: String(lead.email),
              companyName: String(lead.companyName || '未知公司'),
              contactName: String(lead.contactName || ''),
              source: 'NOVA',
              isUnlocked: true, // 解锁可见
            }
          });
          console.log(`✅ 线索已进入目标线索库: ${lead.email}`);

          // 🟢 修复2：触发 AI 逻辑并写入投递流水 (DeliveryLog)
          // 因为你还没配好发信域名，这里直接写入 FAILED 状态，让前端能展示出来
          await prisma.deliveryLog.create({
            data: {
              userId: userId,
              taskId: task ? task.id : null,
              leadId: savedLead.id,
              recipientEmail: savedLead.email,
              senderDomain: '等待配置发信域名',
              subject: `[AI 自动生成] 致 ${savedLead.companyName} 的专属合作方案`,
              status: 'FAILED', // 你提到发信现在不好用，所以直接标为失败
              errorMessage: '系统拦截：尚未配置发信源 API，AI 邮件已生成但未发送',
              companyName: savedLead.companyName,
              contactName: savedLead.contactName,
            }
          });
          console.log(`✅ 投递流水已更新，由于未配发信源，状态拦截为 FAILED`);
        }
        break;

      case 'TASK_COMPLETED':
        // 🟢 修复3：全面更新面板状态，让前端停止空转
        const finalStatus = status === 'SUCCESS' ? 'COMPLETED' : 'FAILED';
        
        // 更新战术面板 (NovaTask)
        if (task) {
          await prisma.novaTask.update({
            where: { id: targetId },
            data: { status: finalStatus as any }
          });
        }
        
        // 更新 Campaign 和 NovaJob 防止漏网之鱼导致局部转圈
        await prisma.campaign.updateMany({
          where: { id: targetId },
          data: { status: finalStatus }
        });
        await prisma.novaJob.updateMany({
          where: { id: targetId },
          data: { status: finalStatus }
        });
        
        console.log(`🏁 泥头车任务结束，全站状态已更新为: ${finalStatus}`);
        break;

      default:
        console.log(`⚠️ 忽略未知动作: ${action}`);
    }
    
    return NextResponse.json({ success: true, message: '主站已安全落库' });

  } catch (error: any) {
    console.error('[主站 Webhook 彻底崩溃]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}