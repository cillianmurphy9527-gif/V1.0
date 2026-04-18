import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRole } from '@/lib/admin-auth';
import { getDynamicPricing, updateFullStore } from '@/lib/dynamic-pricing';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdminRole(['SUPER_ADMIN', 'OPS']);
    if (!auth.ok) return auth.response;
    return NextResponse.json({ success: true, data: getDynamicPricing() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ error: '获取失败' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdminRole(['SUPER_ADMIN']);
    if (!auth.ok) return auth.response;
    const body = await req.json();
    
    // 🚀 如果接收到 save_all 指令，直接覆盖全局状态
    if (body.action === 'save_all') {
      updateFullStore(body.data);
      return NextResponse.json({ success: true, message: '全局同步成功' });
    }
    
    return NextResponse.json({ error: '无效指令' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: '更新失败' }, { status: 500 });
  }
}