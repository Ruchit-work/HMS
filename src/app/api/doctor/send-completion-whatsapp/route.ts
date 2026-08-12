/**
 * API endpoint to send checkup completion WhatsApp message to patient with Google Review link
 * and prescription PDF (fees + medicine). Called automatically when doctor completes a checkup.
 */

import { NextResponse } from "next/server"
import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import {
  sendBhashCheckupCompleteTemplateIfConfigured,
  sendBhashPrescriptionDocumentTemplateIfConfigured,
} from "@/server/bhashUtilityTemplates"
import { shouldUseBhashSms } from "@/server/bhashWhatsApp"
import { sendWhatsAppNotification } from "@/server/whatsapp"
import { sendDocumentMessage } from "@/server/metaWhatsApp"
import { isValid6DigitPatientId } from "@/shared/utils/printConverters"
import { getPrescriptionPDFBuffer } from "@/shared/utils/documents/pdfGenerators"
import { authenticateRequest, createAuthErrorResponse } from "@/shared/utils/firebase/apiAuth"
import { getHospitalCollectionPath, getAppointmentHospitalId } from "@/shared/utils/firebase/serverHospitalQueries"
import { createPdfAccessToken } from "@/shared/utils/pdfAccessToken"

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
      const u =
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
    // Get phone, name, and 6-digit Patient ID
    let phone = patientPhone || (fullAppointment?.patientPhone as string) || ""
    let name = (patientName || fullAppointment?.patientName || "Patient") as string
    let resolved6DigitPatientId: string | undefined = undefined

    try {
      const targetUid = patientId || fullAppointment?.patientUid || fullAppointment?.patientId
      if (targetUid) {
        const patientDoc = await db.collection("patients").doc(targetUid).get()
        if (patientDoc.exists) {
          const patientData = patientDoc.data() || {}
          if (!phone || phone.trim() === "") {
            phone = patientData?.phone || patientData?.phoneNumber || patientData?.contact || ""
          }
          if (!name || name.trim() === "" || name === "Patient") {
            name = `${patientData?.firstName || ""} ${patientData?.lastName || ""}`.trim() ||
              (patientData?.name as string) ||
              (patientData?.fullName as string) ||
              "Patient"
          }
          const candidate = patientData?.patientId || patientData?.patientSequentialId || patientData?.patientDisplayId || patientData?.hospitalPatientId || patientData?.customPatientId || patientData?.patientNo || patientData?.patientNumber || patientData?.uhid || patientData?.pid
          if (candidate != null && isValid6DigitPatientId(candidate)) {
            resolved6DigitPatientId = String(candidate).trim()
          }
        }

        if (!resolved6DigitPatientId && appointmentHospitalId) {
          const hospPatientDoc = await db.collection("hospitals").doc(appointmentHospitalId).collection("patients").doc(targetUid).get()
          if (hospPatientDoc.exists) {
            const hData = hospPatientDoc.data() || {}
            const candidate = hData.patientId || hData.patientSequentialId || hData.patientDisplayId || hData.hospitalPatientId || hData.customPatientId || hData.patientNo || hData.patientNumber || hData.uhid || hData.pid
            if (candidate != null && isValid6DigitPatientId(candidate)) {
              resolved6DigitPatientId = String(candidate).trim()
            }
          }
        }
      }
    } catch {
      // ignore
    }

    if (!phone || phone.trim() === "") {
      return NextResponse.json({
        success: false,
        error: "Patient phone number not found",
        message: "Checkup completed but WhatsApp message not sent (no phone number)"
      }, { status: 200 })
    }

    // Fetch hospital specific name, reviewLink, and settings for PDF header branding
    let hospitalDisplayName = "our hospital"
    let hospitalReviewLink = ""
    let hospitalSettings: any = undefined
    if (appointmentHospitalId) {
      try {
        const hospSnap = await db.collection("hospitals").doc(appointmentHospitalId).get()
        if (hospSnap.exists) {
          const hospData = hospSnap.data() || {}
          if (hospData.name) hospitalDisplayName = hospData.name.trim()
          hospitalReviewLink =
            (hospData.settings?.general?.reviewLink as string)?.trim() ||
            (hospData.reviewLink as string)?.trim() ||
            ""

          hospitalSettings = {
            headerTitle: hospData.name?.trim() || hospData.settings?.print?.headerTitle,
            headerSubtitle: hospData.settings?.print?.headerSubtitle || "Multi-Specialty Healthcare Services",
            address: hospData.address || hospData.settings?.print?.address,
            phone: hospData.phone || hospData.settings?.print?.phone,
            email: hospData.email || hospData.settings?.print?.email,
            logoUrl: hospData.settings?.print?.logoUrl || hospData.logoUrl,
          }
        }
      } catch {
        // ignore
      }
    }
    if (!hospitalReviewLink && process.env.GOOGLE_REVIEW_LINK) {
      hospitalReviewLink = process.env.GOOGLE_REVIEW_LINK.trim()
    }

    // Generate prescription PDF and store for WhatsApp document (fees + medicine)
    let pdfStored = false
    let pdfAccessToken = ""
    const hasCompletionData =
      fullAppointment &&
      (fullAppointment.status === "completed" ||
        fullAppointment.medicine ||
        fullAppointment.doctorNotes)
    if (hasCompletionData && fullAppointment) {
      const apt = fullAppointment
      try {
        const aptPid = typeof apt.patientId === "string" ? apt.patientId : undefined
        const aptSeqId = typeof (apt as any).patientSequentialId === "string" ? (apt as any).patientSequentialId : undefined
        const effectivePatientId = resolved6DigitPatientId ||
          (isValid6DigitPatientId(aptPid) ? aptPid : undefined) ||
          (isValid6DigitPatientId(aptSeqId) ? aptSeqId : "N/A")

        const appointmentForPdf = {
          ...apt,
          id: appointmentId,
          patientId: effectivePatientId,
          patientUid: apt.patientUid || apt.patientId || patientId,
          patientName: apt.patientName || name,
          patientPhone: phone,
        } as Parameters<typeof getPrescriptionPDFBuffer>[0]
        const pdfBuffer = getPrescriptionPDFBuffer(appointmentForPdf, hospitalSettings)
        const pdfBase64 = pdfBuffer.toString("base64")
        const expiresAt = new Date()
        expiresAt.setDate(expiresAt.getDate() + 7)
        const accessToken = createPdfAccessToken()
        await db.collection("prescriptionPDFs").doc(appointmentId).set({
          pdfBase64,
          accessToken,
          expiresAt: expiresAt.toISOString(),
          patientName: name,
          appointmentDate: apt.appointmentDate || "",
          createdAt: new Date().toISOString(),
        })
        pdfAccessToken = accessToken
        pdfStored = true
      } catch (pdfErr) {
        // Don't fail completion if PDF fails - log and continue
        console.error("[send-completion-whatsapp] Prescription PDF generation failed:", pdfErr)
      }
    }

    // Build completion message according to hospital review link setting
    let messageText = `Thank you for visiting ${hospitalDisplayName}.\n\n` +
      `We hope you are feeling better.`
    
    if (hospitalReviewLink && hospitalReviewLink.trim() !== "") {
      messageText += `\n\nPlease share your experience:\n${hospitalReviewLink}`
    }

    // Add PDF download link if available
    let pdfDownloadUrl = ""
    if (pdfStored && pdfAccessToken) {
      pdfDownloadUrl = `${getPdfBaseUrl()}/api/appointments/${appointmentId}/prescription-pdf?token=${encodeURIComponent(pdfAccessToken)}`
      messageText += `\n\n📄 *Download your prescription & invoice:*\n${pdfDownloadUrl}`
    }

    // Send WhatsApp thank you message
    const sentViaBhashTemplate = await sendBhashCheckupCompleteTemplateIfConfigured({
      to: phone,
      patientName: name,
      reviewLink: hospitalReviewLink,
    })

    let result: { success: boolean; sid?: string; error?: string }
    if (sentViaBhashTemplate || shouldUseBhashSms()) {
      result = {
        success: sentViaBhashTemplate,
        sid: sentViaBhashTemplate ? "bhash-template" : undefined,
        error: sentViaBhashTemplate ? undefined : "Bhash checkup_complete template failed",
      }
    } else {
      result = await sendWhatsAppNotification({
        to: phone,
        message: messageText,
      })
    }
    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error || "Failed to send WhatsApp message",
        message: "Checkup completed but WhatsApp message failed to send"
      }, { status: 200 })
    }

    // Send prescription PDF as document (fees + medicine)
    if (pdfStored && pdfAccessToken) {
      try {
        const pdfUrl = `${getPdfBaseUrl()}/api/appointments/${appointmentId}/prescription-pdf?token=${encodeURIComponent(pdfAccessToken)}`
        const dateStr = fullAppointment?.appointmentDate
          ? new Date(String(fullAppointment.appointmentDate)).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0]
        const filename = `Prescription_${String(name).replace(/\s+/g, "_")}_${dateStr}.pdf`

        const sentPrescriptionTemplate = await sendBhashPrescriptionDocumentTemplateIfConfigured({
          to: phone,
          documentUrl: pdfUrl,
          patientName: name,
          appointmentId,
        })

        if (!sentPrescriptionTemplate && !shouldUseBhashSms()) {
          const docResult = await sendDocumentMessage(
            phone,
            pdfUrl,
            filename,
            "Your prescription and invoice from today's visit. Thank you for choosing us!"
          )
          if (!docResult.success) {
            console.error("[send-completion-whatsapp] Prescription PDF send failed:", docResult.error)
          }
        } else if (!sentPrescriptionTemplate) {
          console.error("[send-completion-whatsapp] Bhash prescription_pdf template failed")
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
        googleReviewLink: hospitalReviewLink || null,
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

