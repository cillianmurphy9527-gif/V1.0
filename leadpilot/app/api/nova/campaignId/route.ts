import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { campaignId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { campaignId } = params

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: {
        id: true,
        status: true,
        userId: true,
        estimatedLeads: true,
      }
    })

    if (!campaign || campaign.userId !== session.user.id) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // 统计已验证的线索数
    const verifiedCount = await prisma.lead.count({
      where: { campaignId, status: 'SENT' }
    })

    // 统计 AI 已生成的线索数
    const generatedCount = await prisma.lead.count({
      where: { campaignId, status: 'GENERATED' }
    })

    // 统计总获取的线索数（所有非 PENDING 的）
    const totalCount = await prisma.lead.count({
      where: { campaignId, status: { not: 'PENDING' } }
    })

    const isCompleted = campaign.status === 'COMPLETED'

    return NextResponse.json({
      total: totalCount,
      verified: verifiedCount,
      generated: generatedCount,
      isCompleted,
    })
  } catch (error: any) {
    console.error('[Nova Status] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}