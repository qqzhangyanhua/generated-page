import {
  ComponentDoc,
  VectorDocument,
  RAGConfig,
  RAGSearchRequest,
  RAGSearchResponse,
  RAGServiceStatus,
  ComponentSyncRequest,
  ComponentSyncResponse,
  RAGError,
  ParsedComponent
} from '../types'
import { ComponentParser } from '../parsers/component-parser'
import { OpenAIEmbeddings } from '../embeddings/openai-embeddings'
import { FileVectorStore } from '../vector-store/file-store'
import { SmartCache } from '../cache/smart-cache'

/**
 * RAG核心服务
 * 集成组件解析、向量化、存储和检索功能
 */
export class RAGService {
  private embeddings: OpenAIEmbeddings
  private vectorStore: FileVectorStore
  private parser: ComponentParser
  private config: RAGConfig
  private cache: SmartCache // 使用智能缓存

  constructor(config: RAGConfig, sourcePath: string) {
    this.config = config
    
    // 初始化智能缓存
    this.cache = new SmartCache(
      config.cache?.maxSize || 1000,
      (config.cache?.ttl || 300) * 1000, // 转换为毫秒
      0.92 // 语义相似度阈值
    )

    // 初始化组件
    this.embeddings = new OpenAIEmbeddings(
      config.openai?.apiKey || '',
      config.openai?.model || 'text-embedding-3-small'
    )

    this.vectorStore = new FileVectorStore('./data/rag-index')
    this.parser = new ComponentParser(sourcePath)
  }

  /**
   * 初始化服务
   */
  async initialize(): Promise<void> {
    try {
      await this.vectorStore.initialize()
    } catch (error) {
      throw new RAGError(
        `Failed to initialize RAG service: ${error}`,
        'INIT_ERROR'
      )
    }
  }

  /**
   * 同步组件文档 - 优化版（并发处理）
   */
  async syncComponents(request: ComponentSyncRequest): Promise<ComponentSyncResponse> {
    const startTime = Date.now()
    let processedCount = 0
    let successCount = 0
    const errors: string[] = []

    try {
      // 解析组件
      const parsedComponents = await this.parser.parseAllComponents()
      processedCount = parsedComponents.length

      // 过滤需要同步的包
      const componentsToSync = request.packages
        ? parsedComponents.filter(comp => 
            request.packages!.includes(comp.info.packageName)
          )
        : parsedComponents

      // 如果强制重新索引，清空现有数据
      if (request.forceReindex) {
        await this.vectorStore.clear()
      }

      // 并发批处理组件 - 优化性能
      const BATCH_SIZE = 10 // 每批处理10个组件
      const batches: ParsedComponent[][] = []
      
      for (let i = 0; i < componentsToSync.length; i += BATCH_SIZE) {
        batches.push(componentsToSync.slice(i, i + BATCH_SIZE))
      }

      console.log(`[RAG] 开始同步 ${componentsToSync.length} 个组件，分 ${batches.length} 批处理`)

      // 按批次并发处理
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex]
        console.log(`[RAG] 处理第 ${batchIndex + 1}/${batches.length} 批，包含 ${batch.length} 个组件`)
        
        // 并发处理当前批次的所有组件
        const batchPromises = batch.map(async (parsedComp) => {
          try {
            if (parsedComp.status === 'success') {
              const vectors = await this.createComponentVectors(parsedComp.info)
              return { success: true, vectors, componentName: parsedComp.info.componentName }
            } else {
              return { 
                success: false, 
                error: `${parsedComp.info.componentName}: ${parsedComp.error || 'Parse failed'}`,
                componentName: parsedComp.info.componentName 
              }
            }
          } catch (error) {
            return { 
              success: false, 
              error: `${parsedComp.info.componentName}: ${error}`,
              componentName: parsedComp.info.componentName 
            }
          }
        })

        // 等待当前批次完成
        const batchResults = await Promise.all(batchPromises)
        
        // 收集成功的向量文档
        const vectorDocuments: VectorDocument[] = []
        
        for (const result of batchResults) {
          if (result.success && result.vectors) {
            vectorDocuments.push(...result.vectors)
            successCount++
          } else if (result.error) {
            errors.push(result.error)
          }
        }

        // 批量存储向量
        if (vectorDocuments.length > 0) {
          await this.vectorStore.addDocuments(vectorDocuments)
          console.log(`[RAG] 批次 ${batchIndex + 1} 完成：${vectorDocuments.length} 个向量已存储`)
        }
      }

      // 清空缓存
      this.clearCache()

      const duration = Date.now() - startTime
      console.log(`[RAG] 同步完成：${successCount}/${processedCount} 成功，耗时 ${duration}ms`)

      return {
        status: errors.length === 0 ? 'success' : (successCount > 0 ? 'partial' : 'failed'),
        processedCount,
        successCount,
        failedCount: processedCount - successCount,
        errors,
        duration
      }
    } catch (error) {
      return {
        status: 'failed',
        processedCount,
        successCount,
        failedCount: processedCount - successCount,
        errors: [...errors, `Sync error: ${error}`],
        duration: Date.now() - startTime
      }
    }
  }

  /**
   * 搜索相关组件 - 优化版（智能缓存）
   */
  async searchComponents(request: RAGSearchRequest): Promise<RAGSearchResponse> {
    const startTime = Date.now()

    try {
      // 生成查询向量（用于缓存和搜索）
      const queryEmbedding = await this.embeddings.embedText(request.query)
      
      // 检查智能缓存
      if (this.config.cache?.enabled) {
        const cached = await this.cache.get(
          request.query,
          queryEmbedding,
          request.filters
        )
        
        if (cached) {
          // 更新响应时间
          return {
            ...cached,
            duration: Date.now() - startTime
          }
        }
      }

      // 向量检索
      const vectorResults = request.filters
        ? await this.vectorStore.searchWithFilters(
            queryEmbedding,
            request.filters,
            request.topK || 10,
            request.threshold || 0.5
          )
        : await this.vectorStore.similaritySearch(
            queryEmbedding,
            request.topK || 10,
            request.threshold || 0.5
          )

      // 合并相同组件的结果
      const componentMap = new Map<string, {
        component: ComponentDoc
        scores: number[]
        totalScore: number
      }>()

      for (const doc of vectorResults) {
        const componentKey = `${doc.metadata.packageName}-${doc.metadata.componentName}`
        
        if (!componentMap.has(componentKey)) {
          // 从向量文档重建ComponentDoc
          const component = await this.reconstructComponentDoc(doc.metadata)
          componentMap.set(componentKey, {
            component,
            scores: [this.calculateRelevanceScore(doc, request.query)],
            totalScore: 0
          })
        } else {
          const existing = componentMap.get(componentKey)!
          existing.scores.push(this.calculateRelevanceScore(doc, request.query))
        }
      }

      // 计算最终得分并排序
      const results = Array.from(componentMap.values())
        .map(item => ({
          ...item,
          totalScore: Math.max(...item.scores) * 0.7 + (item.scores.reduce((a, b) => a + b, 0) / item.scores.length) * 0.3
        }))
        .sort((a, b) => b.totalScore - a.totalScore)
        .slice(0, request.topK || 5)

      const response: RAGSearchResponse = {
        components: results.map(r => r.component),
        scores: results.map(r => r.totalScore),
        confidence: this.calculateConfidence(results.map(r => r.totalScore)),
        suggestions: this.generateSuggestions(request.query, results.map(r => r.component)),
        duration: Date.now() - startTime
      }

      // 缓存结果
      if (this.config.cache?.enabled) {
        this.cache.set(
          request.query,
          response,
          queryEmbedding,
          request.filters
        )
      }

      return response
    } catch (error) {
      throw new RAGError(
        `Search failed: ${error}`,
        'SEARCH_ERROR'
      )
    }
  }

  /**
   * 获取服务状态
   */
  async getStatus(): Promise<RAGServiceStatus> {
    try {
      const stats = await this.vectorStore.getStats()
      
      return {
        available: true,
        stats,
        config: {
          vectorStore: this.config.vectorStore,
          embeddingModel: this.config.embeddingModel,
          dimension: this.config.dimension,
          cache: this.config.cache
        },
        checkedAt: new Date().toISOString()
      }
    } catch {
      return {
        available: false,
        stats: {
          totalComponents: 0,
          totalDocuments: 0,
          indexSize: 0,
          lastUpdated: new Date().toISOString(),
          packageStats: {}
        },
        config: {
          vectorStore: this.config.vectorStore,
          embeddingModel: this.config.embeddingModel,
          dimension: this.config.dimension,
          cache: this.config.cache
        },
        checkedAt: new Date().toISOString()
      }
    }
  }

  /**
   * 清空缓存
   */
  clearCache(): void {
    this.cache.clear()
  }

  /**
   * 私有方法：为组件创建向量文档 - 优化版（批量向量化）
   */
  private async createComponentVectors(component: ComponentDoc): Promise<VectorDocument[]> {
    const baseMetadata = {
      componentName: component.componentName,
      packageName: component.packageName,
      tags: component.tags,
      version: component.version
    }

    try {
      // 批量准备文本和元数据
      const texts: string[] = []
      const metadataList: Array<VectorDocument['metadata'] & { type: string }> = []
      const contentList: string[] = []

      // 收集描述
      if (component.description) {
        texts.push(component.description)
        contentList.push(component.description)
        metadataList.push({ ...baseMetadata, type: 'description' })
      }

      // 收集API文档
      if (component.api && component.api !== 'API documentation not available') {
        texts.push(component.api)
        contentList.push(component.api)
        metadataList.push({ ...baseMetadata, type: 'api' })
      }

      // 收集示例
      component.examples.forEach((example) => {
        if (example.trim()) {
          texts.push(example)
          contentList.push(example)
          metadataList.push({ ...baseMetadata, type: 'example' })
        }
      })

      // 如果没有可向量化的内容，返回空数组
      if (texts.length === 0) {
        return []
      }

      // 批量向量化 - 显著减少API调用次数
      console.log(`[RAG] 批量向量化 ${component.componentName}: ${texts.length} 个文本`)
      const embeddings = await this.embeddings.embedTexts(texts)

      // 构建向量文档
      const vectors: VectorDocument[] = embeddings.map((embedding, index) => ({
        id: FileVectorStore.generateDocumentId(
          component.componentName,
          metadataList[index].type === 'example' ? `example-${index}` : metadataList[index].type,
          contentList[index]
        ),
        content: contentList[index],
        embedding,
        metadata: metadataList[index]
      }))

      return vectors
    } catch (error) {
      throw new RAGError(
        `Failed to create vectors for ${component.componentName}: ${error}`,
        'VECTOR_CREATION_ERROR'
      )
    }
  }

  /**
   * 私有方法：从元数据重建组件文档
   */
  private async reconstructComponentDoc(metadata: VectorDocument['metadata']): Promise<ComponentDoc> {
    // 这里简化处理，实际应用中可能需要从数据库或缓存中获取完整信息
    return {
      packageName: metadata.packageName,
      componentName: metadata.componentName,
      description: `${metadata.componentName} component`,
      api: 'API documentation available',
      examples: [],
      tags: metadata.tags,
      version: metadata.version,
      dependencies: [],
      updatedAt: new Date().toISOString()
    }
  }

  /**
   * 私有方法：计算相关性得分
   */
  private calculateRelevanceScore(doc: VectorDocument, query: string): number {
    // 基础得分从相似度计算，这里简化为随机值作为占位符
    // 实际应该使用向量相似度
    let score = 0.8

    // 根据文档类型调整权重
    if (doc.metadata.type === 'description') {
      score *= 1.2
    } else if (doc.metadata.type === 'api') {
      score *= 1.0
    } else if (doc.metadata.type === 'example') {
      score *= 0.8
    }

    // 根据查询关键词匹配调整
    const queryLower = query.toLowerCase()
    const contentLower = doc.content.toLowerCase()
    
    if (contentLower.includes(queryLower)) {
      score *= 1.3
    }

    return Math.min(score, 1.0)
  }

  /**
   * 私有方法：计算整体置信度
   */
  private calculateConfidence(scores: number[]): number {
    if (scores.length === 0) return 0
    
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length
    const maxScore = Math.max(...scores)
    
    // 综合平均分和最高分
    return avgScore * 0.6 + maxScore * 0.4
  }

  /**
   * 私有方法：生成使用建议
   */
  private generateSuggestions(query: string, components: ComponentDoc[]): string[] {
    const suggestions: string[] = []
    
    if (components.length === 0) {
      suggestions.push('Try using more general terms in your search')
      suggestions.push('Check if the component name is correct')
    } else {
      if (components.length === 1) {
        suggestions.push(`Found perfect match: ${components[0].componentName}`)
      } else {
        suggestions.push(`Found ${components.length} relevant components`)
        suggestions.push(`Top match: ${components[0].componentName}`)
      }
    }

    return suggestions
  }
}

/**
 * 工厂函数：创建RAG服务实例
 */
export function createRAGService(
  config: RAGConfig,
  sourcePath: string
): RAGService {
  return new RAGService(config, sourcePath)
}

/**
 * 默认配置
 */
export const defaultRAGConfig: RAGConfig = {
  vectorStore: 'file',
  embeddingModel: 'openai',
  dimension: 1536,
  cache: {
    enabled: true,
    ttl: 300 // 5分钟
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: 'text-embedding-3-small'
  }
}