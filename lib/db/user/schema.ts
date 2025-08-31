import mongoose, { Schema, model } from "mongoose"
import { User } from "./types"

const UserSchema = new Schema<User>(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 20,
      match: /^[a-zA-Z0-9_]+$/,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
    },
    displayName: {
      type: String,
      trim: true,
      maxlength: 50,
    },
    avatar: {
      type: String,
      trim: true,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'banned'],
      default: 'active',
    },
    lastLoginAt: {
      type: Date,
    },
    // 迁移相关字段
    githubId: {
      type: String,
      sparse: true, // 允许多个文档为null，但不能有重复非null值
    },
    migratedFrom: {
      type: String,
      enum: ['github'],
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function(doc, ret) {
        delete ret.password // 序列化时移除密码字段
        return ret
      }
    }
  }
)

// 创建复合索引提高查询性能
UserSchema.index({ email: 1, status: 1 })
UserSchema.index({ username: 1, status: 1 })
UserSchema.index({ githubId: 1 }, { sparse: true })

export const UserModel = 
  mongoose.models.User || model<User>("User", UserSchema)