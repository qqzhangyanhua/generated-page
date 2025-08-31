import jwt from 'jsonwebtoken'
import { env } from '@/lib/env'
import { User } from '@/lib/db/user/types'

export interface JWTPayload {
  userId: string
  email: string
  role: string
  iat?: number
  exp?: number
}

export interface TokenPair {
  accessToken: string
  refreshToken: string
}

/**
 * 生成访问令牌
 * @param user - 用户信息
 * @returns 访问令牌
 */
export function generateAccessToken(user: User): string {
  const payload: JWTPayload = {
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
  }

  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
    issuer: 'compoder',
    audience: 'compoder-users',
  } as jwt.SignOptions)
}

/**
 * 生成刷新令牌
 * @param user - 用户信息
 * @returns 刷新令牌
 */
export function generateRefreshToken(user: User): string {
  const payload: JWTPayload = {
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
  }

  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
    issuer: 'compoder',
    audience: 'compoder-refresh',
  } as jwt.SignOptions)
}

/**
 * 生成令牌对（访问令牌 + 刷新令牌）
 * @param user - 用户信息
 * @returns 令牌对
 */
export function generateTokenPair(user: User): TokenPair {
  return {
    accessToken: generateAccessToken(user),
    refreshToken: generateRefreshToken(user),
  }
}

/**
 * 验证并解析访问令牌
 * @param token - 访问令牌
 * @returns 解析后的payload
 */
export function verifyAccessToken(token: string): JWTPayload | null {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, {
      issuer: 'compoder',
      audience: 'compoder-users',
    }) as JWTPayload

    return payload
  } catch (error) {
    console.error('Access token verification failed:', error)
    return null
  }
}

/**
 * 验证并解析刷新令牌
 * @param token - 刷新令牌
 * @returns 解析后的payload
 */
export function verifyRefreshToken(token: string): JWTPayload | null {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, {
      issuer: 'compoder',
      audience: 'compoder-refresh',
    }) as JWTPayload

    return payload
  } catch (error) {
    console.error('Refresh token verification failed:', error)
    return null
  }
}

/**
 * 从请求头中提取Bearer token
 * @param authHeader - Authorization头部
 * @returns token或null
 */
export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) {
    return null
  }

  const parts = authHeader.split(' ')
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null
  }

  return parts[1]
}

/**
 * 检查token是否即将过期（30分钟内）
 * @param payload - JWT payload
 * @returns 是否即将过期
 */
export function isTokenExpiringSoon(payload: JWTPayload): boolean {
  if (!payload.exp) {
    return true
  }

  const now = Math.floor(Date.now() / 1000)
  const thirtyMinutes = 30 * 60 // 30分钟
  
  return (payload.exp - now) < thirtyMinutes
}