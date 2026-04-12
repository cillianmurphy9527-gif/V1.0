import type { Metadata } from "next"
import { Inter } from "next/font/google"
import AuthProvider from "@/components/providers/AuthProvider"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { Toaster } from "@/components/ui/toaster"
import { PurchasedAssetsProvider } from "@/contexts/PurchasedAssetsContext"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "LeadPilot - 智能外贸开发信自动化平台",
  description: "AI驱动的外贸开发信自动化SaaS平台，集成意图过滤、多语言撰写与统一收件箱",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body className={inter.className}>
        <ErrorBoundary>
          <AuthProvider>
            <PurchasedAssetsProvider>
              {children}
              <Toaster />
            </PurchasedAssetsProvider>
          </AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  )
}
