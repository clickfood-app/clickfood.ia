"use client"

import { Store, Truck, Utensils } from "lucide-react"
import { cn } from "@/lib/utils"
import type { OrderType } from "@/lib/order-types"

interface OrderTypeSelectorProps {
  value: OrderType
  onChange: (value: OrderType) => void
}

const options: Array<{
  value: OrderType
  label: string
  description: string
  icon: typeof Utensils
}> = [
  {
    value: "local",
    label: "Mesa",
    description: "Consumo no local",
    icon: Utensils,
  },
  {
    value: "pickup",
    label: "Retirada",
    description: "Cliente retira no balcão",
    icon: Store,
  },
  {
    value: "delivery",
    label: "Entrega",
    description: "Enviar para endereço",
    icon: Truck,
  },
]

export function OrderTypeSelector({ value, onChange }: OrderTypeSelectorProps) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      {options.map((option) => {
        const Icon = option.icon
        const selected = value === option.value

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-xl border px-4 py-3 text-left transition-all",
              selected
                ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]"
                : "border-border bg-background text-muted-foreground hover:bg-muted"
            )}
          >
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4" />

              <p className="text-sm font-bold">
                {option.label}
              </p>
            </div>

            <p className="mt-1 text-xs">
              {option.description}
            </p>
          </button>
        )
      })}
    </div>
  )
}

export default OrderTypeSelector