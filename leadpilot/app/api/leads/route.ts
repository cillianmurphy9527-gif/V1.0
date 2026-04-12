import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return email
  const [local, domain] = email.split('@')
  if (local.length <= 1) return `${local}***@${domain}`
  return `${local[0]}***@${domain}`
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const country = searchParams.get('country')

    const skip = (page - 1) * limit
    const where: any = { userId: user.id }
    if (country) {
      where.country = country
    }

    // 并行查询 UserLead 和 LeadsCache，合并去重
    const [userLeads, cachedLeads] = await Promise.all([
      // 用户主动保存的线索
      prisma.userLead.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      }),
      // Worker 自动抓取的线索（从 LeadsCache）
      prisma.leadsCache.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
      }),
    ])

    // 合并两个表的数据，统一格式
    const allLeads = [
      ...userLeads.map(l => ({
        id: l.id,
        companyName: l.companyName,
        contactName: l.contactName,
        jobTitle: l.jobTitle,
        country: l.country,
        email: l.isUnlocked ? l.email : maskEmail(l.email),
        phone: l.phone ? (l.isUnlocked ? l.phone : maskEmail(l.phone)) : null,
        isUnlocked: l.isUnlocked,
        source: l.source || 'manual',
        website: l.website,
        linkedIn: l.linkedIn,
        industry: l.industry,
        createdAt: l.createdAt,
        _source: 'userLead' as const,
      })),
      ...cachedLeads.map(l => ({
        id: l.id,
        companyName: l.companyName,
        contactName: null,
        jobTitle: l.jobTitle,
        country: null,
        email: maskEmail(l.contactEmail), // LeadsCache 的 email 字段是 contactEmail
        phone: null,
        isUnlocked: false, // 自动抓取的线索默认锁定
        source: 'nova',
        website: l.domain,
        linkedIn: null,
        industry: null,
        createdAt: l.createdAt,
        _source: 'leadsCache' as const,
      })),
    ]

    // 按时间降序排列
    allLeads.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    // 分页
    const total = allLeads.length
    const paginatedLeads = allLeads.slice(skip, skip + limit)

    // 服务端脱敏：isUnlocked=false 的线索，email 返回脱敏版本
    const processedLeads = paginatedLeads.map(l => ({
      id: l.id,
      companyName: l.companyName || '未知公司',
      contactName: l.contactName,
      jobTitle: l.jobTitle,
      country: l.country,
      email: l.isUnlocked ? l.email : maskEmail(l.email),
      phone: l.phone,
      isUnlocked: l.isUnlocked,
      source: l.source,
      website: l.website,
      linkedIn: l.linkedIn,
      industry: l.industry,
      createdAt: l.createdAt,
      _source: l._source,
    }))

    return NextResponse.json({
      success: true,
      data: processedLeads,
      exportQuota: user.exportQuota,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('[leads] GET error:', error)
    return NextResponse.json({ error: '获取线索失败' }, { status: 500 })
  }
}
