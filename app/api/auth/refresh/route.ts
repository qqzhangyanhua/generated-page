import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/db/mongo"
import { getUserById } from "@/lib/db/user/selectors"
import { verifyRefreshToken, generateTokenPair } from "@/lib/auth/jwt"
import { z } from "zod"

const refreshSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
})

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase()

    const body = await request.json()
    
    // 验证请求参数
    const validationResult = refreshSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: "Invalid input",
          details: validationResult.error.errors 
        },
        { status: 400 }
      )
    }

    const { refreshToken } = validationResult.data

    // 验证刷新令牌
    const payload = verifyRefreshToken(refreshToken)
    if (!payload) {
      return NextResponse.json(
        { error: "Invalid or expired refresh token" },
        { status: 401 }
      )
    }

    // 获取用户信息
    const user = await getUserById(payload.userId)
    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      )
    }

    // 检查用户状态
    if (user.status !== 'active') {
      return NextResponse.json(
        { error: "Account is not active" },
        { status: 403 }
      )
    }

    // 生成新的令牌对
    const { accessToken, refreshToken: newRefreshToken } = generateTokenPair(user)

    // 返回新的令牌
    return NextResponse.json({
      message: "Token refreshed successfully",
      tokens: {
        accessToken,
        refreshToken: newRefreshToken,
      }
    })

  } catch (error) {
    console.error("Token refresh error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}