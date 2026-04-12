import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

/**
 * 管理员专用 API 示例
 * 展示如何在后端使用 getServerSession(authOptions) 验证权限
 */
export async function GET(request: NextRequest) {
  // 【核心安全】从 session 中获取用户信息和角色
  const session = await getServerSession(authOptions)

  // 未登录
  if (!session) {
    return NextResponse.json(
      { success: false, error: "未登录" },
      { status: 401 }
    )
  }

  // 【权限验证】只有 ADMIN 才能访问
  if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json(
      { 
        success: false, 
        error: "权限不足",
        currentRole: session.user.role 
      },
      { status: 403 }
    )
  }

  // 管理员操作
  return NextResponse.json({
    success: true,
    message: "欢迎，管理员",
    user: {
      id: session.user.id,
      email: session.user.email,
      role: session.user.role
    }
  })
}
