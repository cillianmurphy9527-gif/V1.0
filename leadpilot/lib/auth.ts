/**
 * NextAuth.js 身份验证配置
 *
 * 核心安全特性：
 * 1. JWT Token 中包含用户 role（从数据库实时读取）
 * 2. Session 对象中暴露 role 给前端
 * 3. phone === '18342297595' 在内存中强制升级为 SUPER_ADMIN
 * 4. 硬编码账号在数据库中同步真实 UUID，保证前后端 ID 一致
 */

import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { hashPassword, verifyPassword } from "@/lib/password"
import { getRedis } from "@/lib/redis"

// ─── 超级管理员手机号硬锁 ────────────────────────────────────────
const SUPER_ADMIN_PHONE = '18342297595'

// ─── 安全过滤：防止 Base64 撑爆 Cookie ──────────────────────────
// Base64 图片数据会超出浏览器 4KB Cookie 限制，导致 ERR_RESPONSE_HEADERS_TOO_BIG
const getSafeImage = (imgUrl: string | null | undefined): string | undefined => {
  if (!imgUrl) return undefined
  if (imgUrl.startsWith('data:image')) return undefined // 拒绝 Base64 写入 JWT
  return imgUrl
}

// ─── 硬编码测试账号（开发专用）───────────────────────────────────
// 重要：id 必须是真实的数据库 UUID，才能保证通知系统正常工作
const HARDCODED_USERS = [
  {
    id: 'dev-admin-super',           // UUID 格式（用于 JWT token）
    phone: '18342297595',
    password: 'jiaofuquan123@',
    email: 'admin@leadpilot.cn',
    role: 'SUPER_ADMIN',
  },
  {
    id: 'dev-user-dashboard',         // UUID 格式（用于 JWT token）
    phone: '13900000001',             // 必须是手机号格式
    password: 'jiaofuquan123@',
    email: '1390504583@qq.com',
    role: 'USER',
  },
  {
    id: 'dev-admin-001',
    phone: '00000000000',
    password: 'admin888@',
    email: 'admin2@leadpilot.cn',
    role: 'ADMIN',
  },
]

// ─── 扩展 NextAuth 类型定义 ──────────────────────────────────────
declare module "next-auth" {
  interface Session {
    user: {
      id: string
      email: string
      phone: string
      name?: string
      image?: string
      role: string // USER | ADMIN | SUPER_ADMIN
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
    role: string // USER | ADMIN | SUPER_ADMIN
  }
}

/**
 * 确保硬编码账号在数据库中存在，并返回真实的数据库 ID
 * 关键：UUID 格式的 ID 用于 JWT token，保证与数据库记录一致
 */
async function ensureHardcodedUserExists(user: typeof HARDCODED_USERS[number]): Promise<string> {
  const features: Prisma.InputJsonValue = { canUseInbox: true, aiScoring: true }
  const hashedPassword = await hashPassword(user.password)

  let dbUser = await prisma.user.findUnique({
    where: { email: user.email },
    select: { id: true, email: true, phone: true, role: true, password: true },
  })

  if (!dbUser) {
    console.log(`[Auth] 硬编码账号 ${user.email} 不在数据库中，创建新记录...`)
    dbUser = await prisma.user.create({
      data: {
        phone: user.phone,
        email: user.email,
        password: hashedPassword,
        companyName: user.role === 'USER' ? '测试用户' : 'LeadPilot Admin',
        subscriptionTier: 'MAX',
        features,
        role: user.role,
        adminRole: user.role === 'SUPER_ADMIN' || user.role === 'ADMIN' ? user.role : null,
        tokenBalance: user.role === 'USER' ? 100 : 999999,
        monthlySearches: 0,
        ragFileCount: 0,
        credits: user.role === 'USER' ? 100 : 999999,
      },
      select: { id: true, email: true, phone: true, role: true, password: true },
    })
    console.log(`[Auth] 硬编码账号 ${user.email} 已创建，数据库ID: ${dbUser.id}`)
  } else {
    if (!dbUser.password) {
      await prisma.user.update({
        where: { id: dbUser.id },
        data: { password: hashedPassword },
      })
    }
    // 存在但 phone 不匹配？更新 phone（保证登录一致性）
    if (dbUser.phone !== user.phone) {
      await prisma.user.update({
        where: { id: dbUser.id },
        data: { phone: user.phone },
      })
      console.log(`[Auth] 硬编码账号 ${user.email} 的 phone 已更新为 ${user.phone}`)
    }

    // 同步角色
    if (dbUser.role !== user.role) {
      await prisma.user.update({
        where: { id: dbUser.id },
        data: { role: user.role, adminRole: user.role },
      })
    }
  }

  return dbUser!.id
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
            const hardcoded = HARDCODED_USERS.find(
              (u) => u.email.toLowerCase() === email
            )
            if (hardcoded) {
              const realDbId = await ensureHardcodedUserExists(hardcoded)
              const dbUser = await prisma.user.findUnique({
                where: { id: realDbId },
                select: selectUser,
              })
              if (!dbUser?.password) {
                throw new Error("用户密码未设置，请联系管理员")
              }
              const ok = await verifyPassword(password, dbUser.password)
              if (!ok) throw new Error("密码错误")
              const role =
                dbUser.phone === SUPER_ADMIN_PHONE ? "SUPER_ADMIN" : dbUser.role
              return {
                id: dbUser.id,
                email: dbUser.email || "",
                phone: dbUser.phone || "",
                name: dbUser.name || undefined,
                image: getSafeImage(dbUser.image),
                role,
              }
            }
            throw new Error("用户不存在")
          }

          if (!user.password) {
            throw new Error("用户密码未设置，请联系管理员")
          }
          const ok = await verifyPassword(password, user.password)
          if (!ok) throw new Error("密码错误")
          const role =
            user.phone === SUPER_ADMIN_PHONE ? "SUPER_ADMIN" : user.role
          return {
            id: user.id,
            email: user.email || "",
            phone: user.phone || "",
            name: user.name || undefined,
            image: getSafeImage(user.image),
            role,
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
          const role =
            user.phone === SUPER_ADMIN_PHONE ? "SUPER_ADMIN" : user.role
          return {
            id: user.id,
            email: user.email || "",
            phone: user.phone || "",
            name: user.name || undefined,
            image: getSafeImage(user.image),
            role,
          }
        }

        throw new Error("请输入邮箱与密码，或手机号与验证码")
      },
    })
  ],

  callbacks: {
    async jwt({ token, user, trigger, session }) {
      // 1. 拦截前端 updateSession 传过来的新数据（最高优先级）
      //    这是 NextAuth v4 官方规范：必须手动拦截 session 参数并赋值给 token
      if (trigger === "update" && session) {
        token.image = getSafeImage(session.image)
        if (session.name !== undefined) token.name = session.name
        // 拦截到前端数据后直接返回，不再往下走查数据库逻辑，防止竞态延迟
        return token
      }

      // 2. 首次登录时从 user 对象填充 token
      if (user) {
        token.id     = user.id
        token.email = user.email
        token.phone = user.phone
        token.name  = user.name
        token.image = getSafeImage(user.image)
        token.role  = user.role
      }

      // 3. 内存强制升级：无论数据库存什么，SUPER_ADMIN_PHONE 永远是 SUPER_ADMIN
      if ((token.phone as string) === SUPER_ADMIN_PHONE) {
        token.role = 'SUPER_ADMIN'
      }

      // 4. 后续刷新时从数据库重新读取最新 role（硬编码账号跳过）
      if (trigger === "update" || !user) {
        const DEV_PHONES = HARDCODED_USERS.map(u => u.phone)
        if (!DEV_PHONES.includes(token.phone as string)) {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { role: true, phone: true, name: true, image: true }
          })
          if (dbUser) {
            // 内存强制升级优先
            token.role  = dbUser.phone === SUPER_ADMIN_PHONE ? 'SUPER_ADMIN' : dbUser.role
            token.name  = dbUser.name ?? undefined
            token.image = getSafeImage(dbUser.image)
          }
        }
      }

      return token
    },

    async session({ session, token }) {
      if (token) {
        session.user.id    = token.id     as string
        session.user.email = (token.email as string) || ""
        session.user.phone = token.phone  as string
        session.user.name  = token.name  as string | undefined
        session.user.image = token.image as string | undefined
        session.user.role  = token.role  as string
      }
      return session
    }
  },

  pages: {
    signIn: "/login",
    error:  "/login"
  },

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60 // 30 天
  },

  secret: process.env.NEXTAUTH_SECRET || "your-secret-key-change-in-production"
}
