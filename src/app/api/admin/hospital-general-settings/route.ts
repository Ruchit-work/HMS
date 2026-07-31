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
import type { HospitalGeneralSettings } from "@/types/hospital"

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_REGEX = /^(\+?\d{1,4}[-.\s]?)?\d{7,15}$/
const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/

async function resolveHospitalForRead(
  uid: string,
  role: string,
  requestedHospitalId: string | null
): Promise<string | null> {
  if (role === "super_admin" || (await isPlatformSuperAdmin(uid))) {
    return requestedHospitalId
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
    return requestedHospitalId
  }
  if (role !== "admin") return null
  return resolveAuthorizedHospitalId(
    uid,
    requestedHospitalId || (await getUserActiveHospitalId(uid))
  )
}

/**
 * GET /api/admin/hospital-general-settings?hospitalId=...
 * Fetch general hospital settings
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

  const initResult = initFirebaseAdmin("general settings GET")
  if (!initResult.ok) {
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }

  const db = admin.firestore()
  const hospitalDoc = await db.collection("hospitals").doc(hospitalId).get()
  if (!hospitalDoc.exists) {
    return NextResponse.json({ error: "Hospital not found" }, { status: 404 })
  }

  const data = hospitalDoc.data() || {}
  const gen: HospitalGeneralSettings = (data.settings?.general as HospitalGeneralSettings) || {}

  const settings = {
    hospitalId,
    name: data.name || "",
    code: data.code || "",
    email: data.email || "",
    phone: data.phone || "",
    address: data.address || "",
    registrationNumber: gen.registrationNumber || "",
    gstNumber: gen.gstNumber || "",
    website: gen.website || "",
    city: gen.city || "",
    state: gen.state || "",
    country: gen.country || "India",
    pinCode: gen.pinCode || "",
    logo: gen.logo || data.settings?.print?.logoUrl || "",
    favicon: gen.favicon || "",
    primaryColor: gen.primaryColor || "#0284c7",
    secondaryColor: gen.secondaryColor || "#0f172a",
    timeZone: gen.timeZone || "Asia/Kolkata",
    dateFormat: gen.dateFormat || "DD/MM/YYYY",
    timeFormat: gen.timeFormat || "12h",
    currency: gen.currency || "INR ₹",
    language: gen.language || "en",
  }

  return NextResponse.json({ success: true, hospitalId, settings })
}

/**
 * PUT /api/admin/hospital-general-settings
 * Update general hospital settings (Super Admin or Hospital Admin only)
 */
export async function PUT(request: Request) {
  const limit = await applyRateLimit(request, "ADMIN")
  if (limit instanceof Response) return limit

  const auth = await authenticateRequest(request)
  if (!auth.success) return createAuthErrorResponse(auth)
  if (!auth.user) return NextResponse.json({ error: "User context missing" }, { status: 403 })

  const initResult = initFirebaseAdmin("general settings PUT")
  if (!initResult.ok) {
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const requestedHospitalId = typeof body?.hospitalId === "string" ? body.hospitalId.trim() : null

    const hospitalId = await resolveHospitalForWrite(auth.user.uid, auth.user.role, requestedHospitalId)
    if (!hospitalId) {
      return NextResponse.json(
        { error: "Forbidden: Only Hospital Admin or Super Admin can edit general settings." },
        { status: 403 }
      )
    }

    const {
      name,
      email,
      phone,
      address,
      registrationNumber,
      gstNumber,
      website,
      city,
      state,
      country,
      pinCode,
      logo,
      favicon,
      primaryColor,
      secondaryColor,
      timeZone,
      dateFormat,
      timeFormat,
      currency,
      language,
    } = body

    // Validation
    const cleanName = typeof name === "string" ? name.trim() : ""
    const cleanEmail = typeof email === "string" ? email.trim() : ""
    const cleanPhone = typeof phone === "string" ? phone.trim() : ""
    const cleanAddress = typeof address === "string" ? address.trim() : ""
    const cleanCity = typeof city === "string" ? city.trim() : ""
    const cleanState = typeof state === "string" ? state.trim() : ""
    const cleanCountry = typeof country === "string" ? country.trim() : ""
    const cleanPinCode = typeof pinCode === "string" ? pinCode.trim() : ""
    const cleanGst = typeof gstNumber === "string" ? gstNumber.trim().toUpperCase() : ""
    const cleanWebsite = typeof website === "string" ? website.trim() : ""

    if (!cleanName) return NextResponse.json({ error: "Hospital Name is required." }, { status: 400 })
    if (!cleanEmail) return NextResponse.json({ error: "Email address is required." }, { status: 400 })
    if (!EMAIL_REGEX.test(cleanEmail)) return NextResponse.json({ error: "Invalid email format." }, { status: 400 })

    if (!cleanPhone) return NextResponse.json({ error: "Phone number is required." }, { status: 400 })
    if (!PHONE_REGEX.test(cleanPhone.replace(/\s+/g, ""))) {
      return NextResponse.json({ error: "Invalid phone number format." }, { status: 400 })
    }

    if (!cleanAddress) return NextResponse.json({ error: "Street Address is required." }, { status: 400 })
    if (!cleanCity) return NextResponse.json({ error: "City is required." }, { status: 400 })
    if (!cleanState) return NextResponse.json({ error: "State is required." }, { status: 400 })
    if (!cleanCountry) return NextResponse.json({ error: "Country is required." }, { status: 400 })
    if (!cleanPinCode) return NextResponse.json({ error: "PIN / Postal Code is required." }, { status: 400 })

    if (cleanGst && !GST_REGEX.test(cleanGst)) {
      return NextResponse.json(
        { error: "Invalid GST Number format. Example: 22AAAAA0000A1Z5" },
        { status: 400 }
      )
    }

    if (cleanWebsite && !cleanWebsite.startsWith("http://") && !cleanWebsite.startsWith("https://")) {
      return NextResponse.json({ error: "Website URL must start with http:// or https://" }, { status: 400 })
    }

    const db = admin.firestore()
    const hospitalRef = db.collection("hospitals").doc(hospitalId)
    const hospitalSnap = await hospitalRef.get()
    if (!hospitalSnap.exists) {
      return NextResponse.json({ error: "Hospital not found" }, { status: 404 })
    }

    const prevData = hospitalSnap.data() || {}
    const prevGen = (prevData.settings?.general as Record<string, unknown>) || {}

    const previousState: Record<string, unknown> = {
      name: prevData.name || "",
      email: prevData.email || "",
      phone: prevData.phone || "",
      address: prevData.address || "",
      registrationNumber: prevGen.registrationNumber || "",
      gstNumber: prevGen.gstNumber || "",
      website: prevGen.website || "",
      city: prevGen.city || "",
      state: prevGen.state || "",
      country: prevGen.country || "India",
      pinCode: prevGen.pinCode || "",
      logo: prevGen.logo || "",
      favicon: prevGen.favicon || "",
      primaryColor: prevGen.primaryColor || "#0284c7",
      secondaryColor: prevGen.secondaryColor || "#0f172a",
      timeZone: prevGen.timeZone || "Asia/Kolkata",
      dateFormat: prevGen.dateFormat || "DD/MM/YYYY",
      timeFormat: prevGen.timeFormat || "12h",
      currency: prevGen.currency || "INR ₹",
      language: prevGen.language || "en",
    }

    const updatedGeneralSettings: HospitalGeneralSettings = {
      registrationNumber: typeof registrationNumber === "string" ? registrationNumber.trim() : "",
      gstNumber: cleanGst,
      website: cleanWebsite,
      city: cleanCity,
      state: cleanState,
      country: cleanCountry,
      pinCode: cleanPinCode,
      logo: typeof logo === "string" ? logo.trim() : "",
      favicon: typeof favicon === "string" ? favicon.trim() : "",
      primaryColor: typeof primaryColor === "string" ? primaryColor.trim() : "#0284c7",
      secondaryColor: typeof secondaryColor === "string" ? secondaryColor.trim() : "#0f172a",
      timeZone: typeof timeZone === "string" ? timeZone.trim() : "Asia/Kolkata",
      dateFormat: typeof dateFormat === "string" ? dateFormat.trim() : "DD/MM/YYYY",
      timeFormat: timeFormat === "24h" ? "24h" : "12h",
      currency: typeof currency === "string" ? currency.trim() : "INR ₹",
      language: typeof language === "string" ? language.trim() : "en",
    }

    const newState: Record<string, unknown> = {
      name: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
      address: cleanAddress,
      ...updatedGeneralSettings,
    }

    // Determine changed fields for audit log
    const changedFields = Object.keys(newState).filter(
      (key) => String(previousState[key] ?? "") !== String(newState[key] ?? "")
    )

    const nowIso = new Date().toISOString()
    await hospitalRef.update({
      name: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
      address: cleanAddress,
      "settings.general": updatedGeneralSettings,
      updatedAt: nowIso,
      updatedBy: auth.user.uid,
    })

    const summaryText = changedFields.length
      ? `General settings updated: ${changedFields.join(", ")} changed.`
      : "General settings updated without field changes."

    void auditLogger.logForUser(auth.user, {
      hospitalId,
      module: "Administration",
      entityType: "hospital_general_settings",
      entityId: hospitalId,
      action: AUDIT_ACTIONS.GENERAL_SETTINGS_CHANGED,
      summary: summaryText,
      metadata: {
        changedFields,
        previous: previousState,
        current: newState,
        changedBy: auth.user.uid,
        changedAt: nowIso,
      },
    })

    return NextResponse.json({
      success: true,
      message: "General settings updated successfully.",
      hospitalId,
      settings: newState,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to save general settings"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
