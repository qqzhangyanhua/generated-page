"use client"

import { redirect } from "next/navigation"
import { routes } from "@/hooks/use-routes"

// 主页面组件
// 负责将用户重定向到第一个可用的路由
export default function MainPage() {
  redirect(routes[0].url) // 重定向到路由列表中的第一个路由
}
