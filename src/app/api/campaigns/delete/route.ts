import { NextResponse } from "next/server"
import { authenticateRequest, createAuthErrorResponse } from "@/shared/utils/firebase/apiAuth"
import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { applyRateLimit } from "@/shared/utils/shared/rateLimit"
import {
  assertUserHospitalAccess,
  getUserActiveHospitalId,
  isPlatformSuperAdmin,
} from "@/shared/utils/firebase/serverHospitalQueries"

/**
 * POST /api/campaigns/delete
 * Deletes a campaign by ID
 * Requires admin role
 */
export async function POST(request: Request) {
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

    const db = admin.firestore()
    const campaignRef = db.collection("campaigns").doc(id)

    const campaignDoc = await campaignRef.get()
    if (!campaignDoc.exists) {
      return NextResponse.json(
        { success: false, error: "Campaign not found" },
        { status: 404 }
      )
    }

    const campaignData = campaignDoc.data() as { hospitalId?: string | null } | undefined
    const campaignHospitalId =
      typeof campaignData?.hospitalId === "string" && campaignData.hospitalId.trim()
        ? campaignData.hospitalId.trim()
        : null

    const superAdmin = await isPlatformSuperAdmin(auth.user!.uid)
    if (!superAdmin) {
      const requesterHospitalId =
        (typeof hospitalId === "string" && hospitalId.trim()
          ? hospitalId.trim()
          : null) || (await getUserActiveHospitalId(auth.user!.uid))

      if (!requesterHospitalId) {
        return NextResponse.json(
          { success: false, error: "Hospital context required" },
          { status: 403 }
        )
      }

      const hasAccess = await assertUserHospitalAccess(auth.user!.uid, requesterHospitalId)
      if (!hasAccess) {
        return NextResponse.json(
          { success: false, error: "Forbidden: hospital access denied" },
          { status: 403 }
        )
      }

      if (!campaignHospitalId) {
        return NextResponse.json(
          { success: false, error: "Forbidden: campaign has no hospital scope" },
          { status: 403 }
        )
      }

      if (campaignHospitalId !== requesterHospitalId) {
        return NextResponse.json(
          { success: false, error: "Forbidden: Campaign does not belong to your hospital" },
          { status: 403 }
        )
      }
    }

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
