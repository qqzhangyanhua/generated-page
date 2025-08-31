import { NextResponse, NextRequest } from "next/server"
import { reloadAIProvidersConfig } from "@/lib/config/ai-providers"
import { validateAdminPermission } from "@/lib/auth/jwt-middleware"

/**
 * API route that reloads the AI providers configuration from the config file
 * This is used when the configuration file has been updated and we need to reload it
 */
export async function POST(request: NextRequest) {
  try {
    const authError = await validateAdminPermission(request)
    if (authError) {
      return authError
    }

    // Reload the AI providers configuration
    reloadAIProvidersConfig()

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error reloading AI providers configuration:", error)
    return NextResponse.json(
      { error: "Failed to reload AI providers configuration" },
      { status: 500 },
    )
  }
}
