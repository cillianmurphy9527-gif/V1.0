import axios from 'axios';

// 主站的地址（云端部署时会换成您真实的域名）
const MAIN_API_URL = process.env.MAIN_API_URL || 'http://localhost:3000';
const NOVA_SECRET = process.env.NOVA_WEBHOOK_SECRET || 'leadpilot-super-secret-2026';

export async function sendToMainStation(action: string, jobId: string, data: any) {
    try {
        await axios.post(`${MAIN_API_URL}/api/nova/webhook`, {
            action,
            jobId,
            data
        }, {
            headers: {
                'Authorization': `Bearer ${NOVA_SECRET}`,
                'Content-Type': 'application/json'
            }
        });
        console.log(`[泥头车对讲机] 战报已发送至主站 -> ${action}`);
    } catch (error) {
        console.error(`[泥头车对讲机] 发送失败! 请检查主站是否启动。`, error);
    }
}