"use client"

import React, { useCallback } from "react"
import { Loading } from "@/components/biz/Loading"
import useRoutes from "@/hooks/use-routes"
import { useSession, useAuth } from "@/lib/auth/AuthProvider"
import { redirect } from "next/navigation"
import { useEffect } from "react"
import { AppSidebarLayout } from "@/components/biz/AppSidebarLayout"
import {
  useProviderModelModal,
  ProviderModelModalProvider,
} from "@/app/commons/ProviderModelModal"
import { type NavMainItem } from "@/components/biz/AppSidebarLayout/interface"

// 创建一个内部组件来使用上下文
// MainLayoutContent 组件负责处理主布局的内容展示和导航交互
function MainLayoutContent({
  children,
  user,
}: {
  children: React.ReactNode
  user: {
    name: string
    email: string
    avatar: string
  }
}) {
  const routes = useRoutes()
  const { openModal } = useProviderModelModal()
  const { logout } = useAuth()

  const handleNavItemClick = useCallback(
    (url: string) => {
      if (url === "/main/settings") {
        openModal()
        return true
      }

      return false
    },
    [openModal],
  )

  return (
    <AppSidebarLayout
      navMain={routes as NavMainItem[]}
      user={user}
      onLogout={logout}
      onNavItemClick={handleNavItemClick}
    >
      {children}
    </AppSidebarLayout>
  )
}

// 主布局组件
// MainLayout 组件负责处理身份验证和整体布局结构
export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // 获取会话状态和用户数据
  const { status, data } = useSession()

  // 构建用户信息对象
  const user = {
    name: data?.user?.name || "",
    email: data?.user?.email || "",
    avatar: data?.user?.image || "",
  }

  // 监听认证状态，未认证时重定向到登录页
  useEffect(() => {
    if (status === "unauthenticated") {
      redirect("/login")
    }
  }, [status])

  // 在检查认证状态时显示加载状态
  if (status === "loading") {
    return <Loading fullscreen />
  }

  // 渲染主布局
  return (
    <ProviderModelModalProvider>
      <MainLayoutContent user={user}>{children}</MainLayoutContent>
    </ProviderModelModalProvider>
  )
}
