import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminRole } from '@/lib/admin-auth'

const VALID_CATEGORIES = ['INFRA', 'DATA', 'PAYMENT', 'OTHER']
const VALID_CYCLES     = ['MONTHLY', 'YEARLY']

/** GET /api/admin/financial/fixed-costs?activeOnly=true */
export async function GET(request: NextRequest) {
  const auth = await requireAdminRole(['SUPER_ADMIN', 'FINANCE'])
  if (!auth.ok) return auth.response
  const { searchParams } = new URL(request.url)
  const activeOnly = searchParams.get('activeOnly') === 'true'
  const items = await prisma.fixedCost.findMany({
    where: activeOnly ? { isActive: true } : {},
    orderBy: [{ category: 'asc' }, { createdAt: 'desc' }],
  })
  return NextResponse.json({ items })
}

/** POST /api/admin/financial/fixed-costs — 新增 */
export async function POST(request: NextRequest) {
  const auth = await requireAdminRole(['SUPER_ADMIN', 'FINANCE'])
  if (!auth.ok) return auth.response
  const body = await request.json()
  const { name, category, amount, billingCycle, vendor, notes } = body
  if (!name?.trim()) return NextResponse.json({ error: '请填写成本名称' }, { status: 400 })
  if (!VALID_CATEGORIES.includes(category)) return NextResponse.json({ error: '无效的分类' }, { status: 400 })
  if (typeof amount !== 'number' || amount <= 0) return NextResponse.json({ error: '金额必须大于 0' }, { status: 400 })
  if (!VALID_CYCLES.includes(billingCycle)) return NextResponse.json({ error: '无效的计费周期' }, { status: 400 })
  const item = await prisma.fixedCost.create({
    data: {
      name: name.trim(),
      category,
      amount,
      billingCycle,
      vendor: vendor?.trim() || null,
      notes:  notes?.trim()  || null,
      isActive: true,
    },
  })
  return NextResponse.json({ success: true, item })
}

/** PATCH /api/admin/financial/fixed-costs — 更新 */
export async function PATCH(request: NextRequest) {
  const auth = await requireAdminRole(['SUPER_ADMIN', 'FINANCE'])
  if (!auth.ok) return auth.response
  const body = await request.json()
  const { id, name, category, amount, billingCycle, vendor, notes, isActive } = body
  if (!id) return NextResponse.json({ error: '缺少 id' }, { status: 400 })
  const data: Record<string, unknown> = {}
  if (name !== undefined)         data.name         = String(name).trim()
  if (category !== undefined)     { if (!VALID_CATEGORIES.includes(category)) return NextResponse.json({ error: '无效的分类' }, { status: 400 }); data.category = category }
  if (amount !== undefined)       { if (typeof amount !== 'number' || amount <= 0) return NextResponse.json({ error: '金额必须大于 0' }, { status: 400 }); data.amount = amount }
  if (billingCycle !== undefined) { if (!VALID_CYCLES.includes(billingCycle)) return NextResponse.json({ error: '无效的计费周期' }, { status: 400 }); data.billingCycle = billingCycle }
  if (vendor !== undefined)       data.vendor   = vendor?.trim() || null
  if (notes !== undefined)        data.notes    = notes?.trim()  || null
  if (isActive !== undefined)     data.isActive = Boolean(isActive)
  const item = await prisma.fixedCost.update({ where: { id }, data })
  return NextResponse.json({ success: true, item })
}

/** DELETE /api/admin/financial/fixed-costs?id=xxx */
export async function DELETE(request: NextRequest) {
  const auth = await requireAdminRole(['SUPER_ADMIN', 'FINANCE'])
  if (!auth.ok) return auth.response
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: '缺少 id' }, { status: 400 })
  await prisma.fixedCost.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
