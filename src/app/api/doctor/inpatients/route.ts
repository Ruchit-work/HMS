import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { authenticateRequest, createAuthErrorResponse } from "@/utils/firebase/apiAuth"

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
    const baseRef = firestore.collection("admissions").where("doctorId", "==", auth.user.uid)
    const [admittedSnap, scheduledSnap] = await Promise.all([
      baseRef.where("status", "==", "admitted").get(),
      baseRef.where("status", "==", "scheduled").get(),
    ])

    const admissions = [...admittedSnap.docs, ...scheduledSnap.docs]
      .map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() || {}) }))
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

