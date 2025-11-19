import { NextResponse } from "next/server"
import { authenticateRequest, createAuthErrorResponse } from "@/utils/apiAuth"
import { deleteCampaign } from "@/utils/campaigns"

/**
 * POST /api/campaigns/delete
 * Deletes a campaign by ID
 * Requires admin role
 */
export async function POST(request: Request) {
  // Authenticate request - requires admin role
  const auth = await authenticateRequest(request, "admin")
  if (!auth.success) {
    return createAuthErrorResponse(auth)
  }

  try {
    const body = await request.json().catch(() => ({}))
    const { id } = body

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { success: false, error: "Campaign ID is required" },
        { status: 400 }
      )
    }

    await deleteCampaign(id)

    return NextResponse.json({
      success: true,
      message: "Campaign deleted successfully",
    })
  } catch (error: any) {
    console.error("campaigns/delete error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to delete campaign",
      },
      { status: 500 }
    )
  }
}

