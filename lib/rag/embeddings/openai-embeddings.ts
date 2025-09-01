import OpenAI from 'openai'
import {
  EmbeddingError
} from '../types'

/**
 * OpenAI Embeddings 服务
 * 用于生成文本向量表示
 */
export class OpenAIEmbeddings {
  private client: OpenAI
  private model: string
  private maxRetries: number
  private retryDelay: number

  constructor(
    apiKey: string,
    model = 'text-embedding-3-small',
    maxRetries = 3,
    retryDelay = 1000
  ) {
    this.client = new OpenAI({ apiKey })
    this.model = model
    this.maxRetries = maxRetries
    this.retryDelay = retryDelay
  }

  /**
   * 生成单个文本的向量
   */
  async embedText(text: string): Promise<number[]> {
    if (!text.trim()) {
      throw new EmbeddingError('Text cannot be empty', 'openai')
    }

    try {
      const response = await this.createEmbedding([text])
      return response[0]
    } catch (error) {
      throw new EmbeddingError(
        `Failed to generate embedding for text: ${error}`,
        'openai'
      )
    }
  }

  /**
   * 批量生成文本向量
   */
  async embedTexts(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return []
    }

    // 过滤空文本
    const validTexts = texts.filter(text => text.trim())
    if (validTexts.length === 0) {
      throw new EmbeddingError('No valid texts provided', 'openai')
    }

    try {
      return await this.createEmbedding(validTexts)
    } catch (error) {
      throw new EmbeddingError(
        `Failed to generate embeddings for ${validTexts.length} texts: ${error}`,
        'openai'
      )
    }
  }

  /**
   * 分块处理大量文本
   */
  async embedTextsInBatches(
    texts: string[],
    batchSize = 100
  ): Promise<number[][]> {
    const results: number[][] = []
    
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize)
      const embeddings = await this.embedTexts(batch)
      results.push(...embeddings)
      
      // 简单的速率限制
      if (i + batchSize < texts.length) {
        await this.delay(100)
      }
    }
    
    return results
  }

  /**
   * 获取模型信息
   */
  getModelInfo(): {
    model: string
    maxTokens: number
    dimensions: number
  } {
    const modelInfo: Record<string, { maxTokens: number; dimensions: number }> = {
      'text-embedding-3-small': { maxTokens: 8192, dimensions: 1536 },
      'text-embedding-3-large': { maxTokens: 8192, dimensions: 3072 },
      'text-embedding-ada-002': { maxTokens: 8192, dimensions: 1536 }
    }
    
    return {
      model: this.model,
      ...modelInfo[this.model] || { maxTokens: 8192, dimensions: 1536 }
    }
  }

  /**
   * 估算文本token数量
   */
  estimateTokens(text: string): number {
    // 简单估算：英文大约4个字符=1个token，中文1个字符=1个token
    const englishChars = text.match(/[a-zA-Z\s]/g)?.length || 0
    const otherChars = text.length - englishChars
    
    return Math.ceil(englishChars / 4) + otherChars
  }

  /**
   * 截断文本以适应token限制
   */
  truncateText(text: string, maxTokens?: number): string {
    const limit = maxTokens || this.getModelInfo().maxTokens
    const estimatedTokens = this.estimateTokens(text)
    
    if (estimatedTokens <= limit) {
      return text
    }
    
    // 简单截断策略
    const ratio = limit / estimatedTokens
    const maxLength = Math.floor(text.length * ratio * 0.9) // 留10%缓冲
    
    return text.slice(0, maxLength) + '...'
  }

  /**
   * 私有方法：调用OpenAI API
   */
  private async createEmbedding(texts: string[]): Promise<number[][]> {
    let lastError: Error | null = null
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.client.embeddings.create({
          model: this.model,
          input: texts,
          encoding_format: 'float'
        })
        
        return response.data
          .sort((a: any, b: any) => a.index - b.index) // 确保顺序正确
          .map((item: any) => item.embedding)
      } catch (error) {
        lastError = error as Error
        
        if (attempt < this.maxRetries) {
          await this.delay(this.retryDelay * attempt)
          continue
        }
        
        // 检查是否是配额错误
        if (error instanceof Error && error.message.includes('quota')) {
          throw new EmbeddingError(
            'OpenAI API quota exceeded. Please check your billing.',
            'openai'
          )
        }
        
        // 检查是否是认证错误
        if (error instanceof Error && error.message.includes('401')) {
          throw new EmbeddingError(
            'OpenAI API authentication failed. Please check your API key.',
            'openai'
          )
        }
        
        throw new EmbeddingError(
          `OpenAI API error after ${this.maxRetries} attempts: ${lastError?.message}`,
          'openai'
        )
      }
    }
    
    throw new EmbeddingError(
      `Failed to create embedding after ${this.maxRetries} attempts`,
      'openai'
    )
  }

  /**
   * 私有方法：延时函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

/**
 * 工厂函数：创建OpenAI Embeddings实例
 */
export function createOpenAIEmbeddings(config: {
  apiKey: string
  model?: string
  maxRetries?: number
  retryDelay?: number
}): OpenAIEmbeddings {
  return new OpenAIEmbeddings(
    config.apiKey,
    config.model,
    config.maxRetries,
    config.retryDelay
  )
}

/**
 * 批量处理组件文档的便捷函数
 */
export async function embedComponentDocs(
  embeddings: OpenAIEmbeddings,
  docs: Array<{
    componentName: string
    description: string
    api: string
    examples: string[]
  }>
): Promise<Array<{
  componentName: string
  descriptionEmbedding: number[]
  apiEmbedding: number[]
  exampleEmbeddings: number[][]
}>> {
  const results = []
  
  for (const doc of docs) {
    try {
      // 准备文本
      const descriptionText = embeddings.truncateText(doc.description, 1000)
      const apiText = embeddings.truncateText(doc.api, 2000)
      const exampleTexts = doc.examples
        .map(example => embeddings.truncateText(example, 1000))
        .slice(0, 3) // 最多3个例子
      
      // 生成向量
      const [descriptionEmbedding, apiEmbedding, ...exampleEmbeddings] = 
        await embeddings.embedTexts([
          descriptionText,
          apiText,
          ...exampleTexts
        ])
      
      results.push({
        componentName: doc.componentName,
        descriptionEmbedding,
        apiEmbedding,
        exampleEmbeddings
      })
      
      // 简单速率限制
      await embeddings['delay'](50)
    } catch (error) {
      console.warn(`Failed to embed component ${doc.componentName}:`, error)
      // 继续处理其他组件
    }
  }
  
  return results
}