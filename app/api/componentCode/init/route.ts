import { NextRequest, NextResponse } from "next/server"
import { run, initComponentWorkflow } from "@/app/api/ai-core/workflow"
import { ComponentCodeApi } from "../type"
import { findCodegenById } from "@/lib/db/codegen/selectors"
import { getAIClient } from "@/app/api/ai-core/utils/aiClient"
import { validateJWTSession, getCurrentUserId } from "@/lib/auth/jwt-middleware"
import { connectToDatabase } from "@/lib/db/mongo"
import { LanguageModel } from "ai"
import { AIProvider } from "@/lib/config/ai-providers"

export async function POST(request: NextRequest) {
  try {
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

    const encoder = new TextEncoder()
    const stream = new TransformStream()
    const writer = stream.writable.getWriter()

    const body = (await request.json()) as ComponentCodeApi.initRequest
    const codegenDetail = await findCodegenById(body.codegenId)

    const aiModel = getAIClient(body.provider as AIProvider, body.model)

    const response = new Response(stream.readable)

    run(initComponentWorkflow, {
      stream: {
        write: (chunk: string) => writer.write(encoder.encode(chunk)),
        close: () => writer.close(),
      },
      query: {
        prompt: body.prompt,
        aiModel: aiModel as LanguageModel,
        rules: codegenDetail.rules,
        userId: userId!,
        codegenId: body.codegenId,
        component: body.component,
      },
    })

    return response
  } catch (error) {
    console.error("Failed to get component code detail:", error)
    return NextResponse.json(
      { error: "Failed to get component code detail" },
      { status: 500 },
    )
  }
}
