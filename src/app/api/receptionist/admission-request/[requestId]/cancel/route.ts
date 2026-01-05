import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import type { NextRequest } from "next/server"
import { authenticateRequest, createAuthErrorResponse } from "@/utils/apiAuth"

interface Params {
  requestId: string
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<Params> }
) {
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
    const initResult = initFirebaseAdmin("receptionist-cancel-admission-request API")
    if (!initResult.ok) {
      return Response.json({ error: "Server not configured for admin" }, { status: 500 })
    }

    const { reason } = await req.json().catch(() => ({}))
    const { requestId } = await context.params
    if (!requestId) {
      return Response.json({ error: "Missing requestId" }, { status: 400 })
    }

    const firestore = admin.firestore()
    const requestRef = firestore.collection("admission_requests").doc(requestId)
    const requestSnap = await requestRef.get()

    if (!requestSnap.exists) {
      return Response.json({ error: "Admission request not found" }, { status: 404 })
    }

    const requestData = requestSnap.data() || {}
    if (requestData.status !== "pending") {
      return Response.json({ error: "Admission request is not pending" }, { status: 400 })
    }

    const appointmentId = String(requestData.appointmentId || "")
    if (!appointmentId) {
      return Response.json({ error: "Request missing appointmentId" }, { status: 400 })
    }

    const appointmentRef = firestore.collection("appointments").doc(appointmentId)
    const appointmentSnap = await appointmentRef.get()
    if (!appointmentSnap.exists) {
      return Response.json({ error: "Appointment not found" }, { status: 404 })
    }

    const nowIso = new Date().toISOString()

    await firestore.runTransaction(async (tx) => {
      tx.update(requestRef, {
        status: "cancelled",
        cancelledAt: nowIso,
        updatedAt: nowIso,
        cancelReason: typeof reason === "string" && reason.trim() ? reason.trim() : null
      })

      tx.update(appointmentRef, {
        status: "completed",
        admissionRequestId: null,
        updatedAt: nowIso
      })
    })

    return Response.json({ success: true })
  } catch (error: any) {
    return Response.json(
      { error: error?.message || "Failed to cancel admission request" },
      { status: 500 }
    )
  }
}


