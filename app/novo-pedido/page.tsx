"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import AdminLayout from "@/components/admin-layout"
import OrderTypeSelector from "@/components/manual-order/order-type-selector"
import TableSelector from "@/components/manual-order/table-selector"
import ProductSearch from "@/components/manual-order/product-search"
import OrderSummary from "@/components/manual-order/order-summary"
import PaymentSelector from "@/components/manual-order/payment-selector"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { initialProducts, initialCategories, type Product } from "@/lib/products-data"
import {
  type OrderType,
  type PaymentMethod,
  type OrderItem,
  type Table,
  type CustomerData,
  type DeliveryAddress,
  initialTables,
} from "@/lib/order-types"
import { ShoppingCart, User, MapPin, Check } from "lucide-react"

export default function NovoPedidoPage() {
  const router = useRouter()
  const { toast } = useToast()

  // Order state
  const [orderType, setOrderType] = useState<OrderType>("local")
  const [selectedTable, setSelectedTable] = useState<string>("")
  const [tables, setTables] = useState<Table[]>(initialTables)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("pending")
  const [items, setItems] = useState<OrderItem[]>([])
  const [discount, setDiscount] = useState(0)
  const [deliveryFee] = useState(8.0)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Customer data
  const [customer, setCustomer] = useState<CustomerData>({
    name: "",
    phone: "",
    observation: "",
  })

  // Delivery address
  const [address, setAddress] = useState<DeliveryAddress>({
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    zipCode: "",
  })

  // Products data (would come from props/API)
  const [products] = useState<Product[]>(initialProducts)
  const [categories] = useState(initialCategories)

  // Add product to order
  const handleAddProduct = useCallback((product: Product) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === product.id)
      if (existing) {
        return prev.map((i) =>
          i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i
        )
      }
      return [
        ...prev,
        {
          id: `item-${Date.now()}`,
          productId: product.id,
          name: product.name,
          price: product.price,
          quantity: 1,
          observation: "",
        },
      ]
    })
  }, [])

  // Update item quantity
  const handleUpdateQuantity = useCallback((itemId: string, quantity: number) => {
    setItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, quantity } : i))
    )
  }, [])

  // Update item observation
  const handleUpdateObservation = useCallback((itemId: string, observation: string) => {
    setItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, observation } : i))
    )
  }, [])

  // Remove item
  const handleRemoveItem = useCallback((itemId: string) => {
    setItems((prev) => prev.filter((i) => i.id !== itemId))
  }, [])

  // Create new table
  const handleCreateTable = useCallback((table: Omit<Table, "id">) => {
    const newTable: Table = {
      ...table,
      id: `table-${Date.now()}`,
    }
    setTables((prev) => [...prev, newTable])
    setSelectedTable(newTable.id)
  }, [])

  // Calculate total
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const finalDeliveryFee = orderType === "delivery" ? deliveryFee : 0
  const total = Math.max(0, subtotal + finalDeliveryFee - discount)

  // Validate form
  const canSubmit = () => {
    if (items.length === 0) return false
    if (orderType === "local" && !selectedTable) return false
    if (orderType === "delivery") {
      if (!address.street || !address.number || !address.neighborhood) return false
    }
    return true
  }

  // Submit order
  const handleSubmit = async () => {
    if (!canSubmit()) return

    setIsSubmitting(true)

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000))

    const orderStatus = orderType === "delivery" ? "delivering" : "preparing"

    // Here you would send to your API/Supabase
    const order = {
      type: orderType,
      tableId: orderType === "local" ? selectedTable : undefined,
      customer,
      address: orderType === "delivery" ? address : undefined,
      items,
      subtotal,
      deliveryFee: finalDeliveryFee,
      discount,
      total,
      paymentMethod,
      status: orderStatus,
      createdAt: new Date(),
    }

    console.log("[v0] Order created:", order)

    toast({
      title: "Pedido criado com sucesso!",
      description: `Pedido #${Date.now().toString().slice(-6)} foi enviado para a cozinha.`,
    })

    setIsSubmitting(false)
    router.push("/pedidos")
  }

  return (
    <AdminLayout>
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-7xl">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-xl font-bold text-foreground">Novo Pedido</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Crie um pedido manualmente para mesa, balcao ou delivery.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            {/* Left Column - Order Details */}
            <div className="xl:col-span-2 space-y-6">
              {/* Order Type */}
              <div className="rounded-xl border border-border bg-card p-5">
                <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                  Tipo de Pedido
                </h2>
                <OrderTypeSelector value={orderType} onChange={setOrderType} />
              </div>

              {/* Table Selection (for local) */}
              {orderType === "local" && (
                <div className="rounded-xl border border-border bg-card p-5">
                  <TableSelector
                    tables={tables}
                    value={selectedTable}
                    onChange={setSelectedTable}
                    onCreateTable={handleCreateTable}
                  />
                </div>
              )}

              {/* Customer Data */}
              <div className="rounded-xl border border-border bg-card p-5">
                <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  Dados do Cliente
                </h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Nome</label>
                    <input
                      type="text"
                      value={customer.name}
                      onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                      placeholder="Nome do cliente"
                      className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Telefone</label>
                    <input
                      type="tel"
                      value={customer.phone}
                      onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                      placeholder="(00) 00000-0000"
                      className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      Observacao do Pedido
                    </label>
                    <textarea
                      value={customer.observation || ""}
                      onChange={(e) => setCustomer({ ...customer, observation: e.target.value })}
                      placeholder="Observacoes gerais do pedido..."
                      rows={2}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Delivery Address (for delivery) */}
              {orderType === "delivery" && (
                <div className="rounded-xl border border-border bg-card p-5">
                  <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    Endereco de Entrega
                  </h2>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-foreground mb-1.5">
                        Rua <span className="text-destructive">*</span>
                      </label>
                      <input
                        type="text"
                        value={address.street}
                        onChange={(e) => setAddress({ ...address, street: e.target.value })}
                        placeholder="Nome da rua"
                        className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1.5">
                        Numero <span className="text-destructive">*</span>
                      </label>
                      <input
                        type="text"
                        value={address.number}
                        onChange={(e) => setAddress({ ...address, number: e.target.value })}
                        placeholder="123"
                        className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1.5">Complemento</label>
                      <input
                        type="text"
                        value={address.complement || ""}
                        onChange={(e) => setAddress({ ...address, complement: e.target.value })}
                        placeholder="Apto, bloco..."
                        className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1.5">
                        Bairro <span className="text-destructive">*</span>
                      </label>
                      <input
                        type="text"
                        value={address.neighborhood}
                        onChange={(e) => setAddress({ ...address, neighborhood: e.target.value })}
                        placeholder="Bairro"
                        className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1.5">Cidade</label>
                      <input
                        type="text"
                        value={address.city}
                        onChange={(e) => setAddress({ ...address, city: e.target.value })}
                        placeholder="Cidade"
                        className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Products Search */}
              <div className="rounded-xl border border-border bg-card p-5">
                <h2 className="text-sm font-semibold text-foreground mb-4">Adicionar Produtos</h2>
                <ProductSearch
                  products={products}
                  categories={categories}
                  onAddProduct={handleAddProduct}
                />
              </div>
            </div>

            {/* Right Column - Order Summary */}
            <div className="xl:col-span-1">
              <div className="sticky top-6 rounded-xl border border-border bg-card p-5">
                <h2 className="text-sm font-semibold text-foreground mb-4">Resumo do Pedido</h2>
                
                <div className="h-[320px]">
                  <OrderSummary
                    items={items}
                    orderType={orderType}
                    deliveryFee={deliveryFee}
                    discount={discount}
                    onUpdateQuantity={handleUpdateQuantity}
                    onUpdateObservation={handleUpdateObservation}
                    onRemoveItem={handleRemoveItem}
                    onDiscountChange={setDiscount}
                  />
                </div>

                {/* Payment Method */}
                <div className="mt-6 pt-4 border-t border-border">
                  <PaymentSelector value={paymentMethod} onChange={setPaymentMethod} />
                </div>

                {/* Submit Button */}
                <button
                  onClick={handleSubmit}
                  disabled={!canSubmit() || isSubmitting}
                  className={cn(
                    "mt-6 flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold transition-all",
                    canSubmit() && !isSubmitting
                      ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary))]/90"
                      : "bg-muted text-muted-foreground cursor-not-allowed"
                  )}
                >
                  {isSubmitting ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Criando pedido...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      Criar Pedido
                    </>
                  )}
                </button>

                {!canSubmit() && items.length > 0 && (
                  <p className="mt-2 text-xs text-center text-muted-foreground">
                    {orderType === "local" && !selectedTable && "Selecione uma mesa"}
                    {orderType === "delivery" && (!address.street || !address.number || !address.neighborhood) && "Preencha o endereco completo"}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
