"use client"

// 导入所需的组件和钩子
import { CodegenFilterContainer } from "@/components/biz/CodegenFilterContainer"
import { CodegenList } from "@/components/biz/CodegenList"
import { useGetCodegenList } from "./server-store/selectors"
import { useState } from "react"
import { StackType } from "@/components/biz/CodegenList/interface"
import { AppHeader } from "@/components/biz/AppHeader"
import { useRouter } from "next/navigation"
import { Skeleton } from "@/components/ui/skeleton"
import { useFirstLoading } from "@/hooks/use-first-loading"

// Codegen 页面主组件
export default function Codegen() {
  const router = useRouter()

  // 过滤器状态管理
  const [filters, setFilters] = useState<{
    pageSize: number // 每页显示数量
    selectedStack?: StackType | "All" // 选中的技术栈
    searchKeyword?: string // 搜索关键词
  }>({
    pageSize: 10,
    selectedStack: undefined,
    searchKeyword: undefined,
  })

  // 获取代码生成列表数据
  const { data, isLoading, hasNextPage, fetchNextPage } = useGetCodegenList({
    pageSize: filters.pageSize,
    name: filters.searchKeyword,
    fullStack:
      filters.selectedStack === "All" ? undefined : filters.selectedStack,
  })

  // 判断是否为首次加载
  const isFirstLoading = useFirstLoading(isLoading)

  // 处理技术栈选择变更
  const handleStackChange = (stack: StackType) => {
    setFilters(prev => ({
      ...prev,
      selectedStack: stack,
    }))
  }

  // 处理搜索关键词变更
  const handleSearchChange = (keyword: string) => {
    setFilters(prev => ({
      ...prev,
      searchKeyword: keyword,
    }))
  }

  // 处理加载更多数据
  const handleLoadMore = () => {
    fetchNextPage()
  }

  // 处理列表项点击，跳转到详情页
  const handleItemClick = (id: string) => {
    router.push(`/main/codegen/${id}`)
  }

  return (
    <div>
      {/* 页面头部，显示面包屑导航 */}
      <AppHeader breadcrumbs={[{ label: "Codegen" }]} />

      {/* 代码生成过滤器容器 */}
      <CodegenFilterContainer
        selectedStack={filters.selectedStack}
        onStackChange={handleStackChange}
        onSearchChange={handleSearchChange}
        onLoadMore={handleLoadMore}
        isLoading={isLoading}
        hasMore={hasNextPage}
      >
        {/* 首次加载时显示骨架屏 */}
        {isFirstLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : (
          // 显示代码生成列表
          <CodegenList items={data?.data ?? []} onItemClick={handleItemClick} />
        )}
      </CodegenFilterContainer>
    </div>
  )
}
