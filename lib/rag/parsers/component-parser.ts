import fs from 'fs/promises'
import path from 'path'
import {
  ComponentDoc,
  ParsedComponent,
  ComponentParseError
} from '../types'

/**
 * 组件文档解析器
 * 从 @private/basic-components 源码中提取组件API和文档
 */
export class ComponentParser {
  private readonly sourcePath: string
  private readonly packageName: string

  constructor(sourcePath: string, packageName = '@private/basic-components') {
    this.sourcePath = sourcePath
    this.packageName = packageName
  }

  /**
   * 解析所有组件
   */
  async parseAllComponents(): Promise<ParsedComponent[]> {
    try {
      const componentsPath = path.join(this.sourcePath, 'components')
      const entries = await fs.readdir(componentsPath, { withFileTypes: true })
      
      const componentDirs = entries
        .filter(entry => entry.isDirectory() && !entry.name.startsWith('_'))
        .map(entry => entry.name)

      const results: ParsedComponent[] = []
      
      for (const componentName of componentDirs) {
        try {
          const parsed = await this.parseComponent(componentName)
          results.push(parsed)
        } catch (error) {
          results.push({
            info: this.createEmptyComponentDoc(componentName),
            filePath: path.join(componentsPath, componentName),
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }

      return results
    } catch (error) {
      throw new ComponentParseError(
        `Failed to parse components: ${error}`,
        this.sourcePath
      )
    }
  }

  /**
   * 解析单个组件
   */
  async parseComponent(componentName: string): Promise<ParsedComponent> {
    const componentPath = path.join(this.sourcePath, 'components', componentName)
    
    try {
      // 检查组件目录是否存在
      await fs.access(componentPath)
      
      const componentDoc = await this.extractComponentDoc(componentPath, componentName)
      
      return {
        info: componentDoc,
        filePath: componentPath,
        status: 'success'
      }
    } catch (error) {
      throw new ComponentParseError(
        `Failed to parse component ${componentName}: ${error}`,
        componentPath
      )
    }
  }

  /**
   * 从组件目录提取文档信息
   */
  private async extractComponentDoc(
    componentPath: string,
    componentName: string
  ): Promise<ComponentDoc> {
    const [description, api, examples, tags, dependencies] = await Promise.all([
      this.extractDescription(componentPath),
      this.extractAPI(componentPath),
      this.extractExamples(componentPath),
      this.extractTags(componentPath),
      this.extractDependencies(componentPath)
    ])

    return {
      packageName: this.packageName,
      componentName: this.capitalizeComponentName(componentName),
      description,
      api,
      examples,
      tags,
      version: await this.extractVersion(),
      dependencies,
      updatedAt: new Date().toISOString()
    }
  }

  /**
   * 提取组件描述
   */
  private async extractDescription(componentPath: string): Promise<string> {
    try {
      // 优先读取英文文档
      const markdownPath = path.join(componentPath, 'index.en-US.md')
      
      const content = await fs.readFile(markdownPath, 'utf-8')
      
      // 提取描述部分 (在 --- 标记之后，## When To Use 之前)
      const lines = content.split('\n')
      const startIndex = lines.findIndex(line => line.trim() === '---')
      const endIndex = lines.findIndex((line, index) => 
        index > startIndex && line.startsWith('## ')
      )
      
      if (startIndex !== -1 && endIndex !== -1) {
        const descriptionLines = lines
          .slice(startIndex + 1, endIndex)
          .filter(line => !line.startsWith('---') && line.trim() !== '')
          .join(' ')
          .trim()
        
        return descriptionLines || `${this.capitalizeComponentName(path.basename(componentPath))} component`
      }
      
      return `${this.capitalizeComponentName(path.basename(componentPath))} component`
    } catch {
      return `${this.capitalizeComponentName(path.basename(componentPath))} component`
    }
  }

  /**
   * 提取API文档
   */
  private async extractAPI(componentPath: string): Promise<string> {
    try {
      const markdownPath = path.join(componentPath, 'index.en-US.md')
      const content = await fs.readFile(markdownPath, 'utf-8')
      
      // 提取API部分 (从 ## API 开始)
      const apiStartIndex = content.indexOf('## API')
      if (apiStartIndex !== -1) {
        const apiContent = content.slice(apiStartIndex)
        // 截取到下一个一级或二级标题
        const nextSectionMatch = apiContent.match(/\n## (?!API)/)
        if (nextSectionMatch) {
          return apiContent.slice(0, nextSectionMatch.index).trim()
        }
        return apiContent.trim()
      }
      
      return 'API documentation not available'
    } catch {
      return 'API documentation not available'
    }
  }

  /**
   * 提取使用示例
   */
  private async extractExamples(componentPath: string): Promise<string[]> {
    try {
      const demoPath = path.join(componentPath, 'demo')
      
      // 检查demo目录是否存在
      try {
        await fs.access(demoPath)
      } catch {
        return []
      }
      
      const demoFiles = await fs.readdir(demoPath)
      const tsxFiles = demoFiles.filter(file => file.endsWith('.tsx'))
      
      const examples: string[] = []
      
      for (const file of tsxFiles.slice(0, 3)) { // 限制最多3个示例
        try {
          const content = await fs.readFile(path.join(demoPath, file), 'utf-8')
          // 提取主要代码，移除import语句
          const codeWithoutImports = content
            .split('\n')
            .filter(line => !line.trim().startsWith('import'))
            .join('\n')
            .trim()
          
          if (codeWithoutImports) {
            examples.push(codeWithoutImports)
          }
        } catch {
          // 忽略单个文件读取失败
        }
      }
      
      return examples
    } catch {
      return []
    }
  }

  /**
   * 提取组件标签
   */
  private async extractTags(componentPath: string): Promise<string[]> {
    const componentName = path.basename(componentPath).toLowerCase()
    
    // 基于组件名称推断标签
    const tagMapping: Record<string, string[]> = {
      'button': ['form', 'action', 'ui', 'interactive'],
      'input': ['form', 'data-entry', 'ui'],
      'table': ['data-display', 'list', 'ui'],
      'form': ['data-entry', 'validation', 'ui'],
      'modal': ['feedback', 'overlay', 'ui'],
      'alert': ['feedback', 'message', 'ui'],
      'card': ['data-display', 'container', 'ui'],
      'menu': ['navigation', 'ui'],
      'breadcrumb': ['navigation', 'ui'],
      'pagination': ['navigation', 'data-display', 'ui'],
      'tabs': ['navigation', 'ui'],
      'select': ['form', 'data-entry', 'ui'],
      'checkbox': ['form', 'data-entry', 'ui'],
      'radio': ['form', 'data-entry', 'ui'],
      'switch': ['form', 'data-entry', 'ui'],
      'slider': ['form', 'data-entry', 'ui'],
      'upload': ['form', 'data-entry', 'ui'],
      'progress': ['feedback', 'ui'],
      'spin': ['feedback', 'loading', 'ui'],
      'avatar': ['data-display', 'ui'],
      'badge': ['data-display', 'ui'],
      'tag': ['data-display', 'ui'],
      'tooltip': ['data-display', 'overlay', 'ui'],
      'popover': ['data-display', 'overlay', 'ui'],
      'dropdown': ['navigation', 'overlay', 'ui']
    }

    const baseTags = tagMapping[componentName] || ['ui']
    
    // 添加通用标签
    return [...baseTags, 'react', 'component']
  }

  /**
   * 提取依赖关系
   */
  private async extractDependencies(componentPath: string): Promise<string[]> {
    try {
      // 读取主组件文件
      const indexPath = path.join(componentPath, 'index.ts')
      const content = await fs.readFile(indexPath, 'utf-8')
      
      // 提取内部组件依赖 (import from '../xxx')
      const importMatches = content.match(/from\s+['"]\.\.\/([^'"]+)['"]/g)
      
      if (importMatches) {
        return importMatches
          .map(match => {
            const pathMatch = match.match(/from\s+['"]\.\.\/([^'"]+)['"]/)
            return pathMatch ? pathMatch[1] : null
          })
          .filter((dep): dep is string => dep !== null)
          .map(dep => this.capitalizeComponentName(dep))
      }
      
      return []
    } catch {
      return []
    }
  }

  /**
   * 获取包版本
   */
  private async extractVersion(): Promise<string> {
    try {
      const packageJsonPath = path.join(this.sourcePath, 'package.json')
      const content = await fs.readFile(packageJsonPath, 'utf-8')
      const packageJson = JSON.parse(content)
      return packageJson.version || '1.0.0'
    } catch {
      return '1.0.0'
    }
  }

  /**
   * 首字母大写
   */
  private capitalizeComponentName(name: string): string {
    return name
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join('')
  }

  /**
   * 创建空的组件文档
   */
  private createEmptyComponentDoc(componentName: string): ComponentDoc {
    return {
      packageName: this.packageName,
      componentName: this.capitalizeComponentName(componentName),
      description: `${this.capitalizeComponentName(componentName)} component`,
      api: 'API documentation not available',
      examples: [],
      tags: ['ui', 'react', 'component'],
      version: '1.0.0',
      dependencies: [],
      updatedAt: new Date().toISOString()
    }
  }
}

/**
 * 便捷函数：解析指定路径的所有组件
 */
export async function parsePrivateComponents(
  sourcePath: string
): Promise<ParsedComponent[]> {
  const parser = new ComponentParser(sourcePath)
  return parser.parseAllComponents()
}

/**
 * 便捷函数：解析单个组件
 */
export async function parsePrivateComponent(
  sourcePath: string,
  componentName: string
): Promise<ParsedComponent> {
  const parser = new ComponentParser(sourcePath)
  return parser.parseComponent(componentName)
}