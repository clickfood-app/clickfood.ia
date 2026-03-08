"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import LoginForm from "./login-form"
import SignUpForm from "./signup"

type Tab = "login" | "signup"

export default function AuthCard() {
  const [activeTab, setActiveTab] = useState<Tab>("login")

  return (
    <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Card */}
      <div className="rounded-2xl bg-white shadow-2xl shadow-gray-200/60 border border-gray-100/80 overflow-hidden">
        {/* Tabs */}
        <div className="flex bg-gray-50/50">
          <button
            onClick={() => setActiveTab("login")}
            className={cn(
              "flex-1 py-4 text-sm font-semibold transition-all duration-200 relative",
              activeTab === "login"
                ? "text-blue-600 bg-white"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            Entrar
            {activeTab === "login" && (
              <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-blue-600 rounded-full" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("signup")}
            className={cn(
              "flex-1 py-4 text-sm font-semibold transition-all duration-200 relative",
              activeTab === "signup"
                ? "text-blue-600 bg-white"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            Criar Conta
            {activeTab === "signup" && (
              <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-blue-600 rounded-full" />
            )}
          </button>
        </div>

        {/* Form Content */}
        <div className="p-6 sm:p-8">
          <div
            key={activeTab}
            className="animate-in fade-in slide-in-from-right-2 duration-300"
          >
            {activeTab === "login" ? <LoginForm /> : <SignUpForm />}
          </div>
        </div>
      </div>

      {/* Social Proof */}
      <div className="mt-6 text-center">
        <div className="flex items-center justify-center gap-1 mb-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <svg
              key={star}
              className="h-4 w-4 text-yellow-400 fill-current"
              viewBox="0 0 20 20"
            >
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          ))}
        </div>
        <p className="text-xs text-gray-500">
          Mais de <span className="font-semibold text-gray-700">2.000 restaurantes</span> ja usam nossa plataforma
        </p>
      </div>
    </div>
  )
}
