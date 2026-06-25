"use client"

import React, { useState } from "react"
import { Wallet, QrCode, CreditCard, Clock, X } from "lucide-react"

// Tipagem para as props (se você for passar o total do pedido via props depois)
interface PaymentPanelProps {
  total: number;
}

export default function PaymentPanel({ total = 0 }: PaymentPanelProps) {
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null)

  const paymentMethods = [
    { id: 'dinheiro', name: 'Dinheiro', icon: <Wallet className="h-8 w-8 mb-2" /> },
    { id: 'pix', name: 'PIX', icon: <QrCode className="h-8 w-8 mb-2" /> },
    { id: 'credito', name: 'Crédito', icon: <CreditCard className="h-8 w-8 mb-2" /> },
    { id: 'debito', name: 'Débito', icon: <CreditCard className="h-8 w-8 mb-2" /> },
    { id: 'pendente', name: 'Pendente', icon: <Clock className="h-8 w-8 mb-2" /> },
  ]

  const handleConfirmPayment = () => {
    console.log(`Pagamento confirmado via: ${selectedMethod}`)
    // Aqui entrará a integração com o Supabase para salvar o pedido
    setIsPaymentModalOpen(false)
    setSelectedMethod(null)
  }

  return (
    <>
      {/* PAINEL DIREITO: RESUMO DO PEDIDO */}
      <div className="w-96 bg-[#0A0A0A] border-l border-white/10 flex flex-col shadow-sm h-full">
        <div className="p-6 flex-1 flex flex-col">
          <h2 className="text-lg font-semibold text-white mb-6">Resumo do Pedido</h2>
          
          {/* Lista de Itens (Simulada para visualização) */}
          <div className="flex-1 overflow-y-auto bg-[#111111] rounded-lg flex items-center justify-center border border-dashed border-white/10">
            <span className="text-zinc-500">Nenhum item adicionado</span>
          </div>

          {/* Área de Totais */}
          <div className="mt-6 pt-6 border-t border-white/10">
            <div className="flex justify-between text-zinc-500 mb-3">
              <span>Subtotal</span>
              <span>R$ {total.toFixed(2).replace('.', ',')}</span>
            </div>
            <div className="flex justify-between text-zinc-500 mb-4">
              <span>Desconto</span>
              <span className="text-zinc-500">R$ 0,00</span>
            </div>
            
            <div className="flex justify-between items-center mb-8">
              <span className="text-xl font-bold text-white">Total</span>
              <span className="text-2xl font-bold text-[#2563EB]">R$ {total.toFixed(2).replace('.', ',')}</span>
            </div>

            <button 
              onClick={() => setIsPaymentModalOpen(true)}
              className="w-full bg-[#2563EB] hover:bg-yellow-400 text-black font-bold py-4 rounded-xl transition-colors shadow-md flex justify-center items-center gap-2"
            >
              Cobrar Pedido
            </button>
          </div>
        </div>
      </div>

      {/* MODAL DE PAGAMENTO (Overlay) */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111111] backdrop-blur-sm transition-opacity">
          <div className="bg-[#0A0A0A] w-full max-w-2xl rounded-2xl shadow-2xl p-8 transform transition-all">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="text-2xl font-bold text-white">Forma de Pagamento</h3>
                <p className="text-zinc-500 mt-1">Selecione como o cliente deseja pagar</p>
              </div>
              <button 
                onClick={() => setIsPaymentModalOpen(false)}
                className="text-zinc-500 hover:text-zinc-500 p-2 rounded-full hover:bg-[#111111] transition"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="bg-yellow-400/10 border border-yellow-400/30 rounded-xl p-6 text-center mb-8">
              <span className="block text-yellow-400 text-sm font-semibold uppercase tracking-wider mb-1">Total a Cobrar</span>
              <span className="text-4xl font-bold text-yellow-400">R$ {total.toFixed(2).replace('.', ',')}</span>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-8">
              {paymentMethods.map((method) => (
                <button
                  key={method.id}
                  onClick={() => setSelectedMethod(method.id)}
                  className={`flex flex-col items-center justify-center p-6 rounded-xl border-2 transition-all duration-200 ${
                    selectedMethod === method.id
                      ? 'border-yellow-400/30 bg-yellow-400/10 text-yellow-400 shadow-sm'
                      : 'border-white/10 hover:border-yellow-400/30 hover:bg-[#111111] text-zinc-500'
                  }`}
                >
                  {method.icon}
                  <span className="font-semibold">{method.name}</span>
                </button>
              ))}
            </div>

            <div className="flex justify-end gap-4 border-t border-white/10 pt-6">
              <button 
                onClick={() => setIsPaymentModalOpen(false)}
                className="px-6 py-3 font-semibold text-zinc-500 hover:bg-[#111111] rounded-xl transition"
              >
                Cancelar
              </button>
              <button 
                disabled={!selectedMethod}
                onClick={handleConfirmPayment}
                className={`px-8 py-3 font-bold text-white rounded-xl transition shadow-md ${
                  selectedMethod 
                    ? 'bg-emerald-500 hover:bg-emerald-500/80' 
                    : 'bg-[#111111] cursor-not-allowed'
                }`}
              >
                Confirmar Pagamento
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}