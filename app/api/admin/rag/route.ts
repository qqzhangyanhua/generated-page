import { NextRequest, NextResponse } from 'next/server'
import { createRAGService, defaultRAGConfig } from '@/lib/rag/service/rag-service'

/**
 * RAG管理API - 获取系统状态和统计信息
 * GET /api/admin/rag
 */
export async function GET() {
  try {
    // 获取环境变量配置
    const config = {
      ...defaultRAGConfig,
      openai: {
        apiKey: process.env.OPENAI_API_KEY || '',
        model: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small'
      }
    }

    const defaultSourcePath = process.env.PRIVATE_COMPONENTS_SOURCE_PATH || 
      '/Users/zhangyanhua/Desktop/AI/docs/private-bizcomponent-website/packages/@private-basic-components'

    // 创建RAG服务
    const ragService = createRAGService(config, defaultSourcePath)
    await ragService.initialize()

    // 获取详细状态
    const status = await ragService.getStatus()

    return NextResponse.json({
      success: true,
      data: {
        system: {
          status: status.available ? 'healthy' : 'error',
          checkedAt: status.checkedAt,
          configuration: {
            vectorStore: status.config.vectorStore,
            embeddingModel: status.config.embeddingModel,
            dimension: status.config.dimension,
            cacheEnabled: status.config.cache?.enabled || false,
            cacheTtl: status.config.cache?.ttl || 0
          },
          environment: {
            sourcePath: defaultSourcePath,
            openaiConfigured: !!config.openai.apiKey,
            embeddingModel: config.openai.model,
            nodeEnv: process.env.NODE_ENV || 'development'
          }
        },
        index: {
          totalComponents: status.stats.totalComponents,
          totalDocuments: status.stats.totalDocuments,
          indexSize: status.stats.indexSize,
          lastUpdated: status.stats.lastUpdated,
          packageBreakdown: Object.entries(status.stats.packageStats).map(([pkg, count]) => ({
            package: pkg,
            componentCount: count
          }))
        },
        health: {
          vectorStoreHealthy: status.available,
          embeddingsHealthy: !!config.openai.apiKey,
          overallHealth: status.available && !!config.openai.apiKey ? 'healthy' : 'degraded'
        }
      }
    })

  } catch (error) {
    console.error('RAG admin status error:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Failed to get RAG system status',
      details: error instanceof Error ? error.message : 'Unknown error',
      data: {
        system: { status: 'error', checkedAt: new Date().toISOString() },
        index: { totalComponents: 0, totalDocuments: 0, indexSize: 0 },
        health: { overallHealth: 'error' }
      }
    }, { status: 500 })
  }
}

/**
 * RAG管理API - 执行管理操作
 * POST /api/admin/rag
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, ...params } = body

    if (!action || typeof action !== 'string') {
      return NextResponse.json(
        { error: 'Action parameter is required and must be a string' },
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

    if (!config.openai.apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      )
    }

    const defaultSourcePath = process.env.PRIVATE_COMPONENTS_SOURCE_PATH || 
      '/Users/zhangyanhua/Desktop/AI/docs/private-bizcomponent-website/packages/@private-basic-components'

    const ragService = createRAGService(config, defaultSourcePath)
    await ragService.initialize()

    switch (action) {
      case 'rebuild-index':
        {
          const syncResult = await ragService.syncComponents({
            sourcePath: params.sourcePath || defaultSourcePath,
            forceReindex: true,
            packages: params.packages
          })

          return NextResponse.json({
            success: true,
            action: 'rebuild-index',
            data: syncResult
          })
        }

      case 'clear-cache':
        {
          ragService.clearCache()
          
          return NextResponse.json({
            success: true,
            action: 'clear-cache',
            data: { message: 'Cache cleared successfully' }
          })
        }

      case 'health-check':
        {
          const status = await ragService.getStatus()
          
          return NextResponse.json({
            success: true,
            action: 'health-check',
            data: {
              healthy: status.available,
              components: status.stats.totalComponents,
              documents: status.stats.totalDocuments,
              lastUpdated: status.stats.lastUpdated
            }
          })
        }

      case 'test-search':
        {
          if (!params.query) {
            return NextResponse.json(
              { error: 'Query parameter required for test-search action' },
              { status: 400 }
            )
          }

          const searchResult = await ragService.searchComponents({
            query: params.query,
            topK: params.topK || 3,
            threshold: params.threshold || 0.5
          })

          return NextResponse.json({
            success: true,
            action: 'test-search',
            data: {
              query: params.query,
              results: searchResult.components.length,
              confidence: searchResult.confidence,
              duration: searchResult.duration,
              components: searchResult.components.map(comp => ({
                name: comp.componentName,
                package: comp.packageName,
                tags: comp.tags
              }))
            }
          })
        }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}`, availableActions: ['rebuild-index', 'clear-cache', 'health-check', 'test-search'] },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('RAG admin operation error:', error)

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
    }

    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * RAG管理API - 删除索引数据
 * DELETE /api/admin/rag
 */
export async function DELETE() {
  try {
    const config = {
      ...defaultRAGConfig,
      openai: {
        apiKey: process.env.OPENAI_API_KEY || '',
        model: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small'
      }
    }

    const defaultSourcePath = process.env.PRIVATE_COMPONENTS_SOURCE_PATH || 
      '/Users/zhangyanhua/Desktop/AI/docs/private-bizcomponent-website/packages/@private-basic-components'

    const ragService = createRAGService(config, defaultSourcePath)
    await ragService.initialize()

    // 清空所有数据
    await ragService.syncComponents({
      sourcePath: defaultSourcePath,
      forceReindex: true,
      packages: [] // 空数组表示不同步任何包，等同于清空
    })

    ragService.clearCache()

    return NextResponse.json({
      success: true,
      message: 'All RAG index data deleted successfully'
    })

  } catch (error) {
    console.error('RAG admin delete error:', error)
    
    return NextResponse.json(
      { error: 'Failed to delete RAG data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}