#!/bin/bash

# 批量更新API文件使用JWT认证的脚本

API_FILES=(
  "app/api/componentCode/init/route.ts"
  "app/api/componentCode/edit/route.ts"
  "app/api/config/route.ts"
  "app/api/config/reload/route.ts"
  "app/api/codegen/list/route.ts"
  "app/api/codegen/detail/route.ts"
)

echo "🔄 开始批量更新API文件使用JWT认证..."

for file in "${API_FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "📝 更新文件: $file"
    
    # 替换导入语句
    sed -i '' 's|import { getUserId, validateSession } from "@/lib/auth/middleware"|import { validateJWTSession, getCurrentUserId } from "@/lib/auth/jwt-middleware"|g' "$file"
    sed -i '' 's|import { validateSession } from "@/lib/auth/middleware"|import { validateJWTSession } from "@/lib/auth/jwt-middleware"|g' "$file"
    sed -i '' 's|import { getUserId } from "@/lib/auth/middleware"|import { getCurrentUserId } from "@/lib/auth/jwt-middleware"|g' "$file"
    
    # 替换验证逻辑
    sed -i '' 's|const authError = await validateSession()|const { error } = await validateJWTSession(request)|g' "$file"
    sed -i '' 's|if (authError) {|if (error) {|g' "$file"
    sed -i '' 's|return authError|return error|g' "$file"
    
    # 替换获取用户ID的逻辑
    sed -i '' 's|const userId = await getUserId()|const userId = await getCurrentUserId(request)|g' "$file"
    
    echo "✅ 完成更新: $file"
  else
    echo "❌ 文件不存在: $file"
  fi
done

echo "🎉 批量更新完成！"