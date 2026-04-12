import { redirect } from "next/navigation"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import {
  DashboardPageClient,
  type DashboardInitialUserAssets,
} from "@/components/dashboard/DashboardPageClient"

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

  const initialUserAssets: DashboardInitialUserAssets = {
    tokenBalance: user?.tokenBalance ?? 0,
    subscriptionTier: user?.subscriptionTier ?? "TRIAL",
    ragFileCount: user?.ragFileCount ?? 0,
  }

  return <DashboardPageClient initialUserAssets={initialUserAssets} />
}
