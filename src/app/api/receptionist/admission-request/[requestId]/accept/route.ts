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
    const initResult = initFirebaseAdmin("receptionist-accept-admission-request API")
    if (!initResult.ok) {
      return Response.json({ error: "Server not configured for admin" }, { status: 500 })
    }

    const { roomId, notes } = await req.json().catch(() => ({}))
    if (!roomId || typeof roomId !== "string") {
      return Response.json({ error: "Missing roomId" }, { status: 400 })
    }

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

    const roomRef = firestore.collection("rooms").doc(roomId)
    const roomSnap = await roomRef.get()
    if (!roomSnap.exists) {
      return Response.json({ error: "Room not found" }, { status: 404 })
    }

    const roomData = roomSnap.data() || {}
    if (roomData.status && roomData.status !== "available") {
      return Response.json({ error: "Room is not available" }, { status: 400 })
    }

    const nowIso = new Date().toISOString()
    const admissionRef = firestore.collection("admissions").doc()

    const admissionPayload = {
      appointmentId,
      patientUid: String(requestData.patientUid || ""),
      patientId: requestData.patientId || null,
      patientName: requestData.patientName || null,
      doctorId: String(requestData.doctorId || ""),
      doctorName: requestData.doctorName || null,
      roomId,
      roomNumber: roomData.roomNumber || "",
      roomType: roomData.roomType || "",
      roomRatePerDay: roomData.ratePerDay || 0,
      status: "admitted",
      checkInAt: nowIso,
      checkOutAt: null,
      notes: typeof notes === "string" && notes.trim() ? notes.trim() : null,
      createdBy: "receptionist",
      createdAt: nowIso,
      updatedAt: nowIso,
    }

    await firestore.runTransaction(async (tx) => {
      tx.update(requestRef, {
        status: "accepted",
        acceptedAt: nowIso,
        updatedAt: nowIso,
        acceptedRoomId: roomId
      })

      tx.update(appointmentRef, {
        status: "admitted",
        admissionId: admissionRef.id,
        admissionRequestId: requestId,
        updatedAt: nowIso
      })

      tx.update(roomRef, {
        status: "occupied",
        updatedAt: nowIso
      })

      tx.set(admissionRef, admissionPayload)
    })

    return Response.json({ success: true, admissionId: admissionRef.id })
  } catch (error: any) {

    return Response.json(
      { error: error?.message || "Failed to accept admission request" },
      { status: 500 }
    )
  }
}


