import { NextRequest, NextResponse } from 'next/server'
import { createRAGService, defaultRAGConfig } from '@/lib/rag/service/rag-service'
import { RAGSearchRequest } from '@/lib/rag/types'

/**
 * RAG组件检索API
 * POST /api/rag/search
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as RAGSearchRequest

    // 验证请求参数
    if (!body.query || typeof body.query !== 'string') {
      return NextResponse.json(
        { error: 'Query parameter is required and must be a string' },
        { status: 400 }
      )
    }

    if (body.topK && (body.topK < 1 || body.topK > 50)) {
      return NextResponse.json(
        { error: 'topK must be between 1 and 50' },
        { status: 400 }
      )
    }

    if (body.threshold && (body.threshold < 0 || body.threshold > 1)) {
      return NextResponse.json(
        { error: 'threshold must be between 0 and 1' },
        { status: 400 }
      )
    }

    // 获取环境变量配置
    const config = {
      ...defaultRAGConfig,
      openai: {
        apiKey: process.env.OPENAI_API_KEY || '',
        model: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small'
      }
    }

    // 检查OpenAI API Key
    if (!config.openai.apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      )
    }

    // 创建RAG服务
    const sourcePath = process.env.PRIVATE_COMPONENTS_SOURCE_PATH || 
      '/Users/zhangyanhua/Desktop/AI/docs/private-bizcomponent-website/packages/@private-basic-components'
    
    const ragService = createRAGService(config, sourcePath)
    await ragService.initialize()

    // 执行搜索
    const searchRequest: RAGSearchRequest = {
      query: body.query,
      topK: body.topK || 5,
      threshold: body.threshold || 0.5,
      filters: body.filters
    }

    const result = await ragService.searchComponents(searchRequest)

    return NextResponse.json({
      success: true,
      data: result
    })

  } catch (error) {
    console.error('RAG search error:', error)

    // 处理特定错误类型
    if (error instanceof Error) {
      if (error.message.includes('OpenAI API')) {
        return NextResponse.json(
          { error: 'AI service temporarily unavailable', details: error.message },
          { status: 503 }
        )
      }

      if (error.message.includes('quota')) {
        return NextResponse.json(
          { error: 'AI service quota exceeded', details: error.message },
          { status: 429 }
        )
      }

      if (error.message.includes('authentication')) {
        return NextResponse.json(
          { error: 'AI service authentication failed' },
          { status: 401 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * 获取搜索帮助信息
 * GET /api/rag/search
 */
export async function GET() {
  return NextResponse.json({
    message: 'RAG Component Search API',
    usage: {
      method: 'POST',
      endpoint: '/api/rag/search',
      body: {
        query: 'string (required) - Search query for components',
        topK: 'number (optional) - Number of results to return (1-50, default: 5)',
        threshold: 'number (optional) - Minimum similarity threshold (0-1, default: 0.5)',
        filters: {
          packageName: 'string (optional) - Filter by package name',
          componentName: 'string (optional) - Filter by component name',
          tags: 'string[] (optional) - Filter by component tags',
          version: 'string (optional) - Filter by version'
        }
      },
      response: {
        success: 'boolean',
        data: {
          components: 'ComponentDoc[] - Array of matching components',
          scores: 'number[] - Relevance scores for each component',
          confidence: 'number - Overall search confidence (0-1)',
          suggestions: 'string[] - Usage suggestions',
          duration: 'number - Search duration in milliseconds'
        }
      }
    },
    examples: [
      {
        description: 'Search for button components',
        query: { query: 'button component for forms' }
      },
      {
        description: 'Search with filters',
        query: {
          query: 'data table',
          topK: 3,
          threshold: 0.6,
          filters: {
            packageName: '@private/basic-components',
            tags: ['ui', 'data-display']
          }
        }
      }
    ]
  })
}