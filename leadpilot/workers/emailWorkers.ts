import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { prisma } from '../lib/prisma';
import axios from 'axios';

const connection = new Redis({ host: process.env.REDIS_HOST || '127.0.0.1', port: 6379, maxRetriesPerRequest: null });

const aiEmailWorker = new Worker('ai-email-jobs', async (job: Job) => {
    const { campaignId } = job.data;
    try {
        const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
        if (!campaign) return;

        const leads = await prisma.lead.findMany({ where: { campaignId, status: 'VERIFIED' } });
        
        for (const lead of leads) {
            try {
                let websiteDataObj = typeof lead.websiteData === 'string' ? JSON.parse(lead.websiteData) : (lead.websiteData || {});
                
                // 🌟 直连 DeepSeek 引擎 (彻底绕过所有旧文件和缓存) 🌟
                console.log(`🧠 [AI] 正在呼叫 DeepSeek 为 ${lead.email} 写信...`);
                
                const deepseekKey = process.env.DEEPSEEK_API_KEY;
                if (!deepseekKey) {
                    throw new Error("🚨 .env 文件中缺少 DEEPSEEK_API_KEY！请立刻检查！");
                }

                const response = await axios.post(
                    'https://api.deepseek.com/chat/completions',
                    {
                        model: 'deepseek-chat',
                        messages: [
                            { role: 'system', content: 'You are a professional B2B sales expert. Write highly customized cold emails.' },
                            { role: 'user', content: `请根据以下数据，用英文写一封带称呼和公司名的B2B开发信：${JSON.stringify(websiteDataObj)}` }
                        ],
                        temperature: 0.7,
                    },
                    {
                        headers: {
                            'Authorization': `Bearer ${deepseekKey}`,
                            'Content-Type': 'application/json',
                        },
                        timeout: 20000,
                    }
                );

                const emailContent = response.data.choices[0].message.content;
                console.log(`✅ [AI] DeepSeek 写信成功！`);
                // ---------------------------------------------------

                const userLead = await prisma.userLead.upsert({
                    where: { userId_email: { userId: campaign.userId, email: lead.email } },
                    update: { aiSummary: emailContent },
                    create: {
                        userId: campaign.userId,
                        email: lead.email,
                        companyName: websiteDataObj.companyName || 'Unknown',
                        contactName: websiteDataObj.contactName || 'CEO',
                        isUnlocked: true,
                        aiSummary: emailContent,
                        source: 'NOVA'
                    }
                });

                await prisma.deliveryLog.create({
                    data: {
                        userId: campaign.userId,
                        leadId: userLead.id,
                        recipientEmail: lead.email,
                        senderDomain: 'system-pending', 
                        subject: 'Business Inquiry',
                        status: 'PENDING', 
                        companyName: userLead.companyName,
                        contactName: userLead.contactName,
                        errorMessage: emailContent // 前端读的是这里
                    }
                });

                await prisma.lead.update({ where: { id: lead.id }, data: { status: 'GENERATED' } });
                console.log(`✅ [完美入库] ${lead.email} 的真邮件已生成并存入！`);
            } catch (e: any) { 
                // 如果没有 API Key，这里会直接爆红字！
                console.error(`❌ [处理失败] ${lead.email} : ${e.response?.data?.error?.message || e.message}`); 
            }
        }
        await prisma.campaign.update({ where: { id: campaignId }, data: { status: 'COMPLETED' } });
    } catch (error: any) { 
        console.error(`🚨 系统错误: ${error.message}`); 
    }
}, { connection });

console.log('🚀 [系统就绪] 强力直连 Worker (反缓存版) 已启动！');