import { NextRequest, NextResponse } from "next/server"
import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { authenticateRequest, createAuthErrorResponse } from "@/utils/apiAuth"
import { getUserActiveHospitalId, getHospitalCollectionPath, getAllActiveHospitals } from "@/utils/serverHospitalQueries"
import { sendWhatsAppNotification } from "@/server/whatsapp"

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

        console.log("[mark-not-attended] Sending WhatsApp message to patient:", {
          appointmentId,
          patientPhone: patientPhone.substring(0, 3) + "***",
          patientName,
        })

        // Send WhatsApp message (fire-and-forget, don't fail if it fails)
        const whatsappResult = await sendWhatsAppNotification({
          to: patientPhone,
          message: messageText,
        })

        if (whatsappResult.success) {
          console.log("[mark-not-attended] ✅ WhatsApp message sent successfully:", whatsappResult.sid)
          
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
          } catch (error) {
            console.error("[mark-not-attended] Error storing notification record:", error)
            // Don't fail if storing fails
          }
        } else {
          console.error("[mark-not-attended] ❌ Failed to send WhatsApp message:", whatsappResult.error)
          // Don't fail the request if WhatsApp fails
        }
      } else {
        console.warn("[mark-not-attended] ⚠️ Patient phone number not found, skipping WhatsApp message")
      }
    } catch (error) {
      console.error("[mark-not-attended] Error sending WhatsApp message:", error)
      // Don't fail the request if WhatsApp fails - appointment is already marked as not attended
    }

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

