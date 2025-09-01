# RAG Private Components 实施任务清单

## 总体计划

**目标**: 通过RAG技术解决 `@private/basic-components` 包名生成错误问题
**预计工期**: 6-8天
**优先级**: P0 (阻塞问题)

---

## Phase 1: 基础设施搭建 (2天)

### Task 1.1: 创建RAG基础类型定义
- **文件**: `lib/rag/types.ts`
- **预计时间**: 30分钟
- **验收标准**: TypeScript类型检查通过
- **依赖**: 无

### Task 1.2: 实现组件文档解析器
- **文件**: `lib/rag/parsers/component-parser.ts`
- **预计时间**: 2小时
- **功能**: 从源码中提取组件API、类型、示例
- **验收标准**: 能解析Button、Table等基础组件
- **依赖**: Task 1.1

### Task 1.3: 实现文件向量存储
- **文件**: `lib/rag/vector-store/file-store.ts`
- **预计时间**: 2小时
- **功能**: 基于文件系统的轻量向量存储
- **验收标准**: 存储和检索功能正常
- **依赖**: Task 1.1

### Task 1.4: 集成OpenAI Embeddings
- **文件**: `lib/rag/embeddings/openai-embeddings.ts`
- **预计时间**: 1小时
- **功能**: OpenAI text-embedding-3-small集成
- **验收标准**: 能生成组件文档向量
- **依赖**: Task 1.3

### Task 1.5: 实现RAG核心服务
- **文件**: `lib/rag/service/rag-service.ts`
- **预计时间**: 3小时
- **功能**: 组件检索、索引管理
- **验收标准**: 语义搜索返回相关组件
- **依赖**: Task 1.2, 1.4

---

## Phase 2: API服务开发 (1.5天)

### Task 2.1: RAG检索API
- **文件**: `app/api/rag/search/route.ts`
- **预计时间**: 1小时
- **功能**: 根据查询返回相关组件
- **验收标准**: API响应正常，TypeScript检查通过
- **依赖**: Task 1.5

### Task 2.2: 组件同步API
- **文件**: `app/api/rag/sync/route.ts`
- **预计时间**: 1小时
- **功能**: 从源码同步组件文档到向量库
- **验收标准**: 能自动更新组件索引
- **依赖**: Task 1.5

### Task 2.3: RAG管理界面API
- **文件**: `app/api/admin/rag/route.ts`
- **预计时间**: 2小时
- **功能**: 查看索引状态、重建索引
- **验收标准**: 管理功能完整
- **依赖**: Task 2.1, 2.2

---

## Phase 3: AI工作流改造 (2天)

### Task 3.1: 改造设计组件步骤
- **文件**: `app/api/ai-core/steps/design-component/utils.ts`
- **预计时间**: 2小时
- **功能**: 集成RAG组件检索
- **验收标准**: 设计阶段返回精确组件列表
- **依赖**: Task 2.1

### Task 3.2: 改造代码生成步骤
- **文件**: `app/api/ai-core/steps/generate-component/utils.ts`
- **预计时间**: 2小时
- **功能**: 基于RAG结果生成精确提示词
- **验收标准**: 生成正确包名的代码
- **依赖**: Task 3.1

### Task 3.3: 更新工作流类型定义
- **文件**: `app/api/ai-core/type.ts`
- **预计时间**: 1小时
- **功能**: 添加RAG相关类型
- **验收标准**: TypeScript类型检查通过
- **依赖**: Task 3.1, 3.2

### Task 3.4: 修改codegens.json配置
- **文件**: `data/codegens.json`
- **预计时间**: 30分钟
- **功能**: 简化配置，启用RAG
- **验收标准**: 配置加载正常
- **依赖**: Task 3.3

---

## Phase 4: 测试与验证 (1.5天)

### Task 4.1: 单元测试
- **文件**: `__tests__/rag/**`
- **预计时间**: 3小时
- **覆盖**: 解析器、向量存储、RAG服务
- **验收标准**: 测试覆盖率 > 80%
- **依赖**: Phase 1 完成

### Task 4.2: 集成测试  
- **文件**: `__tests__/integration/rag-workflow.test.ts`
- **预计时间**: 2小时
- **覆盖**: 完整工作流测试
- **验收标准**: 生成正确包名的代码
- **依赖**: Phase 3 完成

### Task 4.3: 性能测试
- **文件**: `scripts/rag-performance-test.ts`
- **预计时间**: 1小时
- **指标**: 检索速度 < 500ms, 内存使用合理
- **验收标准**: 性能指标达标
- **依赖**: Task 4.2

### Task 4.4: 端到端测试
- **方式**: 手动测试
- **预计时间**: 2小时
- **场景**: 生成登录页、表格组件等
- **验收标准**: 包名100%正确
- **依赖**: Task 4.3

---

## Phase 5: 部署与监控 (1天)

### Task 5.1: 环境配置
- **文件**: `.env.template`, `docker-compose.yml`
- **预计时间**: 1小时
- **功能**: RAG相关环境变量
- **验收标准**: 环境启动正常
- **依赖**: Phase 4 完成

### Task 5.2: 数据初始化
- **脚本**: `scripts/init-rag-data.ts`
- **预计时间**: 1小时
- **功能**: 初始化组件向量数据
- **验收标准**: 数据加载完整
- **依赖**: Task 5.1

### Task 5.3: 监控日志
- **文件**: `lib/rag/logger.ts`
- **预计时间**: 1小时
- **功能**: RAG操作日志记录
- **验收标准**: 关键操作有日志
- **依赖**: Task 5.2

### Task 5.4: 文档更新
- **文件**: `README.md`, `docs/rag-setup.md`
- **预计时间**: 1小时
- **内容**: 部署说明、使用指南
- **验收标准**: 文档清晰完整
- **依赖**: Task 5.3

---

## 质量保证检查点

### 每个Task完成后必须检查:
1. ✅ `pnpm lint` 通过
2. ✅ `pnpm test` 通过  
3. ✅ TypeScript 编译无错误
4. ✅ 功能手动验证通过
5. ✅ 代码Review (自检)

### Phase完成检查:
1. ✅ 所有Task验收标准达成
2. ✅ 集成测试通过
3. ✅ 性能指标达标
4. ✅ 文档同步更新

---

**创建时间**: 2025-08-31  
**负责人**: Architecture Team  
**状态**: 待执行