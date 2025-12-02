import { NextRequest, NextResponse } from "next/server"
import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { authenticateRequest, createAuthErrorResponse } from "@/utils/apiAuth"
import { getUserActiveHospitalId, getHospitalCollectionPath, getAllActiveHospitals } from "@/utils/serverHospitalQueries"

interface Params {
  appointmentId: string
}

/**
 * POST /api/appointments/[appointmentId]/mark-not-attended
 * Mark an appointment as not attended (manual action by staff)
 * Requires: receptionist or admin role
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<Params> }
) {
  // Authenticate request - requires receptionist or admin role
  const auth = await authenticateRequest(request)
  if (!auth.success) {
    return createAuthErrorResponse(auth)
  }
  
  if (auth.user && auth.user.role !== "receptionist" && auth.user.role !== "admin") {
    return NextResponse.json(
      { error: "Access denied. This endpoint requires receptionist or admin role." },
      { status: 403 }
    )
  }

  try {
    const initResult = initFirebaseAdmin("mark-not-attended API")
    if (!initResult.ok) {
      return NextResponse.json({ error: "Server not configured" }, { status: 500 })
    }

    const { appointmentId } = await context.params
    const firestore = admin.firestore()

    // Try to find the appointment - first check user's active hospital, then search all hospitals
    let appointmentRef: FirebaseFirestore.DocumentReference | null = null
    let appointmentData: FirebaseFirestore.DocumentData | null = null
    let hospitalId: string | null = null

    // First, try user's active hospital
    if (auth.user?.uid) {
      const userHospitalId = await getUserActiveHospitalId(auth.user.uid)
      if (userHospitalId) {
        const ref = firestore
          .collection(getHospitalCollectionPath(userHospitalId, "appointments"))
          .doc(appointmentId)
        const doc = await ref.get()
        if (doc.exists) {
          appointmentRef = ref
          appointmentData = doc.data()!
          hospitalId = userHospitalId
        }
      }
    }

    // If not found, search all active hospitals
    if (!appointmentRef) {
      const activeHospitals = await getAllActiveHospitals()
      for (const hospital of activeHospitals) {
        const ref = firestore
          .collection(getHospitalCollectionPath(hospital.id, "appointments"))
          .doc(appointmentId)
        const doc = await ref.get()
        if (doc.exists) {
          appointmentRef = ref
          appointmentData = doc.data()!
          hospitalId = hospital.id
          break
        }
      }
    }

    if (!appointmentRef || !appointmentData) {
      return NextResponse.json(
        { error: "Appointment not found" },
        { status: 404 }
      )
    }

    // Validate appointment can be marked as not attended
    const currentStatus = appointmentData.status || ""
    if (currentStatus === "completed") {
      return NextResponse.json(
        { error: "Cannot mark completed appointment as not attended" },
        { status: 400 }
      )
    }

    if (currentStatus === "cancelled") {
      return NextResponse.json(
        { error: "Cannot mark cancelled appointment as not attended" },
        { status: 400 }
      )
    }

    // Update appointment status
    const nowIso = new Date().toISOString()
    await appointmentRef.update({
      status: "not_attended",
      notAttendedAt: nowIso,
      markedNotAttendedBy: auth.user?.uid || "unknown",
      updatedAt: nowIso,
    })

    return NextResponse.json({
      success: true,
      message: "Appointment marked as not attended",
      appointmentId,
      status: "not_attended",
    })
  } catch (error: any) {
    console.error("[mark-not-attended] Error:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to mark appointment as not attended" },
      { status: 500 }
    )
  }
}

