"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Loader2, CheckCircle, XCircle } from "lucide-react"

interface RegisterFormData {
  username: string
  email: string
  password: string
  confirmPassword: string
  displayName: string
}

interface PasswordStrength {
  score: number
  feedback: string[]
}

export default function RegisterPage() {
  const router = useRouter()
  const [formData, setFormData] = useState<RegisterFormData>({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    displayName: ""
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [passwordStrength, setPasswordStrength] = useState<PasswordStrength>({ score: 0, feedback: [] })

  const validatePasswordStrength = (password: string): PasswordStrength => {
    const feedback: string[] = []
    let score = 0

    if (!password) {
      return { score: 0, feedback: ["密码不能为空"] }
    }

    if (password.length >= 8) {
      score += 1
    } else {
      feedback.push("密码长度至少8位")
    }

    if (/[a-z]/.test(password)) {
      score += 1
    } else {
      feedback.push("密码应包含小写字母")
    }

    if (/[A-Z]/.test(password)) {
      score += 1
    } else {
      feedback.push("密码应包含大写字母")
    }

    if (/[0-9]/.test(password)) {
      score += 1
    } else {
      feedback.push("密码应包含数字")
    }

    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      score += 1
    } else {
      feedback.push("建议包含特殊字符以提高安全性")
    }

    if (feedback.length === 0) {
      feedback.push("密码强度良好")
    }

    return { score: Math.min(score, 4), feedback }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))

    // 实时检查密码强度
    if (name === "password") {
      setPasswordStrength(validatePasswordStrength(value))
    }

    // 清除错误信息
    if (error) {
      setError(null)
    }
    if (success) {
      setSuccess(null)
    }
  }

  // 密码强度颜色（预留功能）
  // const getPasswordStrengthColor = (score: number) => {
  //   if (score <= 1) return "bg-red-500"
  //   if (score <= 2) return "bg-orange-500"
  //   if (score <= 3) return "bg-yellow-500"
  //   return "bg-green-500"
  // }

  const getPasswordStrengthText = (score: number) => {
    if (score <= 1) return "弱"
    if (score <= 2) return "一般"
    if (score <= 3) return "良好"
    return "强"
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setSuccess(null)

    // 基本验证
    if (formData.password !== formData.confirmPassword) {
      setError("两次输入的密码不一致")
      setIsLoading(false)
      return
    }

    if (passwordStrength.score < 2) {
      setError("密码强度过低，请设置更强的密码")
      setIsLoading(false)
      return
    }

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: formData.username,
          email: formData.email,
          password: formData.password,
          displayName: formData.displayName || undefined
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "注册失败")
      }

      setSuccess("注册成功！正在跳转到登录页面...")
      
      // 2秒后跳转到登录页面
      setTimeout(() => {
        router.push("/login")
      }, 2000)

    } catch (err) {
      console.error("Register error:", err)
      setError(err instanceof Error ? err.message : "注册失败，请稍后重试")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            注册 Compoder
          </CardTitle>
          <CardDescription className="text-center">
            创建您的账户，开始使用 AI 组件代码生成器
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert className="border-green-200 bg-green-50 text-green-800">
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="username">用户名 *</Label>
              <Input
                id="username"
                name="username"
                type="text"
                placeholder="输入用户名（3-20位字母数字下划线）"
                value={formData.username}
                onChange={handleInputChange}
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">邮箱 *</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="输入您的邮箱"
                value={formData.email}
                onChange={handleInputChange}
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="displayName">显示名称（可选）</Label>
              <Input
                id="displayName"
                name="displayName"
                type="text"
                placeholder="输入显示名称"
                value={formData.displayName}
                onChange={handleInputChange}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">密码 *</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="输入密码（至少8位）"
                value={formData.password}
                onChange={handleInputChange}
                required
                disabled={isLoading}
              />
              {formData.password && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>密码强度：</span>
                    <span className="font-medium">
                      {getPasswordStrengthText(passwordStrength.score)}
                    </span>
                  </div>
                  <Progress 
                    value={(passwordStrength.score / 4) * 100} 
                    className="h-2"
                  />
                  {passwordStrength.feedback.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      <ul className="list-disc list-inside space-y-1">
                        {passwordStrength.feedback.map((item, index) => (
                          <li key={index}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">确认密码 *</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="再次输入密码"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                required
                disabled={isLoading}
              />
              {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                <p className="text-xs text-red-600">两次输入的密码不一致</p>
              )}
            </div>
          </CardContent>

          <CardFooter className="flex flex-col space-y-4">
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  注册中...
                </>
              ) : (
                "注册"
              )}
            </Button>

            <p className="text-sm text-muted-foreground text-center">
              已有账户？{" "}
              <Link 
                href="/login" 
                className="text-primary hover:underline font-medium"
              >
                立即登录
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}