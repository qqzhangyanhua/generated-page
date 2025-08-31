import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/db/mongo"
import { getUserWithPassword } from "@/lib/db/user/selectors"
import { updateUser } from "@/lib/db/user/mutations"
import { verifyPassword } from "@/lib/auth/password"
import { generateTokenPair } from "@/lib/auth/jwt"
import { z } from "zod"

const loginSchema = z.object({
  email: z
    .string()
    .email("邮箱格式不正确")
    .toLowerCase(),
  password: z
    .string()
    .min(1, "密码不能为空"),
})

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase()

    const body = await request.json()
    
    // 验证请求参数
    const validationResult = loginSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: "Invalid input",
          details: validationResult.error.errors 
        },
        { status: 400 }
      )
    }

    const { email, password } = validationResult.data

    // 获取用户信息（包含密码）
    const user = await getUserWithPassword(email)
    if (!user) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      )
    }

    // 检查用户状态
    if (user.status === 'banned') {
      return NextResponse.json(
        { error: "Account has been banned" },
        { status: 403 }
      )
    }

    if (user.status === 'inactive') {
      return NextResponse.json(
        { error: "Account is inactive" },
        { status: 403 }
      )
    }

    // 验证密码
    const isPasswordValid = await verifyPassword(password, user.password)
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      )
    }

    // 更新最后登录时间
    await updateUser(user._id.toString(), {
      lastLoginAt: new Date(),
    })

    // 生成JWT令牌对
    const { accessToken, refreshToken } = generateTokenPair(user)

    // 返回成功结果
    return NextResponse.json({
      message: "Login successful",
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        avatar: user.avatar,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        lastLoginAt: new Date(),
      },
      tokens: {
        accessToken,
        refreshToken,
      }
    })

  } catch (error) {
    console.error("Login error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}