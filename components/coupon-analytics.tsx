"use client"

import { useMemo } from "react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  BarChart3,
  Receipt,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Ticket,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { CouponUsageDay } from "@/lib/coupons-data"
import { formatBRL, ticketComparison } from "@/lib/coupons-data"

interface AnalyticsCoupon {
  status: "ativo" | "pausado" | "expirado"
}

interface CouponAnalyticsProps {
  usageData: CouponUsageDay[]
  coupons: AnalyticsCoupon[]
}

export default function CouponAnalytics({
  usageData,
  coupons,
}: CouponAnalyticsProps) {
  const analytics = useMemo(() => {
    const totalOrders = usageData.reduce((acc, day) => acc + day.orders, 0)
    const couponOrders = usageData.reduce((acc, day) => acc + day.uses, 0)

    const revenueWithCoupon = usageData.reduce(
      (acc, day) => acc + day.revenue,
      0
    )

    const discountGiven = usageData.reduce(
      (acc, day) => acc + day.discountGiven,
      0
    )

    const revenueWithoutCoupon = Math.max(revenueWithCoupon - discountGiven, 0)

    const avgTicketWithCoupon =
      couponOrders > 0 ? revenueWithCoupon / couponOrders : 0

    const nonCouponOrders = Math.max(totalOrders - couponOrders, 0)

    const avgTicketWithoutCoupon =
      nonCouponOrders > 0 ? revenueWithoutCoupon / nonCouponOrders : 0

    const conversionRate =
      totalOrders > 0 ? (couponOrders / totalOrders) * 100 : 0

    const activeCoupons = coupons.filter((coupon) => coupon.status === "ativo").length

    const comparison = ticketComparison(
      avgTicketWithCoupon,
      avgTicketWithoutCoupon
    )

    return {
      totalOrders,
      couponOrders,
      revenueWithCoupon,
      revenueWithoutCoupon,
      avgTicketWithCoupon,
      avgTicketWithoutCoupon,
      conversionRate,
      activeCoupons,
      comparison,
    }
  }, [usageData, coupons])

  const cards = [
    {
      title: "Pedidos com cupom",
      value: analytics.couponOrders.toString(),
      subtitle: `${analytics.conversionRate.toFixed(1)}% dos pedidos`,
      icon: Ticket,
    },
    {
      title: "Receita com cupom",
      value: formatBRL(analytics.revenueWithCoupon),
      subtitle: "Total gerado com uso de cupons",
      icon: ShoppingCart,
    },
    {
      title: "Ticket médio com cupom",
      value: formatBRL(analytics.avgTicketWithCoupon),
      subtitle: "Valor médio dos pedidos com cupom",
      icon: Receipt,
    },
    {
      title: "Cupons ativos",
      value: analytics.activeCoupons.toString(),
      subtitle: "Campanhas disponíveis agora",
      icon: BarChart3,
    },
  ]

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon

          return (
            <Card key={card.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {card.title}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>

              <CardContent>
                <div className="text-2xl font-bold">{card.value}</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {card.subtitle}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Comparativo de ticket médio</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4 rounded-xl border p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Com cupom</p>
              <p className="text-2xl font-bold">
                {formatBRL(analytics.comparison.withCoupon)}
              </p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Sem cupom</p>
              <p className="text-2xl font-bold">
                {formatBRL(analytics.comparison.withoutCoupon)}
              </p>
            </div>

            <div
              className={cn(
                "flex w-fit items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium",
                analytics.comparison.isPositive
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                  : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400"
              )}
            >
              {analytics.comparison.isPositive ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <TrendingDown className="h-4 w-4" />
              )}

              <span>
                {analytics.comparison.isPositive ? "+" : ""}
                {analytics.comparison.percentage.toFixed(1)}%
              </span>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            Diferença absoluta:{" "}
            <span className="font-medium text-foreground">
              {formatBRL(analytics.comparison.difference)}
            </span>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}