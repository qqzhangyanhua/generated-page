import { NextRequest, NextResponse } from "next/server"
import { deleteComponentCode } from "@/lib/db/componentCode/mutations"
import { validateJWTSession } from "@/lib/auth/jwt-middleware"
import { connectToDatabase } from "@/lib/db/mongo"

export async function DELETE(request: NextRequest) {
  try {
    // 1. 验证JWT认证
    const { error } = await validateJWTSession(request)
    if (error) {
      return error
    }

    // 2. Connect to database
    await connectToDatabase()

    // 3. Get query parameters from URL
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json(
        { error: "Missing required parameter: id" },
        { status: 400 },
      )
    }

    // 4. Execute delete operation
    await deleteComponentCode({ id })

    // 5. Return empty response, indicating successful deletion
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error("Error in DELETE operation:", error)
    return NextResponse.json(
      { error: "Delete operation failed" },
      { status: 500 },
    )
  }
}
