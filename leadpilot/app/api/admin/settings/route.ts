import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminRole } from '@/lib/admin-auth'

/**
 * 获取系统配置
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminRole()
    if (!auth.ok) return auth.response

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')

    const where = category ? { category } : {}

    const settings = await prisma.systemSettings.findMany({
      where,
      orderBy: { category: 'asc' },
    })

    // 转换为易用的格式
    const result: Record<string, any> = {}
    settings.forEach(setting => {
      try {
        result[setting.key] = JSON.parse(setting.value)
      } catch {
        result[setting.key] = setting.value
      }
    })

    return NextResponse.json({ settings: result })
  } catch (error: any) {
    console.error('Failed to fetch settings:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * 更新系统配置（仅 Admin）
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminRole(['SUPER_ADMIN'])
    if (!auth.ok) return auth.response

    const { key, value, category, description } = await request.json()

    if (!key || value === undefined) {
      return NextResponse.json(
        { error: '缺少必填字段：key 和 value' },
        { status: 400 }
      )
    }

    // 序列化值
    const serializedValue = typeof value === 'string' ? value : JSON.stringify(value)

    const setting = await prisma.systemSettings.upsert({
      where: { key },
      create: {
        key,
        value: serializedValue,
        category: category || 'general',
        description,
        updatedBy: token.id as string,
      },
      update: {
        value: serializedValue,
        category: category || undefined,
        description: description || undefined,
        updatedBy: token.id as string,
      },
    })

    console.log(`✅ 配置已更新: ${key}`)

    return NextResponse.json({
      success: true,
      setting,
    })
  } catch (error: any) {
    console.error('Failed to update setting:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * 删除系统配置（仅 Admin）
 */
export async function DELETE(request: NextRequest) {
  try {
    const token = await getToken({
      req: request as any,
      secret: process.env.NEXTAUTH_SECRET,
    })
    if (!token?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 验证管理员身份
    const user = { role: token?.role as string | undefined }
    if (user?.role !== 'ADMIN' && user?.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const key = searchParams.get('key')

    if (!key) {
      return NextResponse.json({ error: '缺少 key 参数' }, { status: 400 })
    }

    await prisma.systemSettings.delete({
      where: { key },
    })

    console.log(`✅ 配置已删除: ${key}`)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Failed to delete setting:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
