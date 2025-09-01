/**
 * RAG (Retrieval-Augmented Generation) 基础类型定义
 * 用于私有组件智能检索和代码生成
 */

// 组件文档结构
export interface ComponentDoc {
  /** 包名，如 "@private/basic-components" */
  packageName: string
  /** 组件名称，如 "Button", "Table" */
  componentName: string
  /** 组件功能描述 */
  description: string
  /** API文档内容 */
  api: string
  /** 使用示例代码 */
  examples: string[]
  /** 组件标签，用于分类和搜索 */
  tags: string[]
  /** 组件版本 */
  version: string
  /** 依赖的其他组件 */
  dependencies: string[]
  /** 文档最后更新时间 */
  updatedAt: string
}

// 向量化文档
export interface VectorDocument {
  /** 文档唯一ID */
  id: string
  /** 文档内容 */
  content: string
  /** 向量表示 */
  embedding: number[]
  /** 元数据 */
  metadata: {
    componentName: string
    packageName: string
    type: 'description' | 'api' | 'example' | 'usage'
    tags: string[]
    version: string
  }
}

// RAG检索请求
export interface RAGSearchRequest {
  /** 搜索查询 */
  query: string
  /** 返回结果数量 */
  topK?: number
  /** 过滤条件 */
  filters?: {
    packageName?: string
    componentName?: string
    tags?: string[]
    version?: string
  }
  /** 最小相似度阈值 */
  threshold?: number
}

// RAG检索响应
export interface RAGSearchResponse {
  /** 匹配的组件文档 */
  components: ComponentDoc[]
  /** 相似度得分 */
  scores: number[]
  /** 检索置信度 */
  confidence: number
  /** 使用建议 */
  suggestions: string[]
  /** 查询用时(ms) */
  duration: number
}

// RAG服务配置
export interface RAGConfig {
  /** 向量存储类型 */
  vectorStore: 'file' | 'pinecone' | 'weaviate'
  /** Embeddings模型 */
  embeddingModel: 'openai' | 'local'
  /** 向量维度 */
  dimension: number
  /** 缓存配置 */
  cache?: {
    enabled: boolean
    ttl: number // 缓存时间(秒)
    maxSize?: number // 最大缓存条目数
  }
  /** OpenAI配置 */
  openai?: {
    apiKey: string
    model: string // 如 "text-embedding-3-small"
  }
  /** Pinecone配置 */
  pinecone?: {
    apiKey: string
    environment: string
    indexName: string
  }
}

// 组件解析结果
export interface ParsedComponent {
  /** 组件信息 */
  info: ComponentDoc
  /** 源文件路径 */
  filePath: string
  /** 解析状态 */
  status: 'success' | 'error' | 'partial'
  /** 错误信息 */
  error?: string
}

// RAG索引统计
export interface RAGIndexStats {
  /** 总组件数 */
  totalComponents: number
  /** 总文档数 */
  totalDocuments: number
  /** 索引大小(bytes) */
  indexSize: number
  /** 最后更新时间 */
  lastUpdated: string
  /** 各包的组件数量统计 */
  packageStats: Record<string, number>
}

// RAG服务状态
export interface RAGServiceStatus {
  /** 服务是否可用 */
  available: boolean
  /** 索引统计 */
  stats: RAGIndexStats
  /** 配置信息 */
  config: Omit<RAGConfig, 'openai' | 'pinecone'> // 隐藏敏感信息
  /** 健康检查时间 */
  checkedAt: string
}

// 组件同步请求
export interface ComponentSyncRequest {
  /** 源码路径 */
  sourcePath: string
  /** 是否强制重新索引 */
  forceReindex?: boolean
  /** 同步的包名列表，空则同步所有 */
  packages?: string[]
}

// 组件同步响应
export interface ComponentSyncResponse {
  /** 同步状态 */
  status: 'success' | 'partial' | 'failed'
  /** 处理的组件数 */
  processedCount: number
  /** 成功的组件数 */
  successCount: number
  /** 失败的组件数 */
  failedCount: number
  /** 错误详情 */
  errors: string[]
  /** 同步用时(ms) */
  duration: number
}

// Codegen规则扩展
export interface RAGEnhancedRule {
  type: 'rag-enhanced'
  enabled: boolean
  /** 向量存储命名空间 */
  namespace: string
  /** RAG检索配置 */
  searchConfig?: Partial<RAGSearchRequest>
}

// AI工作流上下文扩展
export interface RAGWorkflowContext {
  /** RAG检索到的组件 */
  ragComponents?: ComponentDoc[]
  /** RAG检索置信度 */
  ragConfidence?: number
  /** RAG检索耗时 */
  ragDuration?: number
}

// 错误类型
export class RAGError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, any>
  ) {
    super(message)
    this.name = 'RAGError'
  }
}

export class ComponentParseError extends RAGError {
  constructor(message: string, public filePath: string) {
    super(message, 'COMPONENT_PARSE_ERROR', { filePath })
  }
}

export class VectorStoreError extends RAGError {
  constructor(message: string, operation: string) {
    super(message, 'VECTOR_STORE_ERROR', { operation })
  }
}

export class EmbeddingError extends RAGError {
  constructor(message: string, public provider: string) {
    super(message, 'EMBEDDING_ERROR', { provider })
  }
}