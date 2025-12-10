/**
 * API endpoint to send checkup completion WhatsApp message to patient with Google Review link
 * Called automatically when doctor completes a checkup
 */

import { NextResponse } from "next/server"
import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { sendWhatsAppNotification } from "@/server/whatsapp"
import { authenticateRequest, createAuthErrorResponse } from "@/utils/apiAuth"
import { getHospitalCollectionPath, getAppointmentHospitalId } from "@/utils/serverHospitalQueries"

export async function POST(request: Request) {
  console.log("[send-completion-whatsapp] Request received")
  
  // Authenticate request - requires doctor role
  const auth = await authenticateRequest(request, "doctor")
  if (!auth.success) {
    console.error("[send-completion-whatsapp] Authentication failed:", auth.error)
    return createAuthErrorResponse(auth)
  }

  console.log("[send-completion-whatsapp] Authentication successful")

  try {
    const initResult = initFirebaseAdmin("send-completion-whatsapp API")
    if (!initResult.ok) {
      console.error("[send-completion-whatsapp] Firebase Admin not initialized")
      return NextResponse.json({ error: "Server not configured" }, { status: 500 })
    }

    const body = await request.json().catch(() => ({}))
    const { appointmentId, patientId, patientPhone, patientName, hospitalId } = body

    console.log("[send-completion-whatsapp] Request body:", {
      appointmentId,
      patientId,
      patientPhone: patientPhone ? `${patientPhone.substring(0, 3)}***` : "not provided",
      patientName,
      hospitalId,
    })

    if (!appointmentId || !patientId) {
      console.error("[send-completion-whatsapp] Missing required fields:", { appointmentId, patientId })
      return NextResponse.json({ error: "Missing appointmentId or patientId" }, { status: 400 })
    }

    const db = admin.firestore()

    // Get hospitalId - try from request body first, then from appointment
    let appointmentHospitalId = hospitalId
    if (!appointmentHospitalId) {
      console.log("[send-completion-whatsapp] HospitalId not provided, trying to get from appointment...")
      appointmentHospitalId = await getAppointmentHospitalId(appointmentId)
    }

    // Get patient data to find phone number and name
    let phone = patientPhone
    let name = patientName || "Patient"
    
    console.log("[send-completion-whatsapp] Initial patient data:", {
      phone: phone ? `${phone.substring(0, 3)}***` : "empty",
      name,
      hospitalId: appointmentHospitalId,
    })
    
    // First, try to get data from appointment document (it might have patientPhone and patientName)
    if ((!phone || phone.trim() === "") || (!name || name.trim() === "" || name === "Patient")) {
      console.log("[send-completion-whatsapp] Fetching appointment data from Firestore...")
      try {
        // Try hospital-scoped collection first
        if (appointmentHospitalId) {
          const hospitalAppointmentPath = getHospitalCollectionPath(appointmentHospitalId, "appointments")
          const appointmentDoc = await db.collection(hospitalAppointmentPath).doc(appointmentId).get()
          
          if (appointmentDoc.exists) {
            const appointmentData = appointmentDoc.data()
            console.log("[send-completion-whatsapp] Appointment document found in hospital collection")
            
            if ((!phone || phone.trim() === "") && appointmentData?.patientPhone) {
              phone = appointmentData.patientPhone
              console.log("[send-completion-whatsapp] Phone from appointment:", phone ? `${phone.substring(0, 3)}***` : "not found")
            }
            if ((!name || name.trim() === "" || name === "Patient") && appointmentData?.patientName) {
              name = appointmentData.patientName
              console.log("[send-completion-whatsapp] Name from appointment:", name)
            }
          } else {
            console.warn("[send-completion-whatsapp] Appointment document not found in hospital collection, trying global...")
            // Fallback to global collection
            const appointmentDocGlobal = await db.collection("appointments").doc(appointmentId).get()
            if (appointmentDocGlobal.exists) {
              const appointmentData = appointmentDocGlobal.data()
              console.log("[send-completion-whatsapp] Appointment document found in global collection")
              
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
          console.log("[send-completion-whatsapp] No hospitalId, trying global appointments collection...")
          const appointmentDoc = await db.collection("appointments").doc(appointmentId).get()
          
          if (appointmentDoc.exists) {
            const appointmentData = appointmentDoc.data()
            console.log("[send-completion-whatsapp] Appointment document found in global collection")
            
            if ((!phone || phone.trim() === "") && appointmentData?.patientPhone) {
              phone = appointmentData.patientPhone
            }
            if ((!name || name.trim() === "" || name === "Patient") && appointmentData?.patientName) {
              name = appointmentData.patientName
            }
          } else {
            console.warn("[send-completion-whatsapp] Appointment document not found in any collection")
          }
        }
      } catch (error) {
        console.error("[send-completion-whatsapp] Error fetching appointment:", error)
      }
    }
    
    // If still missing, try to get from patient document
    if ((!phone || phone.trim() === "") || (!name || name.trim() === "" || name === "Patient")) {
      console.log("[send-completion-whatsapp] Fetching patient data from Firestore...")
      try {
        const patientDoc = await db.collection("patients").doc(patientId).get()
        if (patientDoc.exists) {
          const patientData = patientDoc.data()
          console.log("[send-completion-whatsapp] Patient document found")
          if (!phone || phone.trim() === "") {
            phone = patientData?.phone || patientData?.phoneNumber || patientData?.contact || ""
            console.log("[send-completion-whatsapp] Phone from Firestore:", phone ? `${phone.substring(0, 3)}***` : "not found")
          }
          if (!name || name.trim() === "" || name === "Patient") {
            name = `${patientData?.firstName || ""} ${patientData?.lastName || ""}`.trim() || 
                   patientData?.name || 
                   patientData?.fullName || 
                   "Patient"
            console.log("[send-completion-whatsapp] Name from Firestore:", name)
          }
        } else {
          console.warn("[send-completion-whatsapp] Patient document not found in Firestore")
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

    console.log("[send-completion-whatsapp] Final patient data:", {
      phone: `${phone.substring(0, 3)}***`,
      name,
    })

    // Get Google Review link from environment variable
    const googleReviewLink = process.env.GOOGLE_REVIEW_LINK || ""
    
    console.log("[send-completion-whatsapp] Google Review link configured:", googleReviewLink ? "Yes" : "No")
    
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

    console.log("[send-completion-whatsapp] Sending WhatsApp message to:", `${phone.substring(0, 3)}***`)
    console.log("[send-completion-whatsapp] Message preview:", messageText.substring(0, 100) + "...")

    // Send WhatsApp message
    const result = await sendWhatsAppNotification({
      to: phone,
      message: messageText,
    })

    console.log("[send-completion-whatsapp] WhatsApp send result:", {
      success: result.success,
      sid: result.sid,
      error: result.error,
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

