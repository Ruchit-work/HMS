import { NextRequest, NextResponse } from "next/server"
import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { authenticateRequest, createAuthErrorResponse, type UserRole } from "@/utils/firebase/apiAuth"
import { getUserActiveHospitalId, getHospitalCollectionPath } from "@/utils/firebase/serverHospitalQueries"
import { PatientConsentMetadata } from "@/types/consent"

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.success) return createAuthErrorResponse(auth)

    const user = auth.user!
    const allowedRoles: UserRole[] = ["doctor", "receptionist", "admin"]
    if (!user.role || !allowedRoles.includes(user.role)) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      )
    }

    const initResult = initFirebaseAdmin("patient-consent-list")
    if (!initResult.ok) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
    }

    const hospitalId = await getUserActiveHospitalId(user.uid)
    if (!hospitalId) {
      return NextResponse.json({ error: "Hospital ID not found" }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const patientId = searchParams.get("patientId") || searchParams.get("patientUid") || undefined
    const appointmentId = searchParams.get("appointmentId") || undefined

    const db = admin.firestore()
    const consentRef = db.collection(getHospitalCollectionPath(hospitalId, "patient_consent"))

    let snapshot
    if (patientId) {
      snapshot = await consentRef.where("patientUid", "==", patientId).limit(100).get()
    } else {
      // List all consents for the hospital (for Documents tab) — no orderBy to avoid index requirement
      snapshot = await consentRef.limit(100).get()
    }

    let list: PatientConsentMetadata[] = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as PatientConsentMetadata[]
    // When viewing from an appointment: show consents for this appointment OR patient-level (no appointmentId)
    // so receptionist-added consents (often without appointmentId) appear on the doctor's appointment page
    if (appointmentId) {
      list = list.filter((c) => !c.appointmentId || c.appointmentId === appointmentId)
    }
    list.sort((a, b) => (b.uploadedAt || "").localeCompare(a.uploadedAt || ""))
    list = list.slice(0, 50)

    return NextResponse.json({ consents: list })
  } catch (err) {
    console.error("[patient-consent] List error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to list consents" },
      { status: 500 }
    )
  }
}
