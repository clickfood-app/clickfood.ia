"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Cell,
} from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { PackageOpen } from "lucide-react"

/**
 * Dados mockados de produtos mais vendidos.
 * Estruturados para fácil integração com backend futuramente:
 * basta substituir este array por dados vindos de uma API.
 */
export interface ProductSalesData {
  name: string
  quantity: number
}

const mockData: ProductSalesData[] = [
  { name: "Camiseta Básica", quantity: 342 },
  { name: "Tênis Runner", quantity: 276 },
  { name: "Mochila Urban", quantity: 218 },
  { name: "Boné Classic", quantity: 195 },
  { name: "Calça Jogger", quantity: 164 },
  { name: "Jaqueta Slim", quantity: 132 },
  { name: "Relógio Sport", quantity: 98 },
  { name: "Óculos Solar", quantity: 74 },
]

/** Cores computadas em JS (Recharts não suporta CSS variables diretamente) */
const BAR_COLORS = [
  "hsl(217, 91%, 60%)",
  "hsl(217, 80%, 67%)",
  "hsl(210, 70%, 55%)",
  "hsl(210, 65%, 63%)",
  "hsl(200, 65%, 55%)",
  "hsl(200, 55%, 62%)",
  "hsl(230, 60%, 60%)",
  "hsl(230, 50%, 67%)",
]

interface TopProductsChartProps {
  /** Dados opcionais; quando não fornecidos, usa dados mockados */
  data?: ProductSalesData[]
  /** Período exibido no subtítulo */
  period?: string
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
      <PackageOpen className="mb-3 h-10 w-10 opacity-40" />
      <p className="text-sm font-medium">Nenhuma venda registrada</p>
      <p className="mt-1 text-xs">
        Os dados aparecerão aqui quando houver vendas.
      </p>
    </div>
  )
}

export default function TopProductsChart({
  data,
  period = "Últimos 30 dias",
}: TopProductsChartProps) {
  const chartData = (data ?? mockData).sort((a, b) => b.quantity - a.quantity)
  const hasData = chartData.length > 0

  return (
    <div className="rounded-xl border border-border bg-card">
      {/* Header */}
      <div className="border-b border-border px-6 py-4">
        <h2 className="text-base font-semibold text-foreground">
          Produtos Mais Vendidos
        </h2>
        <p className="text-sm text-muted-foreground">{period}</p>
      </div>

      {/* Chart body */}
      <div className="px-6 py-5">
        {!hasData ? (
          <EmptyState />
        ) : (
          <ChartContainer
            config={{
              quantity: {
                label: "Vendidos",
                color: "hsl(217, 91%, 60%)",
              },
            }}
            className="h-[350px] w-full"
          >
            <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 4, right: 24, left: 4, bottom: 4 }}
                barCategoryGap="18%"
              >
                <CartesianGrid
                  horizontal={false}
                  strokeDasharray="3 3"
                  stroke="hsl(220, 13%, 91%)"
                />
                <XAxis
                  type="number"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "hsl(220, 9%, 46%)", fontSize: 12 }}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  axisLine={false}
                  tickLine={false}
                  width={110}
                  tick={{ fill: "hsl(220, 15%, 10%)", fontSize: 12 }}
                />
                <ChartTooltip
                  cursor={{ fill: "hsl(220, 14%, 96%)", radius: 4 }}
                  content={
                    <ChartTooltipContent
                      labelKey="name"
                      formatter={(value) => (
                        <span className="font-semibold">
                          {Number(value).toLocaleString("pt-BR")} un.
                        </span>
                      )}
                    />
                  }
                />
                <Bar dataKey="quantity" radius={[0, 6, 6, 0]} animationDuration={800}>
                  {chartData.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={BAR_COLORS[index % BAR_COLORS.length]}
                    />
                  ))}
                </Bar>
            </BarChart>
          </ChartContainer>
        )}
      </div>
    </div>
  )
}
