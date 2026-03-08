import React from "react"
import type { Metadata } from 'next'
import { Toaster } from 'sonner'
import { AuthProvider } from '@/components/auth/auth-provider'

import './globals.css'

export const metadata: Metadata = {
  title: 'AdminPro - Painel Administrativo',
  description: 'Painel administrativo para gerenciamento de pedidos e relatórios',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR">
      <body className="font-sans antialiased">
        <AuthProvider>
          {children}
          <Toaster position="top-right" richColors closeButton />
        </AuthProvider>
      </body>
    </html>
  )
}
