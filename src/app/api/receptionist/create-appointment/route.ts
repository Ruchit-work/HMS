import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { getDoctorHospitalId, getHospitalCollectionPath } from "@/shared/utils/firebase/serverHospitalQueries"
import { sendBhashConfirmationTemplateIfConfigured } from "@/server/bhashAppointmentTemplate"
import { shouldUseBhashSms } from "@/server/bhashWhatsApp"
import { sendWhatsAppNotification } from "@/server/whatsapp"
import { authenticateRequest, createAuthErrorResponse } from "@/shared/utils/firebase/apiAuth"
import { normalizeTime } from "@/shared/utils/timeSlots"
import { applyRateLimit } from "@/shared/utils/shared/rateLimit"
import { logApiError, createErrorResponse } from "@/shared/utils/errors/errorLogger"
import { getString, isRecord, type UnknownRecord } from "@/shared/utils/api/validation"
import { auditLogger, AUDIT_ACTIONS } from "@/server/auditLogger"
import { isValid6DigitPatientId } from "@/shared/utils/printConverters"

const sendAppointmentWhatsApp = async (appointmentData: UnknownRecord) => {
  const patientName = getString(appointmentData.patientName) || "there"
  const fullName = patientName.trim() || "Patient"
  const doctorName = getString(appointmentData.doctorName) || "our doctor"
  const doctorSpecialization = getString(appointmentData.doctorSpecialization) || ""
  const appointmentId =
    getString(appointmentData.appointmentId) || getString(appointmentData.id) || "N/A"
  const paymentMethod =
    getString(appointmentData.paymentMethod) ||
    getString(appointmentData.paymentOption) ||
    "Cash"
  const paymentAmount =
    (typeof appointmentData.paymentAmount === "number" ? appointmentData.paymentAmount : undefined) ||
    (typeof appointmentData.totalConsultationFee === "number" ? appointmentData.totalConsultationFee : undefined) ||
    0
  const paymentStatus = getString(appointmentData.paymentStatus) || "paid" // Default to paid for receptionist bookings
  
  const dateDisplay = new Date(appointmentData.appointmentDate + "T00:00:00").toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })
  
  const timeStr = getString(appointmentData.appointmentTime) || ""
  const isFcfsMsg = appointmentData.isFcfs === true || timeStr.toUpperCase().includes("FCFS")
  let timeDisplay = timeStr
  if (isFcfsMsg) {
    const queueNum = appointmentData.queueNumber || appointmentData.tokenNumber
    timeDisplay = queueNum ? `First-Come-First-Serve (Queue #${queueNum})` : "First-Come-First-Serve"
  } else {
    const [h, m] = timeStr.split(":").map(Number)
    timeDisplay = !isNaN(h) && !isNaN(m) 
      ? new Date(2000, 0, 1, h, m).toLocaleTimeString("en-IN", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        })
      : timeStr
  }
  
  const hospitalName = getString(appointmentData.hospitalName) || process.env.HOSPITAL_NAME?.trim() || "our hospital"

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

Thank you for choosing ${hospitalName}. 🏥`

  // Try multiple phone number fields
  const phoneCandidates = [
    getString(appointmentData.patientPhone),
    getString(appointmentData.patientPhoneNumber),
    getString(appointmentData.patientContact),
    getString(appointmentData.phone),
  ].filter((v): v is string => Boolean(v))

  if (phoneCandidates.length === 0) {
    return
  }

  const appointmentDate = getString(appointmentData.appointmentDate) || ""
  const sentViaBhashTemplate = await sendBhashConfirmationTemplateIfConfigured({
    to: phoneCandidates[0] || null,
    fallbackRecipients: phoneCandidates.slice(1),
    params: {
      patientName: fullName,
      confirmedVia: "by our receptionist",
      doctorName,
      doctorSpecialization: doctorSpecialization || undefined,
      appointmentDate,
      appointmentTime: timeStr,
      appointmentId,
      paymentMethod,
      paymentAmount,
      paymentStatus,
      hospitalName,
    },
  })

  if (sentViaBhashTemplate || shouldUseBhashSms()) {
    return
  }

  await sendWhatsAppNotification({
    to: phoneCandidates[0] || null,
    fallbackRecipients: phoneCandidates.slice(1),
    message,
  })
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
  let appointmentData: UnknownRecord | null = null
  let appointmentId: string | null = null

  try {
    const initResult = initFirebaseAdmin("create-appointment API")
    if (!initResult.ok) {
      return Response.json({ error: "Server not configured for admin" }, { status: 500 })
    }

    const bodyUnknown: unknown = await request.json().catch(() => ({}))
    const body = isRecord(bodyUnknown) ? bodyUnknown : {}
    const maybeAppointmentData = body.appointmentData
    appointmentData = isRecord(maybeAppointmentData) ? maybeAppointmentData : null
    if (!appointmentData) {
      return Response.json({ error: "Missing appointmentData" }, { status: 400 })
    }

    const rawTimeStr = getString(appointmentData.appointmentTime) || ""
    const isFcfs = appointmentData.isFcfs === true || rawTimeStr.toUpperCase().includes("FCFS") || !rawTimeStr

    const required = ["patientId", "patientName", "doctorId", "doctorName", "appointmentDate"]
    for (const k of required) {
      if (!appointmentData[k]) {
        return Response.json({ error: `Missing ${k}` }, { status: 400 })
      }
    }
    if (!isFcfs && !rawTimeStr) {
      return Response.json({ error: "Missing appointmentTime" }, { status: 400 })
    }

    const nowIso = new Date().toISOString()
    
    // Helper function to ensure no undefined values (avoid `any`)
    const safeValue = (val: unknown, defaultValue: string = ""): string => {
      if (val === undefined || val === null) return defaultValue
      if (typeof val === "string") return val
      if (typeof val === "number" || typeof val === "boolean") return String(val)
      return defaultValue
    }
    
    // Normalize appointment time to 24-hour format (HH:MM) for consistent storage (or FCFS)
    const normalizedAppointmentTime = isFcfs ? "FCFS" : normalizeTime(rawTimeStr)
    
    // Get doctor's hospital ID - appointment belongs to doctor's hospital
    const doctorHospitalId = await getDoctorHospitalId(String(appointmentData.doctorId))
    if (!doctorHospitalId) {
      return Response.json({ error: "Doctor's hospital not found" }, { status: 400 })
    }

    // Get visit type and effective consultation fee server-side
    const { normalizeVisitType } = await import("@/shared/utils/visitTypes")
    const { getEffectiveConsultationFee } = await import("@/shared/utils/billingSettings")
    const { getHospitalBillingSettings } = await import("@/server/hospitalBillingSettings")

    const visitType = normalizeVisitType(appointmentData.visitType)
    const doctorDoc = await admin.firestore().collection("doctors").doc(String(appointmentData.doctorId)).get()
    const doctorData = doctorDoc.exists ? doctorDoc.data() : {}
    const doctorBaseFee = doctorData?.consultationFee || appointmentData.paymentAmount || 0

    let hospitalName = process.env.HOSPITAL_NAME?.trim() || "our hospital"
    if (doctorHospitalId) {
      try {
        const hospitalDoc = await admin.firestore().collection("hospitals").doc(doctorHospitalId).get()
        if (hospitalDoc.exists) {
          const hd = hospitalDoc.data()
          hospitalName = hd?.name || hd?.hospitalName || process.env.HOSPITAL_NAME?.trim() || "our hospital"
        }
      } catch {}
    }
    
    const billingSettings = await getHospitalBillingSettings(doctorHospitalId)
    const consultationFee = getEffectiveConsultationFee(doctorBaseFee, visitType, billingSettings)

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
    const requestedBranchId = getString(appointmentData.branchId)
    if (requestedBranchId) {
      const branchDoc = await admin.firestore().collection("branches").doc(requestedBranchId).get()
      if (branchDoc.exists) {
        const branchData = branchDoc.data()
        if (branchData?.hospitalId === doctorHospitalId && branchData?.status === "active") {
          branchId = requestedBranchId
          branchName = branchData?.name || null
        }
      }
    }
    
    // Calculate total including additional fees (before creating docData object)
    const additionalFeesArray = Array.isArray(appointmentData.additionalFees) ? appointmentData.additionalFees : []
    const totalAdditionalFees = additionalFeesArray.reduce((sum: number, fee: unknown) => {
      const amount = isRecord(fee) ? Number(fee.amount) || 0 : 0
      return sum + amount
    }, 0)
    const totalPaymentAmount = typeof appointmentData.paymentAmount === 'number' 
      ? appointmentData.paymentAmount 
      : consultationFee + totalAdditionalFees

    const patientUidForLookup = String(appointmentData.patientUid || appointmentData.patientId || "")
    let resolved6DigitPid = isValid6DigitPatientId(String(appointmentData.patientId)) ? String(appointmentData.patientId) : null
    if (!resolved6DigitPid && patientUidForLookup) {
      try {
        const pSnap = await admin.firestore().collection("patients").doc(patientUidForLookup).get()
        if (pSnap.exists) {
          const pData = pSnap.data() || {}
          if (pData.patientId && isValid6DigitPatientId(pData.patientId)) {
            resolved6DigitPid = String(pData.patientId).trim()
          }
        }
      } catch {}
    }

    const docData: Record<string, unknown> = {
      patientId: resolved6DigitPid || String(appointmentData.patientId),
      patientSequentialId: resolved6DigitPid || null,
      patientUid: patientUidForLookup,
      patientName: String(appointmentData.patientName),
      patientEmail: safeValue(appointmentData.patientEmail, ""),
      patientPhone: safeValue(appointmentData.patientPhone, ""),
      doctorId: String(appointmentData.doctorId),
      doctorName: String(appointmentData.doctorName),
      doctorSpecialization: safeValue(appointmentData.doctorSpecialization, ""),
      appointmentDate: String(appointmentData.appointmentDate),
      appointmentTime: normalizedAppointmentTime, // Always store in 24-hour format
      status: safeValue(appointmentData.status, "confirmed"),
      appointmentType: safeValue(appointmentData.appointmentType, "consultation"),
      visitType,
      
      // Payment fields - properly set for completed payment
      paymentAmount: totalPaymentAmount,
      totalConsultationFee: consultationFee,
      // Store additional fees if provided
      additionalFees: additionalFeesArray.length > 0
        ? additionalFeesArray.map((fee: unknown) => {
            const feeRec = isRecord(fee) ? fee : {}
            return {
              description: safeValue(feeRec.description, ""),
              amount: Number(feeRec.amount) || 0,
            }
          })
        : undefined,
      paymentMethod: safeValue(appointmentData.paymentMethod, "cash"),
      paymentType: safeValue(appointmentData.paymentType, "full"),
      paymentStatus: "paid", // Mark as paid since receptionist completed payment
      billingStatus: "paid",
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
    appointmentId = null // Reset for this transaction

    await firestore.runTransaction(async (transaction) => {
      if (isFcfs) {
        // First-Come-First-Serve atomic queue sequencing:
        // Scoped to Hospital + Branch + Doctor + Appointment Date
        const queueCounterDocId = `queue_${doctorHospitalId}_${branchId || "default"}_${docData.doctorId}_${docData.appointmentDate}`.replace(/[:\s]/g, "-")
        const queueCounterRef = firestore.collection("appointmentQueues").doc(queueCounterDocId)
        const queueSnap = await transaction.get(queueCounterRef)
        const currentQueue = queueSnap.exists ? (Number(queueSnap.data()?.lastQueueNumber) || 0) : 0
        const nextQueueNumber = currentQueue + 1

        transaction.set(
          queueCounterRef,
          {
            lastQueueNumber: nextQueueNumber,
            hospitalId: doctorHospitalId,
            branchId: branchId || null,
            doctorId: docData.doctorId,
            appointmentDate: docData.appointmentDate,
            updatedAt: nowIso,
          },
          { merge: true }
        )

        docData.queueNumber = nextQueueNumber
        docData.tokenNumber = nextQueueNumber
        docData.isFcfs = true
        docData.appointmentTime = `FCFS #${nextQueueNumber}`

        const slotDocId = `fcfs_${docData.doctorId}_${docData.appointmentDate}_${nextQueueNumber}`.replace(/[:\s]/g, "-")
        const slotRef = firestore.collection("appointmentSlots").doc(slotDocId)

        const appointmentRef = firestore
          .collection(getHospitalCollectionPath(doctorHospitalId, "appointments"))
          .doc()
        appointmentId = appointmentRef.id
        transaction.set(appointmentRef, docData)
        transaction.set(slotRef, {
          appointmentId,
          doctorId: docData.doctorId,
          appointmentDate: docData.appointmentDate,
          appointmentTime: docData.appointmentTime,
          queueNumber: nextQueueNumber,
          isFcfs: true,
          createdAt: nowIso,
          hospitalId: doctorHospitalId,
        })
      } else {
        // Standard Slot-based booking:
        const slotDocId = `${docData.doctorId}_${docData.appointmentDate}_${normalizedAppointmentTime}`.replace(/[:\s]/g, "-")
        const slotRef = firestore.collection("appointmentSlots").doc(slotDocId)
        const slotSnap = await transaction.get(slotRef)
        if (slotSnap.exists) {
          throw new Error("SLOT_ALREADY_BOOKED")
        }

        const appointmentRef = firestore
          .collection(getHospitalCollectionPath(doctorHospitalId, "appointments"))
          .doc()
        appointmentId = appointmentRef.id
        transaction.set(appointmentRef, docData)
        transaction.set(slotRef, {
          appointmentId,
          doctorId: docData.doctorId,
          appointmentDate: docData.appointmentDate,
          appointmentTime: normalizedAppointmentTime,
          createdAt: nowIso,
          hospitalId: doctorHospitalId,
        })
      }
    })

    // If patient phone is missing, try to fetch it from the patient record
    let patientPhone =
      (typeof docData.patientPhone === "string" ? docData.patientPhone : "") ||
      getString(appointmentData.patientPhone) ||
      ""
    if (!patientPhone || patientPhone.trim() === "") {
      try {
        const patientIdForLookup = getString(appointmentData.patientId)
        if (patientIdForLookup) {
          const patientDoc = await admin.firestore().collection("patients").doc(patientIdForLookup).get()
          if (patientDoc.exists) {
            const patientData = patientDoc.data()
            patientPhone =
              patientData?.phone ||
              patientData?.phoneNumber ||
              patientData?.contact ||
              patientData?.mobile ||
              ""
          }
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
          hospitalName,
        })
      } catch {
      }
    } else {
    }

    if (appointmentId) {
      void auditLogger.logForUser(auth.user, {
        hospitalId: doctorHospitalId,
        branchId,
        module: "Appointment",
        entityType: "appointment",
        entityId: appointmentId,
        action: AUDIT_ACTIONS.APPOINTMENT_CREATED,
        summary: `Appointment ${appointmentId} was created.`,
        metadata: {
          patientId: docData.patientId,
          doctorId: docData.doctorId,
          appointmentDate: docData.appointmentDate,
          appointmentTime: docData.appointmentTime,
        },
      })
    }

    return Response.json({ success: true, id: appointmentId })
  } catch (error: unknown) {
    // Log error with context (don't await to avoid blocking response)
    const hospitalId = await getDoctorHospitalId(String(appointmentData?.doctorId || "")).catch(() => null)
    logApiError(error, request, auth, {
      action: "create-appointment",
      hospitalId: hospitalId || undefined,
      appointmentId: appointmentId || undefined,
      patientId: appointmentData ? getString(appointmentData.patientId) : undefined,
      doctorId: appointmentData ? getString(appointmentData.doctorId) : undefined,
      receptionistId: auth?.user?.uid,
    }).catch((err) => {
      console.error('[Error Logger] Failed to log error:', err)
    })
    
    if (error instanceof Error && error.message === "SLOT_ALREADY_BOOKED") {
      return Response.json({ error: "This time slot has already been booked. Please select another slot." }, { status: 409 })
    }
    return await createErrorResponse(error, request, auth, {
      action: "create-appointment",
      hospitalId: hospitalId || undefined,
      appointmentId: appointmentId || undefined,
    })
  }
}


