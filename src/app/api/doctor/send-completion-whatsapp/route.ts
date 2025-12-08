/**
 * API endpoint to send checkup completion WhatsApp message to patient with Google Review link
 * Called automatically when doctor completes a checkup
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
    const initResult = initFirebaseAdmin("send-completion-whatsapp API")
    if (!initResult.ok) {
      return NextResponse.json({ error: "Server not configured" }, { status: 500 })
    }

    const body = await request.json().catch(() => ({}))
    const { appointmentId, patientId, patientPhone, patientName } = body

    if (!appointmentId || !patientId) {
      return NextResponse.json({ error: "Missing appointmentId or patientId" }, { status: 400 })
    }

    const db = admin.firestore()

    // Get patient data to find phone number and name
    let phone = patientPhone
    let name = patientName || "Patient"
    
    if (!phone || phone.trim() === "" || !name || name.trim() === "") {
      try {
        const patientDoc = await db.collection("patients").doc(patientId).get()
        if (patientDoc.exists) {
          const patientData = patientDoc.data()
          if (!phone || phone.trim() === "") {
            phone = patientData?.phone || patientData?.phoneNumber || patientData?.contact || ""
          }
          if (!name || name.trim() === "" || name === "Patient") {
            name = `${patientData?.firstName || ""} ${patientData?.lastName || ""}`.trim() || 
                   patientData?.name || 
                   patientData?.fullName || 
                   "Patient"
          }
        }
      } catch (error) {
        console.error("[send-completion-whatsapp] Error fetching patient:", error)
      }
    }

    if (!phone || phone.trim() === "") {
      console.warn("[send-completion-whatsapp] Patient phone number not found, skipping WhatsApp message")
      return NextResponse.json({ 
        success: false,
        error: "Patient phone number not found",
        message: "Checkup completed but WhatsApp message not sent (no phone number)"
      }, { status: 200 }) // Return 200 so completion doesn't fail
    }

    // Get Google Review link from environment variable
    const googleReviewLink = process.env.GOOGLE_REVIEW_LINK || ""
    
    // Build completion message
    let messageText = `✅ *Checkup Completed*\n\n` +
      `Hello ${name},\n\n` +
      `Your checkup is completed! 🎉\n\n` +
      `Thank you for visiting us. We hope you had a great experience.\n\n` +
      `Can you please rate us? Your feedback helps us improve our services.\n\n`
    
    // Add Google Review link if configured
    if (googleReviewLink && googleReviewLink.trim() !== "") {
      messageText += `⭐ *Rate Us on Google:*\n` +
        `${googleReviewLink}\n\n`
    } else {
      messageText += `⭐ *Rate Us:*\n` +
        `We would love to hear about your experience! Please share your feedback with us.\n\n`
    }
    
    messageText += `Thank you for choosing Harmony Medical Services! 🏥`

    // Send WhatsApp message
    const result = await sendWhatsAppNotification({
      to: phone,
      message: messageText,
    })

    if (!result.success) {
      console.error("[send-completion-whatsapp] Failed to send WhatsApp:", result.error)
      // Don't fail the completion if WhatsApp fails - just log it
      return NextResponse.json({ 
        success: false,
        error: result.error || "Failed to send WhatsApp message",
        message: "Checkup completed but WhatsApp message failed to send"
      }, { status: 200 }) // Return 200 so completion doesn't fail
    }

    // Store completion message in Firestore for tracking
    try {
      await db.collection("completion_messages").add({
        appointmentId,
        patientId,
        patientPhone: phone,
        patientName: name,
        message: messageText,
        googleReviewLink: googleReviewLink || null,
        sentAt: new Date().toISOString(),
        status: "sent",
        messageId: result.sid,
      })
    } catch (error) {
      console.error("[send-completion-whatsapp] Error storing completion message:", error)
      // Don't fail the request if storing fails
    }

    return NextResponse.json({ 
      success: true, 
      message: "Checkup completion WhatsApp message sent successfully",
      sid: result.sid
    })

  } catch (error: any) {
    console.error("[send-completion-whatsapp] Error:", error)
    // Don't fail the completion if this API fails
    return NextResponse.json({ 
      success: false,
      error: error?.message || "Failed to send completion WhatsApp message",
      message: "Checkup completed but WhatsApp message failed"
    }, { status: 200 }) // Return 200 so completion doesn't fail
  }
}

