import { NextResponse } from "next/server"
import { authenticateRequest, createAuthErrorResponse } from "@/utils/apiAuth"
import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"

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
    const initResult = initFirebaseAdmin("delete-campaign API")
    if (!initResult.ok) {
      return NextResponse.json(
        { success: false, error: "Server not configured" },
        { status: 500 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const { id } = body

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { success: false, error: "Campaign ID is required" },
        { status: 400 }
      )
    }

    // Use Firebase Admin SDK to delete the campaign
    const db = admin.firestore()
    const campaignRef = db.collection("campaigns").doc(id)
    
    // Check if campaign exists
    const campaignDoc = await campaignRef.get()
    if (!campaignDoc.exists) {
      return NextResponse.json(
        { success: false, error: "Campaign not found" },
        { status: 404 }
      )
    }

    // Delete the campaign
    await campaignRef.delete()

    return NextResponse.json({
      success: true,
      message: "Campaign deleted successfully",
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to delete campaign",
      },
      { status: 500 }
    )
  }
}

