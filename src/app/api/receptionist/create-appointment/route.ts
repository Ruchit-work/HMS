import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { sendWhatsAppNotification } from "@/server/whatsapp"
import { formatAppointmentDateTime } from "@/utils/date"
import { authenticateRequest, createAuthErrorResponse } from "@/utils/apiAuth"
import { normalizeTime } from "@/utils/timeSlots"
import { applyRateLimit } from "@/utils/rateLimit"
import { logAppointmentEvent } from "@/utils/auditLog"

const sendAppointmentWhatsApp = async (appointmentData: Record<string, any>) => {
  const patientName: string = appointmentData.patientName || "there"
  const friendlyName = patientName.trim().split(" ")[0] || "there"
  const fullName = patientName.trim() || "Patient"
  const doctorName: string = appointmentData.doctorName || "our doctor"
  const doctorSpecialization: string = appointmentData.doctorSpecialization || ""
  const schedule = formatAppointmentDateTime(appointmentData.appointmentDate, appointmentData.appointmentTime)
  const appointmentId = appointmentData.appointmentId || appointmentData.id || "N/A"
  const paymentMethod = appointmentData.paymentMethod || appointmentData.paymentOption || "Cash"
  const paymentAmount = appointmentData.paymentAmount || appointmentData.totalConsultationFee || 0
  const paymentStatus = appointmentData.paymentStatus || "pending"
  
  const dateDisplay = new Date(appointmentData.appointmentDate + "T00:00:00").toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })
  
  const timeStr = appointmentData.appointmentTime || ""
  const [h, m] = timeStr.split(":").map(Number)
  const timeDisplay = !isNaN(h) && !isNaN(m) 
    ? new Date(2000, 0, 1, h, m).toLocaleTimeString("en-IN", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
    : timeStr
  
  const message = `🎉 *Appointment Successfully Booked!*

Hi ${fullName},

Your appointment has been confirmed and booked successfully by our receptionist.

📋 *Appointment Details:*
• 👨‍⚕️ Doctor: ${doctorName}${doctorSpecialization ? ` (${doctorSpecialization})` : ""}
• 📅 Date: ${dateDisplay}
• 🕒 Time: ${timeDisplay}
• 📋 Appointment ID: ${appointmentId}
${appointmentData.chiefComplaint ? `• 📝 Reason: ${appointmentData.chiefComplaint}` : ""}

💳 *Payment Information:*
• Method: ${paymentMethod}
• Amount: ₹${paymentAmount}
• Status: ${paymentStatus === "paid" ? "✅ Paid" : "⏳ Pending"}

✅ Your appointment is confirmed and visible in our system.

If you need to reschedule or have any questions, reply here or call us at +91-XXXXXXXXXX.

See you soon! 🏥`

  // Try multiple phone number fields
  const phoneCandidates = [
    appointmentData.patientPhone,
    appointmentData.patientPhoneNumber,
    appointmentData.patientContact,
    appointmentData.phone,
  ].filter(Boolean)

  if (phoneCandidates.length === 0) {
    console.warn("[Appointment WhatsApp] No phone number found for patient:", appointmentData.patientName)
    return
  }

  const result = await sendWhatsAppNotification({
    to: phoneCandidates[0] || null,
    fallbackRecipients: phoneCandidates.slice(1),
    message,
  })

  if (!result.success) {
    console.error("[Appointment WhatsApp] Failed to send appointment confirmation:", {
      patientName,
      phone: phoneCandidates[0],
      error: result.error,
      errorCode: result.errorCode,
    })
  } else {
    console.log("[Appointment WhatsApp] ✅ Appointment confirmation sent successfully to:", phoneCandidates[0])
  }
}

export async function POST(request: Request) {
  // Apply rate limiting first
  const rateLimitResult = await applyRateLimit(request, "BOOKING")
  if (rateLimitResult instanceof Response) {
    return rateLimitResult // Rate limited
  }

  // Authenticate request - requires receptionist or admin role
  const auth = await authenticateRequest(request)
  if (!auth.success) {
    return createAuthErrorResponse(auth)
  }
  if (auth.user && auth.user.role !== "receptionist" && auth.user.role !== "admin") {
    return Response.json(
      { error: "Access denied. This endpoint requires receptionist or admin role." },
      { status: 403 }
    )
  }

  // Re-apply rate limit with user ID for better tracking
  const rateLimitWithUser = await applyRateLimit(request, "BOOKING", auth.user?.uid)
  if (rateLimitWithUser instanceof Response) {
    return rateLimitWithUser // Rate limited
  }

  try {
    const initResult = initFirebaseAdmin("create-appointment API")
    if (!initResult.ok) {
      return Response.json({ error: "Server not configured for admin" }, { status: 500 })
    }

    const body = await request.json().catch(() => ({}))
    const appointmentData = body?.appointmentData
    if (!appointmentData) {
      return Response.json({ error: "Missing appointmentData" }, { status: 400 })
    }

    const required = ["patientId", "patientName", "doctorId", "doctorName", "appointmentDate", "appointmentTime"]
    for (const k of required) {
      if (!appointmentData[k]) {
        return Response.json({ error: `Missing ${k}` }, { status: 400 })
      }
    }

    const nowIso = new Date().toISOString()
    
    // Helper function to ensure no undefined values
    const safeValue = (val: any, defaultValue: any = "") => {
      return val !== undefined && val !== null ? val : defaultValue
    }
    
    // Normalize appointment time to 24-hour format (HH:MM) for consistent storage
    const normalizedAppointmentTime = normalizeTime(String(appointmentData.appointmentTime))
    
    const docData: any = {
      patientId: String(appointmentData.patientId),
      patientName: String(appointmentData.patientName),
      patientEmail: safeValue(appointmentData.patientEmail, ""),
      patientPhone: safeValue(appointmentData.patientPhone, ""),
      doctorId: String(appointmentData.doctorId),
      doctorName: String(appointmentData.doctorName),
      doctorSpecialization: safeValue(appointmentData.doctorSpecialization, ""),
      appointmentDate: String(appointmentData.appointmentDate),
      appointmentTime: normalizedAppointmentTime, // Always store in 24-hour format
      status: safeValue(appointmentData.status, "confirmed"),
      paymentAmount: typeof appointmentData.paymentAmount === 'number' ? appointmentData.paymentAmount : 0,
      createdAt: safeValue(appointmentData.createdAt, nowIso),
      updatedAt: nowIso,
      createdBy: safeValue(appointmentData.createdBy, "receptionist")
    }
    
    // Include optional patient health fields only if they exist and are not undefined
    if (appointmentData.patientGender !== undefined) docData.patientGender = safeValue(appointmentData.patientGender, "")
    if (appointmentData.patientBloodGroup !== undefined) docData.patientBloodGroup = safeValue(appointmentData.patientBloodGroup, "")
    if (appointmentData.patientDateOfBirth !== undefined) docData.patientDateOfBirth = safeValue(appointmentData.patientDateOfBirth, "")
    if (appointmentData.patientDrinkingHabits !== undefined) docData.patientDrinkingHabits = safeValue(appointmentData.patientDrinkingHabits, "")
    if (appointmentData.patientSmokingHabits !== undefined) docData.patientSmokingHabits = safeValue(appointmentData.patientSmokingHabits, "")
    if (appointmentData.patientVegetarian !== undefined) docData.patientVegetarian = appointmentData.patientVegetarian ?? false
    if (appointmentData.patientOccupation !== undefined) docData.patientOccupation = safeValue(appointmentData.patientOccupation, "")
    if (appointmentData.patientFamilyHistory !== undefined) docData.patientFamilyHistory = safeValue(appointmentData.patientFamilyHistory, "")
    if (appointmentData.patientPregnancyStatus !== undefined) docData.patientPregnancyStatus = safeValue(appointmentData.patientPregnancyStatus, "")
    if (appointmentData.patientHeightCm !== undefined) docData.patientHeightCm = appointmentData.patientHeightCm ?? null
    if (appointmentData.patientWeightKg !== undefined) docData.patientWeightKg = appointmentData.patientWeightKg ?? null
    if (appointmentData.patientAllergies !== undefined) docData.patientAllergies = safeValue(appointmentData.patientAllergies, "")
    if (appointmentData.patientCurrentMedications !== undefined) docData.patientCurrentMedications = safeValue(appointmentData.patientCurrentMedications, "")
    
    // Include appointment-specific fields
    // Always include chiefComplaint and medicalHistory (required fields) - use defaults if not provided
    docData.chiefComplaint = safeValue(appointmentData.chiefComplaint, "General consultation")
    docData.medicalHistory = safeValue(appointmentData.medicalHistory, "")
    if (appointmentData.patientAdditionalConcern !== undefined) docData.patientAdditionalConcern = safeValue(appointmentData.patientAdditionalConcern, "")
    if (appointmentData.symptomOnset !== undefined) docData.symptomOnset = safeValue(appointmentData.symptomOnset, "")
    if (appointmentData.symptomDuration !== undefined) docData.symptomDuration = safeValue(appointmentData.symptomDuration, "")
    if (appointmentData.symptomSeverity !== undefined) docData.symptomSeverity = appointmentData.symptomSeverity ?? null
    if (appointmentData.symptomProgression !== undefined) docData.symptomProgression = safeValue(appointmentData.symptomProgression, "")
    if (appointmentData.symptomTriggers !== undefined) docData.symptomTriggers = safeValue(appointmentData.symptomTriggers, "")
    if (appointmentData.associatedSymptoms !== undefined) docData.associatedSymptoms = safeValue(appointmentData.associatedSymptoms, "")
    
    // Remove any undefined values that might have slipped through
    Object.keys(docData).forEach(key => {
      if (docData[key] === undefined) {
        delete docData[key]
      }
    })

    const firestore = admin.firestore()
    // Use normalized time for slot document ID (already normalized above)
    const slotDocId = `${docData.doctorId}_${docData.appointmentDate}_${normalizedAppointmentTime}`.replace(/[:\s]/g, "-")
    let appointmentId: string | null = null

    await firestore.runTransaction(async (transaction) => {
      const slotRef = firestore.collection("appointmentSlots").doc(slotDocId)
      const slotSnap = await transaction.get(slotRef)
      if (slotSnap.exists) {
        throw new Error("SLOT_ALREADY_BOOKED")
      }

      const appointmentRef = firestore.collection("appointments").doc()
      appointmentId = appointmentRef.id
      transaction.set(appointmentRef, docData)
      transaction.set(slotRef, {
        appointmentId,
        doctorId: docData.doctorId,
        appointmentDate: docData.appointmentDate,
        appointmentTime: normalizedAppointmentTime, // Always store in 24-hour format
        createdAt: nowIso,
      })
    })

    // If patient phone is missing, try to fetch it from the patient record
    let patientPhone = docData.patientPhone || appointmentData.patientPhone
    if (!patientPhone || patientPhone.trim() === "") {
      try {
        const patientDoc = await admin.firestore().collection("patients").doc(appointmentData.patientId).get()
        if (patientDoc.exists) {
          const patientData = patientDoc.data()
          patientPhone = patientData?.phone || patientData?.phoneNumber || patientData?.contact || patientData?.mobile || ""
        }
      } catch (error) {
        console.error("[create-appointment] Error fetching patient phone:", error)
      }
    }

    // Send WhatsApp notification only if we have a phone number (don't block on this)
    if (patientPhone && patientPhone.trim() !== "") {
      sendAppointmentWhatsApp({
        ...appointmentData,
        ...docData,
        appointmentId: appointmentId,
        id: appointmentId,
        patientPhone: patientPhone,
        patientName: docData.patientName,
        doctorName: docData.doctorName,
        doctorSpecialization: docData.doctorSpecialization,
        appointmentDate: docData.appointmentDate,
        appointmentTime: docData.appointmentTime,
      }).catch((error) => {
        console.error("[create-appointment] WhatsApp notification failed:", error)
      })
    }

    // Log successful appointment booking
    await logAppointmentEvent(
      "appointment_booked",
      request,
      auth.user?.uid,
      auth.user?.email || undefined,
      auth.user?.role,
      appointmentId || undefined,
      docData.doctorId ? String(docData.doctorId) : undefined,
      appointmentData.patientId ? String(appointmentData.patientId) : undefined,
      undefined,
      { appointmentDate: docData.appointmentDate, appointmentTime: normalizedAppointmentTime, createdBy: "receptionist" }
    )

    return Response.json({ success: true, id: appointmentId })
  } catch (error: any) {
    console.error("create-appointment error:", error)
    
    // Log failed appointment creation (note: request body may have already been consumed)
    if (auth.success && auth.user) {
      await logAppointmentEvent(
        "appointment_failed",
        request,
        auth.user.uid,
        auth.user.email || undefined,
        auth.user.role,
        undefined,
        undefined,
        undefined,
        error?.message || "Failed to create appointment"
      )
    }
    
    if (error?.message === "SLOT_ALREADY_BOOKED") {
      return Response.json({ error: "This time slot has already been booked. Please select another slot." }, { status: 409 })
    }
    return Response.json({ error: error?.message || "Failed to create appointment" }, { status: 500 })
  }
}


