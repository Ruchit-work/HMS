import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { getDoctorHospitalId, getHospitalCollectionPath } from "@/utils/firebase/serverHospitalQueries"
import { sendWhatsAppNotification } from "@/server/whatsapp"
import { authenticateRequest, createAuthErrorResponse } from "@/utils/firebase/apiAuth"
import { normalizeTime } from "@/utils/timeSlots"
import { applyRateLimit } from "@/utils/shared/rateLimit"
import { logApiError, createErrorResponse } from "@/utils/errors/errorLogger"
import { getString, isRecord, type UnknownRecord } from "@/utils/api/typeGuards"

const sendDoctorBookingWhatsApp = async (
  appointmentData: UnknownRecord,
  options?: { payAtReception?: boolean; amountDue?: number }
) => {
  const patientName = getString(appointmentData.patientName) || "there"
  const fullName = patientName.trim() || "Patient"
  const doctorName = getString(appointmentData.doctorName) || "your doctor"
  const doctorSpecialization = getString(appointmentData.doctorSpecialization) || ""
  const appointmentId =
    getString(appointmentData.appointmentId) || getString(appointmentData.id) || "N/A"
  const dateDisplay = new Date(appointmentData.appointmentDate + "T00:00:00").toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })
  const timeStr = getString(appointmentData.appointmentTime) || ""
  const [h, m] = timeStr.split(":").map(Number)
  const timeDisplay = !isNaN(h) && !isNaN(m)
    ? new Date(2000, 0, 1, h, m).toLocaleTimeString("en-IN", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
    : timeStr

  const chiefComplaint = getString(appointmentData.chiefComplaint) || ""
  const isRecheckup = /^Re-checkup/i.test(chiefComplaint)
  const payAtReception = options?.payAtReception === true
  const amountDue = options?.amountDue ?? 0

  const header = isRecheckup ? "🔄 *Re-checkup Appointment Booked!*" : "🎉 *Appointment Booked!*"
  let intro: string
  let footer: string
  if (payAtReception) {
    intro =
      "Doctor has recommended a re-checkup. Please visit the hospital and complete payment at reception before consultation."
    footer = amountDue > 0
      ? `\n\n💳 *Payment:* Please pay ₹${amountDue} at reception before your consultation.\n\nSee you at the clinic! 🏥`
      : "\n\n💳 *Payment:* Please complete payment at reception before your consultation.\n\nSee you at the clinic! 🏥"
  } else {
    intro = isRecheckup
      ? "Your re-checkup (follow-up) appointment has been confirmed by the doctor."
      : "Your appointment has been confirmed by the doctor."
    footer = "\n\nSee you at the clinic! 🏥"
  }

  const message = `${header}

Hi ${fullName},

${intro}

📋 *Details:*
• 👨‍⚕️ Doctor: ${doctorName}${doctorSpecialization ? ` (${doctorSpecialization})` : ""}
• 📅 Date: ${dateDisplay}
• 🕒 Time: ${timeDisplay}
• 📋 ID: ${appointmentId}
${chiefComplaint ? `• 📝 Reason: ${chiefComplaint}` : ""}
${footer}`

  const phoneCandidates = [
    getString(appointmentData.patientPhone),
    getString(appointmentData.patientPhoneNumber),
    getString(appointmentData.patientContact),
    getString(appointmentData.phone),
  ].filter((v): v is string => Boolean(v))

  if (phoneCandidates.length === 0) return
  await sendWhatsAppNotification({
    to: phoneCandidates[0] || null,
    fallbackRecipients: phoneCandidates.slice(1),
    message,
  })
}

export async function POST(request: Request) {
  const rateLimitResult = await applyRateLimit(request, "BOOKING")
  if (rateLimitResult instanceof Response) return rateLimitResult

  const auth = await authenticateRequest(request)
  if (!auth.success) return createAuthErrorResponse(auth)
  if (auth.user?.role !== "doctor") {
    return Response.json(
      { error: "Access denied. This endpoint is for doctors only." },
      { status: 403 }
    )
  }

  const rateLimitWithUser = await applyRateLimit(request, "BOOKING", auth.user?.uid)
  if (rateLimitWithUser instanceof Response) return rateLimitWithUser

  let appointmentData: UnknownRecord | null = null
  let appointmentId: string | null = null

  try {
    const initResult = initFirebaseAdmin("doctor-create-appointment API")
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
    const isEmergency = body.isEmergency === true
    const isRecheck = body.isRecheck === true

    const doctorId = auth.user.uid
    const required = ["patientId", "patientName", "appointmentDate", "appointmentTime"]
    for (const k of required) {
      if (!appointmentData[k]) {
        return Response.json({ error: `Missing ${k}` }, { status: 400 })
      }
    }

    const nowIso = new Date().toISOString()
    const safeValue = (val: unknown, defaultValue: string = ""): string => {
      if (val === undefined || val === null) return defaultValue
      if (typeof val === "string") return val
      if (typeof val === "number" || typeof val === "boolean") return String(val)
      return defaultValue
    }

    const normalizedAppointmentTime = normalizeTime(String(appointmentData.appointmentTime))
    const doctorDoc = await admin.firestore().collection("doctors").doc(doctorId).get()
    const doctorData = doctorDoc.exists ? doctorDoc.data() : {}
    const doctorName = `${doctorData?.firstName || ""} ${doctorData?.lastName || ""}`.trim() || "Doctor"
    const doctorSpecialization = doctorData?.specialization || ""
    const consultationFee = doctorData?.consultationFee || appointmentData.paymentAmount || 0

    const doctorHospitalId = await getDoctorHospitalId(doctorId)
    if (!doctorHospitalId) {
      return Response.json({ error: "Doctor's hospital not found" }, { status: 400 })
    }

    const additionalFeesArray = Array.isArray(appointmentData.additionalFees) ? appointmentData.additionalFees : []
    const totalAdditionalFees = additionalFeesArray.reduce((sum: number, fee: unknown) => {
      const amount = isRecord(fee) ? Number(fee.amount) || 0 : 0
      return sum + amount
    }, 0)
    const totalPaymentAmount =
      isRecheck
        ? Number(consultationFee) || 0
        : typeof appointmentData.paymentAmount === "number"
          ? appointmentData.paymentAmount
          : consultationFee + totalAdditionalFees

    const paymentStatus = isRecheck ? "unpaid" : "paid"
    const remainingAmount = isRecheck ? totalPaymentAmount : 0
    const paidAt = isRecheck ? "" : nowIso
    const slotOverbooking = isEmergency || isRecheck

    // Derive branchId/branchName when missing (doctor-booked or recheck from doctor-booked)
    let effectiveBranchId =
      appointmentData.branchId !== undefined && appointmentData.branchId !== null && String(appointmentData.branchId || "").trim()
        ? String(appointmentData.branchId).trim()
        : null
    let effectiveBranchName =
      appointmentData.branchName !== undefined && appointmentData.branchName !== null && String(appointmentData.branchName || "").trim()
        ? String(appointmentData.branchName).trim()
        : null
    if (!effectiveBranchId) {
      const doctorBranchIds = Array.isArray(doctorData?.branchIds) ? doctorData.branchIds : []
      if (doctorBranchIds.length > 0) {
        effectiveBranchId = String(doctorBranchIds[0])
        const branchDoc = await admin.firestore().collection("branches").doc(effectiveBranchId).get()
        if (branchDoc.exists) {
          effectiveBranchName = (branchDoc.data() as { name?: string })?.name || null
        }
      }
      if (!effectiveBranchId) {
        const branchesSnap = await admin
          .firestore()
          .collection("branches")
          .where("hospitalId", "==", doctorHospitalId)
          .where("status", "==", "active")
          .limit(1)
          .get()
        if (!branchesSnap.empty) {
          const firstBranch = branchesSnap.docs[0]
          effectiveBranchId = firstBranch.id
          effectiveBranchName = (firstBranch.data() as { name?: string })?.name || null
        }
      }
    }

    const docData: Record<string, unknown> = {
      patientId: String(appointmentData.patientId),
      patientName: String(appointmentData.patientName),
      patientEmail: safeValue(appointmentData.patientEmail, ""),
      patientPhone: safeValue(appointmentData.patientPhone, ""),
      doctorId,
      doctorName,
      doctorSpecialization,
      appointmentDate: String(appointmentData.appointmentDate),
      appointmentTime: normalizedAppointmentTime,
      status: safeValue(appointmentData.status, "confirmed"),
      paymentAmount: totalPaymentAmount,
      totalConsultationFee: consultationFee,
      additionalFees:
        additionalFeesArray.length > 0
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
      durationMinutes: typeof appointmentData.durationMinutes === "number" ? appointmentData.durationMinutes : 15,
      paymentStatus,
      remainingAmount,
      paidAt,
      transactionId: `DOC${Date.now()}`,
      createdAt: safeValue(appointmentData.createdAt, nowIso),
      updatedAt: nowIso,
      createdBy: "doctor",
      hospitalId: doctorHospitalId,
      branchId: effectiveBranchId,
      branchName: effectiveBranchName,
    }

    if (appointmentData.patientGender !== undefined) docData.patientGender = safeValue(appointmentData.patientGender, "")
    if (appointmentData.patientBloodGroup !== undefined) docData.patientBloodGroup = safeValue(appointmentData.patientBloodGroup, "")
    if (appointmentData.patientDateOfBirth !== undefined) docData.patientDateOfBirth = safeValue(appointmentData.patientDateOfBirth, "")
    if (appointmentData.patientAllergies !== undefined) docData.patientAllergies = safeValue(appointmentData.patientAllergies, "")
    if (appointmentData.patientCurrentMedications !== undefined)
      docData.patientCurrentMedications = safeValue(appointmentData.patientCurrentMedications, "")

    docData.chiefComplaint = safeValue(appointmentData.chiefComplaint, "General consultation")
    docData.medicalHistory = safeValue(appointmentData.medicalHistory, "")

    Object.keys(docData).forEach((key) => {
      if (docData[key] === undefined) delete docData[key]
    })

    const firestore = admin.firestore()
    const slotDocId = `${docData.doctorId}_${docData.appointmentDate}_${normalizedAppointmentTime}`.replace(/[:\s]/g, "-")
    appointmentId = null

    await firestore.runTransaction(async (transaction) => {
      const slotRef = firestore.collection("appointmentSlots").doc(slotDocId)
      const slotSnap = await transaction.get(slotRef)
      if (!slotOverbooking && slotSnap.exists) throw new Error("SLOT_ALREADY_BOOKED")

      const appointmentRef = firestore
        .collection(getHospitalCollectionPath(doctorHospitalId, "appointments"))
        .doc()
      appointmentId = appointmentRef.id
      transaction.set(appointmentRef, docData)
      if (!slotOverbooking || !slotSnap.exists) {
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
        // ignore
      }
    }

    if (patientPhone && patientPhone.trim() !== "") {
      try {
        await sendDoctorBookingWhatsApp(
          {
            ...appointmentData,
            ...docData,
            appointmentId,
            id: appointmentId,
            patientPhone,
            patientName: docData.patientName,
            doctorName: docData.doctorName,
            doctorSpecialization: docData.doctorSpecialization,
            appointmentDate: docData.appointmentDate,
            appointmentTime: docData.appointmentTime,
            chiefComplaint: docData.chiefComplaint,
          },
          isRecheck
            ? { payAtReception: true, amountDue: totalPaymentAmount }
            : undefined
        )
      } catch {
        // ignore
      }
    }

    return Response.json({ success: true, id: appointmentId })
  } catch (error: unknown) {
    const hospitalId = await getDoctorHospitalId(auth?.user?.uid || "").catch(() => null)
    logApiError(error, request, auth, {
      action: "doctor-create-appointment",
      hospitalId: hospitalId || undefined,
      appointmentId: appointmentId || undefined,
      patientId: appointmentData ? getString(appointmentData.patientId) : undefined,
      doctorId: auth?.user?.uid,
    }).catch(() => {})

    if (error instanceof Error && error.message === "SLOT_ALREADY_BOOKED") {
      return Response.json(
        { error: "This time slot has already been booked. Please select another slot." },
        { status: 409 }
      )
    }
    return await createErrorResponse(error, request, auth, {
      action: "doctor-create-appointment",
      hospitalId: hospitalId || undefined,
      appointmentId: appointmentId || undefined,
    })
  }
}
