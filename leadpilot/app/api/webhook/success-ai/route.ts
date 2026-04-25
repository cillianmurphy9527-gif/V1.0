// 文件路径: leadpilot/app/api/webhooks/smartlead/route.ts
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    // 1. 获取 Smartlead 推送过来的数据
    const body = await req.json();
    
    // 2. 简单的防黑客鉴权 (可选，比对 URL 参数或 Header)
    // const { searchParams } = new URL(req.url);
    // if (searchParams.get('secret') !== process.env.SMARTLEAD_WEBHOOK_SECRET) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    console.log('\n📥 [Smartlead Webhook] 收到实时事件推送:');
    console.log(`事件类型: ${body.event_type}`); // 例如: EMAIL_REPLIED, EMAIL_OPENED
    
    // 3. 核心业务逻辑分发
    switch (body.event_type) {
      case 'EMAIL_REPLIED':
        console.log(`🔥 客户回复了！邮箱: ${body.to_email}, 内容: ${body.message}`);
        // TODO: 把回复内容存入数据库，并在咱们系统的前端打上 "Hot Lead" 标签
        break;
        
      case 'EMAIL_OPENED':
        console.log(`👀 客户打开了邮件: ${body.to_email}`);
        // TODO: 更新该客户的打开次数统计
        break;
        
      case 'EMAIL_CLICKED':
        console.log(`🖱️ 客户点击了链接: ${body.to_email}`);
        break;

      default:
        console.log(`ℹ️ 其他事件: ${body.event_type}`);
    }

    // 必须给 Smartlead 返回 200，否则它会不断重发
    return NextResponse.json({ status: 'success', received: true });

  } catch (error) {
    console.error('❌ 处理 Smartlead Webhook 失败:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}