import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: '未提供文件' }, { status: 400 })
    }

    // 防御性检查：文件类型
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: '不支持的文件类型，仅允许 JPG、PNG、GIF、WebP' },
        { status: 400 }
      )
    }

    // 防御性检查：文件大小
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: '文件过大，最大支持 2MB' },
        { status: 400 }
      )
    }

    // 生成唯一文件名
    const ext = file.name.split('.').pop() || 'jpg'
    const uniqueName = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${ext}`

    // 确保目录存在
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'avatars')
    await mkdir(uploadDir, { recursive: true })

    // 写入文件
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const filePath = path.join(uploadDir, uniqueName)
    await writeFile(filePath, buffer)

    // 返回相对路径 URL
    const url = `/uploads/avatars/${uniqueName}`
    return NextResponse.json({ url })
  } catch (error) {
    console.error('[Upload] 文件上传失败:', error)
    const err = error as Error & { code?: string | number }
    if (err.name === 'SyntaxError' || err.message?.includes('JSON')) {
      return NextResponse.json(
        { error: '请求格式错误，请检查上传参数', code: 400 },
        { status: 400 }
      )
    }
    if (err.code === 'ENOENT' || err.code === 'ENOTDIR') {
      return NextResponse.json(
        { error: '存储路径配置错误，请联系管理员', code: 500 },
        { status: 500 }
      )
    }
    return NextResponse.json(
      { error: '文件上传失败，请稍后重试', code: 500 },
      { status: 500 }
    )
  }
}
