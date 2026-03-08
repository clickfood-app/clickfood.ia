"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"

export default function Login() {

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  const handleLogin = async () => {

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) {
      alert("Erro no login")
    } else {
      window.location.href = "/bem-vindo"
    }

  }

  return (

    <div>
      <h1>Login</h1>

      <input
        placeholder="Email"
        onChange={(e)=>setEmail(e.target.value)}
      />

      <input
        placeholder="Senha"
        type="password"
        onChange={(e)=>setPassword(e.target.value)}
      />

      <button onClick={handleLogin}>
        Entrar
      </button>

    </div>

  )
}