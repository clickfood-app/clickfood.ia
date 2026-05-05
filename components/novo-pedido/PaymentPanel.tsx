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
      <div className="w-96 bg-white border-l border-gray-200 flex flex-col shadow-sm h-full">
        <div className="p-6 flex-1 flex flex-col">
          <h2 className="text-lg font-semibold text-gray-800 mb-6">Resumo do Pedido</h2>
          
          {/* Lista de Itens (Simulada para visualização) */}
          <div className="flex-1 overflow-y-auto bg-gray-50 rounded-lg flex items-center justify-center border border-dashed border-gray-300">
            <span className="text-gray-400">Nenhum item adicionado</span>
          </div>

          {/* Área de Totais */}
          <div className="mt-6 pt-6 border-t border-gray-100">
            <div className="flex justify-between text-gray-600 mb-3">
              <span>Subtotal</span>
              <span>R$ {total.toFixed(2).replace('.', ',')}</span>
            </div>
            <div className="flex justify-between text-gray-600 mb-4">
              <span>Desconto</span>
              <span className="text-gray-400">R$ 0,00</span>
            </div>
            
            <div className="flex justify-between items-center mb-8">
              <span className="text-xl font-bold text-gray-800">Total</span>
              <span className="text-2xl font-bold text-[#2563EB]">R$ {total.toFixed(2).replace('.', ',')}</span>
            </div>

            <button 
              onClick={() => setIsPaymentModalOpen(true)}
              className="w-full bg-[#2563EB] hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition-colors shadow-md flex justify-center items-center gap-2"
            >
              Cobrar Pedido
            </button>
          </div>
        </div>
      </div>

      {/* MODAL DE PAGAMENTO (Overlay) */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl p-8 transform transition-all">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="text-2xl font-bold text-gray-800">Forma de Pagamento</h3>
                <p className="text-gray-500 mt-1">Selecione como o cliente deseja pagar</p>
              </div>
              <button 
                onClick={() => setIsPaymentModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100 transition"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 text-center mb-8">
              <span className="block text-blue-600 text-sm font-semibold uppercase tracking-wider mb-1">Total a Cobrar</span>
              <span className="text-4xl font-bold text-blue-800">R$ {total.toFixed(2).replace('.', ',')}</span>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-8">
              {paymentMethods.map((method) => (
                <button
                  key={method.id}
                  onClick={() => setSelectedMethod(method.id)}
                  className={`flex flex-col items-center justify-center p-6 rounded-xl border-2 transition-all duration-200 ${
                    selectedMethod === method.id
                      ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-sm'
                      : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50 text-gray-600'
                  }`}
                >
                  {method.icon}
                  <span className="font-semibold">{method.name}</span>
                </button>
              ))}
            </div>

            <div className="flex justify-end gap-4 border-t border-gray-100 pt-6">
              <button 
                onClick={() => setIsPaymentModalOpen(false)}
                className="px-6 py-3 font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition"
              >
                Cancelar
              </button>
              <button 
                disabled={!selectedMethod}
                onClick={handleConfirmPayment}
                className={`px-8 py-3 font-bold text-white rounded-xl transition shadow-md ${
                  selectedMethod 
                    ? 'bg-green-500 hover:bg-green-600' 
                    : 'bg-gray-300 cursor-not-allowed'
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