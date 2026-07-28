import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { authenticateRequest, createAuthErrorResponse } from "@/shared/utils/firebase/apiAuth"
import {
  getHospitalCollectionPath,
  getUserActiveHospitalId,
} from "@/shared/utils/firebase/serverHospitalQueries"
import { createPatientDualWrite } from "@/services/server/PatientService"
import { auditLogger, AUDIT_ACTIONS } from "@/server/auditLogger"
import { getActorInfo } from "@/shared/utils/auditHelpers"

type RouteContext = {
  params: Promise<{ patientId: string }>
}

export async function PATCH(req: Request, context: RouteContext) {
  const auth = await authenticateRequest(req)
  if (!auth.success) {
    return createAuthErrorResponse(auth)
  }
  if (!auth.user || (auth.user.role !== "receptionist" && auth.user.role !== "admin")) {
    return Response.json(
      { error: "Access denied. Only receptionists and admins can update patient records." },
      { status: 403 }
    )
  }

  const initResult = initFirebaseAdmin("receptionist-update-patient API")
  if (!initResult.ok) {
    return Response.json({ error: "Server not configured for admin" }, { status: 500 })
  }

  const { patientId: patientDocIdRaw } = await context.params
  const patientDocId = (patientDocIdRaw || "").trim()
  if (!patientDocId) {
    return Response.json({ error: "Missing patientId" }, { status: 400 })
  }

  const hospitalId = await getUserActiveHospitalId(auth.user.uid)
  if (!hospitalId) {
    return Response.json({ error: "No active hospital found for current user" }, { status: 400 })
  }

  const firestore = admin.firestore()
  const rootRef = firestore.collection("patients").doc(patientDocId)
  const hospitalRef = firestore
    .collection(getHospitalCollectionPath(hospitalId, "patients"))
    .doc(patientDocId)

  const [rootSnap, hospitalSnap] = await Promise.all([rootRef.get(), hospitalRef.get()])
  if (!rootSnap.exists && !hospitalSnap.exists) {
    return Response.json({ error: "Patient record not found" }, { status: 404 })
  }

  const existingData = (hospitalSnap.exists ? hospitalSnap.data() : rootSnap.data()) || {}

  const body = await req.json().catch(() => ({}))
  const patientData = body?.patientData || body || {}

  const nowIso = new Date().toISOString()
  const actorInfo = getActorInfo(auth.user)

  // Construct update payload with strict field protection
  const updates: Record<string, unknown> = {
    updatedAt: nowIso,
    updatedBy: actorInfo,
  }

  if (typeof patientData.firstName === "string" && patientData.firstName.trim()) {
    updates.firstName = patientData.firstName.trim()
  }
  if (typeof patientData.lastName === "string" && patientData.lastName.trim()) {
    updates.lastName = patientData.lastName.trim()
  }
  if (typeof patientData.email === "string") {
    updates.email = patientData.email.trim().toLowerCase()
  }
  if (typeof patientData.phone === "string") {
    updates.phone = patientData.phone.trim()
  }
  if (typeof patientData.phoneCountryCode === "string") {
    updates.phoneCountryCode = patientData.phoneCountryCode.trim()
  }
  if (typeof patientData.phoneNumber === "string") {
    updates.phoneNumber = patientData.phoneNumber.trim()
  }
  if (typeof patientData.alternatePhone === "string") {
    updates.alternatePhone = patientData.alternatePhone.trim()
  }
  if (typeof patientData.gender === "string") {
    updates.gender = patientData.gender.trim()
  }
  if (typeof patientData.dateOfBirth === "string") {
    updates.dateOfBirth = patientData.dateOfBirth.trim()
  }
  if (typeof patientData.bloodGroup === "string") {
    updates.bloodGroup = patientData.bloodGroup.trim()
  }
  if (typeof patientData.address === "string") {
    updates.address = patientData.address.trim()
  }
  if (typeof patientData.city === "string") {
    updates.city = patientData.city.trim()
  }
  if (typeof patientData.state === "string") {
    updates.state = patientData.state.trim()
  }
  if (typeof patientData.pincode === "string") {
    updates.pincode = patientData.pincode.trim()
  }
  if (typeof patientData.emergencyContactName === "string") {
    updates.emergencyContactName = patientData.emergencyContactName.trim()
  }
  if (typeof patientData.emergencyContactPhone === "string") {
    updates.emergencyContactPhone = patientData.emergencyContactPhone.trim()
  }
  if (typeof patientData.maritalStatus === "string") {
    updates.maritalStatus = patientData.maritalStatus.trim()
  }
  if (typeof patientData.occupation === "string") {
    updates.occupation = patientData.occupation.trim()
  }
  if (typeof patientData.insuranceProvider === "string") {
    updates.insuranceProvider = patientData.insuranceProvider.trim()
  }
  if (typeof patientData.insurancePolicyNumber === "string") {
    updates.insurancePolicyNumber = patientData.insurancePolicyNumber.trim()
  }
  if (patientData.heightCm !== undefined && patientData.heightCm !== null && `${patientData.heightCm}`.trim() !== "") {
    const num = Number(patientData.heightCm)
    updates.heightCm = Number.isFinite(num) && num > 0 ? num : null
  }
  if (patientData.weightKg !== undefined && patientData.weightKg !== null && `${patientData.weightKg}`.trim() !== "") {
    const num = Number(patientData.weightKg)
    updates.weightKg = Number.isFinite(num) && num > 0 ? num : null
  }
  if (patientData.status === "active" || patientData.status === "inactive") {
    updates.status = patientData.status
  }

  // Dual-write updates to hospital-scoped and root patient collections
  await createPatientDualWrite(hospitalId, patientDocId, updates, { merge: true })

  // Log audit action
  const fullName = `${updates.firstName || existingData.firstName || ""} ${updates.lastName || existingData.lastName || ""}`.trim()
  void auditLogger.logForUser(auth.user, {
    hospitalId,
    branchId: existingData.defaultBranchId || null,
    module: "Patient",
    entityType: "patient",
    entityId: patientDocId,
    action: AUDIT_ACTIONS.PATIENT_UPDATED,
    summary: `Patient ${fullName || patientDocId} profile was updated.`,
    metadata: {
      updatedFields: Object.keys(updates).filter((k) => k !== "updatedAt" && k !== "updatedBy"),
    },
  })

  return Response.json({ success: true, id: patientDocId, updates })
}
