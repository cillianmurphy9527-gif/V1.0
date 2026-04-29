import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return '***@***';
  const [, domain] = email.split('@');
  return `xx***@${domain}`;
}

function maskName(name: string | null): string | null {
  if (!name || name.trim() === '') return null;
  const trimmed = name.trim();
  if (trimmed.length === 1) {
    return `${trimmed[0]}**`;
  }
  return `${trimmed[0]}**`;
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

    const [userLeads, cachedLeads] = await Promise.all([
      prisma.userLead.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.leadsCache.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
      }),
    ])

    const allLeads = [
      ...userLeads.map(l => ({
        id: l.id,
        companyName: l.companyName,
        contactName: l.contactName,
        jobTitle: l.jobTitle,
        country: l.country,
        email: l.isUnlocked ? l.email : maskEmail(l.email),
        phone: l.phone ? (l.isUnlocked ? l.phone : maskEmail(l.email)) : null,
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
        companyName: l.companyName || '未知公司',
        contactName: null,
        jobTitle: l.jobTitle,
        country: null,
        email: maskEmail(l.contactEmail),
        phone: null,
        isUnlocked: false,
        source: 'nova',
        website: l.domain,
        linkedIn: null,
        industry: null,
        createdAt: l.createdAt,
        _source: 'leadsCache' as const,
      })),
    ]

    allLeads.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    const total = allLeads.length
    const paginatedLeads = allLeads.slice(skip, skip + limit)

    const processedLeads = paginatedLeads.map(l => ({
      id: l.id,
      companyName: l.companyName || '未知公司',
      contactName: l.isUnlocked ? (l.contactName ?? null) : maskName(l.contactName),
      jobTitle: l.jobTitle,
      country: l.country,
      email: l.email,
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
