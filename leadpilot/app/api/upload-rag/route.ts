/**
 * API: 上传知识库文件
 * 
 * 【核心安全】第一行必须验证用户权限和配额
 * 如果触发 FUP 或权限不足，直接返回 403，绝不上传文件
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { checkFeatureAccess, recordQuotaUsage, FeatureGateError } from '@/lib/feature-gate'

export async function POST(request: NextRequest) {
  try {
    // ─── 1. 验证登录状态 ──────────────────────────────
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      )
    }

    const userId = session.user.id
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // ─── 2. 【关键】特征门控检查 ────────────────────────
    const gateResult = await checkFeatureAccess(userId, 'RAG_UPLOAD')
    
    if (!gateResult.allowed) {
      // 【拦截】返回 403 + 标准错误码
      const statusCode = gateResult.error === FeatureGateError.UPGRADE_REQUIRED ? 403 : 429
      return NextResponse.json(
        {
          error: gateResult.message,
          code: gateResult.error,
          remainingQuota: gateResult.remainingQuota,
        },
        { status: statusCode }
      )
    }

    // ─── 3. 配额检查通过，处理文件上传 ────────────────
    // 这里才是真正的业务逻辑
    const fileName = file.name
    const fileSize = file.size
    
    // 模拟上传到存储服务
    const fileId = `rag-${Date.now()}`

    // ─── 4. 记录配额消耗 ──────────────────────────────
    await recordQuotaUsage(userId, 'rag', 1)

    return NextResponse.json({
      success: true,
      fileId,
      fileName,
      fileSize,
      uploadedAt: new Date().toISOString(),
      remainingQuota: gateResult.remainingQuota! - 1,
    })
  } catch (error) {
    console.error('[UploadRAG] Error:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
