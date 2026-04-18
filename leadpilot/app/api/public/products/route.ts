import { NextResponse } from 'next/server';
import { getDynamicPricing } from '@/lib/dynamic-pricing';

// 🚀 终极防缓存三连击
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function GET() {
  const store = getDynamicPricing();
  const response = NextResponse.json({ success: true, data: store });
  
  // 强制浏览器和代理服务器绝不缓存
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  
  return response;
}