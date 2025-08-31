import { connectToDatabase } from "../lib/db/mongo"
import { UserModel } from "../lib/db/user/schema"
import { env } from "../lib/env"

async function promoteUserToAdmin() {
  console.log("🔧 提升用户为管理员...")
  
  try {
    await connectToDatabase()
    
    // 获取所有用户
    const users = await UserModel.find({}).select('username email role status')
    
    if (users.length === 0) {
      console.log("❌ 没有找到任何用户")
      return
    }
    
    console.log("📋 当前用户列表:")
    users.forEach((user, index) => {
      console.log(`  ${index + 1}. ${user.email} (${user.username}) - ${user.role}`)
    })
    
    // 如果只有一个用户，自动提升为管理员
    if (users.length === 1) {
      const user = users[0]
      
      // 修复缺失的username
      if (!user.username && user.email) {
        user.username = user.email.split('@')[0].replace(/[^a-z0-9_]/g, '')
      }
      
      user.role = 'admin'
      user.status = 'active'
      user.isEmailVerified = true
      
      await user.save()
      console.log(`✅ 用户 ${user.email} 已提升为管理员`)
      return
    }
    
    // 如果有多个用户，提升第一个用户为管理员（选择有完整信息的用户）
    let userToPromote = users.find(u => u.username && u.email) || users[0]
    
    // 修复缺失的username
    if (!userToPromote.username && userToPromote.email) {
      userToPromote.username = userToPromote.email.split('@')[0].replace(/[^a-z0-9_]/g, '')
    }
    
    userToPromote.role = 'admin'
    userToPromote.status = 'active'
    userToPromote.isEmailVerified = true
    
    await userToPromote.save()
    console.log(`✅ 用户 ${userToPromote.email} 已提升为管理员`)
    
    console.log("\n💡 提示: 如需提升其他用户为管理员，请手动修改数据库中的role字段")
    
  } catch (error) {
    console.error("❌ 提升管理员失败:", error)
    process.exit(1)
  }
}

// 执行脚本
if (require.main === module) {
  promoteUserToAdmin()
    .then(() => {
      console.log("🎉 操作完成")
      process.exit(0)
    })
    .catch((error) => {
      console.error("💥 操作失败:", error)
      process.exit(1)
    })
}

export default promoteUserToAdmin