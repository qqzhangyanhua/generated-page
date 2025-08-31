import { Document, ObjectId } from "mongoose"

export type UserRole = 'user' | 'admin'
export type UserStatus = 'active' | 'inactive' | 'banned'
export type MigrationSource = 'github'

export interface User extends Document {
  _id: ObjectId
  username: string
  email: string
  password: string
  displayName?: string
  avatar?: string
  isEmailVerified: boolean
  role: UserRole
  status: UserStatus
  lastLoginAt?: Date
  createdAt: Date
  updatedAt: Date
  
  // 迁移相关字段
  githubId?: string
  migratedFrom?: MigrationSource
}

export interface CreateUserInput {
  username: string
  email: string
  password: string
  displayName?: string
  avatar?: string
  role?: UserRole
}

export interface UpdateUserInput {
  displayName?: string
  avatar?: string
  isEmailVerified?: boolean
  lastLoginAt?: Date
  status?: UserStatus
}

export interface LoginInput {
  email: string
  password: string
}

export interface RegisterInput {
  username: string
  email: string
  password: string
  displayName?: string
}