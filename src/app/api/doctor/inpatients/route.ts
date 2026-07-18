import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { authenticateRequest, createAuthErrorResponse } from "@/shared/utils/firebase/apiAuth"
import {
  getDoctorHospitalId,
  getUserActiveHospitalId,
  resolveAdmissionHospitalId,
} from "@/shared/utils/firebase/serverHospitalQueries"

export async function GET(req: Request) {
  const auth = await authenticateRequest(req)
  if (!auth.success) return createAuthErrorResponse(auth)
  if (auth.user?.role !== "doctor") {
    return Response.json({ error: "Access denied. This endpoint requires doctor role." }, { status: 403 })
  }

  try {
    const initResult = initFirebaseAdmin("doctor-inpatients API")
    if (!initResult.ok) return Response.json({ error: "Server not configured for admin" }, { status: 500 })

    const firestore = admin.firestore()
    const doctorUid = auth.user.uid
    const hospitalId =
      (await getUserActiveHospitalId(doctorUid).catch(() => null)) ||
      (await getDoctorHospitalId(doctorUid).catch(() => null))

    const baseRef = firestore.collection("admissions").where("doctorId", "==", doctorUid)
    const [admittedSnap, scheduledSnap] = await Promise.all([
      baseRef.where("status", "==", "admitted").get(),
      baseRef.where("status", "==", "scheduled").get(),
    ])

    const admissions = (
      await Promise.all(
        [...admittedSnap.docs, ...scheduledSnap.docs].map(async (docSnap) => {
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
      .sort((a: any, b: any) => {
        const aDate = new Date(String(a.checkInAt || "")).getTime()
        const bDate = new Date(String(b.checkInAt || "")).getTime()
        return bDate - aDate
      })

    return Response.json({ admissions })
  } catch (error: any) {
    return Response.json({ error: error?.message || "Failed to load inpatients" }, { status: 500 })
  }
}
