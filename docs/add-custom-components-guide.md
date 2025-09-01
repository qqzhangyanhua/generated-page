# 📦 添加自定义组件到RAG系统 - 快速指南

## 🚀 快速开始（5分钟）

### 1. 准备你的组件库

确保你的组件库有以下结构：
```
your-components/
├── package.json              # 包含包名和版本
├── components/
│   ├── Button/
│   │   ├── index.tsx        # 组件实现
│   │   ├── README.md        # 组件文档（可选但推荐）
│   │   └── demos/           # 示例代码（可选）
│   ├── Input/
│   │   ├── index.tsx
│   │   └── README.md
│   └── Table/
│       ├── index.tsx
│       └── README.md
```

### 2. 运行添加脚本

```bash
# 方式1: 使用环境变量
export CUSTOM_COMPONENTS_PATH=/Users/you/my-components
export CUSTOM_PACKAGE_NAME=@mycompany/ui
node scripts/add-custom-components.js

# 方式2: 使用命令行参数
node scripts/add-custom-components.js \
  --path=/Users/you/my-components \
  --package=@mycompany/ui

# 测试模式（不实际修改）
node scripts/add-custom-components.js \
  --path=/Users/you/my-components \
  --package=@mycompany/ui \
  --test
```

### 3. 重启服务

```bash
# 重启开发服务器
pnpm dev
```

### 4. 使用新组件

1. 访问 http://localhost:3000/main/codegen
2. 选择 "@mycompany/ui Codegen"
3. 输入需求，AI将使用你的自定义组件生成代码

## 📝 示例：添加Ant Design Pro组件

```bash
# 1. 克隆Ant Design Pro组件
git clone https://github.com/ant-design/pro-components.git

# 2. 添加到RAG
node scripts/add-custom-components.js \
  --path=/path/to/pro-components/packages/components \
  --package=@ant-design/pro-components

# 3. 测试搜索
curl -X POST http://localhost:3000/api/rag/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "table with search",
    "filters": {"packageName": "@ant-design/pro-components"}
  }'
```

## 🔧 高级用法

### 同时添加多个组件库

创建批处理脚本 `add-multiple-libs.js`:

```javascript
const libs = [
  {
    path: '/path/to/ui-components',
    package: '@company/ui'
  },
  {
    path: '/path/to/chart-components',
    package: '@company/charts'
  },
  {
    path: '/path/to/form-components',
    package: '@company/forms'
  }
]

const { exec } = require('child_process')
const { promisify } = require('util')
const execAsync = promisify(exec)

async function addAll() {
  for (const lib of libs) {
    console.log(`Adding ${lib.package}...`)
    await execAsync(
      `node scripts/add-custom-components.js --path=${lib.path} --package=${lib.package}`
    )
  }
  console.log('All libraries added!')
}

addAll()
```

### 自动同步更新

使用文件监听自动更新：

```javascript
// scripts/watch-components.js
const chokidar = require('chokidar')
const { exec } = require('child_process')

const componentPath = '/path/to/your-components'
const packageName = '@your-org/components'

// 监听组件变化
const watcher = chokidar.watch(`${componentPath}/components/**/*.{tsx,md}`, {
  ignored: /node_modules/,
  persistent: true
})

// 防抖
let syncTimeout
function scheduleSync() {
  clearTimeout(syncTimeout)
  syncTimeout = setTimeout(() => {
    console.log('Syncing components...')
    exec(
      `node scripts/add-custom-components.js --path=${componentPath} --package=${packageName}`,
      (error, stdout) => {
        if (error) {
          console.error('Sync failed:', error)
        } else {
          console.log('Sync completed')
        }
      }
    )
  }, 5000) // 5秒防抖
}

watcher
  .on('add', path => {
    console.log(`File added: ${path}`)
    scheduleSync()
  })
  .on('change', path => {
    console.log(`File changed: ${path}`)
    scheduleSync()
  })
  .on('unlink', path => {
    console.log(`File removed: ${path}`)
    scheduleSync()
  })

console.log(`Watching ${componentPath} for changes...`)
```

### 自定义解析器

对于特殊格式的组件库，创建自定义解析器：

```typescript
// lib/rag/parsers/custom-parser.ts
export class CustomComponentParser extends ComponentParser {
  async extractComponentDoc(
    componentPath: string,
    componentName: string
  ): Promise<ComponentDoc> {
    // 自定义解析逻辑
    // 例如：从TypeScript AST提取
    const sourceFile = ts.createSourceFile(...)
    
    // 提取props
    const props = this.extractProps(sourceFile)
    
    // 提取示例
    const examples = this.extractExamples(sourceFile)
    
    return {
      packageName: this.packageName,
      componentName,
      description: this.extractDescription(sourceFile),
      api: this.formatAPI(props),
      examples,
      tags: this.extractTags(sourceFile),
      version: '1.0.0',
      dependencies: [],
      updatedAt: new Date().toISOString()
    }
  }
}
```

## 🎯 最佳实践

### 1. 组件文档规范

在组件的 README.md 中包含：

```markdown
# Button 组件

## 描述
用于触发操作的按钮组件

## API
| 属性 | 说明 | 类型 | 默认值 |
|------|------|------|--------|
| type | 按钮类型 | 'primary' \| 'default' | 'default' |
| size | 按钮大小 | 'large' \| 'middle' \| 'small' | 'middle' |
| onClick | 点击回调 | (e: Event) => void | - |

## 示例
\`\`\`tsx
import { Button } from '@mycompany/ui'

export default () => (
  <Button type="primary" onClick={() => alert('Clicked!')}>
    Click me
  </Button>
)
\`\`\`
```

### 2. 优化搜索标签

在组件中添加元数据：

```typescript
// components/DataTable/index.tsx

/**
 * @name DataTable
 * @description 高性能数据表格组件
 * @tags table, data, grid, list, crud
 * @category Data Display
 * @since 1.0.0
 */
export const DataTable: React.FC<DataTableProps> = (props) => {
  // ...
}
```

### 3. 性能优化

对于大型组件库：

```bash
# 分批同步
node scripts/add-custom-components.js --path=/path/to/components --batch=10

# 只同步特定组件
node scripts/add-custom-components.js \
  --path=/path/to/components \
  --include=Button,Input,Table

# 排除某些组件
node scripts/add-custom-components.js \
  --path=/path/to/components \
  --exclude=*Test,*Demo
```

## ❓ 常见问题

### Q: 组件没有被检索到？
A: 检查以下几点：
1. 组件目录结构是否正确
2. 是否重启了服务
3. 搜索时是否使用了正确的过滤器

### Q: 如何更新已添加的组件？
A: 重新运行添加脚本即可，或使用 `--force` 强制重建索引

### Q: 如何删除组件库？
A: 编辑 `data/codegens.json`，删除对应配置，然后清理RAG数据：
```bash
rm -rf data/rag-index/*
```

### Q: 支持哪些组件格式？
A: 目前支持：
- React组件 (.tsx, .jsx)
- Vue组件 (.vue)
- 通过自定义解析器可支持任何格式

## 📊 验证集成

### 检查组件是否成功添加

```bash
# 1. 查看RAG索引状态
curl http://localhost:3000/api/admin/rag

# 2. 搜索特定组件
curl -X POST http://localhost:3000/api/rag/search \
  -H "Content-Type: application/json" \
  -d '{"query": "your component name"}'

# 3. 查看配置文件
cat data/codegens.json | jq '.[] | select(.title | contains("your-package"))'
```

### 调试问题

```bash
# 启用调试日志
export RAG_DEBUG=true
node scripts/add-custom-components.js --path=/path --package=@org/pkg

# 查看RAG数据
ls -la data/rag-index/
du -h data/rag-index/
```

## 🚨 注意事项

1. **API Key**: 确保设置了 `OPENAI_API_KEY` 环境变量
2. **路径**: 使用绝对路径，避免相对路径
3. **包名**: 使用完整的包名（包括scope）
4. **内存**: 大型组件库可能需要增加Node内存限制：
   ```bash
   NODE_OPTIONS="--max-old-space-size=4096" node scripts/add-custom-components.js
   ```

## 🎉 完成！

现在你的自定义组件已经集成到RAG系统中，AI可以：
- 理解你的组件API
- 生成使用你组件的代码
- 提供智能提示和建议
- 确保生成的代码符合你的组件规范

Happy coding! 🚀