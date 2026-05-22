"use client"

import LoginForm from "./login-form"

export default function AuthCard() {
  return (
    <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="animate-in fade-in slide-in-from-right-3 duration-500">
        <LoginForm />
      </div>
    </div>
  )
}