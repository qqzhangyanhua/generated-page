import { UserModel } from "./schema"
import { CreateUserInput, UpdateUserInput, User } from "./types"
import { connectToDatabase } from "../mongo"

export async function createUser(input: CreateUserInput): Promise<User> {
  await connectToDatabase()
  
  const user = new UserModel({
    ...input,
    isEmailVerified: false,
    role: input.role || 'user',
    status: 'active',
  })
  
  return await user.save()
}

export async function updateUser(userId: string, input: UpdateUserInput): Promise<User | null> {
  await connectToDatabase()
  
  return await UserModel.findByIdAndUpdate(
    userId,
    { 
      ...input,
      ...(input.lastLoginAt && { lastLoginAt: input.lastLoginAt })
    },
    { 
      new: true, // 返回更新后的文档
      runValidators: true // 运行schema验证
    }
  )
}

export async function updateUserPassword(userId: string, hashedPassword: string): Promise<User | null> {
  await connectToDatabase()
  
  return await UserModel.findByIdAndUpdate(
    userId,
    { password: hashedPassword },
    { new: true, runValidators: true }
  )
}

export async function deleteUser(userId: string): Promise<User | null> {
  await connectToDatabase()
  
  return await UserModel.findByIdAndUpdate(
    userId,
    { status: 'inactive' },
    { new: true }
  )
}

export async function verifyUserEmail(userId: string): Promise<User | null> {
  await connectToDatabase()
  
  return await UserModel.findByIdAndUpdate(
    userId,
    { isEmailVerified: true },
    { new: true }
  )
}

export async function banUser(userId: string): Promise<User | null> {
  await connectToDatabase()
  
  return await UserModel.findByIdAndUpdate(
    userId,
    { status: 'banned' },
    { new: true }
  )
}

export async function unbanUser(userId: string): Promise<User | null> {
  await connectToDatabase()
  
  return await UserModel.findByIdAndUpdate(
    userId,
    { status: 'active' },
    { new: true }
  )
}