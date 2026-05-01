import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminRole } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic';

// GET: 获取手动添加的节点
export async function GET() { 
  try {
    const auth = await requireAdminRole(['SUPER_ADMIN', 'OPS'])
    if (!auth.ok) return auth.response
    const nodes = await prisma.monitoringNode.findMany({
      orderBy: { createdAt: 'asc' }
    });
    const groupedData = nodes.reduce((acc, node) => {
      if (!acc[node.category]) {
        acc[node.category] = { title: getCategoryTitle(node.category), nodes: [] }
      }
      acc[node.category].nodes.push({
        id: node.id,
        label: node.name,
        envKey: node.envKey,
        description: node.description,
        active: !!process.env[node.envKey] 
      });
      return acc;
    }, {} as Record<string, any>);
    return NextResponse.json(Object.values(groupedData))
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST: 新增节点
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminRole(['SUPER_ADMIN', 'OPS'])
    if (!auth.ok) return auth.response
    const body = await request.json()
    const node = await prisma.monitoringNode.create({ data: body })
    return NextResponse.json(node)
  } catch (error: any) {
    return NextResponse.json({ error: '新增失败' }, { status: 500 })
  }
}

// 🚀 核心修复：增加 DELETE 接口，解决“移除失败”
export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAdminRole(['SUPER_ADMIN'])
    if (!auth.ok) return auth.response
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: '缺少 ID' }, { status: 400 })
    await prisma.monitoringNode.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: '后端删除失败' }, { status: 500 })
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