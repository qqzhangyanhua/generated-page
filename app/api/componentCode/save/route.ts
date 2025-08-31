import { NextRequest, NextResponse } from "next/server"
import { saveComponentCodeVersion } from "@/lib/db/componentCode/mutations"
import type { ComponentCodeApi } from "../type"
import { validateJWTSession } from "@/lib/auth/jwt-middleware"
import { connectToDatabase } from "@/lib/db/mongo"

export async function POST(request: NextRequest) {
  try {
    const { error } = await validateJWTSession(request)
    if (error) {
      return error
    }

    await connectToDatabase()

    const body = (await request.json()) as ComponentCodeApi.saveRequest
    const { id, versionId, code } = body

    const result = await saveComponentCodeVersion({
      id,
      versionId,
      code,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error saving component code:", error)
    return NextResponse.json(
      { error: "Failed to save component code" },
      { status: 500 },
    )
  }
}
