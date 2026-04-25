import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminRole } from '@/lib/admin-auth'

// 强制不缓存
export const dynamic = 'force-dynamic';

// 🚀 修复1：完全移除 GET 的参数，杜绝“未使用变量”的报错
export async function GET() { 
  try {
    const auth = await requireAdminRole(['SUPER_ADMIN', 'OPS'])
    if (!auth.ok) return auth.response

    const nodes = await prisma.monitoringNode.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' }
    });

    // 🚀 修复2：给初始的空对象加上强类型断言 {} as Record<string, any>
    const groupedData = nodes.reduce((acc, node) => {
      if (!acc[node.category]) {
        acc[node.category] = {
          title: getCategoryTitle(node.category),
          nodes: []
        }
      }
      
      const envRecord = process.env as Record<string, string | undefined>;
      const isConnected = !!envRecord[node.envKey];

      acc[node.category].nodes.push({
        id: node.id,
        label: node.name,
        envKey: node.envKey,
        description: node.description,
        active: isConnected 
      });
      
      return acc;
    }, {} as Record<string, any>);

    return NextResponse.json(Object.values(groupedData))
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST 接口需要保留 request 因为要读取 body
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminRole(['SUPER_ADMIN', 'OPS'])
    if (!auth.ok) return auth.response
    
    const body = await request.json()
    const { name, category, envKey, description } = body
    
    const node = await prisma.monitoringNode.create({
      data: { name, category, envKey, description }
    })
    return NextResponse.json(node)
  } catch (error: any) {
    return NextResponse.json({ error: '新增失败' }, { status: 500 })
  }
}

function getCategoryTitle(cat: string): string {
  const map: Record<string, string> = {
    'AI_ENGINE': '🧠 核心 AI 引擎 (大模型)',
    'DATA_SOURCE': '🕵️ 数据挖掘与清洗节点',
    'INFRA': '🗄️ 底层高可用基建',
    'PAYMENT': '💰 交易与风控网关',
    'OUTREACH': '✉️ 触达与发信集群'
  }
  return map[cat] || '📦 其他组件'
}