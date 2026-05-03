import { redirect } from "next/navigation"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { DashboardPageClient } from "@/components/dashboard/DashboardPageClient"

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    redirect("/login")
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      tokenBalance: true,
      subscriptionTier: true,
      ragFileCount: true,
    },
  })

  // 🌟 直接构建初始资产对象，不再依赖外部类型
  const initialUserAssets = {
    tokenBalance: user?.tokenBalance ?? 0,
    subscriptionTier: user?.subscriptionTier ?? "TRIAL",
    ragFileCount: user?.ragFileCount ?? 0,
  }

  return <DashboardPageClient initialUserAssets={initialUserAssets} />
}