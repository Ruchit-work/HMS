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
    const { appointmentId, patientId, patientPhone, doctorName, appointmentDate } = body

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
    
    // Get recheckup date/time if provided (for future enhancement)
    const { recheckupDate, recheckupTime } = body
    let recheckupInfo = ""
    if (recheckupDate) {
      const recheckupDateDisplay = new Date(recheckupDate + "T00:00:00").toLocaleDateString("en-IN", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
      if (recheckupTime) {
        const [hours, minutes] = recheckupTime.split(":").map(Number)
        const recheckupTimeDisplay = new Date(2000, 0, 1, hours, minutes).toLocaleTimeString("en-IN", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        })
        recheckupInfo = `\n\n📅 *Recommended Re-checkup Date & Time:*\n• Date: ${recheckupDateDisplay}\n• Time: ${recheckupTimeDisplay}`
      } else {
        recheckupInfo = `\n\n📅 *Recommended Re-checkup Date:*\n• Date: ${recheckupDateDisplay}`
      }
    }

    // Get base URL for booking link
    const requestUrl = new URL(request.url)
    const baseUrl = 
      process.env.VERCEL_URL 
        ? `https://${process.env.VERCEL_URL}`
        : process.env.NEXT_PUBLIC_BASE_URL 
        ? process.env.NEXT_PUBLIC_BASE_URL
        : `${requestUrl.protocol}//${requestUrl.host}`

    // Create booking URL with patient info for auto-fill
    const bookingParams = new URLSearchParams({
      phone: phone.replace(/[^\d+]/g, ""), // Clean phone number
      patientId: patientId,
      recheckup: "1", // Flag to indicate this is a re-checkup
    })
    const bookingUrl = `${baseUrl}/patient-dashboard/book-appointment?${bookingParams.toString()}`

    // Send recheckup message via Meta WhatsApp
    const message = `🏥 *Re-checkup Required*\n\n` +
      `Hi ${patientName},\n\n` +
      `Dr. ${doctorName} has reviewed your checkup from ${dateDisplay} and recommends a follow-up appointment.${recheckupInfo}\n\n` +
      `📅 *Schedule Your Re-checkup:*\n\n` +
      `Reply "Book" or "Book Appointment" to schedule directly via WhatsApp, or visit our website to book online.\n\n` +
      `We'll help you find the best available time slot.`

    const result = await sendWhatsAppNotification({
      to: phone,
      message: message,
      buttons: [
        {
          type: "url",
          title: "🌐 Book Online",
          url: bookingUrl,
        },
      ],
    })
    
    const messageForStorage = message

    if (!result.success) {
      console.error("[send-recheckup-whatsapp] Failed to send WhatsApp:", result.error)
      return NextResponse.json(
        { error: result.error || "Failed to send WhatsApp message" },
        { status: 500 }
      )
    }

    // Store re-checkup request in Firestore for tracking
    try {
      await db.collection("recheckup_requests").add({
        appointmentId,
        patientId,
        patientPhone: phone,
        doctorName,
        originalAppointmentDate: appointmentDate,
        message: messageForStorage,
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
      sid: result.sid 
    })

  } catch (error: any) {
    console.error("[send-recheckup-whatsapp] Error:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to send re-checkup WhatsApp message" },
      { status: 500 }
    )
  }
}

