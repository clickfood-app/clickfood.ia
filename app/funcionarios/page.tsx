"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function FuncionariosPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/gestao")
  }, [router])

  return null
}