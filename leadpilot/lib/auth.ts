/**
 * NextAuth.js 身份验证配置
 *
 * 核心安全特性：
 * 1. JWT Token 中包含用户 role（从数据库实时读取）
 * 2. Session 对象中暴露 role 给前端
 * 3. 管理员权限完全依赖数据库字段
 * 4. 删除所有硬编码账号
 */

import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "@/lib/prisma"
import { verifyPassword } from "@/lib/password"
import { getRedis } from "@/lib/redis"

// ─── 安全过滤：防止 Base64 撑爆 Cookie ──────────────────────────
const getSafeImage = (imgUrl: string | null | undefined): string | undefined => {
  if (!imgUrl) return undefined
  if (imgUrl.startsWith('data:image')) return undefined
  return imgUrl
}

// ─── 扩展 NextAuth 类型定义 ──────────────────────────────────────
declare module "next-auth" {
  interface Session {
    user: {
      id: string
      email: string
      phone: string
      name?: string
      image?: string
      role: string
    }
  }

  interface User {
    id: string
    email: string
    phone: string
    name?: string
    image?: string
    role: string
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    email: string
    phone: string
    name?: string
    image?: string
    role: string
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "邮箱", type: "text" },
        password: { label: "密码", type: "password" },
        phone: { label: "手机号", type: "text" },
        code: { label: "验证码", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials) {
          throw new Error("请输入登录信息")
        }

        const email = credentials.email?.trim().toLowerCase()
        const password =
          typeof credentials.password === "string"
            ? credentials.password
            : String(credentials.password ?? "")
        const phone = credentials.phone?.trim()
        const code = credentials.code?.trim()

        const selectUser = {
          id: true,
          email: true,
          phone: true,
          password: true,
          role: true,
          name: true,
          image: true,
        } as const

        // ─── 通道 A：邮箱 + 密码 ─────────────────────────────────
        if (email && password) {
          const user = await prisma.user.findFirst({
            where: {
              email: { equals: email, mode: "insensitive" },
            },
            select: selectUser,
          })

          if (!user) {
            throw new Error("用户不存在")
          }

          if (!user.password) {
            throw new Error("用户密码未设置，请联系管理员")
          }

          const ok = await verifyPassword(password, user.password)
          if (!ok) throw new Error("密码错误")

          return {
            id: user.id,
            email: user.email || "",
            phone: user.phone || "",
            name: user.name || undefined,
            image: getSafeImage(user.image),
            role: user.role || "USER",
          }
        }

        // ─── 通道 B：手机号 + 短信验证码 ───────────────────────────
        if (phone && code) {
          const redis = getRedis()
          if (!redis) {
            throw new Error("短信登录暂不可用，请稍后再试")
          }

          const authKey = `auth_code_${phone}`
          const stored = await redis.get(authKey)
          if (!stored || stored !== code) {
            throw new Error("验证码错误或已过期")
          }

          const user = await prisma.user.findUnique({
            where: { phone },
            select: selectUser,
          })
          if (!user) {
            throw new Error("用户不存在")
          }

          await redis.del(authKey)

          return {
            id: user.id,
            email: user.email || "",
            phone: user.phone || "",
            name: user.name || undefined,
            image: getSafeImage(user.image),
            role: user.role || "USER",
          }
        }

        throw new Error("请输入邮箱与密码，或手机号与验证码")
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user, trigger, session }) {
      // 1. 拦截前端 updateSession 传过来的新数据
      if (trigger === "update" && session) {
        token.image = getSafeImage(session.image)
        if (session.name !== undefined) token.name = session.name
        return token
      }

      // 2. 首次登录时从 user 对象填充 token
      if (user) {
        token.id = user.id
        token.email = user.email
        token.phone = user.phone
        token.name = user.name
        token.image = getSafeImage(user.image)
        token.role = user.role
      }

      // 3. 后续刷新时从数据库重新读取最新 role
      if (trigger === "update" || !user) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { role: true, name: true, image: true },
        })
        if (dbUser) {
          token.role = dbUser.role || "USER"
          token.name = dbUser.name ?? undefined
          token.image = getSafeImage(dbUser.image)
        }
      }

      return token
    },

    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
        session.user.email = (token.email as string) || ""
        session.user.phone = token.phone as string
        session.user.name = token.name as string | undefined
        session.user.image = token.image as string | undefined
        session.user.role = token.role as string
      }
      return session
    },
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },

  secret: process.env.NEXTAUTH_SECRET || "your-secret-key-change-in-production",
}