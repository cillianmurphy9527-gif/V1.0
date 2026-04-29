import axios from 'axios';

const log = (tag: string, msg: string) => console.log(`[${tag}] ${msg}`);

async function sendWebhook(event: string, payload: any, retry: number = 3) {
    const mainStationUrl = process.env.MAIN_STATION_URL || 'http://localhost:3000';
    const secret = (process.env.NOVA_SECRET_KEY || 'leadpilot_dev_secret_123').replace(/"/g, '');

    for (let attempt = 0; attempt < retry; attempt++) {
        try {
            const response = await axios.post(
                `${mainStationUrl}/api/nova/webhook`,
                { event, ...payload },
                {
                    headers: { 'Authorization': `Bearer ${secret}` },
                    timeout: 10000,
                }
            );

            if (event !== 'LEAD_SYNC') {
                log('Webhook', `✅ 状态已同步至主站: ${event}`);
            }
            return;
        } catch (err: any) {
            const is500 = err.response?.status >= 500;
            const isLastAttempt = attempt === retry - 1;

            if (isLastAttempt || !is500) {
                if (event !== 'LEAD_SYNC') {
                    log('Webhook', `❌ 回传主站失败 (${err.message})`);
                }
                return;
            }

            log('Webhook', `⚠️ 主站返回 ${err.response?.status || '网络错误'}，2秒后重试 (${attempt + 1}/${retry})...`);
            await new Promise(res => setTimeout(res, 2000));
        }
    }
}

function getTargetDomains(keyword: string): { name: string; domain: string }[] {
    const k = keyword.toLowerCase();
    if (k.includes('德国') || k.includes('机械')) {
        return [
            { name: 'Siemens', domain: 'siemens.com' },
            { name: 'Bosch', domain: 'bosch.com' },
            { name: 'KUKA', domain: 'kuka.com' },
        ];
    }
    return [
        { name: 'Apple', domain: 'apple.com' },
        { name: 'Microsoft', domain: 'microsoft.com' },
    ];
}

async function runSnovRoute(domain: string, compName: string): Promise<any[]> {
    const params = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: process.env.SNOV_CLIENT_ID || '',
        client_secret: process.env.SNOV_CLIENT_SECRET || '',
    });

    const tokenRes = await axios.post(
        'https://api.snov.io/v1/oauth/access_token',
        params,
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    const token = tokenRes.data.access_token;

    const searchRes = await axios.post(
        'https://api.snov.io/v1/get-domain-emails-with-info',
        { domain, type: 'personal', limit: 3 },
        { headers: { 'Authorization': `Bearer ${token}` } }
    );

    const emails = searchRes.data.emails || [];
    const validLeads: any[] = [];

    for (const p of emails) {
        log('Snov.io', `正在验证邮箱: ${p.email}`);
        const verifyRes = await axios.post(
            'https://api.snov.io/v1/email-verifier',
            { emails: [p.email] },
            { headers: { 'Authorization': `Bearer ${token}` } }
        );

        if (verifyRes.data[0]?.status === 'valid') {
            validLeads.push({
                companyName: compName,
                domain,
                email: p.email,
                contactName: `${p.firstName || ''} ${p.lastName || ''}`.trim() || '高管',
                position: p.position || '决策者',
                status: 'VERIFIED',
            });
        }
    }
    return validLeads;
}

async function runFallbackRoute(domain: string, compName: string): Promise<any[]> {
    log('Fallback', `⚠️ 正在启用 Hunter + ZeroBounce 联合兜底路线...`);
    const hRes = await axios.get(
        `https://api.hunter.io/v2/domain-search?domain=${domain}&type=personal&limit=3&api_key=${process.env.HUNTER_API_KEY}`
    );
    const emails = hRes.data?.data?.emails || [];

    const validLeads: any[] = [];
    for (const p of emails) {
        log('ZeroBounce', `正在验证邮箱: ${p.value}`);
        const zRes = await axios.get(
            `https://api.zerobounce.net/v2/validate?api_key=${process.env.ZEROBOUNCE_API_KEY}&email=${p.value}`
        );

        if (zRes.data.status === 'valid') {
            validLeads.push({
                companyName: compName,
                domain,
                email: p.value,
                contactName: `${p.first_name || ''} ${p.last_name || ''}`.trim() || '高管',
                position: p.position || '决策者',
                status: 'VERIFIED',
            });
        }
    }
    return validLeads;
}

export async function runEngine(keyword: string, campaignId: string) {
    log('Engine', `🚀 [商用级挖掘引擎] 点火启动 | 任务 ID: ${campaignId}`);

    try {
        const targets = getTargetDomains(keyword);
        log('Engine', `🔍 锁定 ${targets.length} 家目标企业，开始执行四步清洗流水线...`);

        let totalFound = 0;

        for (const target of targets) {
            let leads: any[] = [];

            try {
                log('Engine', `🟢 [首选链路] 呼叫 Snov.io 突击 ${target.domain}...`);
                leads = await runSnovRoute(target.domain, target.name);

                if (leads.length === 0) throw new Error('SNOV_EMPTY');
            } catch (e: any) {
                log('Snov.io', `⚠️ 链路阻断: ${e.response?.data?.message || e.message}`);
                try {
                    leads = await runFallbackRoute(target.domain, target.name);
                } catch (fallbackError: any) {
                    log('Engine', `🔴 [拦截] 该企业 (${target.domain}) 数据防御严密。跳过。`);
                    continue;
                }
            }

            for (const lead of leads) {
                log('Engine', `🎯 [爆绿] 成功捕获线索: ${lead.email}`);
                totalFound++;
                await sendWebhook('LEAD_SYNC', { campaignId, lead });
            }
        }

        log('Engine', `🎉 任务收官！共捕获 ${totalFound} 条数据。正在呼叫主站 AI 队列...`);
        await sendWebhook('TASK_COMPLETED', { campaignId, status: 'SUCCESS', total: totalFound });

    } catch (error: any) {
        log('Error', `🚨 引擎底层崩溃: ${error.message}`);
        await sendWebhook('TASK_FAILED', { campaignId, status: 'FAILED', error: error.message });
    }
}
