import bcrypt from 'bcrypt'

const SALT_ROUNDS = 12 // 增强安全性的盐值轮数

/**
 * 哈希密码
 * @param password - 原始密码
 * @returns Promise<string> - 哈希后的密码
 */
export async function hashPassword(password: string): Promise<string> {
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a non-empty string')
  }
  
  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters long')
  }
  
  return await bcrypt.hash(password, SALT_ROUNDS)
}

/**
 * 验证密码
 * @param password - 原始密码
 * @param hashedPassword - 哈希后的密码
 * @returns Promise<boolean> - 是否匹配
 */
export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  if (!password || !hashedPassword) {
    return false
  }
  
  try {
    return await bcrypt.compare(password, hashedPassword)
  } catch (error) {
    console.error('Password verification error:', error)
    return false
  }
}

/**
 * 验证密码强度
 * @param password - 密码
 * @returns 密码强度评估结果
 */
export interface PasswordStrength {
  isValid: boolean
  score: number // 0-4分，4分最强
  feedback: string[]
}

export function validatePasswordStrength(password: string): PasswordStrength {
  const feedback: string[] = []
  let score = 0
  
  if (!password) {
    return {
      isValid: false,
      score: 0,
      feedback: ['密码不能为空']
    }
  }
  
  // 长度检查
  if (password.length < 8) {
    feedback.push('密码长度至少8位')
  } else if (password.length >= 8) {
    score += 1
  }
  
  // 包含小写字母
  if (/[a-z]/.test(password)) {
    score += 1
  } else {
    feedback.push('密码应包含小写字母')
  }
  
  // 包含大写字母
  if (/[A-Z]/.test(password)) {
    score += 1
  } else {
    feedback.push('密码应包含大写字母')
  }
  
  // 包含数字
  if (/[0-9]/.test(password)) {
    score += 1
  } else {
    feedback.push('密码应包含数字')
  }
  
  // 包含特殊字符
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    score += 1
  } else {
    feedback.push('建议包含特殊字符以提高安全性')
  }
  
  // 基本要求：至少8位，包含字母和数字
  const isValid = password.length >= 8 && 
                  /[a-zA-Z]/.test(password) && 
                  /[0-9]/.test(password)
  
  if (feedback.length === 0) {
    feedback.push('密码强度良好')
  }
  
  return {
    isValid,
    score: Math.min(score, 4),
    feedback
  }
}