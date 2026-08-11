import { NextResponse } from "next/server"
import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { authenticateRequest, createAuthErrorResponse } from "@/shared/utils/firebase/apiAuth"
import {
  getUserActiveHospitalId,
  isPlatformSuperAdmin,
  resolveAuthorizedHospitalId,
} from "@/shared/utils/firebase/serverHospitalQueries"
import { applyRateLimit } from "@/shared/utils/shared/rateLimit"
import { auditLogger, AUDIT_ACTIONS } from "@/server/auditLogger"
import { mergeReceptionistSettings } from "@/shared/constants/receptionistDefaults"
import type { HospitalReceptionistSettings } from "@/types/hospital"

async function resolveHospitalForRead(
  uid: string,
  role: string,
  requestedHospitalId: string | null
): Promise<string | null> {
  if (role === "super_admin" || (await isPlatformSuperAdmin(uid))) {
    return requestedHospitalId || (await getUserActiveHospitalId(uid))
  }
  if (["admin", "receptionist", "doctor", "patient", "pharmacy"].includes(role)) {
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
    return requestedHospitalId || (await getUserActiveHospitalId(uid))
  }
  if (role !== "admin") return null
  return resolveAuthorizedHospitalId(
    uid,
    requestedHospitalId || (await getUserActiveHospitalId(uid))
  )
}

/**
 * GET /api/admin/hospital-receptionist-settings?hospitalId=...
 * Fetch receptionist experience settings for a hospital
 */
export async function GET(request: Request) {
  const auth = await authenticateRequest(request)
  if (!auth.success) return createAuthErrorResponse(auth)
  if (!auth.user) return NextResponse.json({ error: "User context missing" }, { status: 403 })

  const url = new URL(request.url)
  const requestedHospitalId = url.searchParams.get("hospitalId")?.trim() || null
  const hospitalId = await resolveHospitalForRead(auth.user.uid, auth.user.role, requestedHospitalId)

  if (!hospitalId) {
    return NextResponse.json({ error: "Hospital access required." }, { status: 403 })
  }

  const initResult = initFirebaseAdmin("receptionist settings GET")
  if (!initResult.ok) {
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }

  const db = admin.firestore()
  const hospitalDoc = await db.collection("hospitals").doc(hospitalId).get()
  if (!hospitalDoc.exists) {
    return NextResponse.json({ error: "Hospital not found" }, { status: 404 })
  }

  const data = hospitalDoc.data() || {}
  const rawReceptionist = data.settings?.receptionist as Partial<HospitalReceptionistSettings> | undefined
  const settings = mergeReceptionistSettings(rawReceptionist)

  return NextResponse.json({ success: true, hospitalId, settings })
}

/**
 * PUT /api/admin/hospital-receptionist-settings
 * Save receptionist experience settings for a hospital
 */
export async function PUT(request: Request) {
  const limit = await applyRateLimit(request, "ADMIN")
  if (limit instanceof Response) return limit

  const auth = await authenticateRequest(request)
  if (!auth.success) return createAuthErrorResponse(auth)
  if (!auth.user) return NextResponse.json({ error: "User context missing" }, { status: 403 })

  const initResult = initFirebaseAdmin("receptionist settings PUT")
  if (!initResult.ok) {
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const requestedHospitalId = typeof body?.hospitalId === "string" ? body.hospitalId.trim() : null

    const hospitalId = await resolveHospitalForWrite(auth.user.uid, auth.user.role, requestedHospitalId)
    if (!hospitalId) {
      return NextResponse.json(
        { error: "Forbidden: Only Hospital Admin or Super Admin can update receptionist settings." },
        { status: 403 }
      )
    }

    const { interfaceMode, enabledModules, formFields } = body
    const cleanSettings: HospitalReceptionistSettings = mergeReceptionistSettings({
      interfaceMode: interfaceMode === "simple" ? "simple" : "professional",
      enabledModules: typeof enabledModules === "object" && enabledModules !== null ? enabledModules : {},
      formFields: typeof formFields === "object" && formFields !== null ? formFields : { addPatient: {}, bookAppointment: {} },
    })

    const db = admin.firestore()
    const hospitalRef = db.collection("hospitals").doc(hospitalId)
    const hospitalSnap = await hospitalRef.get()
    if (!hospitalSnap.exists) {
      return NextResponse.json({ error: "Hospital not found" }, { status: 404 })
    }

    const nowIso = new Date().toISOString()
    await hospitalRef.update({
      "settings.receptionist": cleanSettings,
      updatedAt: nowIso,
      updatedBy: auth.user.uid,
    })

    void auditLogger.logForUser(auth.user, {
      hospitalId,
      module: "Administration",
      entityType: "hospital_receptionist_settings",
      entityId: hospitalId,
      action: AUDIT_ACTIONS.GENERAL_SETTINGS_CHANGED,
      summary: `Receptionist experience settings updated (Mode: ${cleanSettings.interfaceMode})`,
      metadata: {
        interfaceMode: cleanSettings.interfaceMode,
        changedBy: auth.user.uid,
        changedAt: nowIso,
      },
    })

    return NextResponse.json({
      success: true,
      message: "Receptionist experience settings saved successfully.",
      hospitalId,
      settings: cleanSettings,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to save receptionist settings"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
