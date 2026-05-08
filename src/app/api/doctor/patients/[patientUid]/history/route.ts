import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { authenticateRequest, createAuthErrorResponse } from "@/utils/firebase/apiAuth"
import {
  getAllActiveHospitals,
  getDoctorHospitalId,
  getHospitalCollectionPath,
  getUserActiveHospitalId,
} from "@/utils/firebase/serverHospitalQueries"

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

    const admissionsSnap = await firestore
      .collection("admissions")
      .where("patientUid", "==", patientUid)
      .limit(25)
      .get()

    const admissions = admissionsSnap.docs
      .map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() || {}) }))
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

    // Fallback: if historical appointments were stored under a different hospital scope,
    // scan active hospitals (limited) and merge matches by patientId/patientUid.
    if (appointmentMap.size === 0 && (patientId || patientUid)) {
      const hospitals = await getAllActiveHospitals().catch(() => [])
      for (const hospital of hospitals.slice(0, 20)) {
        const hospAppointmentsRef = firestore.collection(getHospitalCollectionPath(hospital.id, "appointments"))
        if (patientId) {
          const byPid = await hospAppointmentsRef.where("patientId", "==", patientId).limit(10).get()
          byPid.docs.forEach((docSnap) => {
            if (!appointmentMap.has(docSnap.id)) {
              appointmentMap.set(docSnap.id, { id: docSnap.id, ...(docSnap.data() || {}) })
            }
          })
        }
        const byUid = await hospAppointmentsRef.where("patientUid", "==", patientUid).limit(10).get()
        byUid.docs.forEach((docSnap) => {
          if (!appointmentMap.has(docSnap.id)) {
            appointmentMap.set(docSnap.id, { id: docSnap.id, ...(docSnap.data() || {}) })
          }
        })
        if (appointmentMap.size >= 25) break
      }
    }

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

