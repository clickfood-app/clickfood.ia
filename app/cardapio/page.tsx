"use client"

import React, { useState } from "react"
import Image from "next/image"
import AdminLayout from "@/components/admin-layout"
import {
  ExternalLink, Copy, Check, Eye, QrCode, Link2, Share2,
  Globe, Smartphone, Monitor, Store, ShoppingBag, ArrowRight,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { getMenuCategories, formatPrice, productImageMap } from "@/lib/menu-data"
import { defaultStoreData } from "@/lib/settings-data"

const SLUG = "adminpro-restaurante"
const MENU_URL = `/cardapio/${SLUG}`

export default function AdminCardapioPage() {
  const [copied, setCopied] = useState(false)
  const [previewMode, setPreviewMode] = useState<"mobile" | "desktop">("mobile")

  const categories = getMenuCategories(SLUG)
  const totalProducts = categories.reduce((s, c) => s + c.products.length, 0)

  const handleCopy = async () => {
    const fullUrl = `${window.location.origin}${MENU_URL}`
    try {
      await navigator.clipboard.writeText(fullUrl)
      setCopied(true)
      toast.success("Link copiado!")
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Erro ao copiar link")
    }
  }

  const handleOpenPublic = () => {
    window.open(MENU_URL, "_blank")
  }

  const handleShare = async () => {
    const fullUrl = `${window.location.origin}${MENU_URL}`
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${defaultStoreData.name} - Cardapio Digital`,
          text: "Confira nosso cardapio digital!",
          url: fullUrl,
        })
      } catch {
        // User cancelled share
      }
    } else {
      handleCopy()
    }
  }

  return (
    <AdminLayout>
      <div className="p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Cardapio Digital</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Gerencie e compartilhe seu cardapio publico com clientes
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
            >
              <Share2 className="h-4 w-4" />
              Compartilhar
            </button>
            <button
              onClick={handleOpenPublic}
              className="flex items-center gap-2 rounded-lg bg-[hsl(var(--primary))] px-4 py-2.5 text-sm font-medium text-[hsl(var(--primary-foreground))] transition-colors hover:opacity-90"
            >
              <Eye className="h-4 w-4" />
              Visualizar Cardapio
            </button>
          </div>
        </div>

        {/* Link Section */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Link2 className="h-5 w-5 text-[hsl(var(--primary))]" />
            <h2 className="text-lg font-bold text-card-foreground">Link Publico</h2>
          </div>

          <p className="text-sm text-muted-foreground mb-4">
            Compartilhe este link com seus clientes via WhatsApp, redes sociais ou QR Code.
          </p>

          {/* URL display */}
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 rounded-xl border border-border bg-muted/50 px-4 py-3">
              <Globe className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
              <span className="text-sm font-mono text-foreground truncate">
                {typeof window !== "undefined" ? window.location.origin : ""}{MENU_URL}
              </span>
            </div>
            <button
              onClick={handleCopy}
              className={cn(
                "flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border transition-all",
                copied
                  ? "border-green-300 bg-green-50 text-green-600"
                  : "border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
              aria-label="Copiar link"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>

          {/* Quick actions */}
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <button
              onClick={handleOpenPublic}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition-all hover:bg-secondary hover:shadow-sm group"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                <ExternalLink className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-card-foreground">Abrir em nova aba</p>
                <p className="text-xs text-muted-foreground">Visualizar como cliente</p>
              </div>
              <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>

            <button
              onClick={handleCopy}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition-all hover:bg-secondary hover:shadow-sm group"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-600">
                <Copy className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-card-foreground">Copiar link</p>
                <p className="text-xs text-muted-foreground">Para colar onde quiser</p>
              </div>
              <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>

            <button
              onClick={handleShare}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition-all hover:bg-secondary hover:shadow-sm group"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-600">
                <QrCode className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-card-foreground">Compartilhar</p>
                <p className="text-xs text-muted-foreground">WhatsApp, redes sociais</p>
              </div>
              <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          </div>
        </div>

        {/* Stats + Preview */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Stats */}
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                  <Store className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-card-foreground">Resumo do Cardapio</p>
                  <p className="text-xs text-muted-foreground">Produtos publicados</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <p className="text-2xl font-bold text-card-foreground">{totalProducts}</p>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Produtos</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <p className="text-2xl font-bold text-card-foreground">{categories.length}</p>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Categorias</p>
                </div>
              </div>
            </div>

            {/* Category breakdown */}
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-sm font-bold text-card-foreground mb-3">Categorias Publicadas</h3>
              <div className="space-y-2">
                {categories.map((cat) => (
                  <div key={cat.id} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2.5">
                    <span className="text-sm font-medium text-card-foreground">{cat.name}</span>
                    <span className="text-xs font-semibold text-muted-foreground">
                      {cat.products.length} {cat.products.length === 1 ? "item" : "itens"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Uso recomendado */}
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
              <h3 className="text-sm font-bold text-blue-800 mb-2">Dicas de uso</h3>
              <ul className="space-y-2 text-xs text-blue-700 leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-500" />
                  Compartilhe o link no WhatsApp Business
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-500" />
                  Adicione na bio do Instagram
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-500" />
                  Gere um QR Code para as mesas
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-500" />
                  Produtos inativos nao aparecem no cardapio
                </li>
              </ul>
            </div>
          </div>

          {/* Preview frame */}
          <div className="lg:col-span-2">
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              {/* Preview toolbar */}
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-semibold text-card-foreground">Pre-visualizacao</span>
                </div>
                <div className="flex items-center gap-1 rounded-lg bg-muted/50 p-1">
                  <button
                    onClick={() => setPreviewMode("mobile")}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
                      previewMode === "mobile" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Smartphone className="h-3.5 w-3.5" />
                    Mobile
                  </button>
                  <button
                    onClick={() => setPreviewMode("desktop")}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
                      previewMode === "desktop" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Monitor className="h-3.5 w-3.5" />
                    Desktop
                  </button>
                </div>
              </div>

              {/* Preview iframe */}
              <div className="flex justify-center bg-gray-100 p-6">
                <div
                  className={cn(
                    "overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl transition-all duration-300",
                    previewMode === "mobile" ? "w-[375px]" : "w-full max-w-[800px]"
                  )}
                  style={{ height: 640 }}
                >
                  <iframe
                    src={MENU_URL}
                    className="h-full w-full border-0"
                    title="Pre-visualizacao do cardapio"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
