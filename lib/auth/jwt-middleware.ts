import { NextRequest, NextResponse } from "next/server"
import { extractBearerToken, verifyAccessToken, JWTPayload } from "./jwt"
import { getUserById } from "@/lib/db/user/selectors"
import { User } from "@/lib/db/user/types"

export interface AuthenticatedRequest extends NextRequest {
  user?: User
  userId?: string
}

/**
 * 验证用户会话（替换NextAuth的validateSession）
 * @param request - NextRequest对象
 * @returns NextResponse或null（验证通过）
 */
export async function validateJWTSession(
  request: NextRequest
): Promise<{ error: NextResponse | null; payload: JWTPayload | null }> {
  const authHeader = request.headers.get('authorization')
  const token = extractBearerToken(authHeader)

  if (!token) {
    return {
      error: NextResponse.json(
        { error: "Unauthorized - Please login first" },
        { status: 401 }
      ),
      payload: null,
    }
  }

  const payload = verifyAccessToken(token)
  if (!payload) {
    return {
      error: NextResponse.json(
        { error: "Unauthorized - Invalid or expired token" },
        { status: 401 }
      ),
      payload: null,
    }
  }

  return { error: null, payload }
}

/**
 * 获取当前用户ID（替换NextAuth的getUserId）
 * @param request - NextRequest对象
 * @returns 用户ID或null
 */
export async function getCurrentUserId(request: NextRequest): Promise<string | null> {
  const { payload } = await validateJWTSession(request)
  return payload?.userId || null
}

/**
 * 获取当前用户信息
 * @param request - NextRequest对象
 * @returns 用户信息或null
 */
export async function getCurrentUser(request: NextRequest): Promise<User | null> {
  const userId = await getCurrentUserId(request)
  if (!userId) {
    return null
  }

  try {
    return await getUserById(userId)
  } catch (error) {
    console.error('Failed to get current user:', error)
    return null
  }
}

/**
 * 检查用户角色权限
 * @param user - 用户信息
 * @param requiredRole - 所需角色
 * @returns 是否有权限
 */
export function hasRole(user: User, requiredRole: 'admin' | 'user'): boolean {
  if (requiredRole === 'admin') {
    return user.role === 'admin'
  }
  
  // 'user'角色包括所有用户
  return user.role === 'user' || user.role === 'admin'
}

/**
 * 检查用户是否处于活跃状态
 * @param user - 用户信息
 * @returns 是否活跃
 */
export function isUserActive(user: User): boolean {
  return user.status === 'active' && user.isEmailVerified
}

/**
 * 管理员权限验证中间件
 * @param request - NextRequest对象
 * @returns NextResponse或null（验证通过）
 */
export async function validateAdminPermission(
  request: NextRequest
): Promise<NextResponse | null> {
  const { error, payload } = await validateJWTSession(request)
  
  if (error) {
    return error
  }

  const user = await getUserById(payload!.userId)
  if (!user || !hasRole(user, 'admin') || !isUserActive(user)) {
    return NextResponse.json(
      { error: "Forbidden - Admin access required" },
      { status: 403 }
    )
  }

  return null
}