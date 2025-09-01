import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import {
  VectorDocument,
  RAGIndexStats,
  VectorStoreError
} from '../types'

/**
 * 基于文件系统的轻量向量存储
 * 用于开发和快速原型阶段
 */
export class FileVectorStore {
  private readonly indexPath: string
  private readonly documentsPath: string
  private readonly metadataPath: string

  constructor(basePath = './data/rag-index') {
    this.indexPath = path.join(basePath, 'vectors.json')
    this.documentsPath = path.join(basePath, 'documents.json')
    this.metadataPath = path.join(basePath, 'metadata.json')
  }

  /**
   * 初始化存储目录
   */
  async initialize(): Promise<void> {
    try {
      const baseDir = path.dirname(this.indexPath)
      await fs.mkdir(baseDir, { recursive: true })
      
      // 创建默认文件
      await this.ensureFileExists(this.indexPath, '[]')
      await this.ensureFileExists(this.documentsPath, '[]')
      await this.ensureFileExists(this.metadataPath, JSON.stringify({
        totalDocuments: 0,
        indexSize: 0,
        lastUpdated: new Date().toISOString(),
        version: '1.0.0'
      }))
    } catch (error) {
      throw new VectorStoreError(
        `Failed to initialize vector store: ${error}`,
        'initialize'
      )
    }
  }

  /**
   * 添加文档到向量存储
   */
  async addDocuments(documents: VectorDocument[]): Promise<void> {
    try {
      await this.initialize()
      
      const existingDocs = await this.loadDocuments()
      const existingIndex = await this.loadIndex()
      
      // 检查重复文档
      const existingIds = new Set(existingDocs.map(doc => doc.id))
      const newDocs = documents.filter(doc => !existingIds.has(doc.id))
      
      if (newDocs.length === 0) {
        return // 没有新文档需要添加
      }
      
      // 保存文档
      const allDocs = [...existingDocs, ...newDocs]
      await this.saveDocuments(allDocs)
      
      // 保存向量索引
      const newIndexEntries = newDocs.map(doc => ({
        id: doc.id,
        embedding: doc.embedding,
        metadata: doc.metadata
      }))
      
      const allIndexEntries = [...existingIndex, ...newIndexEntries]
      await this.saveIndex(allIndexEntries)
      
      // 更新元数据
      await this.updateMetadata(allDocs.length)
    } catch (error) {
      throw new VectorStoreError(
        `Failed to add documents: ${error}`,
        'addDocuments'
      )
    }
  }

  /**
   * 相似度搜索
   */
  async similaritySearch(
    queryEmbedding: number[],
    topK = 5,
    threshold = 0.5
  ): Promise<VectorDocument[]> {
    try {
      const index = await this.loadIndex()
      const documents = await this.loadDocuments()
      
      if (index.length === 0) {
        return []
      }
      
      // 计算相似度得分
      const similarities = index.map(item => ({
        ...item,
        similarity: this.cosineSimilarity(queryEmbedding, item.embedding)
      }))
      
      // 过滤和排序
      const filtered = similarities
        .filter(item => item.similarity >= threshold)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, topK)
      
      // 返回完整文档
      const docMap = new Map(documents.map(doc => [doc.id, doc]))
      
      return filtered
        .map(item => docMap.get(item.id))
        .filter((doc): doc is VectorDocument => doc !== undefined)
    } catch (error) {
      throw new VectorStoreError(
        `Failed to perform similarity search: ${error}`,
        'similaritySearch'
      )
    }
  }

  /**
   * 删除文档
   */
  async deleteDocuments(ids: string[]): Promise<void> {
    try {
      const documents = await this.loadDocuments()
      const index = await this.loadIndex()
      
      const idsSet = new Set(ids)
      const remainingDocs = documents.filter(doc => !idsSet.has(doc.id))
      const remainingIndex = index.filter(item => !idsSet.has(item.id))
      
      await this.saveDocuments(remainingDocs)
      await this.saveIndex(remainingIndex)
      await this.updateMetadata(remainingDocs.length)
    } catch (error) {
      throw new VectorStoreError(
        `Failed to delete documents: ${error}`,
        'deleteDocuments'
      )
    }
  }

  /**
   * 清空所有文档
   */
  async clear(): Promise<void> {
    try {
      await this.saveDocuments([])
      await this.saveIndex([])
      await this.updateMetadata(0)
    } catch (error) {
      throw new VectorStoreError(
        `Failed to clear vector store: ${error}`,
        'clear'
      )
    }
  }

  /**
   * 获取存储统计信息
   */
  async getStats(): Promise<RAGIndexStats> {
    try {
      const documents = await this.loadDocuments()
      const indexStat = await fs.stat(this.indexPath).catch(() => ({ size: 0 }))
      const docsStat = await fs.stat(this.documentsPath).catch(() => ({ size: 0 }))
      
      // 统计各包的组件数量
      const packageStats: Record<string, number> = {}
      documents.forEach(doc => {
        const packageName = doc.metadata.packageName
        packageStats[packageName] = (packageStats[packageName] || 0) + 1
      })
      
      return {
        totalComponents: new Set(documents.map(doc => doc.metadata.componentName)).size,
        totalDocuments: documents.length,
        indexSize: indexStat.size + docsStat.size,
        lastUpdated: new Date().toISOString(),
        packageStats
      }
    } catch (error) {
      throw new VectorStoreError(
        `Failed to get stats: ${error}`,
        'getStats'
      )
    }
  }

  /**
   * 根据元数据过滤搜索
   */
  async searchWithFilters(
    queryEmbedding: number[],
    filters: {
      packageName?: string
      componentName?: string
      tags?: string[]
      type?: string
    },
    topK = 5,
    threshold = 0.5
  ): Promise<VectorDocument[]> {
    try {
      const allResults = await this.similaritySearch(queryEmbedding, 1000, threshold)
      
      // 应用过滤器
      const filtered = allResults.filter(doc => {
        if (filters.packageName && doc.metadata.packageName !== filters.packageName) {
          return false
        }
        
        if (filters.componentName && doc.metadata.componentName !== filters.componentName) {
          return false
        }
        
        if (filters.type && doc.metadata.type !== filters.type) {
          return false
        }
        
        if (filters.tags && filters.tags.length > 0) {
          const hasMatchingTag = filters.tags.some(tag => 
            doc.metadata.tags.includes(tag)
          )
          if (!hasMatchingTag) {
            return false
          }
        }
        
        return true
      })
      
      return filtered.slice(0, topK)
    } catch (error) {
      throw new VectorStoreError(
        `Failed to search with filters: ${error}`,
        'searchWithFilters'
      )
    }
  }

  /**
   * 私有方法：计算余弦相似度
   */
  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      throw new Error('Vector dimensions must match')
    }
    
    let dotProduct = 0
    let normA = 0
    let normB = 0
    
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i]
      normA += vecA[i] * vecA[i]
      normB += vecB[i] * vecB[i]
    }
    
    const magnitude = Math.sqrt(normA) * Math.sqrt(normB)
    
    if (magnitude === 0) {
      return 0
    }
    
    return dotProduct / magnitude
  }

  /**
   * 私有方法：加载文档
   */
  private async loadDocuments(): Promise<VectorDocument[]> {
    try {
      const content = await fs.readFile(this.documentsPath, 'utf-8')
      return JSON.parse(content) || []
    } catch {
      return []
    }
  }

  /**
   * 私有方法：保存文档
   */
  private async saveDocuments(documents: VectorDocument[]): Promise<void> {
    await fs.writeFile(this.documentsPath, JSON.stringify(documents, null, 2))
  }

  /**
   * 私有方法：加载索引
   */
  private async loadIndex(): Promise<Array<{
    id: string
    embedding: number[]
    metadata: VectorDocument['metadata']
  }>> {
    try {
      const content = await fs.readFile(this.indexPath, 'utf-8')
      return JSON.parse(content) || []
    } catch {
      return []
    }
  }

  /**
   * 私有方法：保存索引
   */
  private async saveIndex(
    index: Array<{
      id: string
      embedding: number[]
      metadata: VectorDocument['metadata']
    }>
  ): Promise<void> {
    await fs.writeFile(this.indexPath, JSON.stringify(index, null, 2))
  }

  /**
   * 私有方法：更新元数据
   */
  private async updateMetadata(totalDocuments: number): Promise<void> {
    const metadata = {
      totalDocuments,
      indexSize: 0, // 会在getStats中重新计算
      lastUpdated: new Date().toISOString(),
      version: '1.0.0'
    }
    
    await fs.writeFile(this.metadataPath, JSON.stringify(metadata, null, 2))
  }

  /**
   * 私有方法：确保文件存在
   */
  private async ensureFileExists(filePath: string, defaultContent: string): Promise<void> {
    try {
      await fs.access(filePath)
    } catch {
      await fs.writeFile(filePath, defaultContent)
    }
  }

  /**
   * 生成文档ID
   */
  static generateDocumentId(
    componentName: string,
    type: string,
    content: string
  ): string {
    const hash = crypto.createHash('md5')
      .update(`${componentName}-${type}-${content}`)
      .digest('hex')
    return `${componentName}-${type}-${hash.slice(0, 8)}`
  }
}