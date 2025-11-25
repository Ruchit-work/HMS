/**
 * API endpoint to send re-checkup WhatsApp message to patient
 * Called when doctor completes checkup and marks "Re-checkup Required"
 */

import { NextResponse } from "next/server"
import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { sendWhatsAppNotification } from "@/server/whatsapp"
import { authenticateRequest, createAuthErrorResponse } from "@/utils/apiAuth"

export async function POST(request: Request) {
  // Authenticate request - requires doctor role
  const auth = await authenticateRequest(request, "doctor")
  if (!auth.success) {
    return createAuthErrorResponse(auth)
  }

  try {
    const initResult = initFirebaseAdmin("send-recheckup-whatsapp API")
    if (!initResult.ok) {
      return NextResponse.json({ error: "Server not configured" }, { status: 500 })
    }

    const body = await request.json().catch(() => ({}))
    const { appointmentId, patientId, patientPhone, doctorName, appointmentDate, recheckupNote } = body

    if (!appointmentId || !patientId) {
      return NextResponse.json({ error: "Missing appointmentId or patientId" }, { status: 400 })
    }

    const db = admin.firestore()

    // Get patient data to find phone number
    let phone = patientPhone
    if (!phone || phone.trim() === "") {
      try {
        const patientDoc = await db.collection("patients").doc(patientId).get()
        if (patientDoc.exists) {
          const patientData = patientDoc.data()
          phone = patientData?.phone || patientData?.phoneNumber || patientData?.contact || ""
        }
      } catch (error) {
        console.error("[send-recheckup-whatsapp] Error fetching patient:", error)
      }
    }

    if (!phone || phone.trim() === "") {
      return NextResponse.json({ error: "Patient phone number not found" }, { status: 400 })
    }

    // Get patient name
    let patientName = "Patient"
    try {
      const patientDoc = await db.collection("patients").doc(patientId).get()
      if (patientDoc.exists) {
        const patientData = patientDoc.data()
        patientName = `${patientData?.firstName || ""} ${patientData?.lastName || ""}`.trim() || 
                     patientData?.name || 
                     patientData?.fullName || 
                     "Patient"
      }
    } catch (error) {
      console.error("[send-recheckup-whatsapp] Error fetching patient name:", error)
    }

    // Format appointment date for display
    const dateDisplay = appointmentDate 
      ? new Date(appointmentDate + "T00:00:00").toLocaleDateString("en-IN", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : "recent checkup"

    // Normalize phone number
    const normalizedPhone = phone.replace(/[^\d+]/g, "")
    
    // Create re-checkup booking session in Firestore
    const sessionRef = db.collection("whatsappBookingSessions").doc(normalizedPhone)
    await sessionRef.set({
      state: "selecting_date",
      isRecheckup: true,
      recheckupNote: recheckupNote || "",
      originalAppointmentId: appointmentId,
      originalAppointmentDate: appointmentDate,
      language: "english", // Default to English for re-checkup
      needsRegistration: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    // Build message with re-checkup note if provided
    let messageText = `🏥 *Re-checkup Required*\n\n` +
      `Hi ${patientName},\n\n` +
      `Dr. ${doctorName} has reviewed your checkup from ${dateDisplay} and recommends a follow-up appointment.\n\n`
    
    if (recheckupNote && recheckupNote.trim()) {
      messageText += `📝 *Doctor's Note:*\n${recheckupNote}\n\n`
    }
    
    messageText += `📅 *Schedule Your Re-checkup:*\n\n` +
      `Please select your preferred date and time for the re-checkup appointment.`

    // Send message with "Pick Date" button
    const { sendMultiButtonMessage } = await import("@/server/metaWhatsApp")
    const buttonResult = await sendMultiButtonMessage(
      phone,
      messageText,
      [
        {
          id: "recheckup_pick_date",
          title: "📅 Pick Date",
        },
      ],
      "Harmony Medical Services"
    )

    if (!buttonResult.success) {
      // Fallback to text message with instructions
      const fallbackMessage = messageText + `\n\nReply "Book" or tap the button below to select a date.`
      const result = await sendWhatsAppNotification({
        to: phone,
        message: fallbackMessage,
      })
      
      if (!result.success) {
        console.error("[send-recheckup-whatsapp] Failed to send WhatsApp:", result.error)
        return NextResponse.json(
          { error: result.error || "Failed to send WhatsApp message" },
          { status: 500 }
        )
      }
    }

    // Store re-checkup request in Firestore for tracking
    try {
      await db.collection("recheckup_requests").add({
        appointmentId,
        patientId,
        patientPhone: phone,
        doctorName,
        originalAppointmentDate: appointmentDate,
        recheckupNote: recheckupNote || "",
        message: messageText,
        sentAt: new Date().toISOString(),
        status: "pending",
      })
    } catch (error) {
      console.error("[send-recheckup-whatsapp] Error storing re-checkup request:", error)
      // Don't fail the request if storing fails
    }

    return NextResponse.json({ 
      success: true, 
      message: "Re-checkup WhatsApp message sent successfully",
      sid: buttonResult.success ? buttonResult.messageId : undefined
    })

  } catch (error: any) {
    console.error("[send-recheckup-whatsapp] Error:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to send re-checkup WhatsApp message" },
      { status: 500 }
    )
  }
}

