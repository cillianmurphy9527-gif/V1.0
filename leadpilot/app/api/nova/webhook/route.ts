import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Queue } from 'bullmq';
import Redis from 'ioredis';

const connection = new Redis({ host: process.env.REDIS_HOST || '127.0.0.1', port: 6379, maxRetriesPerRequest: null });
const aiEmailQueue = new Queue('ai-email-jobs', { connection });

export async function POST(req: NextRequest) {
  try {
    const { event, campaignId, lead } = await req.json();
    
    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign || !campaign.userId) return NextResponse.json({ error: 'Campaign Not Found' }, { status: 404 });

    if (event === 'LEAD_SYNC' && lead) {
       // 1. 计费扣减
       await prisma.userQuota.upsert({
           where: { userId: campaign.userId },
           update: { leadsBalance: { decrement: 1 } },
           create: { userId: campaign.userId, leadsBalance: 999 } 
       });

       const userIdStr = String(campaign.userId);

       // 2. 存入正确的"私有线索库 (UserLead)"表
       await prisma.userLead.upsert({
         where: { userId_email: { userId: userIdStr, email: lead.email } },
         update: {
             companyName: lead.companyName ?? '',
             contactName: lead.contactName || lead.firstName || 'Decision Maker',
             jobTitle: lead.position || 'Executive',
             country: lead.country ?? '',
             industry: lead.industry ?? '',
             website: lead.website ?? ''
         },
         create: {
             userId: userIdStr,
             email: lead.email,
             companyName: lead.companyName ?? '',
             contactName: lead.contactName || lead.firstName || 'Decision Maker',
             jobTitle: lead.position || 'Executive',
             source: 'NOVA',
             isUnlocked: false,
             country: lead.country ?? '',
             industry: lead.industry ?? '',
             website: lead.website ?? ''
         }
       });

       // 3. 同时存入 Campaign 的 Lead 表供流程追踪
       await prisma.lead.create({
         data: { campaignId, email: lead.email, status: 'VERIFIED', websiteData: JSON.stringify(lead) }
       });
       console.log(`[Webhook] ✅ 线索成功存入本地库，等待 AI 接管: ${lead.email}`);

    } 
    else if (event === 'TASK_COMPLETED') {
       await prisma.campaign.update({ where: { id: campaignId }, data: { status: 'PROCESSING' } });
       // 触发 AI 写信队列
       await aiEmailQueue.add('generate-emails', { campaignId }, { removeOnComplete: true });
       console.log(`[Webhook] 🚀 正在推送 AI 写信任务...`);
    }
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[Webhook 崩溃]:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}