# Compoder 项目开发说明

## 1. 项目概述

### 1.1 技术栈

- Next.js - React 框架
- TypeScript - 开发语言
- Tailwind CSS - 样式框架
- Docker - 容器化部署

### 1.2 项目结构

```
项目主要目录结构：
app/          - Next.js 应用主目录
components/   - 可复用组件
hooks/        - 自定义 React Hooks
lib/          - 工具库和通用函数
data/         - 数据相关文件
database/     - 数据库相关文件
public/       - 静态资源文件
```

## 2. 开发环境搭建

### 2.1 基本要求

- Node.js 18+
- pnpm 包管理器
- Docker（可选，用于容器化部署）

### 2.2 环境配置步骤

1. 克隆项目后，复制环境配置文件：

   ```bash
   cp .env.template .env
   ```

2. 安装依赖：

   ```bash
   pnpm install
   ```

3. 启动开发服务器：
   ```bash
   pnpm dev
   ```

## 3. 开发规范

### 3.1 代码规范

- 使用 TypeScript 进行开发
- 遵循 ESLint 规则
- 使用 Prettier 进行代码格式化
- 组件开发遵循 React Hooks 规范

### 3.2 Git 工作流

- 遵循 Git Flow 工作流程
- 提交信息遵循 Conventional Commits 规范
- 每个功能都在独立的分支上开发

## 4. 项目开发指南

### 4.1 组件开发

1. 业务组件生成：

   ```bash
   compoder generate:biz-component
   ```

2. 页面集成：

   ```bash
   compoder generate:page-integration
   ```

3. 服务生成：

   ```bash
   compoder generate:services
   ```

4. SQL API 生成：
   ```bash
   compoder generate:sql-api
   ```

### 4.2 开发流程

1. 需求分析
2. 组件设计
3. 开发实现
4. 测试验证
5. 代码审查
6. 部署上线

## 5. 部署说明

### 5.1 本地部署

```bash
pnpm build
pnpm start
```

### 5.2 Docker 部署

```bash
# 构建镜像
docker-compose build

# 启动服务
docker-compose up -d
```

## 6. 注意事项

1. 确保在开发前已正确配置环境变量
2. 遵循项目既定的代码规范和开发流程
3. 定期同步主分支的更新
4. 保持良好的代码注释和文档更新

## 7. 常见问题

待补充...

## 8. 参考文档

- [Next.js 官方文档](https://nextjs.org/docs)
- [TypeScript 文档](https://www.typescriptlang.org/docs)
- [Tailwind CSS 文档](https://tailwindcss.com/docs)
- [项目 CONTRIBUTING 指南](./CONTRIBUTING.md)

## 9. 业务流程开发指南

### 9.1 准备工作

1. 环境准备

   ```bash
   # 1. 克隆项目
   git clone [项目地址]
   cd compoder

   # 2. 安装依赖
   pnpm install

   # 3. 配置环境变量
   cp .env.template .env

   # 4. 启动开发服务器
   pnpm dev
   ```

2. 数据库准备
   ```bash
   # 启动数据库服务
   docker-compose up -d db
   ```

### 9.2 业务组件开发流程

#### 1. 创建业务组件

```bash
# 生成业务组件
compoder generate:biz-component

# 根据提示输入：
# - 组件名称
# - 组件描述
# - 选择组件类型
```

#### 2. 开发服务层

```bash
# 生成服务层代码
compoder generate:services

# 根据提示输入：
# - 服务名称
# - 选择服务类型
# - 定义服务接口
```

#### 3. 数据库接口开发

```bash
# 生成 SQL API
compoder generate:sql-api

# 根据提示输入：
# - API 名称
# - 数据表名
# - 选择操作类型（CRUD）
```

#### 4. 页面集成

```bash
# 生成页面集成代码
compoder generate:page-integration

# 根据提示输入：
# - 页面名称
# - 选择布局类型
# - 选择需要集成的组件
```

### 9.3 完整业务开发示例

#### 示例：开发用户管理模块

1. 创建用户管理组件

```bash
compoder generate:biz-component
# 输入：
# 组件名称: UserManagement
# 描述: 用户管理组件，包含用户列表、添加、编辑、删除功能
# 类型: Table
```

2. 创建用户服务

```bash
compoder generate:services
# 输入：
# 服务名称: UserService
# 类型: RESTful
# 接口: getUsers, createUser, updateUser, deleteUser
```

3. 创建数据库接口

```bash
compoder generate:sql-api
# 输入：
# API名称: UserAPI
# 表名: users
# 操作: SELECT, INSERT, UPDATE, DELETE
```

4. 集成到页面

```bash
compoder generate:page-integration
# 输入：
# 页面名称: users
# 布局: Dashboard
# 组件: UserManagement
```

### 9.4 业务模块开发检查清单

#### 1. 组件开发检查项

- [ ] 组件目录结构完整
- [ ] 类型定义完善
- [ ] 组件文档完善
- [ ] 组件测试用例
- [ ] 组件样式规范

#### 2. 服务层检查项

- [ ] 接口定义完整
- [ ] 错误处理完善
- [ ] 服务文档完善
- [ ] 单元测试覆盖
- [ ] 性能优化考虑

#### 3. 数据库检查项

- [ ] 表结构设计合理
- [ ] 索引优化
- [ ] SQL 查询优化
- [ ] 数据安全考虑
- [ ] 数据备份方案

#### 4. 页面集成检查项

- [ ] 页面路由配置
- [ ] 页面布局合理
- [ ] 组件间通信正常
- [ ] 错误边界处理
- [ ] 性能优化

### 9.5 开发注意事项

1. 代码规范

   - 遵循 TypeScript 规范
   - 使用 ESLint 和 Prettier 保持代码风格一致
   - 编写清晰的代码注释

2. 性能优化

   - 合理使用 React.memo 和 useMemo
   - 优化组件重渲染
   - 合理使用数据缓存

3. 安全考虑

   - 输入数据验证
   - SQL 注入防护
   - XSS 防护
   - CSRF 防护

4. 测试要求
   - 单元测试覆盖率 > 80%
   - E2E 测试关键流程
   - 性能测试达标

### 9.6 发布流程

1. 代码提交

   ```bash
   git add .
   git commit -m "feat: add user management module"
   git push origin feature/user-management
   ```

2. 创建合并请求

   - 标题规范：feat/fix/docs/style/refactor + 模块名称
   - 详细描述改动内容
   - 关联相关 Issue

3. 代码审查

   - 代码规范检查
   - 功能测试验证
   - 性能影响评估

4. 部署上线

   ```bash
   # 构建
   pnpm build

   # Docker 部署
   docker-compose up -d
   ```

### 9.7 监控和维护

1. 日志监控

   - 业务日志
   - 错误日志
   - 性能日志

2. 性能监控

   - 接口响应时间
   - 资源使用情况
   - 数据库性能

3. 告警机制
   - 错误告警
   - 性能告警
   - 安全告警
