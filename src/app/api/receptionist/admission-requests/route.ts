import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { authenticateRequest, createAuthErrorResponse } from "@/utils/apiAuth"

export async function GET(request: Request) {
  // Authenticate request - requires receptionist or admin role
  const auth = await authenticateRequest(request)
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
    const initResult = initFirebaseAdmin("receptionist-admission-requests API")
    if (!initResult.ok) {
      return Response.json({ error: "Server not configured for admin" }, { status: 500 })
    }

    const firestore = admin.firestore()
    const snapshot = await firestore
      .collection("admission_requests")
      .orderBy("createdAt", "desc")
      .get()

    const requests = await Promise.all(
      snapshot.docs.map(async (docSnap) => {
        const data = docSnap.data() || {}
        const appointmentId = String(data.appointmentId || "")
        let appointmentDetails: Record<string, unknown> | null = null

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
          }
        }

        return {
          id: docSnap.id,
          ...data,
          appointmentDetails
        }
      })
    )

    return Response.json({ requests })
  } catch (error: any) {
    return Response.json(
      { error: error?.message || "Failed to load admission requests" },
      { status: 500 }
    )
  }
}


