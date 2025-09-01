export const customRequire = (moduleName: string) => {
  const modules: { [key: string]: any } = {
    // base modules
    react: require("react"),
    "react-dom": require("react-dom"),
    antd: require("antd"),
    "@private/basic-components": (() => {
      // 确保样式被正确加载
      const privateComponents = require("@private/basic-components")

      // 如果私有组件包有样式入口，确保它被加载
      try {
        // 尝试加载样式相关模块
        require("@private/basic-components/lib/style")
      } catch (e) {
        // 样式可能已经通过其他方式加载了，忽略错误
        console.warn("Private components style loading:", e)
      }

      return privateComponents
    })(),
    "@ant-design/icons": require("@ant-design/icons"),
    "@ant-design/pro-components": require("@ant-design/pro-components"),
    "@ant-design/use-emotion-css": require("@ant-design/use-emotion-css"),
    "styled-components": require("styled-components"),
  }

  if (modules[moduleName]) {
    return modules[moduleName]
  }

  throw new Error(`Module ${moduleName} not found`)
}
