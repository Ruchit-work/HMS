import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { getDoctorHospitalId, getHospitalCollectionPath } from "@/utils/firebase/serverHospitalQueries"
import { sendWhatsAppNotification } from "@/server/whatsapp"
import { authenticateRequest, createAuthErrorResponse } from "@/utils/firebase/apiAuth"
import { normalizeTime } from "@/utils/timeSlots"
import { applyRateLimit } from "@/utils/shared/rateLimit"
import { logApiError, createErrorResponse } from "@/utils/errors/errorLogger"

const sendAppointmentWhatsApp = async (appointmentData: Record<string, any>) => {
  const patientName: string = appointmentData.patientName || "there"
  const fullName = patientName.trim() || "Patient"
  const doctorName: string = appointmentData.doctorName || "our doctor"
  const doctorSpecialization: string = appointmentData.doctorSpecialization || ""
  const appointmentId = appointmentData.appointmentId || appointmentData.id || "N/A"
  const paymentMethod = appointmentData.paymentMethod || appointmentData.paymentOption || "Cash"
  const paymentAmount = appointmentData.paymentAmount || appointmentData.totalConsultationFee || 0
  const paymentStatus = appointmentData.paymentStatus || "paid" // Default to paid for receptionist bookings
  
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
    return
  }
  const result = await sendWhatsAppNotification({
    to: phoneCandidates[0] || null,
    fallbackRecipients: phoneCandidates.slice(1),
    message,
  })

  if (result.success) {
  } else {
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

  // Declare variables outside try block for catch block access
  let appointmentData: any = null
  let appointmentId: string | null = null

  try {
    const initResult = initFirebaseAdmin("create-appointment API")
    if (!initResult.ok) {
      return Response.json({ error: "Server not configured for admin" }, { status: 500 })
    }

    const body = await request.json().catch(() => ({}))
    appointmentData = body?.appointmentData
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
    
    // Get doctor's consultation fee and hospital for payment calculations
    const doctorDoc = await admin.firestore().collection("doctors").doc(String(appointmentData.doctorId)).get()
    const doctorData = doctorDoc.exists ? doctorDoc.data() : {}
    const consultationFee = doctorData?.consultationFee || appointmentData.paymentAmount || 0
    
    // Get doctor's hospital ID - appointment belongs to doctor's hospital
    const doctorHospitalId = await getDoctorHospitalId(String(appointmentData.doctorId))
    if (!doctorHospitalId) {
      return Response.json({ error: "Doctor's hospital not found" }, { status: 400 })
    }

    // Get receptionist's branch ID (if user is a receptionist)
    let branchId: string | null = null
    let branchName: string | null = null
    if (auth.user?.role === "receptionist") {
      const receptionistDoc = await admin.firestore().collection("receptionists").doc(auth.user.uid).get()
      if (receptionistDoc.exists) {
        const receptionistData = receptionistDoc.data()
        branchId = receptionistData?.branchId || null
        branchName = receptionistData?.branchName || null
      }
    }

    // If branchId provided in appointmentData, validate it
    if (appointmentData.branchId) {
      const branchDoc = await admin.firestore().collection("branches").doc(appointmentData.branchId).get()
      if (branchDoc.exists) {
        const branchData = branchDoc.data()
        if (branchData?.hospitalId === doctorHospitalId && branchData?.status === "active") {
          branchId = appointmentData.branchId
          branchName = branchData?.name || null
        }
      }
    }
    
    // Calculate total including additional fees (before creating docData object)
    const additionalFeesArray = Array.isArray(appointmentData.additionalFees) ? appointmentData.additionalFees : []
    const totalAdditionalFees = additionalFeesArray.reduce((sum: number, fee: any) => sum + (Number(fee.amount) || 0), 0)
    const totalPaymentAmount = typeof appointmentData.paymentAmount === 'number' 
      ? appointmentData.paymentAmount 
      : consultationFee + totalAdditionalFees

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
      
      // Payment fields - properly set for completed payment
      paymentAmount: totalPaymentAmount,
      totalConsultationFee: consultationFee,
      // Store additional fees if provided
      additionalFees: additionalFeesArray.length > 0 ? additionalFeesArray.map((fee: any) => ({
        description: safeValue(fee.description, ""),
        amount: Number(fee.amount) || 0,
      })) : undefined,
      paymentMethod: safeValue(appointmentData.paymentMethod, "cash"),
      paymentType: safeValue(appointmentData.paymentType, "full"),
      paymentStatus: "paid", // Mark as paid since receptionist completed payment
      remainingAmount: 0, // No remaining amount since payment is complete
      paidAt: nowIso, // Set payment timestamp
      transactionId: `RCPT${Date.now()}`, // Generate transaction ID
      
      createdAt: safeValue(appointmentData.createdAt, nowIso),
      updatedAt: nowIso,
      createdBy: safeValue(appointmentData.createdBy, "receptionist"),
      hospitalId: doctorHospitalId, // Store hospital association
      branchId: branchId || null, // Store branch association
      branchName: branchName || null, // Store branch name for display
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
    appointmentId = null // Reset for this transaction

    await firestore.runTransaction(async (transaction) => {
      const slotRef = firestore.collection("appointmentSlots").doc(slotDocId)
      const slotSnap = await transaction.get(slotRef)
      if (slotSnap.exists) {
        throw new Error("SLOT_ALREADY_BOOKED")
      }

      // Create appointment in hospital-scoped subcollection
      const appointmentRef = firestore
        .collection(getHospitalCollectionPath(doctorHospitalId, "appointments"))
        .doc()
      appointmentId = appointmentRef.id
      transaction.set(appointmentRef, docData)
      transaction.set(slotRef, {
        appointmentId,
        doctorId: docData.doctorId,
        appointmentDate: docData.appointmentDate,
        appointmentTime: normalizedAppointmentTime, // Always store in 24-hour format
        createdAt: nowIso,
        hospitalId: doctorHospitalId, // Store hospitalId in slot
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
      } catch {
      }
    }

    // Send WhatsApp notification only if we have a phone number (don't block on this)
    if (patientPhone && patientPhone.trim() !== "") {
      try {
        await sendAppointmentWhatsApp({
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
        })
      } catch {
      }
    } else {
    }

    return Response.json({ success: true, id: appointmentId })
  } catch (error: any) {
    // Log error with context
    const hospitalId = await getDoctorHospitalId(String(appointmentData?.doctorId || "")).catch(() => null)
    logApiError(error, request, auth, {
      action: "create-appointment",
      hospitalId: hospitalId || undefined,
      appointmentId: appointmentId || undefined,
      patientId: appointmentData?.patientId,
      doctorId: appointmentData?.doctorId,
      receptionistId: auth?.user?.uid,
    })
    
    if (error?.message === "SLOT_ALREADY_BOOKED") {
      return Response.json({ error: "This time slot has already been booked. Please select another slot." }, { status: 409 })
    }
    return createErrorResponse(error, request, auth, {
      action: "create-appointment",
      hospitalId: hospitalId || undefined,
      appointmentId: appointmentId || undefined,
    })
  }
}


