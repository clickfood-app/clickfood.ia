"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function CardapioIndexPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/cardapio/meu-restaurante")
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <p className="text-sm text-gray-500">Redirecionando cardapio...</p>
    </div>
  )
}