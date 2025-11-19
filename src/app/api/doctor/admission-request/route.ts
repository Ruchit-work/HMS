import { NextRequest } from "next/server"
import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { authenticateRequest, createAuthErrorResponse } from "@/utils/apiAuth"

function isSequentialPatientId(value?: string | null) {
  if (!value) return false
  return /^[A-Z]-\d{6}$/.test(value) || /^\d{6}$/.test(value)
}

export async function POST(req: NextRequest) {
  // Authenticate request - requires doctor role
  const auth = await authenticateRequest(req, "doctor")
  if (!auth.success) {
    return createAuthErrorResponse(auth)
  }

  try {
    const initResult = initFirebaseAdmin("doctor-admission-request API")
    if (!initResult.ok) {
      return Response.json({ error: "Server not configured for admin" }, { status: 500 })
    }

    const { appointmentId, notes } = await req.json().catch(() => ({}))

    if (!appointmentId || typeof appointmentId !== "string") {
      return Response.json({ error: "Missing appointmentId" }, { status: 400 })
    }

    const firestore = admin.firestore()
    const appointmentRef = firestore.collection("appointments").doc(appointmentId)
    const appointmentSnap = await appointmentRef.get()

    if (!appointmentSnap.exists) {
      return Response.json({ error: "Appointment not found" }, { status: 404 })
    }

    const appointmentData = appointmentSnap.data() || {}

    const doctorId = String(appointmentData.doctorId || "")
    const doctorName = String(appointmentData.doctorName || "")
    const patientName = String(appointmentData.patientName || "")
    const patientUid = String(
      appointmentData.patientUid ||
      appointmentData.patientId ||
      ""
    )
    const patientSequentialId = isSequentialPatientId(appointmentData.patientId)
      ? String(appointmentData.patientId)
      : null

    if (!doctorId || !patientUid) {
      return Response.json({
        error: "Appointment is missing doctor or patient identifiers"
      }, { status: 400 })
    }

    // Verify doctor can only create admission requests for their own appointments
    if (doctorId !== auth.user?.uid) {
      return Response.json({
        error: "You can only create admission requests for your own appointments"
      }, { status: 403 })
    }

    const nowIso = new Date().toISOString()

    let finalPatientId = patientSequentialId || null
    let finalPatientName = patientName && patientName.trim() ? patientName : null
    if (!finalPatientId) {
      try {
        const patientSnap = await firestore.collection("patients").doc(patientUid).get()
        if (patientSnap.exists) {
          const patientData = patientSnap.data() as { patientId?: string; firstName?: string; lastName?: string; fullName?: string }
          if (patientData?.patientId && isSequentialPatientId(patientData.patientId)) {
            finalPatientId = patientData.patientId
          }
          if (!finalPatientName) {
            const composed = [patientData?.firstName, patientData?.lastName].filter(Boolean).join(" ").trim()
            finalPatientName = composed || patientData?.fullName || finalPatientName
          }
        }
      } catch (err) {
        console.warn("Unable to resolve patient sequential id", err)
      }
    }

    const requestPayload = {
      appointmentId,
      patientUid,
      patientId: finalPatientId,
      doctorId,
      doctorName: doctorName || null,
      patientName: finalPatientName,
      notes: typeof notes === "string" && notes.trim() ? notes.trim() : null,
      status: "pending",
      createdAt: nowIso,
      updatedAt: nowIso,
    }

    const requestRef = await firestore.collection("admission_requests").add(requestPayload)

    await appointmentRef.update({
      status: "awaiting_admission",
      admissionRequestId: requestRef.id,
      updatedAt: nowIso
    })

    return Response.json({ success: true, requestId: requestRef.id })
  } catch (error: any) {
    console.error("admission-request error", error)
    return Response.json(
      { error: error?.message || "Failed to create admission request" },
      { status: 500 }
    )
  }
}


