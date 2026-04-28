import { NextResponse } from "next/server"
import { authenticateRequest, createAuthErrorResponse } from "@/utils/firebase/apiAuth"
import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { applyRateLimit } from "@/utils/shared/rateLimit"

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
    const rateLimitResult = await applyRateLimit(request, "ADMIN", auth.user?.uid)
    if (rateLimitResult instanceof Response) {
      return rateLimitResult
    }

    const initResult = initFirebaseAdmin("delete-campaign API")
    if (!initResult.ok) {
      return NextResponse.json(
        { success: false, error: "Server not configured" },
        { status: 500 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const { id, hospitalId } = body

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

    // Backward-compatible tenant guard:
    // enforce match only when both campaign + request carry hospital context.
    const campaignData = campaignDoc.data() as { hospitalId?: string | null } | undefined
    const campaignHospitalId = campaignData?.hospitalId || null
    const requestedHospitalId =
      typeof hospitalId === "string" && hospitalId.trim().length > 0 ? hospitalId.trim() : null
    const requesterHospitalId =
      typeof auth.user?.data?.hospitalId === "string" && auth.user.data.hospitalId.trim().length > 0
        ? auth.user.data.hospitalId.trim()
        : null
    const isSuperAdmin = Boolean(auth.user?.data?.isSuperAdmin)

    if (!isSuperAdmin && campaignHospitalId && (requestedHospitalId || requesterHospitalId)) {
      const effectiveHospitalId = requestedHospitalId || requesterHospitalId
      if (effectiveHospitalId !== campaignHospitalId) {
        return NextResponse.json(
          { success: false, error: "Forbidden: Campaign does not belong to your hospital context" },
          { status: 403 }
        )
      }
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

