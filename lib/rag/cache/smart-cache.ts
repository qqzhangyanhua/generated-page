import { RAGSearchResponse } from '../types'
import crypto from 'crypto'

/**
 * 缓存条目接口
 */
interface CacheEntry {
  value: RAGSearchResponse
  timestamp: number
  hits: number
  embedding?: number[]
}

/**
 * 缓存统计接口
 */
export interface CacheStats {
  size: number
  hits: number
  misses: number
  hitRate: number
  avgResponseTime: number
  oldestEntry: number
  totalQueries: number
}

/**
 * 智能缓存实现 - LRU + 语义相似度
 */
export class SmartCache {
  private cache: Map<string, CacheEntry>
  private semanticCache: Map<string, CacheEntry>
  private maxSize: number
  private maxAge: number
  private similarityThreshold: number
  private stats: {
    hits: number
    misses: number
    totalResponseTime: number
    queries: number
  }

  constructor(
    maxSize = 1000,
    maxAge = 300000, // 5分钟
    similarityThreshold = 0.95
  ) {
    this.cache = new Map()
    this.semanticCache = new Map()
    this.maxSize = maxSize
    this.maxAge = maxAge
    this.similarityThreshold = similarityThreshold
    this.stats = {
      hits: 0,
      misses: 0,
      totalResponseTime: 0,
      queries: 0
    }
  }

  /**
   * 生成缓存键
   */
  private generateKey(query: string, filters?: any): string {
    const hash = crypto.createHash('md5')
    hash.update(query.toLowerCase().trim())
    if (filters) {
      hash.update(JSON.stringify(filters))
    }
    return hash.digest('hex')
  }

  /**
   * 计算余弦相似度
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0
    
    let dotProduct = 0
    let normA = 0
    let normB = 0
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i]
      normA += a[i] * a[i]
      normB += b[i] * b[i]
    }
    
    if (normA === 0 || normB === 0) return 0
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
  }

  /**
   * 获取缓存结果
   */
  async get(
    query: string,
    embedding?: number[],
    filters?: any
  ): Promise<RAGSearchResponse | null> {
    const startTime = Date.now()
    this.stats.queries++

    // 1. 尝试精确匹配
    const key = this.generateKey(query, filters)
    const exactMatch = this.cache.get(key)
    
    if (exactMatch) {
      // 检查是否过期
      if (Date.now() - exactMatch.timestamp <= this.maxAge) {
        exactMatch.hits++
        this.stats.hits++
        this.stats.totalResponseTime += Date.now() - startTime
        
        // LRU: 移到最后
        this.cache.delete(key)
        this.cache.set(key, exactMatch)
        
        console.log(`[Cache] 精确命中: ${query}`)
        return exactMatch.value
      } else {
        // 过期，删除
        this.cache.delete(key)
      }
    }

    // 2. 尝试语义相似匹配（如果提供了embedding）
    if (embedding && embedding.length > 0) {
      const semanticEntries = Array.from(this.semanticCache.values())
      for (const entry of semanticEntries) {
        if (entry.embedding && Date.now() - entry.timestamp <= this.maxAge) {
          const similarity = this.cosineSimilarity(embedding, entry.embedding)
          
          if (similarity >= this.similarityThreshold) {
            entry.hits++
            this.stats.hits++
            this.stats.totalResponseTime += Date.now() - startTime
            
            console.log(`[Cache] 语义命中 (相似度: ${(similarity * 100).toFixed(1)}%): ${query}`)
            return entry.value
          }
        }
      }
    }

    this.stats.misses++
    this.stats.totalResponseTime += Date.now() - startTime
    return null
  }

  /**
   * 设置缓存
   */
  set(
    query: string,
    value: RAGSearchResponse,
    embedding?: number[],
    filters?: any
  ): void {
    const key = this.generateKey(query, filters)
    
    // LRU淘汰策略
    if (this.cache.size >= this.maxSize) {
      const firstEntry = Array.from(this.cache.keys())[0]
      if (firstEntry) {
        this.cache.delete(firstEntry)
        
        // 同时检查语义缓存
        if (this.semanticCache.has(firstEntry)) {
          this.semanticCache.delete(firstEntry)
        }
      }
    }

    const entry: CacheEntry = {
      value,
      timestamp: Date.now(),
      hits: 0,
      embedding
    }

    // 添加到精确缓存
    this.cache.set(key, entry)

    // 如果有embedding，也添加到语义缓存
    if (embedding && embedding.length > 0) {
      this.semanticCache.set(key, entry)
    }

    console.log(`[Cache] 缓存添加: ${query} (总缓存数: ${this.cache.size})`)
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear()
    this.semanticCache.clear()
    console.log('[Cache] 缓存已清空')
  }

  /**
   * 获取缓存统计
   */
  getStats(): CacheStats {
    const entries = Array.from(this.cache.values())
    const oldestTimestamp = entries.length > 0 
      ? Math.min(...entries.map(e => e.timestamp))
      : Date.now()

    return {
      size: this.cache.size,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: this.stats.queries > 0 
        ? this.stats.hits / this.stats.queries 
        : 0,
      avgResponseTime: this.stats.queries > 0
        ? this.stats.totalResponseTime / this.stats.queries
        : 0,
      oldestEntry: oldestTimestamp,
      totalQueries: this.stats.queries
    }
  }

  /**
   * 预热缓存
   */
  async warmup(commonQueries: string[]): Promise<void> {
    console.log(`[Cache] 开始预热缓存，${commonQueries.length} 个常用查询`)
    // 这里可以预先缓存一些常用查询
    // 需要配合RAG服务实现
  }

  /**
   * 导出缓存（用于持久化）
   */
  export(): string {
    const data = {
      cache: Array.from(this.cache.entries()),
      semanticCache: Array.from(this.semanticCache.entries()),
      stats: this.stats,
      timestamp: Date.now()
    }
    return JSON.stringify(data)
  }

  /**
   * 导入缓存（从持久化恢复）
   */
  import(data: string): void {
    try {
      const parsed = JSON.parse(data)
      
      // 恢复缓存 - 使用Array.from处理兼容性
      this.cache = new Map(Array.from(parsed.cache))
      this.semanticCache = new Map(Array.from(parsed.semanticCache))
      this.stats = parsed.stats || this.stats
      
      // 清理过期条目
      const now = Date.now()
      const entriesToDelete: string[] = []
      
      for (const [key, entry] of Array.from(this.cache.entries())) {
        if (now - entry.timestamp > this.maxAge) {
          entriesToDelete.push(key)
        }
      }
      
      // 删除过期条目
      for (const key of entriesToDelete) {
        this.cache.delete(key)
        this.semanticCache.delete(key)
      }
      
      console.log(`[Cache] 导入成功，恢复 ${this.cache.size} 个缓存条目`)
    } catch (error) {
      console.error('[Cache] 导入失败:', error)
    }
  }
}

/**
 * 创建默认缓存实例
 */
export function createSmartCache(
  maxSize?: number,
  maxAge?: number,
  similarityThreshold?: number
): SmartCache {
  return new SmartCache(maxSize, maxAge, similarityThreshold)
}