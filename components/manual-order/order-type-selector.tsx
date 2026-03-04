"use client"

import { Store, ShoppingBag, Truck } from "lucide-react"
import { cn } from "@/lib/utils"
import type { OrderType } from "@/lib/order-types"

interface OrderTypeSelectorProps {
  value: OrderType
  onChange: (type: OrderType) => void
}

const orderTypes = [
  {
    type: "local" as OrderType,
    label: "Consumo no Local",
    description: "Cliente consome no restaurante",
    icon: Store,
    color: "text-blue-600 bg-blue-100",
  },
  {
    type: "pickup" as OrderType,
    label: "Retirada",
    description: "Cliente retira no balcao",
    icon: ShoppingBag,
    color: "text-amber-600 bg-amber-100",
  },
  {
    type: "delivery" as OrderType,
    label: "Entrega",
    description: "Enviar para endereco",
    icon: Truck,
    color: "text-green-600 bg-green-100",
  },
]

export default function OrderTypeSelector({ value, onChange }: OrderTypeSelectorProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {orderTypes.map((item) => {
        const Icon = item.icon
        const isSelected = value === item.type

        return (
          <button
            key={item.type}
            onClick={() => onChange(item.type)}
            className={cn(
              "group relative flex flex-col items-center gap-3 rounded-xl border-2 p-5 transition-all duration-200",
              isSelected
                ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/5 shadow-sm"
                : "border-border bg-card hover:border-[hsl(var(--primary))]/40 hover:bg-muted/50"
            )}
          >
            {isSelected && (
              <div className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-[hsl(var(--primary))]" />
            )}
            <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl", item.color)}>
              <Icon className="h-6 w-6" />
            </div>
            <div className="text-center">
              <p className={cn(
                "font-semibold text-sm",
                isSelected ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
              )}>
                {item.label}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
            </div>
          </button>
        )
      })}
    </div>
  )
}
