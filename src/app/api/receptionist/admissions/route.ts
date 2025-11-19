import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { authenticateRequest, createAuthErrorResponse } from "@/utils/apiAuth"

export async function GET(req: Request) {
  // Authenticate request - requires receptionist or admin role
  const auth = await authenticateRequest(req)
  if (!auth.success) {
    return createAuthErrorResponse(auth)
  }
  if (auth.user && auth.user.role !== "receptionist" && auth.user.role !== "admin") {
    return Response.json(
      { error: "Access denied. This endpoint requires receptionist or admin role." },
      { status: 403 }
    )
  }

  try {
    const initResult = initFirebaseAdmin("receptionist-admissions API")
    if (!initResult.ok) {
      return Response.json({ error: "Server not configured for admin" }, { status: 500 })
    }

    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status")

    const firestore = admin.firestore()
    const baseRef = firestore.collection("admissions")

    const fetchDocs = async () => {
      if (status) {
        const filteredSnap = await baseRef.where("status", "==", status).get()
        return filteredSnap.docs
      }
      const orderedSnap = await baseRef.orderBy("checkInAt", "desc").get()
      return orderedSnap.docs
    }

    const docs = await fetchDocs()
    const sortedDocs = status
      ? [...docs].sort((a, b) => {
          const aDate = new Date(String(a.get("checkInAt") || "")).getTime()
          const bDate = new Date(String(b.get("checkInAt") || "")).getTime()
          return bDate - aDate
        })
      : docs

    const admissions = await Promise.all(
      sortedDocs.map(async (docSnap) => {
        const data = docSnap.data() || {}
        const admissionId = docSnap.id
        let appointmentDetails: Record<string, unknown> | null = null
        const appointmentId = String(data.appointmentId || "")
        if (appointmentId) {
          try {
            const aptSnap = await firestore.collection("appointments").doc(appointmentId).get()
            if (aptSnap.exists) {
              const aptData = aptSnap.data() || {}
              appointmentDetails = {
                appointmentDate: aptData.appointmentDate || null,
                appointmentTime: aptData.appointmentTime || null,
                patientPhone: aptData.patientPhone || null,
                doctorSpecialization: aptData.doctorSpecialization || null
              }
            }
          } catch (err) {
            console.warn("Failed to load appointment details for admission", admissionId, err)
          }
        }

        return {
          id: admissionId,
          ...data,
          appointmentDetails
        }
      })
    )

    return Response.json({ admissions })
  } catch (error: any) {
    console.error("admissions GET error", error)
    return Response.json(
      { error: error?.message || "Failed to load admissions" },
      { status: 500 }
    )
  }
}


