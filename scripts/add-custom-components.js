#!/usr/bin/env node

/**
 * 快速添加自定义组件库到RAG系统
 * 
 * 使用方法:
 * 1. 设置环境变量:
 *    export CUSTOM_COMPONENTS_PATH=/path/to/your/components
 *    export CUSTOM_PACKAGE_NAME=@your-org/components
 * 
 * 2. 运行脚本:
 *    node scripts/add-custom-components.js
 * 
 * 3. 可选参数:
 *    --path=/path/to/components  组件源码路径
 *    --package=@org/name         包名
 *    --force                      强制重新索引
 *    --test                       测试模式（不实际写入）
 */

const path = require('path')
const fs = require('fs').promises

// 解析命令行参数
function parseArgs() {
  const args = process.argv.slice(2)
  const options = {
    path: process.env.CUSTOM_COMPONENTS_PATH,
    package: process.env.CUSTOM_PACKAGE_NAME,
    force: false,
    test: false
  }

  args.forEach(arg => {
    if (arg.startsWith('--path=')) {
      options.path = arg.split('=')[1]
    } else if (arg.startsWith('--package=')) {
      options.package = arg.split('=')[1]
    } else if (arg === '--force') {
      options.force = true
    } else if (arg === '--test') {
      options.test = true
    }
  })

  return options
}

// 验证组件库结构
async function validateComponentLibrary(libPath) {
  const errors = []
  const warnings = []
  
  try {
    // 检查必要文件
    const packageJsonPath = path.join(libPath, 'package.json')
    const componentsDir = path.join(libPath, 'components')
    
    // 检查package.json
    try {
      const packageJson = JSON.parse(
        await fs.readFile(packageJsonPath, 'utf-8')
      )
      console.log(`✅ Found package: ${packageJson.name} v${packageJson.version}`)
    } catch (error) {
      errors.push('Missing or invalid package.json')
    }
    
    // 检查components目录
    try {
      const components = await fs.readdir(componentsDir, { withFileTypes: true })
      const componentDirs = components.filter(entry => entry.isDirectory())
      console.log(`✅ Found ${componentDirs.length} components`)
      
      // 检查每个组件的结构
      for (const dir of componentDirs) {
        const compPath = path.join(componentsDir, dir.name)
        const hasIndex = await fileExists(path.join(compPath, 'index.tsx')) ||
                         await fileExists(path.join(compPath, 'index.ts'))
        const hasReadme = await fileExists(path.join(compPath, 'README.md'))
        
        if (!hasIndex) {
          warnings.push(`Component ${dir.name} missing index file`)
        }
        if (!hasReadme) {
          warnings.push(`Component ${dir.name} missing README.md`)
        }
      }
    } catch (error) {
      errors.push('Missing components directory')
    }
    
  } catch (error) {
    errors.push(`Failed to validate: ${error.message}`)
  }
  
  return { errors, warnings }
}

// 检查文件是否存在
async function fileExists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

// 生成codegen配置
function generateCodegenConfig(packageName, componentPath) {
  const namespace = packageName.replace('@', '').replace('/', '-')
  
  return {
    title: `${packageName} Codegen`,
    description: `Generate components from ${packageName}`,
    version: "1.0.0",
    sourceType: "custom",
    rules: [
      {
        type: "rag-enhanced",
        description: `RAG-enhanced generation for ${packageName}`,
        enabled: true,
        vectorStore: "file",
        namespace: namespace,
        sourcePath: componentPath,
        searchConfig: {
          topK: 8,
          threshold: 0.3,
          filters: {
            packageName: packageName
          }
        }
      }
    ],
    metadata: {
      addedAt: new Date().toISOString(),
      addedBy: "add-custom-components script"
    }
  }
}

// 更新codegens.json
async function updateCodegensConfig(config, testMode = false) {
  const codegensPath = path.join(__dirname, '../data/codegens.json')
  
  try {
    // 读取现有配置
    const existing = JSON.parse(
      await fs.readFile(codegensPath, 'utf-8')
    )
    
    // 检查是否已存在
    const existingIndex = existing.findIndex(
      c => c.title === config.title
    )
    
    if (existingIndex >= 0) {
      console.log(`⚠️  Updating existing config: ${config.title}`)
      existing[existingIndex] = config
    } else {
      console.log(`➕ Adding new config: ${config.title}`)
      existing.push(config)
    }
    
    if (testMode) {
      console.log('\n📋 Generated config (test mode - not saved):')
      console.log(JSON.stringify(config, null, 2))
    } else {
      // 备份原文件
      await fs.copyFile(codegensPath, `${codegensPath}.backup`)
      
      // 写入新配置
      await fs.writeFile(
        codegensPath,
        JSON.stringify(existing, null, 2)
      )
      console.log(`✅ Updated ${codegensPath}`)
    }
    
    return true
  } catch (error) {
    console.error(`❌ Failed to update config: ${error.message}`)
    return false
  }
}

// 同步组件到RAG
async function syncToRAG(componentPath, packageName, forceReindex = false) {
  console.log('\n📦 Syncing components to RAG system...')
  
  try {
    // 动态导入RAG服务
    const { createRAGService, defaultRAGConfig } = require('../lib/rag/service/rag-service')
    
    // 配置
    const config = {
      ...defaultRAGConfig,
      openai: {
        apiKey: process.env.OPENAI_API_KEY || '',
        model: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small'
      }
    }
    
    if (!config.openai.apiKey) {
      console.warn('⚠️  OPENAI_API_KEY not set, skipping RAG sync')
      return false
    }
    
    // 创建服务
    const ragService = createRAGService(config, componentPath)
    await ragService.initialize()
    
    // 执行同步
    const result = await ragService.syncComponents({
      namespace: packageName.replace('@', '').replace('/', '-'),
      packages: [packageName],
      forceReindex
    })
    
    console.log(`✅ RAG sync completed:`)
    console.log(`   - Status: ${result.status}`)
    console.log(`   - Processed: ${result.processedCount} components`)
    console.log(`   - Success: ${result.successCount}`)
    console.log(`   - Failed: ${result.failedCount}`)
    console.log(`   - Duration: ${result.duration}ms`)
    
    if (result.errors.length > 0) {
      console.warn('⚠️  Sync errors:')
      result.errors.forEach(err => console.warn(`   - ${err}`))
    }
    
    return true
  } catch (error) {
    console.error(`❌ RAG sync failed: ${error.message}`)
    return false
  }
}

// 测试搜索
async function testSearch(packageName) {
  console.log('\n🔍 Testing RAG search...')
  
  try {
    const response = await fetch('http://localhost:3000/api/rag/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'button',
        topK: 3,
        filters: { packageName }
      })
    })
    
    const result = await response.json()
    
    if (result.success && result.data.components.length > 0) {
      console.log(`✅ Search successful, found ${result.data.components.length} components:`)
      result.data.components.forEach(comp => {
        console.log(`   - ${comp.componentName}: ${comp.description}`)
      })
    } else {
      console.log('⚠️  No components found in search')
    }
    
    return true
  } catch (error) {
    console.warn(`⚠️  Search test failed: ${error.message}`)
    return false
  }
}

// 主函数
async function main() {
  console.log('🚀 Custom Component RAG Integration Tool\n')
  
  // 解析参数
  const options = parseArgs()
  
  // 验证参数
  if (!options.path || !options.package) {
    console.error('❌ Error: Missing required parameters')
    console.log('\nUsage:')
    console.log('  node add-custom-components.js --path=/path/to/components --package=@org/name')
    console.log('\nOr set environment variables:')
    console.log('  export CUSTOM_COMPONENTS_PATH=/path/to/components')
    console.log('  export CUSTOM_PACKAGE_NAME=@org/name')
    process.exit(1)
  }
  
  console.log('📋 Configuration:')
  console.log(`   Path: ${options.path}`)
  console.log(`   Package: ${options.package}`)
  console.log(`   Force reindex: ${options.force}`)
  console.log(`   Test mode: ${options.test}\n`)
  
  // Step 1: 验证组件库
  console.log('1️⃣  Validating component library...')
  const validation = await validateComponentLibrary(options.path)
  
  if (validation.errors.length > 0) {
    console.error('❌ Validation failed:')
    validation.errors.forEach(err => console.error(`   - ${err}`))
    process.exit(1)
  }
  
  if (validation.warnings.length > 0) {
    console.warn('⚠️  Warnings:')
    validation.warnings.forEach(warn => console.warn(`   - ${warn}`))
  }
  
  // Step 2: 生成配置
  console.log('\n2️⃣  Generating codegen configuration...')
  const config = generateCodegenConfig(options.package, options.path)
  
  // Step 3: 更新配置文件
  console.log('\n3️⃣  Updating configuration files...')
  const configUpdated = await updateCodegensConfig(config, options.test)
  
  if (!configUpdated && !options.test) {
    console.error('❌ Failed to update configuration')
    process.exit(1)
  }
  
  // Step 4: 同步到RAG（非测试模式）
  if (!options.test) {
    console.log('\n4️⃣  Syncing to RAG system...')
    const synced = await syncToRAG(
      options.path,
      options.package,
      options.force
    )
    
    if (synced) {
      // Step 5: 测试搜索
      console.log('\n5️⃣  Testing search functionality...')
      await testSearch(options.package)
    }
  }
  
  // 完成
  console.log('\n✨ Process completed!')
  console.log('\nNext steps:')
  console.log('1. Restart the development server: pnpm dev')
  console.log('2. Navigate to http://localhost:3000/main/codegen')
  console.log(`3. Select "${options.package} Codegen" from the list`)
  console.log('4. Start generating components!\n')
  
  if (options.test) {
    console.log('ℹ️  This was a test run. To actually add the components, run without --test flag')
  }
}

// 错误处理
process.on('unhandledRejection', (error) => {
  console.error('❌ Unexpected error:', error)
  process.exit(1)
})

// 运行
main().catch(error => {
  console.error('❌ Fatal error:', error)
  process.exit(1)
})