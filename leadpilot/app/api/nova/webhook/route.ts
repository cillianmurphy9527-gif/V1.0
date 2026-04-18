import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// 军用级密钥，只有对得上暗号才允许写入数据库
const NOVA_SECRET = process.env.NOVA_WEBHOOK_SECRET || 'leadpilot-super-secret-2026';

export async function POST(req: NextRequest) {
  try {
    // 1. 验证身份（防黑客）
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${NOVA_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. 接收泥头车的战报数据
    const payload = await req.json();
    const { action, jobId, data } = payload;

    console.log(`[主站雷达] 收到泥头车动作: ${action} | 任务ID: ${jobId}`);

    // 3. 替泥头车写入数据库
    if (action === 'UPDATE_JOB_STATUS') {
       await prisma.novaJob.update({
         where: { id: jobId },
         data: { status: data.status }
       });
    }
    
    return NextResponse.json({ success: true, message: '主站已安全落库' });

  } catch (error: any) {
    console.error('[主站报警] Webhook 接收失败:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}