"use client"

import React from "react"
import { QRCodeSVG } from "qrcode.react"
import { Printer, X } from "lucide-react"

interface QrCodeModalProps {
  isOpen: boolean
  onClose: () => void
  tableName: string
  tableId: string
  restaurantId?: string
}

export default function QrCodeModal({ 
  isOpen, 
  onClose, 
  tableName, 
  tableId, 
  restaurantId = "restaurante-id" // Aqui você passará o ID real do restaurante vindo do Supabase
}: QrCodeModalProps) {
  if (!isOpen) return null

  /**
   * EXPLICAÇÃO DA URL:
   * Para aparecer a comanda, este link deve ser a URL pública onde o seu cliente
   * acessa o cardápio. O parâmetro 'mesa' permite que o seu sistema identifique 
   * automaticamente de qual mesa o pedido está vindo ou qual comanda exibir.
   */
  const menuUrl = `${window.location.origin}/cardapio/${restaurantId}?mesa=${tableId}`

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity">
      <div className="bg-[#0A0A0A] w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden transform transition-all qr-print-container">
        
        {/* Cabeçalho do Modal (Oculto na impressão) */}
        <div className="flex justify-between items-center p-4 border-b border-white/10 print:hidden">
          <h3 className="text-lg font-bold text-white">QR Code da Mesa</h3>
          <button 
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-500 p-2 rounded-full hover:bg-[#111111] transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Área do QR Code (Visível na impressão) */}
        <div className="p-8 flex flex-col items-center justify-center bg-[#0A0A0A]">
          <div className="text-center mb-6">
            <h2 className="text-3xl font-black text-white">{tableName}</h2>
            <p className="text-sm text-zinc-500 font-medium mt-1">Escaneie para ver sua comanda</p>
          </div>

          <div className="p-4 bg-[#0A0A0A] border-4 border-white/10 rounded-xl mb-2 shadow-sm">
            <QRCodeSVG 
              value={menuUrl} 
              size={200}
              level="H" 
              includeMargin={true}
            />
          </div>
          <p className="text-xs text-zinc-500 mt-4 font-bold tracking-widest uppercase">Clickfood</p>
        </div>

        {/* Rodapé (Oculto na impressão) */}
        <div className="p-4 border-t border-white/10 bg-[#111111] print:hidden">
          <button 
            onClick={handlePrint}
            className="flex w-full items-center justify-center gap-2 bg-yellow-400 hover:bg-yellow-300 text-black font-semibold py-3 rounded-xl transition shadow-sm"
          >
            <Printer className="h-5 w-5" />
            Imprimir QR Code
          </button>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:hidden {
            display: none !important;
          }
          .qr-print-container, .qr-print-container * {
            visibility: visible;
          }
          .qr-print-container {
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            box-shadow: none !important;
            border: none !important;
          }
        }
      `}} />
    </div>
  )
}