import { Metadata } from "next"

export const metadata: Metadata = {
  title: "认证 - Compoder",
  description: "登录或注册 Compoder 账户",
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      {children}
    </div>
  )
}