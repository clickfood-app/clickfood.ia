"use client"

import { useEffect } from "react"

export function PWARegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return
    }

    const registerServiceWorker = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js")
      } catch (error) {
        console.error("Erro ao registrar Service Worker:", error)
      }
    }

    registerServiceWorker()
  }, [])

  return null
}