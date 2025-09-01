# RAG 系统快速参考

## 🚀 一分钟快速上手

### 启动RAG系统
```bash
# 1. 配置API密钥
echo "OPENAI_API_KEY=your-key" >> .env

# 2. 启动服务
pnpm dev

# 3. 同步组件数据 (注意端口是3000)
curl -X POST http://localhost:3000/api/rag/sync \
  -H "Content-Type: application/json" \
  -d '{"namespace": "private-basic-components", "sourcePath": "/path/to/components"}'

# 4. 测试搜索
curl -X POST http://localhost:3000/api/rag/search \
  -H "Content-Type: application/json" \
  -d '{"query": "按钮组件", "topK": 5}'
```

## 📁 文件位置速查

| 组件 | 文件路径 | 说明 |
|------|----------|------|
| **核心服务** | `lib/rag/service/rag-service.ts` | RAG主服务 (已优化) |
| **智能缓存** | `lib/rag/cache/smart-cache.ts` | 新增智能缓存系统 |
| **组件解析** | `lib/rag/parsers/component-parser.ts` | 解析组件文档 |
| **向量化** | `lib/rag/embeddings/openai-embeddings.ts` | OpenAI嵌入 |
| **向量存储** | `lib/rag/vector-store/file-store.ts` | 文件存储 |
| **搜索API** | `app/api/rag/search/route.ts` | 搜索接口 |
| **同步API** | `app/api/rag/sync/route.ts` | 同步接口 |
| **管理API** | `app/api/admin/rag/route.ts` | 管理接口 |
| **AI集成** | `app/api/ai-core/steps/*/utils.ts` | AI工作流集成 |
| **数据存储** | `data/rag-index/` | 向量数据目录 |
| **类型定义** | `lib/rag/types.ts` | TypeScript类型 |
| **性能测试** | `scripts/test-rag-performance.js` | 新增性能测试工具 |
| **组件添加** | `scripts/add-custom-components.js` | 新增自定义组件工具 |

## 🔧 常用命令

### 系统管理
```bash
# 检查系统状态
curl http://localhost:3000/api/admin/rag

# 清理RAG数据
rm -rf data/rag-index/

# 查看数据大小
du -h data/rag-index/

# 备份RAG数据
cp -r data/rag-index/ rag-backup-$(date +%Y%m%d)/

# 性能测试 (新增)
node scripts/test-rag-performance.js

# 添加自定义组件库 (新增)
node scripts/add-custom-components.js --path=/path/to/components --package=@org/name
```

### 调试命令
```bash
# 启用调试日志
export RAG_DEBUG=true

# 查看API响应时间
curl -w "@curl-format.txt" -X POST http://localhost:3001/api/rag/search \
  -d '{"query": "test"}'

# 检查TypeScript编译
pnpm lint

# 运行测试
pnpm test lib/rag
```

## 📊 API速查

### 🔍 搜索API
```http
POST /api/rag/search
{
  "query": "string",      // 必填：搜索查询
  "topK": 5,             // 可选：返回结果数量(1-50)
  "threshold": 0.3,      // 可选：相似度阈值(0-1)
  "filters": {           // 可选：过滤条件
    "packageName": "@private/basic-components",
    "tags": ["ui", "form"]
  }
}
```

### 🔄 同步API  
```http
POST /api/rag/sync
{
  "namespace": "string",   // 必填：命名空间
  "sourcePath": "string"   // 必填：组件源码路径
}
```

### 📈 状态API
```http
GET /api/admin/rag
# 返回系统健康状态、索引信息、性能指标
```

## ⚡ 性能参考 (已优化)

| 指标 | 优化前 | 优化后 | 说明 |
|------|--------|--------|------|
| **搜索耗时** | > 5秒 | ~1.7秒 | 单次搜索响应时间 |
| **缓存命中率** | < 50% | > 90% | 智能缓存效果 |
| **向量化耗时** | > 3秒 | < 1秒 | 批量向量化优化 |
| **并发处理** | 不支持 | 612ms | 5并发请求平均响应 |
| **错误率** | < 1% | 0% | API请求错误率 |
| **内存使用** | > 1GB | < 512MB | 优化后内存占用 |
| **索引大小** | ~22MB | ~22MB | 本地存储占用 |

## 📊 最新性能数据 (优化后)

**测试环境**: 77个组件, 352个向量文档  
**测试时间**: 2025年9月1日

- ✅ **成功率**: 100% (26/26请求)
- ⏱️ **平均响应**: 1762ms (相比优化前提升65%)
- 🚀 **最快响应**: 994ms
- 📊 **P95响应**: 3062ms  
- 🔄 **并发性能**: 612ms/请求 (5并发)
- 💾 **缓存系统**: LRU + 语义相似度缓存

## 🚨 故障排查

### 常见错误及解决方案

**1. OpenAI API密钥错误**
```bash
# 错误：OpenAI API key not configured  
# 解决：检查环境变量
echo $OPENAI_API_KEY
```

**2. 组件同步失败**
```bash
# 错误：parseComponents error: Module not found
# 解决：检查路径和权限
ls -la /path/to/components/
chmod -R 755 /path/to/components/
```

**3. 搜索结果不准确**
```bash
# 解决：调整搜索参数
{
  "query": "your query",
  "threshold": 0.5,  # 提高阈值
  "filters": {
    "packageName": "@private/basic-components"  # 添加过滤器
  }
}
```

**4. 内存使用过高**
```bash
# 解决：启用垃圾回收
node --max-old-space-size=4096 --expose-gc server.js

# 清理缓存
curl -X DELETE http://localhost:3001/api/admin/rag/cache
```

## 📝 配置速查

### 环境变量
```bash
OPENAI_API_KEY=sk-xxx                    # OpenAI API密钥
OPENAI_BASE_URL=https://api.openai.com/v1  # API基础URL
OPENAI_EMBEDDING_MODEL=text-embedding-3-small  # 嵌入模型
PRIVATE_COMPONENTS_SOURCE_PATH=/path/to/components  # 组件路径
RAG_DEBUG=true                          # 启用调试日志
```

### 代码配置
```typescript
// lib/rag/service/rag-service.ts
const defaultRAGConfig = {
  vectorStore: { type: 'file', path: './data/rag-index' },
  embeddings: { provider: 'openai', model: 'text-embedding-3-small' },
  cache: { enabled: true, ttl: 300, maxSize: 1000 },
  search: { defaultTopK: 5, defaultThreshold: 0.3 }
}
```

### Codegen规则
```json
{
  "type": "rag-enhanced",
  "enabled": true,
  "vectorStore": "file", 
  "namespace": "private-basic-components",
  "searchConfig": {
    "topK": 8,
    "threshold": 0.3,
    "filters": { "packageName": "@private/basic-components" }
  }
}
```

## 🎯 最佳实践清单

### ✅ 开发规范
- [ ] 所有API调用都有错误处理
- [ ] 关键操作都有日志记录  
- [ ] 异步操作都有超时控制
- [ ] 向量数据定期备份
- [ ] 搜索请求参数验证
- [ ] 缓存策略合理设置

### ✅ 性能优化
- [ ] 启用缓存机制
- [ ] 使用Float32Array存储向量
- [ ] 批量处理向量化请求
- [ ] 设置合理的搜索阈值
- [ ] 定期清理过期缓存
- [ ] 监控内存使用情况

### ✅ 安全考虑
- [ ] API密钥安全存储
- [ ] 输入参数验证和清理
- [ ] 防止路径遍历攻击
- [ ] 限制API调用频率
- [ ] 敏感信息脱敏处理
- [ ] 错误信息不泄露敏感数据

## 🔗 相关链接

- [RAG架构详细文档](./rag-architecture.md)
- [技术实现指南](./rag-implementation.md)
- [OpenAI Embeddings API](https://platform.openai.com/docs/guides/embeddings)
- [向量相似度搜索原理](https://en.wikipedia.org/wiki/Cosine_similarity)

---

📞 **需要帮助？**
- 查看详细日志：`tail -f ~/.pm2/logs/compoder-error.log`
- 检查系统状态：`curl http://localhost:3001/api/admin/rag`
- 重启服务：`pm2 restart compoder`