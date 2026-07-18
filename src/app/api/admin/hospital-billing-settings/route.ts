import { NextResponse } from "next/server"
import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { authenticateRequest, createAuthErrorResponse } from "@/shared/utils/firebase/apiAuth"
import {
  getUserActiveHospitalId,
  isPlatformSuperAdmin,
  resolveAuthorizedHospitalId,
} from "@/shared/utils/firebase/serverHospitalQueries"
import { getHospitalBillingSettings } from "@/server/hospitalBillingSettings"
import {
  normalizeHospitalBillingSettings,
  validateHospitalBillingSettings,
} from "@/shared/utils/billingSettings"
import { applyRateLimit } from "@/shared/utils/shared/rateLimit"
import { auditLogger, AUDIT_ACTIONS } from "@/server/auditLogger"

function billingSettingsChangeSummary(
  previous: ReturnType<typeof normalizeHospitalBillingSettings>,
  next: ReturnType<typeof normalizeHospitalBillingSettings>
): string {
  const labels: Record<string, string> = {
    refundPolicy: "Refund Policy",
    paidAppointmentCancellation: "Paid Appointment Cancellation",
    allowPartialPayment: "Allow Partial Payment",
    minimumAdvancePercent: "Minimum Advance Percent",
    autoCreateRecheckup: "Auto Create Recheckup",
    recheckupStartsUnpaid: "Recheckup Starts Unpaid",
    defaultRecheckupFee: "Default Recheckup Fee",
  }
  const changed = Object.keys(labels).filter(
    (key) =>
      previous[key as keyof typeof previous] !== next[key as keyof typeof next]
  )
  if (JSON.stringify(previous.paymentMethods) !== JSON.stringify(next.paymentMethods)) {
    changed.push("paymentMethods")
    labels.paymentMethods = "Accepted Payment Methods"
  }
  if (JSON.stringify(previous.billingOptions) !== JSON.stringify(next.billingOptions)) {
    changed.push("billingOptions")
    labels.billingOptions = "Billing Options"
  }
  return changed.length
    ? `${changed.map((key) => labels[key]).join(", ")} changed.`
    : "Hospital billing settings saved without policy changes."
}

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

/**
 * GET /api/admin/hospital-billing-settings?hospitalId=...
 * Hospital staff/patients may read their hospital policy. Platform super admins
 * may inspect a specified hospital. Mutations remain Hospital Admin only.
 */
export async function GET(request: Request) {
  const auth = await authenticateRequest(request)
  if (!auth.success) return createAuthErrorResponse(auth)
  if (!auth.user) return NextResponse.json({ error: "User context missing" }, { status: 403 })

  const url = new URL(request.url)
  const requestedHospitalId = url.searchParams.get("hospitalId")?.trim() || null
  const hospitalId = await resolveHospitalForRead(auth.user.uid, auth.user.role, requestedHospitalId)
  if (!hospitalId) {
    return NextResponse.json(
      { error: "Hospital access required to read billing settings." },
      { status: 403 }
    )
  }

  const settings = await getHospitalBillingSettings(hospitalId)
  return NextResponse.json({ hospitalId, settings })
}

/**
 * PUT /api/admin/hospital-billing-settings
 * Replaces settings.billing with a normalized, validated configuration.
 */
export async function PUT(request: Request) {
  const limit = await applyRateLimit(request, "ADMIN")
  if (limit instanceof Response) return limit

  const auth = await authenticateRequest(request)
  if (!auth.success) return createAuthErrorResponse(auth)
  if (!auth.user) return NextResponse.json({ error: "User context missing" }, { status: 403 })

  try {
    const initResult = initFirebaseAdmin("hospital billing settings API")
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

    const previousSettings = normalizeHospitalBillingSettings(hospital.data()?.settings?.billing)
    const settings = normalizeHospitalBillingSettings(body?.settings)
    const validationError = validateHospitalBillingSettings(settings)
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    const nowIso = new Date().toISOString()
    await hospitalRef.update({
      "settings.billing": settings,
      "settings.billingUpdatedAt": nowIso,
      "settings.billingUpdatedBy": auth.user.uid,
      updatedAt: nowIso,
    })

    void auditLogger.logForUser(auth.user, {
      hospitalId,
      module: "Administration",
      entityType: "hospital",
      entityId: hospitalId,
      action: AUDIT_ACTIONS.BILLING_SETTINGS_CHANGED,
      summary: billingSettingsChangeSummary(previousSettings, settings),
      metadata: { previous: previousSettings, current: settings },
    })

    return NextResponse.json({ success: true, hospitalId, settings })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to save billing settings"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
