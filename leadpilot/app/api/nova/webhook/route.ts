import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Queue } from 'bullmq';
import Redis from 'ioredis';

const connection = new Redis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
});
const aiEmailQueue = new Queue('ai-email-jobs', { connection });
const NOVA_SECRET = process.env.NOVA_WEBHOOK_SECRET || 'leadpilot_dev_secret_123';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (authHeader?.replace('Bearer ', '').trim() !== NOVA_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { event, campaignId, lead, total } = await req.json();
    if (!campaignId) return NextResponse.json({ error: 'Missing ID' });

    console.log(`[Webhook] Event: ${event} | Campaign: ${campaignId}`);

    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) return NextResponse.json({ error: 'Not Found' });

    if (event === 'LEAD_SYNC' && lead) {
       // 1. 🎯 扣除线索额度 (UserQuota)
       await prisma.userQuota.update({
           where: { userId: campaign.userId },
           data: { leadsBalance: { decrement: 1 } }
       }).catch(() => console.log('UserQuota Update Fail'));

       // 2. 🎯 扣除 AI 算力 (User 表)
       await prisma.user.update({
           where: { id: campaign.userId },
           data: { tokenBalance: { decrement: 100 } }
       }).catch(() => console.log('User Token Update Fail'));

       // 3. 🔒 入库强制马赛克锁
       await prisma.userLead.create({
          data: {
              userId: campaign.userId,
              companyName: lead.companyName || 'Unknown',
              contactName: lead.contactName || 'Manager',
              email: lead.email, 
              website: lead.domain,
              source: 'NOVA_ENGINE',
              isUnlocked: false // 🌟 核心：写死 false
          }
       });
       
       await prisma.lead.create({
         data: { campaignId, email: lead.email, status: 'VERIFIED', websiteData: JSON.stringify(lead) }
       });
    } 
    
    else if (event === 'TASK_COMPLETED') {
       console.log(`[Flow] Success! Total: ${total}. Waking up AI Worker...`);
       // 只有挖到线索才写信
       if (Number(total) > 0) {
           await aiEmailQueue.add('generate-emails', { campaignId }, { removeOnComplete: true });
       }
       await prisma.campaign.update({ where: { id: campaignId }, data: { status: 'COMPLETED' }});
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}