# RAG 技术实现指南

## 📋 快速开始

### 🚀 环境配置

1. **配置OpenAI API密钥**
```bash
# 编辑环境变量
echo "OPENAI_API_KEY=your-openai-api-key" >> .env
echo "OPENAI_BASE_URL=https://api.openai.com/v1" >> .env
```

2. **配置组件源码路径**
```bash
echo "PRIVATE_COMPONENTS_SOURCE_PATH=/path/to/your/components" >> .env
```

3. **启动服务并同步组件**
```bash
# 启动开发服务器
pnpm dev

# 同步私有组件数据
curl -X POST http://localhost:3001/api/rag/sync \
  -H "Content-Type: application/json" \
  -d '{"namespace": "private-basic-components", "sourcePath": "/path/to/components"}'
```

### ⚡ 基本使用

**搜索组件**
```bash
curl -X POST http://localhost:3001/api/rag/search \
  -H "Content-Type: application/json" \
  -d '{"query": "登录按钮组件", "topK": 5}'
```

**检查系统状态**
```bash
curl http://localhost:3001/api/admin/rag
```

## 🏗️ 核心代码结构

### 📁 文件组织

```
lib/rag/
├── types.ts                    # 类型定义
├── parsers/
│   └── component-parser.ts     # 组件解析器
├── embeddings/
│   └── openai-embeddings.ts    # 向量化服务  
├── vector-store/
│   └── file-store.ts          # 向量存储
├── cache/                      # 新增缓存模块
│   └── smart-cache.ts         # 智能缓存系统
└── service/
    ├── rag-service.ts         # 核心服务 (已优化)
    └── index.ts               # 服务工厂

app/api/rag/
├── search/route.ts            # 搜索API
├── sync/route.ts              # 同步API
└── admin/rag/route.ts         # 管理API

app/api/ai-core/steps/
├── design-component/utils.ts   # 设计阶段RAG集成
└── generate-component/utils.ts # 生成阶段RAG集成 (已优化)

scripts/                       # 新增工具脚本
├── add-custom-components.js    # 自动添加组件库
├── test-custom-components.sh   # 组件测试脚本
└── test-rag-performance.js     # 性能测试工具
```

### 🔧 关键实现

**1. 组件文档解析**
```typescript
// lib/rag/parsers/component-parser.ts
export class ComponentParser {
  async parseAllComponents(): Promise<ComponentDoc[]> {
    const componentDirs = await this.scanComponentDirectories()
    const results: ComponentDoc[] = []
    
    for (const dir of componentDirs) {
      try {
        const component = await this.parseComponent(dir)
        if (component) results.push(component)
      } catch (error) {
        console.error(`Failed to parse component ${dir}:`, error)
      }
    }
    
    return results
  }
  
  private async parseComponent(componentPath: string): Promise<ComponentDoc | null> {
    const files = await this.loadComponentFiles(componentPath)
    const componentName = path.basename(componentPath)
    
    return this.extractComponentDoc(componentName, files)
  }
  
  private extractComponentDoc(name: string, files: ComponentFiles): ComponentDoc {
    return {
      packageName: '@private/basic-components',
      componentName: name,
      description: this.extractDescription(files),
      api: this.extractAPI(files),
      examples: this.extractExamples(files),
      tags: this.extractTags(files),
      version: this.extractVersion(files),
      dependencies: this.extractDependencies(files),
      updatedAt: new Date().toISOString()
    }
  }
}
```

**2. 向量化处理**
```typescript
// lib/rag/embeddings/openai-embeddings.ts
export class OpenAIEmbeddings {
  async embedTexts(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = []
    
    for (let i = 0; i < texts.length; i += this.batchSize) {
      const batch = texts.slice(i, i + this.batchSize)
      const batchEmbeddings = await this.embedBatch(batch)
      embeddings.push(...batchEmbeddings)
    }
    
    return embeddings
  }
  
  private async embedBatch(texts: string[]): Promise<number[][]> {
    const response = await fetch(`${this.baseURL}/embeddings`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        input: texts,
        model: this.model
      })
    })
    
    const data = await response.json()
    return data.data.map((item: any) => item.embedding)
  }
}
```

**3. 向量搜索实现 (已优化 - 智能缓存)**
```typescript
// lib/rag/vector-store/file-store.ts
export class FileVectorStore {
  async similaritySearch(
    queryVector: number[], 
    topK: number,
    threshold?: number
  ): Promise<VectorSearchResult[]> {
    
    const similarities = this.vectors.map(vector => ({
      id: vector.id,
      score: this.cosineSimilarity(queryVector, vector.embedding),
      document: this.documents.find(doc => doc.id === vector.id)!
    }))
    
    return similarities
      .filter(s => !threshold || s.score >= threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
  }
  
  private cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, ai, i) => sum + ai * b[i], 0)
    const magnitudeA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0))
    const magnitudeB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0))
    
    if (magnitudeA === 0 || magnitudeB === 0) return 0
    return dotProduct / (magnitudeA * magnitudeB)
  }
}
```

**4. 智能缓存实现 (新增)**
```typescript
// lib/rag/cache/smart-cache.ts
export class SmartCache {
  private cache: Map<string, CacheEntry>
  private semanticCache: Map<string, CacheEntry>
  private similarityThreshold = 0.92
  
  async get(query: string, embedding?: number[], filters?: any): Promise<RAGSearchResponse | null> {
    // 1. 精确匹配
    const key = this.generateKey(query, filters)
    const exact = this.cache.get(key)
    if (exact && !this.isExpired(exact)) {
      return exact.value
    }
    
    // 2. 语义相似匹配
    if (embedding) {
      for (const entry of this.semanticCache.values()) {
        if (entry.embedding && !this.isExpired(entry)) {
          const similarity = this.cosineSimilarity(embedding, entry.embedding)
          if (similarity >= this.similarityThreshold) {
            return entry.value // 语义缓存命中!
          }
        }
      }
    }
    
    return null
  }
  
  set(query: string, value: RAGSearchResponse, embedding?: number[]): void {
    // LRU淘汰 + 双重缓存存储
    if (this.cache.size >= this.maxSize) {
      this.evictOldest()
    }
    
    const entry = { value, timestamp: Date.now(), embedding }
    this.cache.set(key, entry)
    
    if (embedding) {
      this.semanticCache.set(key, entry)
    }
  }
}
```

**5. 批量向量化优化 (新增)**
```typescript
// lib/rag/service/rag-service.ts
private async createComponentVectors(component: ComponentDoc): Promise<VectorDocument[]> {
  // 收集所有需要向量化的文本
  const texts: string[] = []
  const metadataList: VectorMetadata[] = []
  
  if (component.description) {
    texts.push(component.description)
    metadataList.push({ ...baseMetadata, type: 'description' })
  }
  
  if (component.api) {
    texts.push(component.api)
    metadataList.push({ ...baseMetadata, type: 'api' })
  }
  
  component.examples.forEach(example => {
    if (example.trim()) {
      texts.push(example)
      metadataList.push({ ...baseMetadata, type: 'example' })
    }
  })
  
  // 批量向量化 - 一次API调用处理多个文本
  const embeddings = await this.embeddings.embedTexts(texts)
  
  // 构建向量文档
  return embeddings.map((embedding, index) => ({
    id: this.generateDocumentId(component.componentName, metadataList[index].type, texts[index]),
    content: texts[index],
    embedding,
    metadata: metadataList[index]
  }))
}
```

**6. 并发处理优化 (新增)**
```typescript
// lib/rag/service/rag-service.ts
async syncComponents(request: ComponentSyncRequest): Promise<ComponentSyncResponse> {
  const BATCH_SIZE = 10 // 每批10个组件并发处理
  const batches = this.chunkArray(componentsToSync, BATCH_SIZE)
  
  for (const batch of batches) {
    // 并发处理当前批次
    const batchPromises = batch.map(async (component) => {
      try {
        const vectors = await this.createComponentVectors(component.info)
        return { success: true, vectors }
      } catch (error) {
        return { success: false, error: error.message }
      }
    })
    
    const batchResults = await Promise.all(batchPromises)
    
    // 收集成功的向量并批量存储
    const vectorDocuments = batchResults
      .filter(r => r.success)
      .flatMap(r => r.vectors)
    
    if (vectorDocuments.length > 0) {
      await this.vectorStore.addDocuments(vectorDocuments)
    }
  }
}
```

**4. AI工作流集成**
```typescript
// app/api/ai-core/steps/design-component/utils.ts
async function performRAGSearch(
  query: string,
  rules: CodegenRule[]
): Promise<{ components: ComponentDoc[], confidence: number } | null> {
  
  const ragConfig = getRagEnhancedRule(rules)
  if (!ragConfig) {
    console.log('RAG not enabled in rules')
    return null
  }

  const config = {
    ...defaultRAGConfig,
    openai: {
      apiKey: process.env.OPENAI_API_KEY || '',
      model: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small'
    }
  }

  const ragService = createRAGService(config, sourcePath)
  await ragService.initialize()

  const result = await ragService.searchComponents({
    query,
    topK: ragConfig.searchConfig.topK,
    threshold: ragConfig.searchConfig.threshold,
    filters: ragConfig.searchConfig.filters
  })

  return {
    components: result.components,
    confidence: result.confidence
  }
}
```

## 🎯 AI提示词增强

### 📝 设计阶段提示词
```typescript
function buildRAGEnhancedSystemPrompt(rules: CodegenRule[], ragComponents?: ComponentDoc[]): string {
  if (!ragComponents?.length) return buildStaticPrompt(rules)
  
  const componentNames = ragComponents.map(comp => comp.componentName).sort()
  
  return `
    # You are a senior frontend engineer specializing in component design
    
    ## Available Components (RAG-Enhanced)
    🚨 FORBIDDEN COMPONENT NAMES (DO NOT USE):
    - TextInput (doesn't exist - use "Input" instead)
    - TextField (doesn't exist - use "Input" instead)  
    - PrimaryButton (doesn't exist - use "Button" instead)
    
    🎯 ALLOWED COMPONENT NAMES ONLY:
    ${componentNames.join(', ')}
    
    ## Critical Rules:
    1. ONLY use exact component names from the list above
    2. Package name MUST be "@private/basic-components"
    3. For text input, use "Input" NOT "TextInput"
    4. For buttons, use "Button" NOT "PrimaryButton"
  `
}
```

### 🔧 生成阶段提示词
```typescript
function generatePrivateComponents(ragComponents?: ComponentDoc[]): string {
  if (!ragComponents?.length) return ""
  
  const componentNames = ragComponents.map(comp => comp.componentName).sort()
  const componentNamesList = componentNames.join(', ')
  
  return `
    **Private Components (RAG-Enhanced)**
    🔥 CRITICAL PACKAGE NAME: "@private/basic-components"
    
    **⚠️ ABSOLUTE COMPONENT NAME RESTRICTIONS:**
    - NEVER use "TextInput" - it does not exist!
    - NEVER use "TextField" - it does not exist!  
    - NEVER use "PrimaryButton" - it does not exist!
    
    **🎯 EXACT COMPONENT NAMES (USE ONLY THESE):**
    Available components: ${componentNamesList}
    
    **🚨 CRITICAL RULES:**
    1. ONLY use component names from the list above
    2. For text input, use "Input" NOT "TextInput" 
    3. For buttons, use "Button" NOT "PrimaryButton"
    4. Copy component names EXACTLY as shown above
  `
}
```

## 🔍 调试和监控

### 📊 性能监控
```typescript
// 性能指标收集
class RAGMetrics {
  private searchTimes: number[] = []
  private embeddingTimes: number[] = []
  private cacheHits = 0
  private totalQueries = 0
  
  recordSearchTime(duration: number) {
    this.searchTimes.push(duration)
    if (this.searchTimes.length > 1000) {
      this.searchTimes.shift() // 保持最近1000次记录
    }
  }
  
  recordCacheHit() {
    this.cacheHits++
  }
  
  getStats() {
    const avgSearchTime = this.searchTimes.reduce((a, b) => a + b, 0) / this.searchTimes.length
    const cacheHitRate = this.cacheHits / this.totalQueries
    
    return {
      averageSearchTime: avgSearchTime || 0,
      cacheHitRate: cacheHitRate || 0,
      totalQueries: this.totalQueries,
      recentSearchTimes: this.searchTimes.slice(-10)
    }
  }
}
```

### 🛠️ 调试工具
```typescript
// 调试日志工具
const debugLogger = {
  enabled: process.env.RAG_DEBUG === 'true',
  
  log(category: string, message: string, data?: any) {
    if (!this.enabled) return
    
    console.log(`[RAG ${category}] ${new Date().toISOString()}: ${message}`)
    if (data) console.log(JSON.stringify(data, null, 2))
  },
  
  searchQuery(query: string, results: ComponentDoc[]) {
    this.log('SEARCH', `Query: "${query}" -> Found ${results.length} components`, {
      componentNames: results.map(r => r.componentName)
    })
  },
  
  embeddingTime(text: string, duration: number) {
    this.log('EMBEDDING', `Generated embedding in ${duration}ms`, {
      textLength: text.length,
      textPreview: text.substring(0, 100) + '...'
    })
  }
}
```

### 🚨 错误告警
```typescript
// 错误监控和告警
class RAGErrorMonitor {
  private errorCounts = new Map<string, number>()
  private readonly ERROR_THRESHOLD = 10
  private readonly TIME_WINDOW = 5 * 60 * 1000 // 5分钟
  
  recordError(errorType: string, error: Error) {
    const count = this.errorCounts.get(errorType) || 0
    this.errorCounts.set(errorType, count + 1)
    
    // 错误日志
    console.error(`[RAG Error] ${errorType}:`, error)
    
    // 告警检查
    if (count + 1 >= this.ERROR_THRESHOLD) {
      this.sendAlert(errorType, count + 1)
      this.errorCounts.set(errorType, 0) // 重置计数
    }
  }
  
  private async sendAlert(errorType: string, count: number) {
    // 发送钉钉/邮件/Slack通知
    const message = `RAG系统告警: ${errorType} 错误在过去5分钟内发生了${count}次`
    console.error(`🚨 ALERT: ${message}`)
    
    // 可以集成具体的通知服务
    // await sendDingTalkMessage(message)
    // await sendEmail(message)
  }
}
```

## 🧪 测试用例

### ✅ 单元测试
```typescript
// lib/rag/__tests__/component-parser.test.ts
import { ComponentParser } from '../parsers/component-parser'

describe('ComponentParser', () => {
  let parser: ComponentParser
  
  beforeEach(() => {
    parser = new ComponentParser('/test/components')
  })
  
  test('should parse component basic info', async () => {
    const component = await parser.parseComponent('/test/components/Button')
    
    expect(component).toBeDefined()
    expect(component.componentName).toBe('Button')
    expect(component.packageName).toBe('@private/basic-components')
    expect(component.description).toContain('Button')
  })
  
  test('should extract API documentation', async () => {
    const component = await parser.parseComponent('/test/components/Input')
    
    expect(component.api).toContain('props')
    expect(component.api).toContain('Type')
    expect(component.api).toContain('Default')
  })
  
  test('should handle missing files gracefully', async () => {
    const component = await parser.parseComponent('/test/components/NonExistent')
    expect(component).toBeNull()
  })
})
```

### 🎯 集成测试  
```typescript
// lib/rag/__tests__/rag-integration.test.ts
import { createRAGService } from '../service'

describe('RAG Integration', () => {
  let ragService: RAGService
  
  beforeAll(async () => {
    ragService = createRAGService(testConfig, testComponentsPath)
    await ragService.initialize()
    await ragService.syncComponents(testComponentsPath)
  })
  
  test('should find relevant components', async () => {
    const result = await ragService.searchComponents({
      query: 'button for login',
      topK: 5
    })
    
    expect(result.components.length).toBeGreaterThan(0)
    expect(result.components[0].componentName).toMatch(/button/i)
    expect(result.confidence).toBeGreaterThan(0.5)
  })
  
  test('should respect search filters', async () => {
    const result = await ragService.searchComponents({
      query: 'input component',
      topK: 10,
      filters: {
        tags: ['form']
      }
    })
    
    result.components.forEach(comp => {
      expect(comp.tags).toContain('form')
    })
  })
})
```

### 🚀 端到端测试
```typescript
// tests/e2e/rag-workflow.test.ts
import { test, expect } from '@playwright/test'

test.describe('RAG Workflow E2E', () => {
  test('should generate correct component imports', async ({ page }) => {
    // 访问代码生成页面
    await page.goto('/main/codegen')
    
    // 选择Private Component Codegen
    await page.click('[data-testid="private-component-codegen"]')
    
    // 输入测试提示词
    await page.fill('[data-testid="prompt-input"]', '生成登录表单组件，包含用户名输入和登录按钮')
    
    // 点击生成
    await page.click('[data-testid="generate-button"]')
    
    // 等待生成完成
    await page.waitForSelector('[data-testid="generated-code"]', { timeout: 30000 })
    
    // 检查生成的代码
    const generatedCode = await page.textContent('[data-testid="generated-code"]')
    
    // 验证包名正确
    expect(generatedCode).toContain("from '@private/basic-components'")
    expect(generatedCode).not.toContain("from '@private-basic-components'")
    
    // 验证组件名正确
    expect(generatedCode).toContain('Input')
    expect(generatedCode).not.toContain('TextInput')
    
    expect(generatedCode).toContain('Button')
    expect(generatedCode).not.toContain('PrimaryButton')
  })
})
```

## 📈 性能优化

### ⚡ 向量计算优化
```typescript
// 使用Float32Array提升性能
class OptimizedVectorStore {
  private vectors: Map<string, Float32Array> = new Map()
  
  addVector(id: string, embedding: number[]) {
    this.vectors.set(id, new Float32Array(embedding))
  }
  
  cosineSimilarity(a: Float32Array, b: Float32Array): number {
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
}
```

### 🔄 缓存策略
```typescript
// 多级缓存系统
class MultiLevelCache {
  // L1: 内存缓存 - 最快访问
  private memoryCache = new Map<string, any>()
  
  // L2: Redis缓存 - 跨实例共享 (可选)
  private redisCache?: RedisClient
  
  // L3: 文件缓存 - 持久化存储
  private fileCache = new Map<string, string>()
  
  async get(key: string): Promise<any> {
    // L1: 内存缓存
    if (this.memoryCache.has(key)) {
      return this.memoryCache.get(key)
    }
    
    // L2: Redis缓存
    if (this.redisCache) {
      const cached = await this.redisCache.get(key)
      if (cached) {
        const data = JSON.parse(cached)
        this.memoryCache.set(key, data) // 回填L1
        return data
      }
    }
    
    // L3: 文件缓存
    const filePath = this.fileCache.get(key)
    if (filePath && await fs.pathExists(filePath)) {
      const data = await fs.readJSON(filePath)
      this.memoryCache.set(key, data) // 回填L1
      return data
    }
    
    return null
  }
  
  async set(key: string, value: any, ttl?: number): Promise<void> {
    // 写入所有缓存层
    this.memoryCache.set(key, value)
    
    if (this.redisCache) {
      await this.redisCache.setex(key, ttl || 300, JSON.stringify(value))
    }
    
    const filePath = `./cache/${key}.json`
    await fs.writeJSON(filePath, value)
    this.fileCache.set(key, filePath)
  }
}
```

## 🎯 最佳实践

### ✨ 代码规范
1. **类型安全**: 所有API都有完整的TypeScript类型定义
2. **错误处理**: 使用自定义错误类，提供详细错误信息
3. **日志记录**: 关键操作都有详细日志，便于调试
4. **性能监控**: 记录关键指标，支持性能分析
5. **测试覆盖**: 单元测试、集成测试、端到端测试全覆盖

### 🔧 运维规范
1. **健康检查**: 提供完整的健康检查API
2. **优雅降级**: RAG服务不可用时回退到静态文档
3. **资源监控**: 监控内存、CPU、磁盘使用情况
4. **告警机制**: 关键错误及时告警通知
5. **数据备份**: 定期备份向量数据和索引

### 📊 监控指标
- **搜索响应时间**: < 2秒为良好，> 5秒需优化
- **缓存命中率**: > 70%为良好，< 50%需调整策略
- **向量化耗时**: < 1秒为良好，> 3秒需优化
- **错误率**: < 1%为良好，> 5%需紧急处理
- **内存使用**: < 512MB为良好，> 1GB需优化

---

通过以上技术实现指南，开发者可以深入理解RAG系统的具体实现细节，掌握关键技术点，并能够根据需要进行扩展和优化。