import React from "react"
import type { Metadata } from "next"
import { Toaster } from "sonner"
import { AuthProvider } from "@/components/auth/auth-provider"
import "./globals.css"

export const metadata: Metadata = {
  title: "ClickFood BR",
  description:
    "A nova geração da gestão para restaurantes que querem crescer. A ClickFood ajuda restaurantes e operações food service a venderem mais e organizarem melhor a operação.",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/favicon.ico",
  },
  openGraph: {
    title: "ClickFood BR",
    description:
      "A nova geração da gestão para restaurantes que querem crescer. A ClickFood ajuda restaurantes e operações food service a venderem mais e organizarem melhor a operação.",
    siteName: "ClickFood BR",
    locale: "pt_BR",
    type: "website",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <AuthProvider>
          {children}
          <Toaster position="top-right" richColors closeButton />
        </AuthProvider>
      </body>
    </html>
  )
}