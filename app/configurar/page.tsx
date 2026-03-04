"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth/auth-provider"
import { markRestaurantConfigured } from "@/lib/auth"
import ImageUpload from "@/components/image-upload"
import {
  Store,
  MapPin,
  Phone,
  Clock,
  Plus,
  Trash2,
  Package,
  Truck,
  Building2,
  MessageSquare,
  ChevronRight,
  Loader2,
  X,
  DollarSign,
} from "lucide-react"
import { cn } from "@/lib/utils"

// Types
interface BusinessHours {
  id: string
  day: string
  enabled: boolean
  openTime: string
  closeTime: string
}

interface Product {
  id: string
  name: string
  price: number
  description: string
}

type ServiceType = "delivery" | "pickup" | "both"

// Default business hours
const DEFAULT_HOURS: BusinessHours[] = [
  { id: "1", day: "Segunda", enabled: true, openTime: "11:00", closeTime: "22:00" },
  { id: "2", day: "Terca", enabled: true, openTime: "11:00", closeTime: "22:00" },
  { id: "3", day: "Quarta", enabled: true, openTime: "11:00", closeTime: "22:00" },
  { id: "4", day: "Quinta", enabled: true, openTime: "11:00", closeTime: "22:00" },
  { id: "5", day: "Sexta", enabled: true, openTime: "11:00", closeTime: "23:00" },
  { id: "6", day: "Sabado", enabled: true, openTime: "11:00", closeTime: "23:00" },
  { id: "7", day: "Domingo", enabled: true, openTime: "12:00", closeTime: "21:00" },
]

export default function ConfigurarPage() {
  const router = useRouter()
  const { user, restaurant } = useAuth()

  // Form state
  const [logo, setLogo] = useState<string | null>(null)
  const [restaurantName, setRestaurantName] = useState(restaurant?.name || "")
  const [address, setAddress] = useState("")
  const [phone, setPhone] = useState("")
  const [businessHours, setBusinessHours] = useState<BusinessHours[]>(DEFAULT_HOURS)

  // Products
  const [products, setProducts] = useState<Product[]>([])
  const [showProductModal, setShowProductModal] = useState(false)
  const [newProduct, setNewProduct] = useState({ name: "", price: "", description: "" })

  // Settings
  const [serviceType, setServiceType] = useState<ServiceType>("both")
  const [deliveryFee, setDeliveryFee] = useState("")
  const [welcomeMessage, setWelcomeMessage] = useState("")

  // UI state
  const [isSaving, setIsSaving] = useState(false)
  const [currentStep, setCurrentStep] = useState(1)
  const totalSteps = 2

  // Business hours handlers
  const toggleDay = useCallback((id: string) => {
    setBusinessHours((prev) =>
      prev.map((h) => (h.id === id ? { ...h, enabled: !h.enabled } : h))
    )
  }, [])

  const updateHours = useCallback((id: string, field: "openTime" | "closeTime", value: string) => {
    setBusinessHours((prev) =>
      prev.map((h) => (h.id === id ? { ...h, [field]: value } : h))
    )
  }, [])

  // Product handlers
  const addProduct = useCallback(() => {
    if (!newProduct.name.trim() || !newProduct.price) return

    const product: Product = {
      id: Date.now().toString(),
      name: newProduct.name.trim(),
      price: parseFloat(newProduct.price),
      description: newProduct.description.trim(),
    }

    setProducts((prev) => [...prev, product])
    setNewProduct({ name: "", price: "", description: "" })
    setShowProductModal(false)
  }, [newProduct])

  const removeProduct = useCallback((id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id))
  }, [])

  // Save handler
  const handleSave = useCallback(async () => {
    setIsSaving(true)

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500))

    // In real implementation, save to database here
    console.log({
      logo,
      restaurantName,
      address,
      phone,
      businessHours,
      products,
      serviceType,
      deliveryFee,
      welcomeMessage,
    })

    // Mark restaurant as configured to unlock dashboard access
    markRestaurantConfigured()

    setIsSaving(false)
    router.push("/dashboard")
  }, [logo, restaurantName, address, phone, businessHours, products, serviceType, deliveryFee, welcomeMessage, router])

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto max-w-3xl px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-slate-900">Configurar Restaurante</h1>
              <p className="text-sm text-slate-500">Passo {currentStep} de {totalSteps}</p>
            </div>
            {/* Progress indicator */}
            <div className="flex items-center gap-2">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "h-2 w-8 rounded-full transition-colors",
                    i + 1 <= currentStep ? "bg-blue-600" : "bg-slate-200"
                  )}
                />
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        {/* Welcome message */}
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-bold text-slate-900">
            Ola{user?.name ? `, ${user.name.split(" ")[0]}` : ""}! Vamos configurar seu restaurante
          </h2>
          <p className="mt-2 text-slate-600">
            Complete as informacoes abaixo para comecar a receber pedidos.
          </p>
        </div>

        {currentStep === 1 && (
          <div className="space-y-6">
            {/* Logo Section */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                  <Store className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">Logo do Restaurante</h3>
                  <p className="text-sm text-slate-500">Adicione o logo que aparecera no cardapio</p>
                </div>
              </div>
              <ImageUpload value={logo} onChange={setLogo} />
            </section>

            {/* Restaurant Info Section */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">Informacoes do Restaurante</h3>
                  <p className="text-sm text-slate-500">Dados basicos do seu estabelecimento</p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Nome do restaurante *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Store className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                      type="text"
                      value={restaurantName}
                      onChange={(e) => setRestaurantName(e.target.value)}
                      placeholder="Ex: Pizzaria do Joao"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 transition-all focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>

                {/* Address */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Endereco completo *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <MapPin className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Rua, numero, bairro, cidade"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 transition-all focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Telefone de contato *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Phone className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(00) 00000-0000"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 transition-all focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Business Hours Section */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">Horario de Funcionamento</h3>
                  <p className="text-sm text-slate-500">Configure os horarios de cada dia</p>
                </div>
              </div>

              <div className="space-y-3">
                {businessHours.map((hours) => (
                  <div
                    key={hours.id}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors",
                      hours.enabled
                        ? "border-slate-200 bg-white"
                        : "border-slate-100 bg-slate-50"
                    )}
                  >
                    {/* Toggle */}
                    <button
                      onClick={() => toggleDay(hours.id)}
                      className={cn(
                        "flex h-5 w-9 items-center rounded-full transition-colors",
                        hours.enabled ? "bg-blue-600" : "bg-slate-300"
                      )}
                    >
                      <span
                        className={cn(
                          "h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
                          hours.enabled ? "translate-x-4" : "translate-x-0.5"
                        )}
                      />
                    </button>

                    {/* Day */}
                    <span
                      className={cn(
                        "w-20 text-sm font-medium",
                        hours.enabled ? "text-slate-900" : "text-slate-400"
                      )}
                    >
                      {hours.day}
                    </span>

                    {/* Times */}
                    {hours.enabled ? (
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="time"
                          value={hours.openTime}
                          onChange={(e) => updateHours(hours.id, "openTime", e.target.value)}
                          className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                        <span className="text-slate-400">ate</span>
                        <input
                          type="time"
                          value={hours.closeTime}
                          onChange={(e) => updateHours(hours.id, "closeTime", e.target.value)}
                          className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>
                    ) : (
                      <span className="text-sm text-slate-400 italic">Fechado</span>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Next button */}
            <button
              onClick={() => setCurrentStep(2)}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-4 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-700 active:scale-[0.98]"
            >
              Continuar
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-6">
            {/* Products Section */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                    <Package className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">Adicionar Produtos</h3>
                    <p className="text-sm text-slate-500">Opcional - voce pode adicionar depois</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowProductModal(true)}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-100 px-3 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-200"
                >
                  <Plus className="h-4 w-4" />
                  Adicionar
                </button>
              </div>

              {products.length > 0 ? (
                <div className="space-y-2">
                  {products.map((product) => (
                    <div
                      key={product.id}
                      className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
                    >
                      <div>
                        <p className="font-medium text-slate-900">{product.name}</p>
                        {product.description && (
                          <p className="text-sm text-slate-500">{product.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-blue-600">
                          {formatPrice(product.price)}
                        </span>
                        <button
                          onClick={() => removeProduct(product.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-100 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 py-8 text-center">
                  <Package className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="mt-2 text-sm text-slate-500">
                    Nenhum produto adicionado ainda
                  </p>
                </div>
              )}
            </section>

            {/* Settings Section */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                  <Truck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">Configuracoes Adicionais</h3>
                  <p className="text-sm text-slate-500">Tipo de atendimento e taxas</p>
                </div>
              </div>

              <div className="space-y-5">
                {/* Service Type */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Tipo de atendimento
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: "delivery", label: "Delivery", icon: Truck },
                      { value: "pickup", label: "Balcao", icon: Building2 },
                      { value: "both", label: "Ambos", icon: Store },
                    ].map(({ value, label, icon: Icon }) => (
                      <button
                        key={value}
                        onClick={() => setServiceType(value as ServiceType)}
                        className={cn(
                          "flex flex-col items-center gap-2 rounded-xl border-2 py-4 transition-all",
                          serviceType === value
                            ? "border-blue-600 bg-blue-50 text-blue-700"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                        )}
                      >
                        <Icon className="h-5 w-5" />
                        <span className="text-sm font-medium">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Delivery Fee */}
                {(serviceType === "delivery" || serviceType === "both") && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Taxa de entrega (opcional)
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <DollarSign className="h-4 w-4 text-slate-400" />
                      </div>
                      <input
                        type="number"
                        step="0.01"
                        value={deliveryFee}
                        onChange={(e) => setDeliveryFee(e.target.value)}
                        placeholder="0,00"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 transition-all focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                  </div>
                )}

                {/* Welcome Message */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Mensagem de boas-vindas (opcional)
                  </label>
                  <div className="relative">
                    <div className="absolute top-3 left-3.5 pointer-events-none">
                      <MessageSquare className="h-4 w-4 text-slate-400" />
                    </div>
                    <textarea
                      value={welcomeMessage}
                      onChange={(e) => setWelcomeMessage(e.target.value)}
                      placeholder="Ex: Obrigado por escolher nosso restaurante!"
                      rows={3}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 transition-all focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setCurrentStep(1)}
                className="flex-1 rounded-xl border border-slate-200 bg-white py-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                Voltar
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || !restaurantName.trim()}
                className="flex-[2] flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-4 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  "Salvar e continuar"
                )}
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Product Modal */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-900">Adicionar Produto</h3>
              <button
                onClick={() => setShowProductModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Nome do produto *
                </label>
                <input
                  type="text"
                  value={newProduct.name}
                  onChange={(e) => setNewProduct((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Ex: X-Bacon"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 transition-all focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Preco *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <span className="text-sm text-slate-400">R$</span>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    value={newProduct.price}
                    onChange={(e) => setNewProduct((p) => ({ ...p, price: e.target.value }))}
                    placeholder="0,00"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 transition-all focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Descricao (opcional)
                </label>
                <textarea
                  value={newProduct.description}
                  onChange={(e) => setNewProduct((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Descreva seu produto..."
                  rows={2}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 transition-all focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowProductModal(false)}
                className="flex-1 rounded-xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={addProduct}
                disabled={!newProduct.name.trim() || !newProduct.price}
                className="flex-1 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white transition-all hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
