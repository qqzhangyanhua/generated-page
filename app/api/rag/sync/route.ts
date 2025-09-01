import { NextRequest, NextResponse } from 'next/server'
import { createRAGService, defaultRAGConfig } from '@/lib/rag/service/rag-service'
import { ComponentSyncRequest } from '@/lib/rag/types'

/**
 * 组件同步API
 * POST /api/rag/sync
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as ComponentSyncRequest

    // 验证请求参数
    if (!body.sourcePath || typeof body.sourcePath !== 'string') {
      return NextResponse.json(
        { error: 'sourcePath parameter is required and must be a string' },
        { status: 400 }
      )
    }

    if (body.packages && !Array.isArray(body.packages)) {
      return NextResponse.json(
        { error: 'packages parameter must be an array of strings' },
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
    const ragService = createRAGService(config, body.sourcePath)
    await ragService.initialize()

    // 执行同步
    const syncRequest: ComponentSyncRequest = {
      sourcePath: body.sourcePath,
      forceReindex: body.forceReindex || false,
      packages: body.packages
    }

    const result = await ragService.syncComponents(syncRequest)

    return NextResponse.json({
      success: true,
      data: result
    })

  } catch (error) {
    console.error('RAG sync error:', error)

    // 处理特定错误类型
    if (error instanceof Error) {
      if (error.message.includes('ENOENT') || error.message.includes('not found')) {
        return NextResponse.json(
          { error: 'Source path not found', details: error.message },
          { status: 404 }
        )
      }

      if (error.message.includes('EACCES') || error.message.includes('permission')) {
        return NextResponse.json(
          { error: 'Permission denied accessing source path', details: error.message },
          { status: 403 }
        )
      }

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
 * 获取同步状态和帮助信息
 * GET /api/rag/sync
 */
export async function GET() {
  try {
    // 获取默认配置
    const config = {
      ...defaultRAGConfig,
      openai: {
        apiKey: process.env.OPENAI_API_KEY || '',
        model: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small'
      }
    }

    const defaultSourcePath = process.env.PRIVATE_COMPONENTS_SOURCE_PATH || 
      '/Users/zhangyanhua/Desktop/AI/docs/private-bizcomponent-website/packages/@private-basic-components'

    // 创建RAG服务获取状态
    const ragService = createRAGService(config, defaultSourcePath)
    await ragService.initialize()
    const status = await ragService.getStatus()

    return NextResponse.json({
      message: 'RAG Component Sync API',
      currentStatus: {
        available: status.available,
        lastUpdated: status.stats.lastUpdated,
        totalComponents: status.stats.totalComponents,
        totalDocuments: status.stats.totalDocuments,
        packageStats: status.stats.packageStats
      },
      usage: {
        method: 'POST',
        endpoint: '/api/rag/sync',
        body: {
          sourcePath: 'string (required) - Path to the components source directory',
          forceReindex: 'boolean (optional) - Whether to force reindexing (default: false)',
          packages: 'string[] (optional) - Specific packages to sync (default: all packages)'
        },
        response: {
          success: 'boolean',
          data: {
            status: '"success" | "partial" | "failed"',
            processedCount: 'number - Total components processed',
            successCount: 'number - Successfully indexed components',
            failedCount: 'number - Failed components',
            errors: 'string[] - Error messages for failed components',
            duration: 'number - Sync duration in milliseconds'
          }
        }
      },
      examples: [
        {
          description: 'Full sync with force reindex',
          query: {
            sourcePath: '/path/to/private-components',
            forceReindex: true
          }
        },
        {
          description: 'Sync specific packages',
          query: {
            sourcePath: '/path/to/private-components',
            packages: ['@private/basic-components']
          }
        }
      ],
      environment: {
        defaultSourcePath,
        openaiConfigured: !!config.openai.apiKey,
        embeddingModel: config.openai.model
      }
    })

  } catch (error) {
    console.error('RAG sync status error:', error)
    
    return NextResponse.json({
      message: 'RAG Component Sync API',
      error: 'Failed to get sync status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}