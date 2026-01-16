import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { authenticateRequest, createAuthErrorResponse } from "@/utils/firebase/apiAuth"

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
      .limit(100) // Limit to recent 100 requests
      .get()

    // Collect all appointment IDs first
    const appointmentIds: string[] = []
    const requestsData = snapshot.docs.map((docSnap) => {
      const data = docSnap.data() || {}
      const appointmentId = String(data.appointmentId || "")
      if (appointmentId && !appointmentIds.includes(appointmentId)) {
        appointmentIds.push(appointmentId)
      }
      return {
        id: docSnap.id,
        ...data,
        appointmentId
      }
    })

    // Batch fetch all appointments at once (max 10 per batch in Firestore)
    const appointmentDetailsMap = new Map<string, Record<string, unknown>>()
    if (appointmentIds.length > 0) {
      // Firestore batch get limit is 10, so we need to chunk
      const batchSize = 10
      for (let i = 0; i < appointmentIds.length; i += batchSize) {
        const batch = appointmentIds.slice(i, i + batchSize)
        const appointmentRefs = batch.map(id => firestore.collection("appointments").doc(id))
        try {
          const appointmentSnaps = await firestore.getAll(...appointmentRefs)
          appointmentSnaps.forEach((aptSnap) => {
            if (aptSnap.exists) {
              const aptData = aptSnap.data() || {}
              appointmentDetailsMap.set(aptSnap.id, {
                appointmentDate: aptData.appointmentDate || null,
                appointmentTime: aptData.appointmentTime || null,
                patientPhone: aptData.patientPhone || null,
                doctorSpecialization: aptData.doctorSpecialization || null
              })
            }
          })
        } catch {
          // Continue if batch fails
        }
      }
    }

    // Map appointment details to requests
    const requests = requestsData.map((req) => ({
      ...req,
      appointmentDetails: req.appointmentId ? (appointmentDetailsMap.get(req.appointmentId) || null) : null
    }))

    return Response.json({ requests })
  } catch (error: any) {
    return Response.json(
      { error: error?.message || "Failed to load admission requests" },
      { status: 500 }
    )
  }
}


