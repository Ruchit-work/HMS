import { NextResponse } from "next/server"
import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { authenticateRequest, createAuthErrorResponse } from "@/shared/utils/firebase/apiAuth"
import {
  getUserActiveHospitalId,
  isPlatformSuperAdmin,
  resolveAuthorizedHospitalId,
} from "@/shared/utils/firebase/serverHospitalQueries"
import { getHospitalPrintSettings } from "@/server/hospitalPrintSettings"
import { normalizeHospitalPrintSettings } from "@/shared/utils/printSettings"
import { applyRateLimit } from "@/shared/utils/shared/rateLimit"

async function resolveHospitalForRead(
  uid: string,
  role: string,
  requestedHospitalId: string | null
): Promise<string | null> {
  if (role === "super_admin" || (await isPlatformSuperAdmin(uid))) {
    return requestedHospitalId
  }
  if (role === "admin" || role === "receptionist" || role === "doctor" || role === "patient") {
    return resolveAuthorizedHospitalId(
      uid,
      requestedHospitalId || (await getUserActiveHospitalId(uid))
    )
  }
  return null
}

async function resolveHospitalForWrite(
  uid: string,
  role: string,
  requestedHospitalId: string | null
): Promise<string | null> {
  if (role === "super_admin" || (await isPlatformSuperAdmin(uid))) {
    return requestedHospitalId
  }
  if (role !== "admin") return null
  return resolveAuthorizedHospitalId(
    uid,
    requestedHospitalId || (await getUserActiveHospitalId(uid))
  )
}

export async function GET(request: Request) {
  const auth = await authenticateRequest(request)
  if (!auth.success) return createAuthErrorResponse(auth)
  if (!auth.user) return NextResponse.json({ error: "User context missing" }, { status: 403 })

  const url = new URL(request.url)
  const requestedHospitalId = url.searchParams.get("hospitalId")?.trim() || null
  const hospitalId = await resolveHospitalForRead(auth.user.uid, auth.user.role, requestedHospitalId)

  const settings = await getHospitalPrintSettings(hospitalId)
  return NextResponse.json({ hospitalId, settings })
}

export async function PUT(request: Request) {
  const limit = await applyRateLimit(request, "ADMIN")
  if (limit instanceof Response) return limit

  const auth = await authenticateRequest(request)
  if (!auth.success) return createAuthErrorResponse(auth)
  if (!auth.user) return NextResponse.json({ error: "User context missing" }, { status: 403 })

  try {
    const initResult = initFirebaseAdmin("hospital print settings API")
    if (!initResult.ok) {
      return NextResponse.json({ error: "Server not configured" }, { status: 500 })
    }

    const body = await request.json().catch(() => ({}))
    const requestedHospitalId =
      typeof body?.hospitalId === "string" && body.hospitalId.trim()
        ? body.hospitalId.trim()
        : null
    const hospitalId = await resolveHospitalForWrite(
      auth.user.uid,
      auth.user.role,
      requestedHospitalId
    )
    if (!hospitalId) {
      return NextResponse.json(
        { error: "Hospital Admin access required for this hospital." },
        { status: 403 }
      )
    }

    const hospitalRef = admin.firestore().collection("hospitals").doc(hospitalId)
    const hospital = await hospitalRef.get()
    if (!hospital.exists) {
      return NextResponse.json({ error: "Hospital not found" }, { status: 404 })
    }

    const settings = normalizeHospitalPrintSettings(body?.settings)
    const nowIso = new Date().toISOString()

    await hospitalRef.update({
      "settings.print": settings,
      "settings.printUpdatedAt": nowIso,
      "settings.printUpdatedBy": auth.user.uid,
      updatedAt: nowIso,
    })

    return NextResponse.json({ success: true, hospitalId, settings })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to save print settings"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
