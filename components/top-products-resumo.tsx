"use client"

import { Trophy, Medal } from "lucide-react"
import { cn } from "@/lib/utils"

interface TopProduct {
  name: string
  quantity: number
  revenue: number
}

const mockProducts: TopProduct[] = [
  { name: "X-Burger Especial", quantity: 342, revenue: 10260 },
  { name: "Pizza Margherita", quantity: 276, revenue: 13800 },
  { name: "Acai 500ml", quantity: 218, revenue: 5450 },
  { name: "Combo Familia", quantity: 195, revenue: 17550 },
  { name: "Refrigerante 2L", quantity: 164, revenue: 1640 },
]

interface TopProductsResumoProps {
  data?: TopProduct[]
}

export default function TopProductsResumo({ data }: TopProductsResumoProps) {
  const products = data ?? mockProducts

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-6 py-4">
        <Trophy className="h-4 w-4 text-[hsl(var(--primary))]" />
        <div>
          <h2 className="text-base font-semibold text-foreground">
            Produtos em Destaque
          </h2>
          <p className="text-sm text-muted-foreground">Top 5 mais vendidos no periodo</p>
        </div>
      </div>
      <div className="divide-y divide-border">
        {products.map((product, index) => (
          <div
            key={product.name}
            className={cn(
              "flex items-center gap-4 px-6 py-3.5 transition-colors hover:bg-muted/50",
              index === 0 && "bg-[hsl(var(--primary))/0.04]"
            )}
          >
            <div className={cn(
              "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold",
              index === 0
                ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                : index === 1
                  ? "bg-blue-100 text-blue-700"
                  : index === 2
                    ? "bg-blue-50 text-blue-600"
                    : "bg-muted text-muted-foreground"
            )}>
              {index + 1}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-medium text-foreground">
                  {product.name}
                </p>
                {index === 0 && (
                  <Medal className="h-3.5 w-3.5 flex-shrink-0 text-amber-500" />
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {product.quantity.toLocaleString("pt-BR")} unidades vendidas
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-foreground">
                {product.revenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </p>
              <p className="text-xs text-muted-foreground">faturamento</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
