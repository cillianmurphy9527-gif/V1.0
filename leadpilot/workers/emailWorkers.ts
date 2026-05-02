import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { prisma } from '../lib/prisma';
import { LLMService } from '../lib/services/LLMService';
import { SmartleadService, SmartleadLeadParams } from '../lib/services/SmartleadService';

const connection = new Redis({ host: process.env.REDIS_HOST || '127.0.0.1', port: 6379, maxRetriesPerRequest: null });

const aiEmailWorker = new Worker('ai-email-jobs', async (job: Job) => {
    const { campaignId } = job.data;
    try {
        const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
        if (!campaign) return;

        const leads = await prisma.lead.findMany({ where: { campaignId, status: 'VERIFIED' } });
        const readyLeadsForSmartlead: SmartleadLeadParams[] = [];
        
        for (const lead of leads) {
            try {
                let websiteDataObj = typeof lead.websiteData === 'string' ? JSON.parse(lead.websiteData) : (lead.websiteData || {});
                
                console.log(`🧠 [AI] 呼叫双引擎大脑为 ${lead.email} 撰写邮件...`);
                
                const emailContent = await LLMService.generateEmail(
                    'You are a professional B2B sales expert. Write highly customized cold emails.', 
                    websiteDataObj
                );

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
                        source: 'NOVA',
                        country: websiteDataObj.country || '',
                        industry: websiteDataObj.industry || ''
                    }
                });

                await prisma.deliveryLog.create({
                    data: {
                        userId: campaign.userId,
                        leadId: userLead.id,
                        recipientEmail: lead.email,
                        senderDomain: 'smartlead-system', 
                        subject: 'Business Inquiry',
                        status: 'PENDING', 
                        companyName: userLead.companyName,
                        contactName: userLead.contactName,
                        errorMessage: emailContent 
                    }
                });

                await prisma.lead.update({ where: { id: lead.id }, data: { status: 'GENERATED' } });
                
                readyLeadsForSmartlead.push({
                    email: lead.email,
                    firstName: websiteDataObj.firstName || websiteDataObj.contactName?.split(' ')[0] || '',
                    lastName: websiteDataObj.lastName || websiteDataObj.contactName?.split(' ').slice(1).join(' ') || '',
                    companyName: websiteDataObj.companyName,
                    website: websiteDataObj.website,
                    industry: websiteDataObj.industry,
                    position: websiteDataObj.position || websiteDataObj.jobTitle,
                    country: websiteDataObj.country,
                    aiIcebreaker: emailContent
                });

            } catch (e: any) { 
                console.error(`❌ [生成失败] ${lead.email} : ${e.message}`); 
            }
        }

        // 🌟 核心商用闭环：写完必须直接发，必须要有真实 ID 🌟
        if (readyLeadsForSmartlead.length > 0) {
            
            // 尝试读取专属 ID (如果有的话)
            let slCampaignId = (campaign as any).smartleadCampaignId;
            
            // 如果用户还没有专属 Campaign，必须当场去 Smartlead 真实创建一个！
            if (!slCampaignId) {
                console.log(`🚀 [Smartlead] 检测到无专属发射井，立刻调用官方 API 真实建仓...`);
                // 必须真实创建成功，否则报错中断
                slCampaignId = await SmartleadService.createCampaign(campaign.name || `LeadPilot 自动任务 ${campaignId}`, campaign.userId);
                
                if (slCampaignId) {
                     try {
                        await prisma.campaign.update({ 
                            where: { id: campaignId }, 
                            data: { smartleadCampaignId: slCampaignId } as any 
                        });
                    } catch (dbErr) {
                         // prisma 可能没及时 migrate，但我们仍有真实的 slCampaignId
                    }
                } else {
                     throw new Error("必须获取到真实的 Smartlead Campaign ID 才能继续投递。");
                }
            }

            // 拥有真实 ID，发射真实数据！
            if (slCampaignId) {
                console.log(`🚀 [Smartlead] 打包 ${readyLeadsForSmartlead.length} 条真实线索推入 [${slCampaignId}]...`);
                await SmartleadService.pushLeadsToCampaign(slCampaignId, readyLeadsForSmartlead, campaign.userId);
            }
        }

        await prisma.campaign.update({ where: { id: campaignId }, data: { status: 'COMPLETED' } });
        console.log(`🏁 [任务大满贯] 批次 ${campaignId} 已全部推送至 Smartlead 真枪实弹发出！`);
    } catch (error: any) { 
        console.error(`🚨 系统级异常: ${error.message}`); 
    }
}, { connection });

console.log('🚀 [系统就绪] 商用级直出 Worker 已启动！');