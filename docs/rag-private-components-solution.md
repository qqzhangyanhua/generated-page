# RAG Enhanced Private Components Solution

## 概述

本方案旨在解决 `@private/basic-components` 包名生成错误问题，通过引入 RAG (Retrieval-Augmented Generation) 技术，提供更准确的私有组件代码生成能力。

## 问题分析

### 现有方案的问题

1. **静态注入**: 所有组件API文档直接写在`data/codegens.json`中
2. **上下文污染**: 大量API文档会影响AI的包名判断
3. **维护困难**: 组件更新需要手动同步到配置文件
4. **精度不高**: AI需要从海量文档中筛选相关组件

### 核心问题

AI模型在生成代码时，将正确的 `@private/basic-components` 错误转换为 `@private-basic-components`

## RAG方案设计

### Phase 1: 向量化存储改造

#### 1.1 数据源准备

```typescript
// lib/rag/private-components/types.ts
interface ComponentDoc {
  packageName: string // "@private/basic-components"
  componentName: string // "Button", "Table", etc.
  description: string // 组件功能描述
  api: string // API文档
  examples: string[] // 使用示例
  tags: string[] // 标签：["form", "input", "ui"]
  version: string // 组件版本
  dependencies: string[] // 依赖的其他组件
}
```

#### 1.2 向量数据库集成

```typescript
// lib/rag/vector-store/index.ts
import { OpenAIEmbeddings } from "langchain/embeddings/openai"
import { PineconeStore } from "langchain/vectorstores/pinecone"

class PrivateComponentsRAG {
  private vectorStore: PineconeStore
  private embeddings: OpenAIEmbeddings

  async indexComponents(components: ComponentDoc[]) {
    // 为每个组件创建多个向量：
    // 1. 组件名称 + 描述
    // 2. API文档分段
    // 3. 使用场景描述
    for (const component of components) {
      const docs = this.createEmbeddingDocuments(component)
      await this.vectorStore.addDocuments(docs)
    }
  }

  async searchRelevantComponents(
    query: string,
    topK = 5,
  ): Promise<ComponentDoc[]> {
    const results = await this.vectorStore.similaritySearch(query, topK)
    return this.parseComponentsFromResults(results)
  }
}
```

### Phase 2: AI工作流改造

#### 2.1 设计阶段增强

```typescript
// app/api/ai-core/steps/design-component/utils.ts (改造)
export async function generateComponentDesign(context: WorkflowContext) {
  // 1. 首次AI调用：分析用户需求
  const initialDesign = await streamText({
    system: buildDesignSystemPrompt(),
    messages: buildUserMessage(context.query.prompt),
  })

  // 2. RAG检索相关组件
  const ragSystem = new PrivateComponentsRAG()
  const relevantComponents = await ragSystem.searchRelevantComponents(
    initialDesign.componentDescription +
      " " +
      initialDesign.functionalRequirements,
    10,
  )

  // 3. 二次AI调用：基于RAG结果精确选择组件
  const finalDesign = await streamText({
    system: buildRAGEnhancedSystemPrompt(),
    messages: [
      ...buildUserMessage(context.query.prompt),
      {
        role: "assistant",
        content: JSON.stringify(initialDesign),
      },
      {
        role: "user",
        content: buildRAGContextMessage(relevantComponents),
      },
    ],
  })

  return finalDesign
}
```

#### 2.2 代码生成阶段改造

```typescript
// app/api/ai-core/steps/generate-component/utils.ts (改造)
export const buildSystemPrompt = (
  rules: WorkflowContext["query"]["rules"],
  selectedComponents: ComponentDoc[], // 从RAG获取的精确组件
) => {
  const componentContext = selectedComponents
    .map(
      comp => `
    Component: ${comp.componentName}
    Package: ${comp.packageName}
    API: ${comp.api}
    Examples: ${comp.examples.join("\n")}
  `,
    )
    .join("\n---\n")

  return `
    # You are a senior frontend engineer
    
    ## CRITICAL PACKAGE REQUIREMENTS
    - MUST use package name: "${selectedComponents[0]?.packageName}" 
    - NEVER modify this package name in any way
    - Import format: import { ComponentName } from '${selectedComponents[0]?.packageName}'
    
    ## Available Components
    ${componentContext}
    
    ## Additional Rules
    ${getSpecialAttentionRules(rules)}
  `
}
```

### Phase 3: 新的API架构

#### 3.1 RAG服务API

```typescript
// app/api/rag/private-components/route.ts
export async function POST(request: NextRequest) {
  const { query, topK = 10 } = await request.json()

  const ragSystem = new PrivateComponentsRAG()
  const components = await ragSystem.searchRelevantComponents(query, topK)

  return NextResponse.json({
    components,
    confidence: calculateConfidence(components),
    suggestions: generateUsageSuggestions(components),
  })
}
```

#### 3.2 数据管理API

```typescript
// app/api/admin/private-components/sync/route.ts
export async function POST() {
  // 从 @private/basic-components 源码自动提取组件文档
  const componentDocs = await extractComponentDocs(
    "/path/to/private-components",
  )

  const ragSystem = new PrivateComponentsRAG()
  await ragSystem.reindexComponents(componentDocs)

  return NextResponse.json({ message: "Components synchronized" })
}
```

### Phase 4: 配置简化

#### 4.1 简化后的codegens.json

```json
{
  "title": "Private Component Codegen",
  "description": "Code generator based on private components",
  "fullStack": "React",
  "model": "gpt-4o",
  "codeRendererUrl": "http://localhost:3005",
  "rules": [
    {
      "type": "styles",
      "prompt": "Use styled-components for styles"
    },
    {
      "type": "file-structure",
      "prompt": "Standard React component structure with styles.ts"
    },
    {
      "type": "rag-enhanced",
      "enabled": true,
      "vectorStore": "pinecone",
      "namespace": "private-basic-components"
    }
  ]
}
```

## 实施步骤

### 步骤1: 数据准备 (1-2天)

1. 解析 `/Users/zhangyanhua/Desktop/AI/docs/private-bizcomponent-website/packages/@private-basic-components` 源码
2. 提取组件API、示例、描述
3. 创建向量数据库索引

### 步骤2: RAG服务开发 (2-3天)

1. 集成向量数据库 (Pinecone/Weaviate/Qdrant)
2. 实现组件检索API
3. 开发自动同步机制

### 步骤3: AI工作流改造 (2-3天)

1. 修改design-component步骤
2. 修改generate-component步骤
3. 增加RAG上下文注入

### 步骤4: 测试验证 (1天)

1. 对比RAG前后的生成质量
2. 验证包名准确性
3. 性能优化

## 预期优势

### 准确性提升

- **精确匹配**: RAG只返回与需求最相关的组件
- **上下文清晰**: AI获得的是精确的组件信息，不会被无关文档干扰
- **包名强化**: 在RAG结果中强调正确的包名

### 维护性改善

- **自动同步**: 组件更新自动同步到向量库
- **版本管理**: 支持多版本组件文档
- **配置简化**: codegens.json不再需要大量静态文档

### 扩展性增强

- **多包支持**: 可轻松扩展到其他private包
- **语义搜索**: 支持自然语言描述查找组件
- **个性化**: 可基于使用历史优化推荐

## 技术选型

### 向量数据库

- **首选**: Pinecone (云服务，易于集成)
- **备选**: Weaviate (开源，可自部署)
- **轻量**: 文件向量存储 (开发阶段)

### Embeddings模型

- **首选**: OpenAI text-embedding-3-small
- **备选**: 本地模型 (sentence-transformers)

### 开发优先级

1. 文件向量存储 + OpenAI embeddings (快速原型)
2. 集成 Pinecone (生产环境)
3. 性能优化和缓存机制

---

**创建时间**: 2025-08-31  
**版本**: v1.0  
**状态**: 设计阶段
找到了！RAG数据存储在 ./data/rag-index 目录中。让我检查这个目录的内容：
