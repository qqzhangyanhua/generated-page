import { connectToDatabase } from "../mongo"
import { UserModel } from "../user/schema"
import { MongoClient } from "mongodb"
import { env } from "@/lib/env"

interface NextAuthUser {
  _id: string
  name?: string
  email?: string
  image?: string
  emailVerified?: Date
  createdAt: Date
  updatedAt: Date
}

interface NextAuthAccount {
  _id: string
  userId: string
  type: string
  provider: string
  providerAccountId: string
  refresh_token?: string
  access_token?: string
  expires_at?: number
  token_type?: string
  scope?: string
  id_token?: string
  session_state?: string
}

async function migrateGithubUsersToNewSystem() {
  console.log("🚀 开始Github用户数据迁移...")
  
  try {
    // 连接数据库
    await connectToDatabase()
    
    // 直接使用MongoDB客户端访问NextAuth collections
    const client = new MongoClient(env.MONGODB_URI)
    await client.connect()
    const db = client.db()
    
    // 获取NextAuth的users和accounts集合
    const usersCollection = db.collection('users')
    const accountsCollection = db.collection('accounts')
    
    // 获取所有NextAuth用户
    const nextAuthUsers = await usersCollection.find({}).toArray()
    console.log(`📊 找到 ${nextAuthUsers.length} 个NextAuth用户`)
    
    if (nextAuthUsers.length === 0) {
      console.log("✅ 没有需要迁移的用户")
      await client.close()
      return
    }
    
    let migratedCount = 0
    let skippedCount = 0
    let errorCount = 0
    
    for (const nextAuthUser of nextAuthUsers) {
      try {
        // 类型转换
        const user = nextAuthUser as unknown as NextAuthUser
        // 检查用户是否已经迁移过
        const existingUser = await UserModel.findOne({
          $or: [
            { email: user.email },
            { githubId: user._id.toString() }
          ]
        })
        
        if (existingUser) {
          console.log(`⏭️  用户已存在，跳过: ${user.email}`)
          skippedCount++
          continue
        }
        
        // 获取Github账户信息
        const githubAccount = await accountsCollection.findOne({
          userId: user._id,
          provider: 'github'
        }) as NextAuthAccount | null
        
        if (!githubAccount) {
          console.log(`❌ 找不到Github账户信息: ${user.email}`)
          errorCount++
          continue
        }
        
        // 生成用户名（从邮箱或Github名称）
        let username = user.name?.toLowerCase().replace(/[^a-z0-9_]/g, '') || 
                      user.email?.split('@')[0].replace(/[^a-z0-9_]/g, '') ||
                      `user_${Date.now()}`
        
        // 确保用户名唯一
        let usernameCounter = 1
        const originalUsername = username
        while (await UserModel.findOne({ username })) {
          username = `${originalUsername}_${usernameCounter++}`
        }
        
        // 创建新用户（无密码，标记为Github迁移）
        const newUser = new UserModel({
          username,
          email: user.email!,
          password: '', // Github用户没有密码，设为空字符串
          displayName: user.name,
          avatar: user.image,
          isEmailVerified: !!user.emailVerified,
          role: 'user',
          status: 'active',
          githubId: githubAccount.providerAccountId, // 保存Github ID
          migratedFrom: 'github',
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        })
        
        await newUser.save()
        console.log(`✅ 成功迁移用户: ${user.email} -> ${username}`)
        migratedCount++
        
      } catch (error) {
        const user = nextAuthUser as unknown as NextAuthUser
        console.error(`❌ 迁移用户失败: ${user.email || 'unknown'}`, error)
        errorCount++
      }
    }
    
    await client.close()
    
    // 输出迁移统计
    console.log("\n📈 迁移统计:")
    console.log(`   ✅ 成功迁移: ${migratedCount} 个用户`)
    console.log(`   ⏭️  已存在跳过: ${skippedCount} 个用户`)
    console.log(`   ❌ 迁移失败: ${errorCount} 个用户`)
    console.log(`   📊 总计处理: ${nextAuthUsers.length} 个用户`)
    
    if (migratedCount > 0) {
      console.log("\n🎉 数据迁移完成！")
      console.log("⚠️  注意: 迁移的Github用户需要通过'忘记密码'功能设置密码才能使用新的登录系统")
    }
    
  } catch (error) {
    console.error("💥 数据迁移失败:", error)
    process.exit(1)
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  migrateGithubUsersToNewSystem()
    .then(() => {
      console.log("🏁 迁移脚本执行完成")
      process.exit(0)
    })
    .catch((error) => {
      console.error("💥 迁移脚本执行失败:", error)
      process.exit(1)
    })
}

export { migrateGithubUsersToNewSystem }