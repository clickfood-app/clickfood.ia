"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import AdminSidebar from "@/components/admin-sidebar"
import AdminHeader from "@/components/admin-header"
import { useAuth } from "@/components/auth/auth-provider"
import { cn } from "@/lib/utils"
import { Clock, ArrowRight } from "lucide-react"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { subscription, trialDaysRemaining } = useAuth()

  useEffect(() => {
    setMounted(true)
  }, [])

  const toggleCollapse = () => setIsCollapsed(!isCollapsed)

  // Use a stable default on server to avoid Radix ID hydration mismatches
  const effectiveCollapsed = mounted ? isCollapsed : false

  const showTrialBanner = subscription?.status === "trialing" && trialDaysRemaining !== null

  return (
    <div className="flex min-h-screen">
      <AdminSidebar
        isCollapsed={effectiveCollapsed}
        onToggleCollapse={toggleCollapse}
      />
      <AdminHeader
        isCollapsed={effectiveCollapsed}
        onToggleCollapse={toggleCollapse}
      />
      <main
        className={cn(
          "flex-1 transition-all duration-300 ease-in-out",
          effectiveCollapsed ? "ml-[68px]" : "ml-64",
          showTrialBanner ? "pt-[104px]" : "pt-14"
        )}
      >
        {/* Trial Banner */}
        {showTrialBanner && (
          <div
            className={cn(
              "fixed top-14 right-0 z-30 bg-gradient-to-r from-amber-500 to-orange-500 text-white transition-all duration-300",
              effectiveCollapsed ? "left-[68px]" : "left-64"
            )}
          >
            <div className="flex items-center justify-between px-4 py-2.5">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span className="text-sm font-medium">
                  {trialDaysRemaining === 0
                    ? "Seu teste gratis termina hoje!"
                    : trialDaysRemaining === 1
                      ? "Seu teste gratis termina amanha!"
                      : `Restam ${trialDaysRemaining} dias do seu teste gratis`}
                </span>
              </div>
              <Link
                href="/oferta"
                className="flex items-center gap-1.5 rounded-lg bg-white/20 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/30"
              >
                Assinar agora
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        )}
        {children}
      </main>
    </div>
  )
}
