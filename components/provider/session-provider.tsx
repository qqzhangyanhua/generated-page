"use client"

import * as React from "react"
import { AuthProvider } from "@/lib/auth/AuthProvider"

export function SessionProvider({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}
