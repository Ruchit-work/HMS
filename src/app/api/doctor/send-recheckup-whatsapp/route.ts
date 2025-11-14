/**
 * API endpoint to send re-checkup WhatsApp message to patient
 * Called when doctor completes checkup and marks "Re-checkup Required"
 */

import { NextResponse } from "next/server"
import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { sendWhatsAppNotification } from "@/server/whatsapp"

export async function POST(request: Request) {
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

    // For proper interactive buttons, we need a Twilio Content Template
    // For now, we'll use an existing template or create a clear message with instructions
    
    // Use Content Template with interactive buttons
    // Content SID: HX794833b5f237f5cceb0444832495b4c1
    const whatsAppContentSid = process.env.WHATSAPP_RECHECKUP_CONTENT_SID || process.env.WHATSAPP_CONTENT_SID || null
    
    let result
    let messageForStorage: string
    
    if (whatsAppContentSid) {
      // Use Content Template with interactive buttons
      // Template variables: {{1}} = Patient Name, {{2}} = Doctor Name, {{3}} = Checkup Date, {{4}} = Booking URL
      // Note: If template has "Dr. {{2}}" then send just doctor name, if template has "{{2}}" then send "Dr. Name"
      // Based on the guide, template should have "Dr. {{2}}" so we send just the name
      const doctorNameForTemplate = doctorName.startsWith("Dr. ") ? doctorName.substring(4) : doctorName
      
      const contentVariables: Record<string, string> = {
        "1": patientName,                    // {{1}} - Patient Name
        "2": doctorNameForTemplate,          // {{2}} - Doctor Name (without "Dr." since template adds it)
        "3": dateDisplay,                    // {{3}} - Checkup Date  
        "4": bookingUrl,                     // {{4}} - Booking URL for buttons
      }
      
      // Fallback message (used if template fails)
      const fallbackMessage = `🏥 *Re-checkup Required*\n\n` +
        `Hi ${patientName},\n\n` +
        `Dr. ${doctorName} has reviewed your checkup from ${dateDisplay} and recommends a follow-up appointment.\n\n` +
        `Reply "Schedule Appointment" to book via WhatsApp, or visit:\n${bookingUrl}`
      
      console.log(`[send-recheckup-whatsapp] Using Content Template: ${whatsAppContentSid}`)
      
      result = await sendWhatsAppNotification({
        to: phone,
        message: fallbackMessage, // Fallback message if template fails
        contentSid: whatsAppContentSid,
        contentVariables: contentVariables,
      })
      
      // Use fallback message for storing in Firestore
      messageForStorage = fallbackMessage
    } else {
      // Fallback: Send message with clear instructions
      // Note: For proper interactive buttons, create a Twilio Content Template with call-to-action buttons
      // Set WHATSAPP_RECHECKUP_CONTENT_SID environment variable once template is approved
      const message = `🏥 *Re-checkup Required*\n\n` +
        `Hi ${patientName},\n\n` +
        `Dr. ${doctorName} has reviewed your checkup from ${dateDisplay} and recommends a follow-up appointment.\n\n` +
        `📅 *Schedule Your Re-checkup:*\n\n` +
        `Reply "Schedule Appointment" to book directly via WhatsApp, or visit:\n${bookingUrl}`

      result = await sendWhatsAppNotification({
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
      
      // Use this message for storing in Firestore
      messageForStorage = message
    }

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

