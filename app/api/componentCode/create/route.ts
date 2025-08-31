import { NextRequest, NextResponse } from "next/server"
import { ComponentCodeApi } from "../type"
import { validateJWTSession, getCurrentUserId } from "@/lib/auth/jwt-middleware"
import { connectToDatabase } from "@/lib/db/mongo"
import { createComponentCode } from "@/lib/db/componentCode/mutations"

const UNINITIALIZED_COMPONENT_NAME = "uninitialized component"
const UNINITIALIZED_COMPONENT_DESCRIPTION =
  "This component is not initialized yet"

export async function POST(request: NextRequest) {
  try {
    // 验证JWT认证
    const { error } = await validateJWTSession(request)
    if (error) {
      return error
    }

    await connectToDatabase()

    const userId = await getCurrentUserId(request)
    if (!userId) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      )
    }

    const body = (await request.json()) as ComponentCodeApi.createRequest

    const component = await createComponentCode({
      userId,
      codegenId: body.codegenId,
      name: UNINITIALIZED_COMPONENT_NAME,
      description: UNINITIALIZED_COMPONENT_DESCRIPTION,
      prompt: body.prompt,
      // created component code is empty, need to be initialized
      code: "",
    })
    return new Response(JSON.stringify({ data: component }))
  } catch (error) {
    console.error("Failed to create component code:", error)
    return NextResponse.json(
      { error: "Failed to create component code" },
      { status: 500 },
    )
  }
}
