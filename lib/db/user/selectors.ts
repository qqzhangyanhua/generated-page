import { UserModel } from "./schema"
import { User } from "./types"
import { connectToDatabase } from "../mongo"

export async function getUserById(userId: string): Promise<User | null> {
  await connectToDatabase()
  
  return await UserModel.findById(userId)
}

export async function getUserByEmail(email: string): Promise<User | null> {
  await connectToDatabase()
  
  return await UserModel.findOne({ 
    email: email.toLowerCase().trim(),
    status: { $ne: 'banned' } 
  })
}

export async function getUserByUsername(username: string): Promise<User | null> {
  await connectToDatabase()
  
  return await UserModel.findOne({ 
    username,
    status: { $ne: 'banned' }
  })
}

export async function getUserByGithubId(githubId: string): Promise<User | null> {
  await connectToDatabase()
  
  return await UserModel.findOne({ 
    githubId,
    status: { $ne: 'banned' }
  })
}

export async function getUserWithPassword(email: string): Promise<User | null> {
  await connectToDatabase()
  
  // 专门用于登录验证，需要返回密码字段
  const user = await UserModel.findOne({ 
    email: email.toLowerCase().trim(),
    status: 'active' 
  }).select('+password')
  
  return user as User | null
}

export async function checkUsernameExists(username: string): Promise<boolean> {
  await connectToDatabase()
  
  const user = await UserModel.findOne({ username })
  return !!user
}

export async function checkEmailExists(email: string): Promise<boolean> {
  await connectToDatabase()
  
  const user = await UserModel.findOne({ 
    email: email.toLowerCase().trim() 
  })
  return !!user
}

export interface GetUsersOptions {
  page?: number
  limit?: number
  role?: string
  status?: string
  search?: string
}

export interface GetUsersResult {
  users: User[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export async function getUsers(options: GetUsersOptions = {}): Promise<GetUsersResult> {
  await connectToDatabase()
  
  const {
    page = 1,
    limit = 20,
    role,
    status,
    search
  } = options
  
  const skip = (page - 1) * limit
  
  // 构建查询条件
  const query: Record<string, unknown> = {}
  
  if (role) {
    query.role = role
  }
  
  if (status) {
    query.status = status
  }
  
  if (search) {
    query.$or = [
      { username: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { displayName: { $regex: search, $options: 'i' } }
    ]
  }
  
  const [users, total] = await Promise.all([
    UserModel.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    UserModel.countDocuments(query)
  ])
  
  return {
    users,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  }
}