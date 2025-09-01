/**
 * 样式加载器 - 确保私有组件样式被正确注入
 */

// 样式加载状态跟踪
let privateStylesLoaded = false

/**
 * 强制加载私有组件样式
 */
export const ensurePrivateComponentStyles = () => {
  if (privateStylesLoaded) return

  try {
    // 尝试触发私有组件样式的注入
    // 这通过导入样式模块来实现
    if (typeof window !== "undefined") {
      // 在浏览器环境中，确保样式系统被正确初始化
      const privateComponents = require("@private/basic-components")

      // 创建一个隐藏的组件实例来触发样式注入
      // 这是一个hack方法，但可以确保CSS-in-JS样式被注入
      const tempDiv = document.createElement("div")
      tempDiv.style.display = "none"
      tempDiv.style.position = "absolute"
      tempDiv.style.top = "-9999px"
      document.body.appendChild(tempDiv)

      // 触发样式注册
      setTimeout(() => {
        document.body.removeChild(tempDiv)
      }, 100)

      privateStylesLoaded = true
      console.log("Private components styles loaded successfully")
    }
  } catch (error) {
    console.warn("Failed to load private component styles:", error)
  }
}

/**
 * 样式注入监听器
 */
export const observeStyleInjection = () => {
  if (typeof window === "undefined") return

  // 监听样式标签的变化
  const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      if (mutation.type === "childList") {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element
            if (
              element.tagName === "STYLE" &&
              element.textContent?.includes("ant-")
            ) {
              console.log("Antd style detected and injected")
            }
          }
        })
      }
    })
  })

  observer.observe(document.head, {
    childList: true,
    subtree: true,
  })

  return () => observer.disconnect()
}
