#!/usr/bin/env node

/**
 * RAG系统性能测试脚本
 * 用于验证优化效果
 */

const { performance } = require('perf_hooks')

// 测试配置
const API_BASE = 'http://localhost:3000/api/rag'
const TEST_QUERIES = [
  'button component',
  '按钮组件',
  'form input',
  '表单输入',
  'data table',
  '数据表格',
  'modal dialog',
  '弹窗对话框',
  'dropdown menu',
  '下拉菜单'
]

// 测试统计
const stats = {
  totalRequests: 0,
  successRequests: 0,
  failedRequests: 0,
  avgResponseTime: 0,
  minResponseTime: Infinity,
  maxResponseTime: 0,
  cacheHits: 0,
  responseTimes: []
}

/**
 * 执行单个搜索测试
 */
async function testSearch(query, iteration = 1) {
  const startTime = performance.now()
  
  try {
    const response = await fetch(`${API_BASE}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        topK: 5,
        threshold: 0.3
      })
    })
    
    const data = await response.json()
    const responseTime = performance.now() - startTime
    
    stats.totalRequests++
    stats.responseTimes.push(responseTime)
    
    if (data.success) {
      stats.successRequests++
      
      // 更新时间统计
      stats.minResponseTime = Math.min(stats.minResponseTime, responseTime)
      stats.maxResponseTime = Math.max(stats.maxResponseTime, responseTime)
      
      // 检测缓存命中（第二次请求应该更快）
      if (iteration > 1 && responseTime < 100) {
        stats.cacheHits++
      }
      
      console.log(`✅ [${iteration}] "${query}": ${responseTime.toFixed(2)}ms, 找到 ${data.data.components.length} 个组件`)
      
      return { success: true, responseTime, components: data.data.components.length }
    } else {
      stats.failedRequests++
      console.log(`❌ [${iteration}] "${query}": 搜索失败`)
      return { success: false, responseTime }
    }
  } catch (error) {
    stats.failedRequests++
    console.error(`❌ [${iteration}] "${query}": ${error.message}`)
    return { success: false, responseTime: performance.now() - startTime }
  }
}

/**
 * 测试并发性能
 */
async function testConcurrency() {
  console.log('\n📊 并发性能测试...')
  console.log('================================')
  
  const concurrentQueries = TEST_QUERIES.slice(0, 5)
  const startTime = performance.now()
  
  // 并发执行
  const results = await Promise.all(
    concurrentQueries.map(query => testSearch(query, 'concurrent'))
  )
  
  const totalTime = performance.now() - startTime
  const successCount = results.filter(r => r.success).length
  
  console.log(`\n并发测试完成：`)
  console.log(`  - 并发请求数: ${concurrentQueries.length}`)
  console.log(`  - 成功: ${successCount}/${concurrentQueries.length}`)
  console.log(`  - 总耗时: ${totalTime.toFixed(2)}ms`)
  console.log(`  - 平均响应: ${(totalTime / concurrentQueries.length).toFixed(2)}ms`)
}

/**
 * 测试缓存效果
 */
async function testCache() {
  console.log('\n💾 缓存效果测试...')
  console.log('================================')
  
  const testQuery = 'button component'
  const iterations = 3
  const results = []
  
  for (let i = 1; i <= iterations; i++) {
    const result = await testSearch(testQuery, i)
    results.push(result.responseTime)
    
    // 短暂延迟
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  
  // 计算缓存加速比
  const firstTime = results[0]
  const avgCachedTime = (results[1] + results[2]) / 2
  const speedup = firstTime / avgCachedTime
  
  console.log(`\n缓存测试结果：`)
  console.log(`  - 首次查询: ${firstTime.toFixed(2)}ms`)
  console.log(`  - 缓存查询平均: ${avgCachedTime.toFixed(2)}ms`)
  console.log(`  - 加速比: ${speedup.toFixed(2)}x`)
  
  if (speedup > 2) {
    console.log(`  ✅ 缓存效果显著！`)
  } else if (speedup > 1.5) {
    console.log(`  ⚠️  缓存效果一般`)
  } else {
    console.log(`  ❌ 缓存效果不明显`)
  }
}

/**
 * 测试语义相似搜索
 */
async function testSemanticSearch() {
  console.log('\n🧠 语义搜索测试...')
  console.log('================================')
  
  const semanticPairs = [
    ['button', 'btn'],
    ['input field', 'text input'],
    ['table', 'data grid'],
    ['modal', 'dialog']
  ]
  
  for (const [query1, query2] of semanticPairs) {
    console.log(`\n测试语义相似: "${query1}" vs "${query2}"`)
    
    const result1 = await testSearch(query1, 'semantic')
    const result2 = await testSearch(query2, 'semantic')
    
    if (result1.success && result2.success) {
      // 比较结果相似度
      if (result1.components === result2.components) {
        console.log(`  ✅ 语义匹配成功！两个查询返回相同数量的组件`)
      } else {
        console.log(`  ⚠️  结果略有差异: ${result1.components} vs ${result2.components}`)
      }
    }
  }
}

/**
 * 生成测试报告
 */
function generateReport() {
  // 计算平均响应时间
  stats.avgResponseTime = stats.responseTimes.length > 0
    ? stats.responseTimes.reduce((a, b) => a + b, 0) / stats.responseTimes.length
    : 0
  
  // 计算P95响应时间
  const sorted = [...stats.responseTimes].sort((a, b) => a - b)
  const p95Index = Math.floor(sorted.length * 0.95)
  const p95ResponseTime = sorted[p95Index] || 0
  
  console.log('\n')
  console.log('═══════════════════════════════════════')
  console.log('📈 RAG系统性能测试报告')
  console.log('═══════════════════════════════════════')
  console.log(`\n📊 总体统计：`)
  console.log(`  - 总请求数: ${stats.totalRequests}`)
  console.log(`  - 成功请求: ${stats.successRequests}`)
  console.log(`  - 失败请求: ${stats.failedRequests}`)
  console.log(`  - 成功率: ${((stats.successRequests / stats.totalRequests) * 100).toFixed(1)}%`)
  
  console.log(`\n⏱️  响应时间：`)
  console.log(`  - 平均响应: ${stats.avgResponseTime.toFixed(2)}ms`)
  console.log(`  - 最快响应: ${stats.minResponseTime.toFixed(2)}ms`)
  console.log(`  - 最慢响应: ${stats.maxResponseTime.toFixed(2)}ms`)
  console.log(`  - P95响应: ${p95ResponseTime.toFixed(2)}ms`)
  
  console.log(`\n💾 缓存性能：`)
  console.log(`  - 缓存命中: ${stats.cacheHits}`)
  console.log(`  - 缓存命中率: ${((stats.cacheHits / Math.max(1, stats.totalRequests - TEST_QUERIES.length)) * 100).toFixed(1)}%`)
  
  // 性能评级
  console.log(`\n🏆 性能评级：`)
  if (stats.avgResponseTime < 500 && stats.successRequests === stats.totalRequests) {
    console.log(`  ⭐⭐⭐⭐⭐ 优秀 - 系统性能表现出色！`)
  } else if (stats.avgResponseTime < 1000 && stats.successRequests / stats.totalRequests > 0.9) {
    console.log(`  ⭐⭐⭐⭐ 良好 - 系统性能达标`)
  } else if (stats.avgResponseTime < 2000 && stats.successRequests / stats.totalRequests > 0.8) {
    console.log(`  ⭐⭐⭐ 一般 - 建议进一步优化`)
  } else {
    console.log(`  ⭐⭐ 需要改进 - 性能未达预期`)
  }
  
  console.log('\n═══════════════════════════════════════')
}

/**
 * 主测试流程
 */
async function main() {
  console.log('🚀 开始RAG系统性能测试')
  console.log('================================\n')
  
  // 检查服务是否可用
  console.log('🔍 检查服务状态...')
  try {
    const response = await fetch(`${API_BASE}/search`)
    if (response.ok) {
      console.log('✅ RAG服务正常运行\n')
    } else {
      throw new Error('Service not responding')
    }
  } catch (error) {
    console.error('❌ RAG服务未启动，请先运行: pnpm dev')
    process.exit(1)
  }
  
  // 执行测试
  console.log('📝 顺序搜索测试...')
  console.log('================================')
  for (const query of TEST_QUERIES) {
    await testSearch(query, 'sequential')
    await new Promise(resolve => setTimeout(resolve, 200)) // 避免过载
  }
  
  // 并发测试
  await testConcurrency()
  
  // 缓存测试
  await testCache()
  
  // 语义搜索测试
  await testSemanticSearch()
  
  // 生成报告
  generateReport()
  
  console.log('\n✨ 测试完成！')
  
  // 优化建议
  console.log('\n💡 优化建议：')
  if (stats.avgResponseTime > 1000) {
    console.log('  - 考虑增加缓存大小或TTL')
    console.log('  - 检查向量化性能')
    console.log('  - 考虑使用向量数据库')
  }
  if (stats.cacheHits < stats.totalRequests * 0.3) {
    console.log('  - 缓存命中率较低，考虑实现语义缓存')
    console.log('  - 预热常用查询')
  }
  if (stats.failedRequests > 0) {
    console.log('  - 检查失败的查询，优化错误处理')
  }
}

// 错误处理
process.on('unhandledRejection', (error) => {
  console.error('❌ 测试错误:', error)
  process.exit(1)
})

// 运行测试
main().catch(console.error)