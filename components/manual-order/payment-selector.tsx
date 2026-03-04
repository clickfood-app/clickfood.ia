"use client"

import { Banknote, QrCode, CreditCard, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import type { PaymentMethod } from "@/lib/order-types"

interface PaymentSelectorProps {
  value: PaymentMethod
  onChange: (method: PaymentMethod) => void
}

const paymentMethods = [
  { method: "cash" as PaymentMethod, label: "Dinheiro", icon: Banknote },
  { method: "pix" as PaymentMethod, label: "PIX", icon: QrCode },
  { method: "credit" as PaymentMethod, label: "Credito", icon: CreditCard },
  { method: "debit" as PaymentMethod, label: "Debito", icon: CreditCard },
  { method: "pending" as PaymentMethod, label: "Pendente", icon: Clock },
]

export default function PaymentSelector({ value, onChange }: PaymentSelectorProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">Forma de Pagamento</label>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {paymentMethods.map((item) => {
          const Icon = item.icon
          const isSelected = value === item.method

          return (
            <button
              key={item.method}
              onClick={() => onChange(item.method)}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-lg border-2 p-3 transition-all",
                isSelected
                  ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10"
                  : "border-border bg-card hover:border-[hsl(var(--primary))]/40"
              )}
            >
              <Icon className={cn(
                "h-5 w-5",
                isSelected ? "text-[hsl(var(--primary))]" : "text-muted-foreground"
              )} />
              <span className={cn(
                "text-[11px] font-medium",
                isSelected ? "text-[hsl(var(--primary))]" : "text-muted-foreground"
              )}>
                {item.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
