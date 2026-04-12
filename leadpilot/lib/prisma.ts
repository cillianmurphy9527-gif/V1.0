import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/** 全项目唯一 Prisma 单例（注册 / NextAuth / API 均通过 @/lib/prisma 引用） */
export const prisma = globalForPrisma.prisma ?? new PrismaClient()

// 开发与生产均挂到 globalThis，避免 Next.js 热更新 / 多模块实例重复 new 导致连接池耗尽
globalForPrisma.prisma = prisma
