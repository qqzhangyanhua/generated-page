import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/db/mongo"
import { getUserByEmail } from "@/lib/db/user/selectors"
import { updateUserPassword } from "@/lib/db/user/mutations"
import { hashPassword, validatePasswordStrength } from "@/lib/auth/password"
import { z } from "zod"

const resetPasswordSchema = z.object({
  email: z
    .string()
    .email("邮箱格式不正确")
    .toLowerCase(),
  newPassword: z
    .string()
    .min(8, "密码至少8个字符"),
  confirmPassword: z
    .string()
    .min(1, "请确认密码"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "两次输入的密码不一致",
  path: ["confirmPassword"],
})

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase()

    const body = await request.json()
    
    // 验证请求参数
    const validationResult = resetPasswordSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: "Invalid input",
          details: validationResult.error.errors 
        },
        { status: 400 }
      )
    }

    const { email, newPassword } = validationResult.data

    // 验证密码强度
    const passwordStrength = validatePasswordStrength(newPassword)
    if (!passwordStrength.isValid) {
      return NextResponse.json(
        { 
          error: "Password too weak",
          feedback: passwordStrength.feedback 
        },
        { status: 400 }
      )
    }

    // 获取用户信息
    const user = await getUserByEmail(email)
    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      )
    }

    // 检查是否是从Github迁移的用户（无密码或空密码）
    if (user.password && user.migratedFrom !== 'github') {
      return NextResponse.json(
        { error: "User already has a password. Use change password instead." },
        { status: 400 }
      )
    }

    // 加密新密码
    const hashedPassword = await hashPassword(newPassword)

    // 更新用户密码
    await updateUserPassword(user._id.toString(), hashedPassword)

    return NextResponse.json({
      message: "Password set successfully",
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        migratedFrom: user.migratedFrom,
      }
    })

  } catch (error) {
    console.error("Set password error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}