/**
 * API endpoint to send checkup completion WhatsApp message to patient with Google Review link
 * Called automatically when doctor completes a checkup
 */

import { NextResponse } from "next/server"
import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { sendWhatsAppNotification } from "@/server/whatsapp"
import { authenticateRequest, createAuthErrorResponse } from "@/utils/firebase/apiAuth"
import { getHospitalCollectionPath, getAppointmentHospitalId } from "@/utils/firebase/serverHospitalQueries"

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
    const { appointmentId, patientId, patientPhone, patientName, hospitalId } = body

    if (!appointmentId || !patientId) {
      return NextResponse.json({ error: "Missing appointmentId or patientId" }, { status: 400 })
    }

    const db = admin.firestore()

    // Get hospitalId - try from request body first, then from appointment
    let appointmentHospitalId = hospitalId
    if (!appointmentHospitalId) {
      appointmentHospitalId = await getAppointmentHospitalId(appointmentId)
    }

    // Get patient data to find phone number and name
    let phone = patientPhone
    let name = patientName || "Patient"
    
    // First, try to get data from appointment document (it might have patientPhone and patientName)
    if ((!phone || phone.trim() === "") || (!name || name.trim() === "" || name === "Patient")) {
      try {
        // Try hospital-scoped collection first
        if (appointmentHospitalId) {
          const hospitalAppointmentPath = getHospitalCollectionPath(appointmentHospitalId, "appointments")
          const appointmentDoc = await db.collection(hospitalAppointmentPath).doc(appointmentId).get()
          
          if (appointmentDoc.exists) {
            const appointmentData = appointmentDoc.data()
            if ((!phone || phone.trim() === "") && appointmentData?.patientPhone) {
              phone = appointmentData.patientPhone
            }
            if ((!name || name.trim() === "" || name === "Patient") && appointmentData?.patientName) {
              name = appointmentData.patientName
            }
          } else {
            // Fallback to global collection
            const appointmentDocGlobal = await db.collection("appointments").doc(appointmentId).get()
            if (appointmentDocGlobal.exists) {
              const appointmentData = appointmentDocGlobal.data()
              if ((!phone || phone.trim() === "") && appointmentData?.patientPhone) {
                phone = appointmentData.patientPhone
              }
              if ((!name || name.trim() === "" || name === "Patient") && appointmentData?.patientName) {
                name = appointmentData.patientName
              }
            }
          }
        } else {
          // No hospitalId - try global collection as fallback
          const appointmentDoc = await db.collection("appointments").doc(appointmentId).get()
          
          if (appointmentDoc.exists) {
            const appointmentData = appointmentDoc.data()
            if ((!phone || phone.trim() === "") && appointmentData?.patientPhone) {
              phone = appointmentData.patientPhone
            }
            if ((!name || name.trim() === "" || name === "Patient") && appointmentData?.patientName) {
              name = appointmentData.patientName
            }
          } else {
          }
        }
      } catch {
      }
    }
    
    // If still missing, try to get from patient document
    if ((!phone || phone.trim() === "") || (!name || name.trim() === "" || name === "Patient")) {
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
        } else {
        }
      } catch {
      }
    }

    if (!phone || phone.trim() === "") {
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
      messageText += `⭐ *Rate Us on Google:*\n\n` +
        `👉 *Click here:* ${googleReviewLink}\n\n`
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
    } catch {
      // Don't fail the request if storing fails
    }

    return NextResponse.json({ 
      success: true, 
      message: "Checkup completion WhatsApp message sent successfully",
      sid: result.sid
    })

  } catch (error: any) {
    // Don't fail the completion if this API fails
    return NextResponse.json({ 
      success: false,
      error: error?.message || "Failed to send completion WhatsApp message",
      message: "Checkup completed but WhatsApp message failed"
    }, { status: 200 }) // Return 200 so completion doesn't fail
  }
}

