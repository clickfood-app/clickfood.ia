"use client"

import React, { useState, useEffect, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import AdminLayout from "@/components/admin-layout"
import { QRCodeSVG } from "qrcode.react"
import { 
  Users, 
  QrCode, 
  Receipt, 
  CheckCircle, 
  Clock, 
  X,
  CreditCard,
  Wallet
} from "lucide-react"
import { formatPrice } from "@/lib/menu-data"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

// Número total de mesas do restaurante
const TOTAL_MESAS = 20

export default function MesasPage() {
  const supabase = useMemo(() => createClient(), [])
  const { toast } = useToast()

  const [restaurant, setRestaurant] = useState<any>(null)
  const [activeOrders, setActiveOrders] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Estados dos Modais
  const [qrCodeModal, setQrCodeModal] = useState<{ isOpen: boolean; mesa: number | null }>({ isOpen: false, mesa: null })
  const [comandaModal, setComandaModal] = useState<{ isOpen: boolean; order: any | null; mesa: number | null }>({ isOpen: false, order: null, mesa: null })
  const [isClosing, setIsClosing] = useState(false)

  // URL base para o QR Code
  const baseUrl = typeof window !== "undefined" ? window.location.origin : ""

  // Carregar restaurante e comandas ativas
  const fetchData = async () => {
    setIsLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    
    if (user) {
      // 1. Buscar Restaurante
      const { data: restData } = await supabase
        .from("restaurants")
        .select("*")
        .eq("owner_id", user.id)
        .single()
      
      if (restData) {
        setRestaurant(restData)

        // 2. Buscar Pedidos Ativos (não finalizados) vinculados a mesas
        const { data: ordersData, error: ordersError } = await supabase
          .from("orders")
          .select("*, items:order_items(*)")
          .eq("restaurant_id", restData.id)
          .not("table_id", "is", null)
          .in("status", ["pending", "preparing", "delivering"])
        
        if (ordersError) {
          console.error("Erro ao buscar comandas:", ordersError)
        }

        if (ordersData) {
          setActiveOrders(ordersData)
        }
      }
    }
    setIsLoading(false)
  }

  useEffect(() => {
    fetchData()

    // Opcional: Atualizar a cada 10 segundos automaticamente
    const interval = setInterval(() => {
      fetchData()
    }, 10000)
    
    return () => clearInterval(interval)
  }, [supabase])

  // Função para Encerrar a Comanda
  const handleEncerrarComanda = async (paymentStatus: "pago" | "pendente") => {
    if (!comandaModal.order) return
    setIsClosing(true)

    const { error } = await supabase
      .from("orders")
      .update({ 
        status: "completed", 
        payment_status: paymentStatus 
      })
      .eq("id", comandaModal.order.id)

    if (error) {
      toast({
        title: "Erro ao encerrar",
        description: error.message,
        variant: "destructive"
      })
    } else {
      toast({
        title: "Mesa Encerrada",
        description: `A comanda da Mesa ${comandaModal.mesa} foi finalizada com sucesso!`,
      })
      setComandaModal({ isOpen: false, order: null, mesa: null })
      fetchData() // Recarrega o salão para zerar a mesa instantaneamente
    }
    
    setIsClosing(false)
  }

  // Gera o array de mesas [1, 2, 3... 20]
  const mesas = Array.from({ length: TOTAL_MESAS }, (_, i) => i + 1)

  return (
    <AdminLayout title="Gestão de Mesas" description="Controle as comandas e gere os QR Codes do salão.">
      <div className="space-y-6">
        
        {/* Legenda */}
        <div className="flex gap-4 mb-6">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm"></span> Livre
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <span className="w-3 h-3 rounded-full bg-rose-500 shadow-sm"></span> Ocupada
          </div>
        </div>

        {/* Grid do Salão */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {mesas.map((numeroMesa) => {
            // Verifica se existe alguma comanda ativa para esta mesa
            const orderForTable = activeOrders.find(o => String(o.table_id) === String(numeroMesa))
            const isOcupada = !!orderForTable

            return (
              <div 
                key={numeroMesa}
                onClick={() => {
                  if (isOcupada) {
                    setComandaModal({ isOpen: true, order: orderForTable, mesa: numeroMesa })
                  } else {
                    toast({
                      title: `Mesa ${numeroMesa} Livre`,
                      description: "Nenhum cliente consumindo nesta mesa no momento.",
                    })
                  }
                }}
                className={cn(
                  "relative p-5 rounded-2xl border transition-all shadow-sm flex flex-col items-center justify-center text-center h-40 cursor-pointer",
                  isOcupada 
                    ? "bg-rose-50 border-rose-200 hover:shadow-md hover:-translate-y-1" 
                    : "bg-white border-slate-200 hover:border-emerald-300 hover:shadow-md hover:-translate-y-1"
                )}
              >
                {/* Botão de QR Code no canto (para não abrir a comanda ao clicar no QR Code, usamos e.stopPropagation()) */}
                <button 
                  onClick={(e) => {
                    e.stopPropagation()
                    setQrCodeModal({ isOpen: true, mesa: numeroMesa })
                  }}
                  className="absolute top-3 right-3 p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition z-10"
                  title="Ver QR Code"
                >
                  <QrCode className="w-4 h-4" />
                </button>

                <h3 className={cn("text-3xl font-black mb-1", isOcupada ? "text-rose-900" : "text-slate-800")}>
                  {numeroMesa}
                </h3>
                
                {isOcupada ? (
                  <>
                    <p className="text-[10px] font-bold text-rose-600 uppercase tracking-widest mb-1">Ocupada</p>
                    <p className="text-sm font-black text-rose-700 mb-2">{formatPrice(orderForTable.total)}</p>
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-rose-600 text-white text-xs font-bold rounded-lg w-full justify-center">
                      <Receipt className="w-3.5 h-3.5" />
                      Ver Comanda
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Livre</p>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* MODAL DO QR CODE */}
      {qrCodeModal.isOpen && restaurant && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center relative animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setQrCodeModal({ isOpen: false, mesa: null })}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:bg-slate-100 rounded-full transition"
            >
              <X className="w-5 h-5" />
            </button>
            
            <h2 className="text-2xl font-black text-slate-900 mb-2">Mesa {qrCodeModal.mesa}</h2>
            <p className="text-sm text-slate-500 mb-6">Imprima este QR Code para o cliente acessar o cardápio desta mesa.</p>
            
            <div className="bg-white p-4 rounded-2xl inline-block border-2 border-slate-100 shadow-sm mb-6">
              <QRCodeSVG 
                value={`${baseUrl}/cardapio/${restaurant.slug}?mesa=${qrCodeModal.mesa}`} 
                size={200}
                level="H"
                includeMargin={false}
              />
            </div>
            
            <button 
              onClick={() => window.print()}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition"
            >
              Imprimir QR Code
            </button>
          </div>
        </div>
      )}

      {/* MODAL DA COMANDA (ENCERRAR MESA) */}
      {comandaModal.isOpen && comandaModal.order && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-8 duration-300">
            
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <div>
                <h2 className="text-xl font-black text-slate-900">Comanda - Mesa {comandaModal.mesa}</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Cliente: <span className="font-semibold text-slate-700">{comandaModal.order.customer?.name || "Não informado"}</span>
                </p>
              </div>
              <button 
                onClick={() => setComandaModal({ isOpen: false, order: null, mesa: null })}
                className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 bg-slate-50">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Itens Consumidos</h3>
              <div className="space-y-3">
                {comandaModal.order.items?.map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-start bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                    <div>
                      <p className="font-bold text-slate-900">
                        <span className="text-blue-600 mr-2">{item.quantity}x</span> 
                        {item.name || "Item do Cardápio"}
                      </p>
                      {item.observation && (
                        <p className="text-xs text-slate-500 mt-1">Obs: {item.observation}</p>
                      )}
                    </div>
                    <span className="font-bold text-slate-700">
                      {formatPrice(item.price * item.quantity)}
                    </span>
                  </div>
                ))}
                
                {(!comandaModal.order.items || comandaModal.order.items.length === 0) && (
                  <p className="text-center text-slate-500 text-sm py-4">Nenhum item detalhado encontrado nesta comanda.</p>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-white rounded-b-3xl shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)]">
              <div className="flex justify-between items-center mb-6">
                <span className="text-slate-500 font-bold uppercase tracking-wider text-sm">Total a cobrar</span>
                <span className="text-3xl font-black text-rose-600">{formatPrice(comandaModal.order.total)}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => handleEncerrarComanda("pago")}
                  disabled={isClosing}
                  className="flex items-center justify-center gap-2 py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl transition disabled:opacity-50"
                >
                  <Wallet className="w-4 h-4" />
                  Pagar e Encerrar
                </button>
                <button 
                  onClick={() => handleEncerrarComanda("pendente")}
                  disabled={isClosing}
                  className="flex items-center justify-center gap-2 py-3.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl transition disabled:opacity-50"
                >
                  <Clock className="w-4 h-4" />
                  Encerrar Pendente
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </AdminLayout>
  )
}