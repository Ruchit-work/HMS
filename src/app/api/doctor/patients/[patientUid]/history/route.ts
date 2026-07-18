import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { authenticateRequest, createAuthErrorResponse } from "@/shared/utils/firebase/apiAuth"
import {
  getDoctorHospitalId,
  getHospitalCollectionPath,
  getUserActiveHospitalId,
  resolveAdmissionHospitalId,
} from "@/shared/utils/firebase/serverHospitalQueries"

interface Params {
  patientUid: string
}

export async function GET(req: Request, context: { params: Promise<Params> }) {
  const auth = await authenticateRequest(req)
  if (!auth.success) return createAuthErrorResponse(auth)
  if (auth.user?.role !== "doctor") {
    return Response.json({ error: "Access denied. This endpoint requires doctor role." }, { status: 403 })
  }

  try {
    const initResult = initFirebaseAdmin("doctor-patient-history API")
    if (!initResult.ok) return Response.json({ error: "Server not configured for admin" }, { status: 500 })

    const { patientUid } = await context.params
    if (!patientUid) return Response.json({ error: "Missing patientUid" }, { status: 400 })

    const { searchParams } = new URL(req.url)
    const patientId = String(searchParams.get("patientId") || "")
    const currentAdmissionId = String(searchParams.get("currentAdmissionId") || "")

    const firestore = admin.firestore()
    const doctorUid = auth.user.uid
    const hospitalId =
      (await getUserActiveHospitalId(doctorUid).catch(() => null)) ||
      (await getDoctorHospitalId(doctorUid).catch(() => null))

    let patientProfile: Record<string, unknown> | null = null
    const rootPatientSnap = await firestore.collection("patients").doc(patientUid).get()
    if (rootPatientSnap.exists) {
      patientProfile = { id: rootPatientSnap.id, ...(rootPatientSnap.data() || {}) }
    } else if (hospitalId) {
      const scopedPatientSnap = await firestore
        .collection(getHospitalCollectionPath(hospitalId, "patients"))
        .doc(patientUid)
        .get()
      if (scopedPatientSnap.exists) {
        patientProfile = { id: scopedPatientSnap.id, ...(scopedPatientSnap.data() || {}) }
      }
    }

    if (
      patientProfile &&
      hospitalId &&
      typeof patientProfile.hospitalId === "string" &&
      patientProfile.hospitalId.trim() &&
      patientProfile.hospitalId.trim() !== hospitalId
    ) {
      return Response.json({ error: "Forbidden: patient belongs to another hospital" }, { status: 403 })
    }

    const admissionsSnap = await firestore
      .collection("admissions")
      .where("patientUid", "==", patientUid)
      .limit(25)
      .get()

    const admissions = (
      await Promise.all(
        admissionsSnap.docs.map(async (docSnap) => {
          const data = docSnap.data() || {}
          if (hospitalId) {
            const docHospital =
              (typeof data.hospitalId === "string" && data.hospitalId.trim()) ||
              (await resolveAdmissionHospitalId(data))
            if (docHospital && docHospital !== hospitalId) return null
          }
          return { id: docSnap.id, ...data }
        })
      )
    )
      .filter(Boolean)
      .filter((entry: any) => !currentAdmissionId || String(entry.id) !== currentAdmissionId)
      .sort((a: any, b: any) => {
        const aTime = new Date(String(a.createdAt || a.checkInAt || 0)).getTime()
        const bTime = new Date(String(b.createdAt || b.checkInAt || 0)).getTime()
        return bTime - aTime
      })

    const appointmentMap = new Map<string, any>()
    if (hospitalId) {
      const hospitalAppointmentsRef = firestore.collection(getHospitalCollectionPath(hospitalId, "appointments"))
      const byUidSnap = await hospitalAppointmentsRef.where("patientUid", "==", patientUid).limit(25).get()
      byUidSnap.docs.forEach((docSnap) => {
        appointmentMap.set(docSnap.id, { id: docSnap.id, ...(docSnap.data() || {}) })
      })
      if (patientId) {
        const byPatientIdSnap = await hospitalAppointmentsRef.where("patientId", "==", patientId).limit(25).get()
        byPatientIdSnap.docs.forEach((docSnap) => {
          if (!appointmentMap.has(docSnap.id)) {
            appointmentMap.set(docSnap.id, { id: docSnap.id, ...(docSnap.data() || {}) })
          }
        })
      }
    }

    if (patientId) {
      const rootAppointmentsSnap = await firestore
        .collection("appointments")
        .where("patientId", "==", patientId)
        .limit(25)
        .get()
      rootAppointmentsSnap.docs.forEach((docSnap) => {
        if (!appointmentMap.has(docSnap.id)) {
          appointmentMap.set(docSnap.id, { id: docSnap.id, ...(docSnap.data() || {}) })
        }
      })
    }

    const rootByUidSnap = await firestore
      .collection("appointments")
      .where("patientUid", "==", patientUid)
      .limit(25)
      .get()
    rootByUidSnap.docs.forEach((docSnap) => {
      if (!appointmentMap.has(docSnap.id)) {
        appointmentMap.set(docSnap.id, { id: docSnap.id, ...(docSnap.data() || {}) })
      }
    })

    // Fallback removed: do not scan other hospitals (tenant isolation).

    let appointments = Array.from(appointmentMap.values())
    appointments = appointments
      .sort((a: any, b: any) => {
        const aTime = new Date(String(a.appointmentDate || a.createdAt || 0)).getTime()
        const bTime = new Date(String(b.appointmentDate || b.createdAt || 0)).getTime()
        return bTime - aTime
      })
      .slice(0, 15)

    return Response.json({
      patientProfile,
      previousAdmissions: admissions,
      normalVisits: appointments,
    })
  } catch (error: any) {
    return Response.json({ error: error?.message || "Failed to load patient history" }, { status: 500 })
  }
}

