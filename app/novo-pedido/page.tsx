"use client"

import { useState, useCallback, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import AdminLayout from "@/components/admin-layout"
import OrderTypeSelector from "@/components/manual-order/order-type-selector"
import TableSelector from "@/components/manual-order/table-selector"
import ProductSearch from "@/components/manual-order/product-search"
import OrderSummary from "@/components/manual-order/order-summary"
// import PaymentSelector from "@/components/manual-order/payment-selector" // Você pode remover/comentar esse componente se não for mais usar em outro lugar
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
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
import { ShoppingCart, User, MapPin, Check, Wallet, QrCode, CreditCard, Clock, X } from "lucide-react"

export default function NovoPedidoPage() {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = useMemo(() => createClient(), [])

  // Order state
  const [orderType, setOrderType] = useState<OrderType>("local")
  const [selectedTable, setSelectedTable] = useState<string>("")
  const [tables, setTables] = useState<Table[]>(initialTables)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("pending")
  const [items, setItems] = useState<OrderItem[]>([])
  const [discount, setDiscount] = useState(0)
  const [deliveryFee] = useState(8.0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // NOVO ESTADO: Controle do Modal de Pagamento
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)

  // NOVO ESTADO: ID do Restaurante logado
  const [restaurantId, setRestaurantId] = useState<string>("")

  // Busca o ID do restaurante logado
  useEffect(() => {
    const fetchRestaurant = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase
          .from("restaurants")
          .select("id")
          .eq("owner_id", user.id)
          .single()
        if (data) setRestaurantId(data.id)
      }
    }
    fetchRestaurant()
  }, [supabase])

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

  // Products data
  const [products] = useState<Product[]>(initialProducts)
  const [categories] = useState(initialCategories)

  // Opções de Pagamento para o Modal
  const paymentOptions = [
    { id: 'dinheiro', name: 'Dinheiro', icon: <Wallet className="h-8 w-8 mb-2" /> },
    { id: 'pix', name: 'PIX', icon: <QrCode className="h-8 w-8 mb-2" /> },
    { id: 'credito', name: 'Crédito', icon: <CreditCard className="h-8 w-8 mb-2" /> },
    { id: 'debito', name: 'Débito', icon: <CreditCard className="h-8 w-8 mb-2" /> },
    { id: 'pending', name: 'Pendente', icon: <Clock className="h-8 w-8 mb-2" /> },
  ]

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
    setIsPaymentModalOpen(false) // Fecha o modal ao iniciar o envio

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000))

    const orderStatus = orderType === "delivery" ? "delivering" : "preparing"

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
          <div className="mb-6">
            <h1 className="text-xl font-bold text-foreground">Novo Pedido</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Crie um pedido manualmente para mesa, balcao ou delivery.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <div className="xl:col-span-2 space-y-6">
              <div className="rounded-xl border border-border bg-card p-5">
                <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                  Tipo de Pedido
                </h2>
                <OrderTypeSelector value={orderType} onChange={setOrderType} />
              </div>

              {orderType === "local" && (
                <div className="rounded-xl border border-border bg-card p-5">
                  <TableSelector
                    tables={tables}
                    value={selectedTable}
                    onChange={setSelectedTable}
                    onCreateTable={handleCreateTable}
                    restaurantId={restaurantId}
                  />
                </div>
              )}

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

              <div className="rounded-xl border border-border bg-card p-5">
                <h2 className="text-sm font-semibold text-foreground mb-4">Adicionar Produtos</h2>
                <ProductSearch
                  products={products}
                  categories={categories}
                  onAddProduct={handleAddProduct}
                />
              </div>
            </div>

            <div className="xl:col-span-1">
              <div className="sticky top-6 rounded-xl border border-border bg-card p-5 flex flex-col h-[calc(100vh-100px)]">
                <h2 className="text-sm font-semibold text-foreground mb-4">Resumo do Pedido</h2>
                
                <div className="flex-1 overflow-hidden min-h-[320px]">
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

                <div className="mt-4 pt-4 border-t border-border">
                  <button
                    onClick={() => setIsPaymentModalOpen(true)}
                    disabled={!canSubmit() || isSubmitting}
                    className={cn(
                      "flex w-full items-center justify-center gap-2 rounded-lg py-4 text-sm font-bold transition-all shadow-md",
                      canSubmit() && !isSubmitting
                        ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary))]/90"
                        : "bg-muted text-muted-foreground cursor-not-allowed"
                    )}
                  >
                    Cobrar Pedido
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
      </div>

      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm transition-opacity">
          <div className="bg-card border border-border w-full max-w-2xl rounded-2xl shadow-2xl p-8 transform transition-all">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="text-2xl font-bold text-foreground">Forma de Pagamento</h3>
                <p className="text-muted-foreground mt-1">Selecione como o cliente deseja pagar</p>
              </div>
              <button 
                onClick={() => setIsPaymentModalOpen(false)}
                className="text-muted-foreground hover:text-foreground p-2 rounded-full hover:bg-accent transition"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="bg-accent/50 border border-border rounded-xl p-6 text-center mb-8">
              <span className="block text-muted-foreground text-sm font-semibold uppercase tracking-wider mb-1">Total a Cobrar</span>
              <span className="text-4xl font-bold text-foreground">R$ {total.toFixed(2).replace('.', ',')}</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
              {paymentOptions.map((method) => (
                <button
                  key={method.id}
                  onClick={() => setPaymentMethod(method.id as PaymentMethod)}
                  className={`flex flex-col items-center justify-center p-6 rounded-xl border-2 transition-all duration-200 ${
                    paymentMethod === method.id
                      ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] shadow-sm'
                      : 'border-border hover:border-border/80 hover:bg-accent text-muted-foreground'
                  }`}
                >
                  {method.icon}
                  <span className="font-semibold">{method.name}</span>
                </button>
              ))}
            </div>

            <div className="flex justify-end gap-4 border-t border-border pt-6">
              <button 
                onClick={() => setIsPaymentModalOpen(false)}
                className="px-6 py-3 font-semibold text-muted-foreground hover:bg-accent rounded-xl transition"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-8 py-3 font-bold text-[hsl(var(--primary-foreground))] bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90 rounded-xl transition shadow-md flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Check className="h-5 w-5" />
                    Confirmar e Finalizar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}