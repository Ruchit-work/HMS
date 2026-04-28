import { NextRequest, NextResponse } from "next/server"
import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { authenticateRequest, createAuthErrorResponse } from "@/utils/firebase/apiAuth"
import { getUserActiveHospitalId, getHospitalCollectionPath, getAllActiveHospitals } from "@/utils/firebase/serverHospitalQueries"
import { sendWhatsAppNotification } from "@/server/whatsapp"
import { applyRateLimit } from "@/utils/shared/rateLimit"

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
    const rateLimitResult = await applyRateLimit(request, "ADMIN", auth.user?.uid)
    if (rateLimitResult instanceof Response) {
      return rateLimitResult
    }

    const initResult = initFirebaseAdmin("mark-not-attended API")
    if (!initResult.ok) {
      return NextResponse.json({ error: "Server not configured" }, { status: 500 })
    }

    const { appointmentId } = await context.params
    if (!appointmentId || typeof appointmentId !== "string" || appointmentId.trim().length > 128) {
      return NextResponse.json(
        { error: "Invalid appointment ID" },
        { status: 400 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const requestedHospitalId =
      typeof body?.hospitalId === "string" && body.hospitalId.trim().length > 0
        ? body.hospitalId.trim()
        : null

    const firestore = admin.firestore()

    // Try to find the appointment - first check user's active hospital, then search all hospitals
    let appointmentRef: FirebaseFirestore.DocumentReference | null = null
    let appointmentData: FirebaseFirestore.DocumentData | null = null
    let hospitalId: string | null = null

    // First, try request hospital context or user's active hospital (preferred path)
    const preferredHospitalIds: string[] = []
    if (requestedHospitalId) preferredHospitalIds.push(requestedHospitalId)

    if (auth.user?.uid) {
      const userHospitalId = await getUserActiveHospitalId(auth.user.uid)
      if (userHospitalId && !preferredHospitalIds.includes(userHospitalId)) {
        preferredHospitalIds.push(userHospitalId)
      }
    }

    for (const preferredHospitalId of preferredHospitalIds) {
      const ref = firestore
        .collection(getHospitalCollectionPath(preferredHospitalId, "appointments"))
        .doc(appointmentId)
      const doc = await ref.get()
      if (doc.exists) {
        appointmentRef = ref
        appointmentData = doc.data()!
        hospitalId = preferredHospitalId
        break
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

    // Send WhatsApp message to patient about missed appointment
    try {
      const patientPhone = appointmentData.patientPhone || appointmentData.patientPhoneNumber || ""
      const patientName = appointmentData.patientName || "Patient"
      const appointmentDate = appointmentData.appointmentDate || ""
      const appointmentTime = appointmentData.appointmentTime || ""
      const doctorName = appointmentData.doctorName || "Doctor"

      if (patientPhone && patientPhone.trim() !== "") {
        // Format date nicely
        let formattedDate = appointmentDate
        if (appointmentDate) {
          try {
            const dateObj = new Date(appointmentDate)
            formattedDate = dateObj.toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })
          } catch {
            // Keep original date if parsing fails
          }
        }

        // Format time nicely
        let formattedTime = appointmentTime
        if (appointmentTime) {
          try {
            // Handle both 24-hour and 12-hour formats
            const [hours, minutes] = appointmentTime.split(':')
            const hour = parseInt(hours)
            const min = minutes || '00'
            const ampm = hour >= 12 ? 'PM' : 'AM'
            const hour12 = hour % 12 || 12
            formattedTime = `${hour12}:${min} ${ampm}`
          } catch {
            // Keep original time if parsing fails
          }
        }

        // Build WhatsApp message
        const messageText = `⚠️ *Appointment Missed*\n\n` +
          `Hello ${patientName},\n\n` +
          `We noticed that you missed your appointment today.\n\n` +
          `📋 *Appointment Details:*\n` +
          `• 👨‍⚕️ Doctor: ${doctorName}\n` +
          `• 📅 Date: ${formattedDate}\n` +
          `• 🕒 Time: ${formattedTime}\n\n` +
          `This appointment has been cancelled by our receptionist due to non-attendance.\n\n` +
          `🔄 *Would you like to reschedule?*\n\n` +
          `Please reply to this message or call us to book a new appointment. We're here to help you reschedule at your convenience.\n\n` +
          `Thank you for choosing Harmony Medical Services! 🏥`

        // Send WhatsApp message (fire-and-forget, don't fail if it fails)
        const whatsappResult = await sendWhatsAppNotification({
          to: patientPhone,
          message: messageText,
        })

        if (whatsappResult.success) {
          // Store notification record in Firestore
          try {
            await firestore.collection("not_attended_messages").add({
              appointmentId,
              patientId: appointmentData.patientId || appointmentData.patientUid || "",
              patientPhone,
              patientName,
              doctorName,
              appointmentDate,
              appointmentTime,
              message: messageText,
              sentAt: nowIso,
              status: "sent",
              messageId: whatsappResult.sid,
              hospitalId,
            })
          } catch {
            // Don't fail if storing fails
          }
        } else {
          // Don't fail the request if WhatsApp fails
        }
      } else {
      }
    } catch {
      // Don't fail the request if WhatsApp fails - appointment is already marked as not attended
    }

    return NextResponse.json({
      success: true,
      message: "Appointment marked as not attended",
      appointmentId,
      status: "not_attended",
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to mark appointment as not attended" },
      { status: 500 }
    )
  }
}

