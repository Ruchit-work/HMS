import { NextRequest } from "next/server"
import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { authenticateRequest, createAuthErrorResponse } from "@/utils/firebase/apiAuth"
import { getDoctorHospitalId, getHospitalCollectionPath } from "@/utils/firebase/serverHospitalQueries"

export async function PUT(req: NextRequest) {
  const auth = await authenticateRequest(req, "doctor")
  if (!auth.success) return createAuthErrorResponse(auth)

  try {
    const initResult = initFirebaseAdmin("doctor-schedule API")
    if (!initResult.ok) return Response.json({ error: "Server not configured" }, { status: 500 })

    const body = await req.json().catch(() => ({}))
    const { visitingHours, blockedDates } = body
    const doctorId = auth.user!.uid

    const updateData: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    }
    if (visitingHours !== undefined) updateData.visitingHours = visitingHours
    if (blockedDates !== undefined) updateData.blockedDates = Array.isArray(blockedDates) ? blockedDates : []

    const db = admin.firestore()

    const doctorRef = db.collection("doctors").doc(doctorId)
    await doctorRef.update(updateData)

    const doctorHospitalId = await getDoctorHospitalId(doctorId)
    if (doctorHospitalId) {
      const hospitalDoctorRef = db
        .collection(getHospitalCollectionPath(doctorHospitalId, "doctors"))
        .doc(doctorId)
      await hospitalDoctorRef.update(updateData)
    }

    return Response.json({ success: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to save schedule"
    return Response.json({ error: msg }, { status: 500 })
  }
}
