import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/db/mongo"
import { createUser } from "@/lib/db/user/mutations"
import { checkEmailExists, checkUsernameExists } from "@/lib/db/user/selectors"
import { hashPassword, validatePasswordStrength } from "@/lib/auth/password"
import { z } from "zod"

const registerSchema = z.object({
  username: z
    .string()
    .min(3, "用户名至少3个字符")
    .max(20, "用户名最多20个字符")
    .regex(/^[a-zA-Z0-9_]+$/, "用户名只能包含字母、数字和下划线"),
  email: z
    .string()
    .email("邮箱格式不正确")
    .toLowerCase(),
  password: z
    .string()
    .min(8, "密码至少8个字符"),
  displayName: z
    .string()
    .max(50, "显示名称最多50个字符")
    .optional(),
})

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase()

    const body = await request.json()
    
    // 验证请求参数
    const validationResult = registerSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: "Invalid input",
          details: validationResult.error.errors 
        },
        { status: 400 }
      )
    }

    const { username, email, password, displayName } = validationResult.data

    // 验证密码强度
    const passwordStrength = validatePasswordStrength(password)
    if (!passwordStrength.isValid) {
      return NextResponse.json(
        { 
          error: "Password too weak",
          feedback: passwordStrength.feedback 
        },
        { status: 400 }
      )
    }

    // 检查用户名是否已存在
    const usernameExists = await checkUsernameExists(username)
    if (usernameExists) {
      return NextResponse.json(
        { error: "Username already exists" },
        { status: 409 }
      )
    }

    // 检查邮箱是否已存在
    const emailExists = await checkEmailExists(email)
    if (emailExists) {
      return NextResponse.json(
        { error: "Email already exists" },
        { status: 409 }
      )
    }

    // 加密密码
    const hashedPassword = await hashPassword(password)

    // 创建用户
    const user = await createUser({
      username,
      email,
      password: hashedPassword,
      displayName,
      role: 'user',
    })

    // 返回成功结果（不包含密码）
    return NextResponse.json({
      message: "User created successfully",
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        isEmailVerified: user.isEmailVerified,
        createdAt: user.createdAt,
      }
    }, { status: 201 })

  } catch (error) {
    console.error("Registration error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}