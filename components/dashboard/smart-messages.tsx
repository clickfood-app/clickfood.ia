"use client"

import { AlertTriangle, CheckCircle2, Info } from "lucide-react"
import { cn } from "@/lib/utils"
import type { SmartMessage } from "@/lib/dashboard-data"

const config: Record<SmartMessage["type"], { icon: React.ReactNode; bg: string; border: string; text: string }> = {
  positive: {
    icon: <CheckCircle2 className="h-4 w-4 flex-shrink-0" />,
    bg: "bg-green-50",
    border: "border-green-200",
    text: "text-green-800",
  },
  negative: {
    icon: <Info className="h-4 w-4 flex-shrink-0" />,
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-800",
  },
  warning: {
    icon: <AlertTriangle className="h-4 w-4 flex-shrink-0" />,
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-800",
  },
}

export default function SmartMessages({ messages }: { messages: SmartMessage[] }) {
  if (messages.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      {messages.map((m) => {
        const c = config[m.type]
        return (
          <div key={m.id} className={cn("flex items-center gap-3 rounded-lg border px-4 py-3", c.bg, c.border, c.text)}>
            {c.icon}
            <p className="text-sm font-medium leading-relaxed">{m.message}</p>
          </div>
        )
      })}
    </div>
  )
}
