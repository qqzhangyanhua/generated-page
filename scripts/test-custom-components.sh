#!/bin/bash

# RAG系统自定义组件快速测试脚本
# 使用: ./test-custom-components.sh /path/to/components @org/package

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查参数
if [ $# -lt 2 ]; then
    echo -e "${RED}错误: 缺少参数${NC}"
    echo "使用方法: $0 <组件路径> <包名>"
    echo "示例: $0 /path/to/my-components @mycompany/ui"
    exit 1
fi

COMPONENT_PATH="$1"
PACKAGE_NAME="$2"

echo -e "${GREEN}🚀 RAG自定义组件测试${NC}"
echo "================================"
echo "组件路径: $COMPONENT_PATH"
echo "包名: $PACKAGE_NAME"
echo "================================"

# Step 1: 检查环境
echo -e "\n${YELLOW}1. 检查环境...${NC}"

if [ ! -d "$COMPONENT_PATH" ]; then
    echo -e "${RED}❌ 组件路径不存在: $COMPONENT_PATH${NC}"
    exit 1
fi

if [ -z "$OPENAI_API_KEY" ]; then
    echo -e "${YELLOW}⚠️  警告: OPENAI_API_KEY 未设置，将跳过向量化${NC}"
fi

echo -e "${GREEN}✅ 环境检查通过${NC}"

# Step 2: 验证组件结构
echo -e "\n${YELLOW}2. 验证组件结构...${NC}"

if [ ! -f "$COMPONENT_PATH/package.json" ]; then
    echo -e "${YELLOW}⚠️  警告: 缺少 package.json${NC}"
fi

if [ ! -d "$COMPONENT_PATH/components" ]; then
    echo -e "${RED}❌ 错误: 缺少 components 目录${NC}"
    exit 1
fi

COMPONENT_COUNT=$(find "$COMPONENT_PATH/components" -maxdepth 1 -type d | wc -l)
echo -e "${GREEN}✅ 找到 $((COMPONENT_COUNT-1)) 个组件${NC}"

# Step 3: 运行添加脚本（测试模式）
echo -e "\n${YELLOW}3. 测试添加配置...${NC}"

node scripts/add-custom-components.js \
    --path="$COMPONENT_PATH" \
    --package="$PACKAGE_NAME" \
    --test

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 配置测试通过${NC}"
else
    echo -e "${RED}❌ 配置测试失败${NC}"
    exit 1
fi

# Step 4: 询问是否实际添加
echo -e "\n${YELLOW}是否要实际添加组件到RAG系统? (y/n)${NC}"
read -r response

if [[ "$response" =~ ^[Yy]$ ]]; then
    echo -e "\n${YELLOW}4. 正式添加组件...${NC}"
    
    node scripts/add-custom-components.js \
        --path="$COMPONENT_PATH" \
        --package="$PACKAGE_NAME"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ 组件添加成功${NC}"
        
        # Step 5: 测试搜索
        echo -e "\n${YELLOW}5. 测试搜索功能...${NC}"
        
        # 等待服务启动
        sleep 2
        
        # 测试搜索
        echo "测试查询: 'button'"
        curl -s -X POST http://localhost:3000/api/rag/search \
            -H "Content-Type: application/json" \
            -d "{\"query\": \"button\", \"topK\": 3, \"filters\": {\"packageName\": \"$PACKAGE_NAME\"}}" \
            | jq '.data.components[].componentName' 2>/dev/null || echo "搜索服务未启动"
        
        echo -e "\n${GREEN}✨ 完成！${NC}"
        echo -e "\n下一步:"
        echo -e "1. 重启开发服务器: ${YELLOW}pnpm dev${NC}"
        echo -e "2. 访问: ${YELLOW}http://localhost:3000/main/codegen${NC}"
        echo -e "3. 选择: ${YELLOW}$PACKAGE_NAME Codegen${NC}"
    else
        echo -e "${RED}❌ 组件添加失败${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}已取消添加${NC}"
fi

echo -e "\n================================"
echo -e "${GREEN}测试完成！${NC}"