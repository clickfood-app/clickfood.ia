import React from "react"
import type { Metadata } from 'next'
import { Toaster } from 'sonner'
import { AuthProvider } from '@/components/auth/auth-provider'

import './globals.css'

export const metadata = {
  title: "ClickFood",
  description: "Sistema de gestão para restaurantes e food service.",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
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
