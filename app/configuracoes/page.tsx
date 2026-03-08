"use client"

import { lazy, Suspense, useState } from "react"
import {
  Building2,
  Clock,
  CreditCard,
  Crown,
  Settings,
  Truck,
} from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import AdminLayout from "@/components/admin-layout"
import { cn } from "@/lib/utils"

// Lazy-loaded tab contents
const StoreTab = lazy(() => import("@/components/settings/store-tab"))
const OperationTab = lazy(() => import("@/components/settings/operation-tab"))
const PaymentsTab = lazy(() => import("@/components/settings/payments-tab"))
const DeliveryTab = lazy(() => import("@/components/settings/delivery-tab"))
const PlanTab = lazy(() => import("@/components/settings/plan-tab"))

const tabs = [
  { value: "store", label: "Dados da Loja", icon: <Building2 className="h-4 w-4" /> },
  { value: "operation", label: "Funcionamento", icon: <Clock className="h-4 w-4" /> },
  { value: "payments", label: "Pagamentos", icon: <CreditCard className="h-4 w-4" /> },
  { value: "delivery", label: "Entrega", icon: <Truck className="h-4 w-4" /> },
  { value: "plan", label: "Plano", icon: <Crown className="h-4 w-4" /> },
] as const

function TabSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-6">
        <Skeleton className="h-5 w-48 mb-5" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Skeleton className="h-3 w-24 mb-2" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div>
            <Skeleton className="h-3 w-24 mb-2" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div>
            <Skeleton className="h-3 w-24 mb-2" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div>
            <Skeleton className="h-3 w-24 mb-2" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card p-6">
        <Skeleton className="h-5 w-40 mb-5" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    </div>
  )
}

export default function ConfiguracoesPage() {
  const [activeTab, setActiveTab] = useState("store")

  return (
    <AdminLayout>
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--primary))]/10">
              <Settings className="h-5 w-5 text-[hsl(var(--primary))]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">Configuracoes</h1>
              <p className="text-sm text-muted-foreground">Gerencie todas as configuracoes do seu restaurante</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-8 flex h-auto w-full flex-wrap gap-1 rounded-xl bg-muted/50 p-1.5">
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all",
                  "data-[state=active]:bg-card data-[state=active]:text-[hsl(var(--primary))] data-[state=active]:shadow-sm"
                )}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="store">
            <Suspense fallback={<TabSkeleton />}>
              <StoreTab />
            </Suspense>
          </TabsContent>

          <TabsContent value="operation">
            <Suspense fallback={<TabSkeleton />}>
              <OperationTab />
            </Suspense>
          </TabsContent>

          <TabsContent value="payments">
            <Suspense fallback={<TabSkeleton />}>
              <PaymentsTab />
            </Suspense>
          </TabsContent>

          <TabsContent value="delivery">
            <Suspense fallback={<TabSkeleton />}>
              <DeliveryTab />
            </Suspense>
          </TabsContent>

          <TabsContent value="plan">
            <Suspense fallback={<TabSkeleton />}>
              <PlanTab />
            </Suspense>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  )
}
