/**
 * API endpoint to send checkup completion WhatsApp message to patient with Google Review link
 * and prescription PDF (fees + medicine). Called automatically when doctor completes a checkup.
 */

import { NextResponse } from "next/server"
import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { sendWhatsAppNotification } from "@/server/whatsapp"
import { sendDocumentMessage } from "@/server/metaWhatsApp"
import { getPrescriptionPDFBuffer } from "@/utils/documents/pdfGenerators"
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

    const getPdfBaseUrl = () => {
      let u =
        process.env.NEXT_PUBLIC_BASE_URL ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
        "https://hospitalmanagementsystem-hazel.vercel.app"
      try {
        return new URL(u).origin
      } catch {
        return String(u).replace(/\/+$/, "").replace(/\/[^/]*$/, "") || u
      }
    }

    if (!appointmentId || !patientId) {
      return NextResponse.json({ error: "Missing appointmentId or patientId" }, { status: 400 })
    }

    const db = admin.firestore()

    // Get hospitalId - try from request body first, then from appointment, then search hospitals
    let appointmentHospitalId = hospitalId
    if (!appointmentHospitalId) {
      appointmentHospitalId = await getAppointmentHospitalId(appointmentId)
    }
    if (!appointmentHospitalId) {
      try {
        const hospitalsSnap = await db.collection("hospitals").get()
        for (const h of hospitalsSnap.docs) {
          const aptDoc = await db
            .collection(`hospitals/${h.id}/appointments`)
            .doc(appointmentId)
            .get()
          if (aptDoc.exists) {
            appointmentHospitalId = h.id
            break
          }
        }
      } catch {
        // ignore
      }
    }

    // Fetch full appointment (for PDF generation and phone/name)
    let fullAppointment: Record<string, unknown> | null = null
    try {
      if (appointmentHospitalId) {
        const hospitalAppointmentPath = getHospitalCollectionPath(appointmentHospitalId, "appointments")
        const appointmentDoc = await db.collection(hospitalAppointmentPath).doc(appointmentId).get()
        if (appointmentDoc.exists) {
          fullAppointment = { id: appointmentId, ...appointmentDoc.data() } as Record<string, unknown>
        }
      }
      if (!fullAppointment) {
        const legacyDoc = await db.collection("appointments").doc(appointmentId).get()
        if (legacyDoc.exists) {
          fullAppointment = { id: appointmentId, ...legacyDoc.data() } as Record<string, unknown>
        }
      }
    } catch {
      // continue without full appointment
    }

    // Get phone and name
    let phone = patientPhone || (fullAppointment?.patientPhone as string) || ""
    let name = (patientName || fullAppointment?.patientName || "Patient") as string
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
              (patientData?.name as string) ||
              (patientData?.fullName as string) ||
              "Patient"
          }
        }
      } catch {
        // ignore
      }
    }

    if (!phone || phone.trim() === "") {
      return NextResponse.json({
        success: false,
        error: "Patient phone number not found",
        message: "Checkup completed but WhatsApp message not sent (no phone number)"
      }, { status: 200 })
    }

    // Generate prescription PDF and store for WhatsApp document (fees + medicine)
    let pdfStored = false
    const hasCompletionData =
      fullAppointment &&
      (fullAppointment.status === "completed" ||
        fullAppointment.medicine ||
        fullAppointment.doctorNotes)
    if (hasCompletionData && fullAppointment) {
      const apt = fullAppointment
      try {
        const appointmentForPdf = {
          ...apt,
          id: appointmentId,
          patientId: apt.patientId || patientId,
          patientName: apt.patientName || name,
          patientPhone: phone,
        } as Parameters<typeof getPrescriptionPDFBuffer>[0]
        const pdfBuffer = getPrescriptionPDFBuffer(appointmentForPdf)
        const pdfBase64 = pdfBuffer.toString("base64")
        const expiresAt = new Date()
        expiresAt.setDate(expiresAt.getDate() + 7)
        await db.collection("prescriptionPDFs").doc(appointmentId).set({
          pdfBase64,
          expiresAt: expiresAt.toISOString(),
          patientName: name,
          appointmentDate: apt.appointmentDate || "",
          createdAt: new Date().toISOString(),
        })
        pdfStored = true
      } catch (pdfErr) {
        // Don't fail completion if PDF fails - log and continue
        console.error("[send-completion-whatsapp] Prescription PDF generation failed:", pdfErr)
      }
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

    // Add PDF download link if we have it (fallback if document send fails)
    let pdfDownloadUrl = ""
    if (pdfStored) {
      pdfDownloadUrl = `${getPdfBaseUrl()}/api/appointments/${appointmentId}/prescription-pdf`
      messageText += `\n\n📄 *Download your prescription & invoice:*\n${pdfDownloadUrl}`
    }

    // Send WhatsApp thank you message
    const result = await sendWhatsAppNotification({
      to: phone,
      message: messageText,
    })
    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error || "Failed to send WhatsApp message",
        message: "Checkup completed but WhatsApp message failed to send"
      }, { status: 200 })
    }

    // Send prescription PDF as document (fees + medicine)
    if (pdfStored) {
      try {
        const pdfUrl = `${getPdfBaseUrl()}/api/appointments/${appointmentId}/prescription-pdf`
        const dateStr = fullAppointment?.appointmentDate
          ? new Date(String(fullAppointment.appointmentDate)).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0]
        const filename = `Prescription_${String(name).replace(/\s+/g, "_")}_${dateStr}.pdf`
        const docResult = await sendDocumentMessage(
          phone,
          pdfUrl,
          filename,
          "Your prescription and invoice from today's visit. Thank you for choosing us! 🏥"
        )
        if (!docResult.success) {
          console.error("[send-completion-whatsapp] Prescription PDF send failed:", docResult.error)
        }
      } catch (docErr) {
        console.error("[send-completion-whatsapp] Prescription PDF send error:", docErr)
      }
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

