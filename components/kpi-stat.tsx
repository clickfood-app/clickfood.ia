"use client"

import React from "react"

import { TrendingUp, TrendingDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface KPIStatProps {
  label: string
  value: string
  change: number
  icon: React.ReactNode
}

export default function KPIStat({ label, value, change, icon }: KPIStatProps) {
  const isPositive = change >= 0

  return (
    <div className="rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[hsl(var(--primary))/0.1] text-[hsl(var(--primary))]">
          {icon}
        </span>
        <span
          className={cn(
            "flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
            isPositive
              ? "bg-green-50 text-green-600"
              : "bg-red-50 text-red-600"
          )}
        >
          {isPositive ? (
            <TrendingUp className="h-3 w-3" />
          ) : (
            <TrendingDown className="h-3 w-3" />
          )}
          {isPositive ? "+" : ""}
          {change.toFixed(1)}%
        </span>
      </div>
      <p className="mt-4 text-2xl font-bold text-foreground">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>
    </div>
  )
}
