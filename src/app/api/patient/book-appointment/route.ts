import { NextResponse } from "next/server"
import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { authenticateRequest, createAuthErrorResponse } from "@/utils/apiAuth"
import { normalizeTime } from "@/utils/timeSlots"
import { applyRateLimit } from "@/utils/rateLimit"
import { sendWhatsAppNotification } from "@/server/whatsapp"
import { getDoctorHospitalId, getAppointmentHospitalId, getHospitalCollectionPath } from "@/utils/serverHospitalQueries"
import { isDateBlocked } from "@/utils/blockedDates"
import { logApiError, createErrorResponse } from "@/utils/errorLogger"

const SLOT_COLLECTION = "appointmentSlots"

const getSlotDocId = (doctorId?: string, date?: string, time?: string) => {
  if (!doctorId || !date || !time) return null
  const normalizedTime = normalizeTime(time)
  return `${doctorId}_${date}_${normalizedTime}`.replace(/[:\s]/g, "-")
}

export async function POST(request: Request) {
  // Apply rate limiting first
  const rateLimitResult = await applyRateLimit(request, "BOOKING")
  if (rateLimitResult instanceof Response) {
    return rateLimitResult // Rate limited
  }

  // Authenticate request - requires patient role
  const auth = await authenticateRequest(request, "patient")
  if (!auth.success) {
    return createAuthErrorResponse(auth)
  }

  // Re-apply rate limit with user ID for better tracking
  const rateLimitWithUser = await applyRateLimit(request, "BOOKING", auth.user?.uid)
  if (rateLimitWithUser instanceof Response) {
    return rateLimitWithUser // Rate limited
  }

  const initResult = initFirebaseAdmin("patient-book-appointment")
  if (!initResult.ok) {
    return NextResponse.json({ error: "Server not configured for admin" }, { status: 500 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const mode = body?.mode || "create"
    const firestore = admin.firestore()

    if (mode === "create") {
      const appointmentData = body?.appointmentData
      if (!appointmentData) {
        return NextResponse.json({ error: "Missing appointment data" }, { status: 400 })
      }
      if (!appointmentData.doctorId || !appointmentData.appointmentDate || !appointmentData.appointmentTime) {
        return NextResponse.json({ error: "Missing doctor/time information" }, { status: 400 })
      }

      // Ensure patientUid matches authenticated user
      if (appointmentData.patientUid && appointmentData.patientUid !== auth.user?.uid) {
        return NextResponse.json({ error: "You can only book appointments for yourself" }, { status: 403 })
      }
      // Set patientUid from authenticated user
      appointmentData.patientUid = auth.user?.uid

      // Get doctor's hospital ID - appointment belongs to doctor's hospital
      const doctorHospitalId = await getDoctorHospitalId(appointmentData.doctorId)
      if (!doctorHospitalId) {
        return NextResponse.json({ error: "Doctor's hospital not found" }, { status: 400 })
      }

      // Validate blocked date on server side
      const doctorDoc = await firestore.collection("doctors").doc(appointmentData.doctorId).get()
      if (doctorDoc.exists) {
        const doctorData = doctorDoc.data()
        const blockedDates: any[] = Array.isArray(doctorData?.blockedDates) ? doctorData.blockedDates : []
        if (isDateBlocked(appointmentData.appointmentDate, blockedDates)) {
          return NextResponse.json({ error: "Doctor is not available on the selected date. Please choose another date." }, { status: 400 })
        }
      }

      // Normalize appointment time to 24-hour format for consistent storage
      const normalizedAppointmentTime = normalizeTime(appointmentData.appointmentTime)
      appointmentData.appointmentTime = normalizedAppointmentTime
      appointmentData.hospitalId = doctorHospitalId

      // Validate and set branch information
      if (appointmentData.branchId) {
        // Verify branch exists and belongs to the hospital
        const branchDoc = await firestore.collection("branches").doc(appointmentData.branchId).get()
        if (!branchDoc.exists) {
          return NextResponse.json({ error: "Branch not found" }, { status: 404 })
        }
        const branchData = branchDoc.data()
        if (branchData?.hospitalId !== doctorHospitalId) {
          return NextResponse.json({ error: "Branch does not belong to this hospital" }, { status: 400 })
        }
        if (branchData?.status !== "active") {
          return NextResponse.json({ error: "Branch is not active" }, { status: 400 })
        }
        // Set branch name for display
        appointmentData.branchName = branchData?.name || ""
      } else {
        // If no branchId provided, try to get patient's default branch
        try {
          const patientDoc = await firestore.collection("patients").doc(auth.user?.uid || "").get()
          if (patientDoc.exists) {
            const patientData = patientDoc.data()
            if (patientData?.defaultBranchId) {
              appointmentData.branchId = patientData.defaultBranchId
              appointmentData.branchName = patientData.defaultBranchName || ""
            }
          }
        } catch {
          // Continue without branch if patient lookup fails
        }
      }

      const slotId = getSlotDocId(appointmentData.doctorId, appointmentData.appointmentDate, normalizedAppointmentTime)
      if (!slotId) {
        return NextResponse.json({ error: "Invalid slot information" }, { status: 400 })
      }

      const nowIso = new Date().toISOString()
      appointmentData.createdAt = appointmentData.createdAt || nowIso
      appointmentData.updatedAt = nowIso
      appointmentData.createdBy = appointmentData.createdBy || "patient" // Mark as patient portal booking

      let appointmentId = ""

      await firestore.runTransaction(async (transaction) => {
        const slotRef = firestore.collection(SLOT_COLLECTION).doc(slotId)
        const slotSnap = await transaction.get(slotRef)
        if (slotSnap.exists) {
          throw new Error("SLOT_ALREADY_BOOKED")
        }

        // Create appointment in hospital-scoped subcollection
        const appointmentRef = firestore
          .collection(getHospitalCollectionPath(doctorHospitalId, "appointments"))
          .doc()
        appointmentId = appointmentRef.id
        transaction.set(appointmentRef, appointmentData)
        transaction.set(slotRef, {
          appointmentId,
          doctorId: appointmentData.doctorId,
          appointmentDate: appointmentData.appointmentDate,
          appointmentTime: normalizedAppointmentTime, // Always store in 24-hour format
          createdAt: nowIso,
          hospitalId: doctorHospitalId,
        })
      })

      // Send WhatsApp notification after successful appointment creation
      try {
        // Fetch patient data to get phone number if not in appointmentData
        let patientPhone = appointmentData.patientPhone || appointmentData.patientPhoneNumber || ""
        if (!patientPhone || patientPhone.trim() === "") {
          try {
            const patientDoc = await firestore.collection("patients").doc(auth.user?.uid || "").get()
            if (patientDoc.exists) {
              const patientData = patientDoc.data()
              patientPhone = patientData?.phone || patientData?.phoneNumber || patientData?.contact || patientData?.mobile || ""
            }
          } catch {
          }
        }

        if (patientPhone && patientPhone.trim() !== "") {
          // Use the same message format as receptionist booking
          const patientName = appointmentData.patientName || "there"
          const fullName = patientName.trim() || "Patient"
          const doctorName = appointmentData.doctorName || "our doctor"
          const doctorSpecialization = appointmentData.doctorSpecialization || ""
          const appointmentIdStr = appointmentId || "N/A"
          const paymentMethod = appointmentData.paymentMethod || "Cash"
          const paymentAmount = appointmentData.paymentAmount || appointmentData.totalConsultationFee || 0
          const paymentStatus = appointmentData.paymentStatus || "pending"
          
          const dateDisplay = new Date(appointmentData.appointmentDate + "T00:00:00").toLocaleDateString("en-IN", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })
          
          const timeStr = normalizedAppointmentTime || ""
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

Your appointment has been confirmed and booked successfully.

📋 *Appointment Details:*
• 👨‍⚕️ Doctor: ${doctorName}${doctorSpecialization ? ` (${doctorSpecialization})` : ""}
• 📅 Date: ${dateDisplay}
• 🕒 Time: ${timeDisplay}
• 📋 Appointment ID: ${appointmentIdStr}
${appointmentData.chiefComplaint ? `• 📝 Reason: ${appointmentData.chiefComplaint}` : ""}

💳 *Payment Information:*
• Method: ${paymentMethod}
• Amount: ₹${paymentAmount}
• Status: ${paymentStatus === "paid" ? "✅ Paid" : "⏳ Pending"}

✅ Your appointment is confirmed and visible in your patient dashboard.

If you need to reschedule or have any questions, reply here or call us at +91-XXXXXXXXXX.

See you soon! 🏥`
          const result = await sendWhatsAppNotification({
            to: patientPhone,
            message,
          })

          if (result.success) {
          } else {
          }
        } else {
        }
      } catch {
        // Don't fail the appointment booking if WhatsApp fails
      }

      return NextResponse.json({ success: true, id: appointmentId })
    }

    if (mode === "reschedule") {
      const appointmentId: string | undefined = body?.appointmentId
      const appointmentDate: string | undefined = body?.appointmentDate
      const appointmentTime: string | undefined = body?.appointmentTime

      if (!appointmentId || !appointmentDate || !appointmentTime) {
        return NextResponse.json({ error: "Missing reschedule parameters" }, { status: 400 })
      }

      // Normalize time to 24-hour format before transaction
      const normalizedNewTime = normalizeTime(appointmentTime)

      // Get hospital ID from appointment - try to find appointment across hospitals
      const appointmentHospitalId = await getAppointmentHospitalId(appointmentId)
      if (!appointmentHospitalId) {
        return NextResponse.json({ error: "Appointment hospital not found" }, { status: 404 })
      }

      // Validate blocked date for reschedule
      const appointmentDocRef = firestore
        .collection(getHospitalCollectionPath(appointmentHospitalId, "appointments"))
        .doc(appointmentId)
      const appointmentDoc = await appointmentDocRef.get()
      if (!appointmentDoc.exists) {
        return NextResponse.json({ error: "Appointment not found" }, { status: 404 })
      }
      const appointment = appointmentDoc.data()
      if (appointment?.doctorId) {
        const doctorDoc = await firestore.collection("doctors").doc(appointment.doctorId).get()
        if (doctorDoc.exists) {
          const doctorData = doctorDoc.data()
          const blockedDates: any[] = Array.isArray(doctorData?.blockedDates) ? doctorData.blockedDates : []
          if (isDateBlocked(appointmentDate, blockedDates)) {
            return NextResponse.json({ error: "Doctor is not available on the selected date. Please choose another date." }, { status: 400 })
          }
        }
      }

      await firestore.runTransaction(async (transaction) => {
        const appointmentRef = firestore
          .collection(getHospitalCollectionPath(appointmentHospitalId, "appointments"))
          .doc(appointmentId)
        const appointmentSnap = await transaction.get(appointmentRef)
        if (!appointmentSnap.exists) {
          throw new Error("APPOINTMENT_NOT_FOUND")
        }

        const appointment = appointmentSnap.data() as Record<string, any>
        // Verify patient can only reschedule their own appointments
        if (appointment.patientUid && appointment.patientUid !== auth.user?.uid) {
          throw new Error("UNAUTHORIZED")
        }

        const doctorId = appointment.doctorId
        const newSlotId = getSlotDocId(doctorId, appointmentDate, normalizedNewTime)
        if (!newSlotId) {
          throw new Error("INVALID_SLOT")
        }

        const newSlotRef = firestore.collection(SLOT_COLLECTION).doc(newSlotId)
        const newSlotSnap = await transaction.get(newSlotRef)
        if (newSlotSnap.exists) {
          throw new Error("SLOT_ALREADY_BOOKED")
        }

        // Normalize old time for comparison
        const normalizedOldTime = normalizeTime(appointment.appointmentTime || "")
        const oldSlotId = getSlotDocId(doctorId, appointment.appointmentDate, normalizedOldTime)
        if (oldSlotId) {
          const oldSlotRef = firestore.collection(SLOT_COLLECTION).doc(oldSlotId)
          transaction.delete(oldSlotRef)
        }

        transaction.update(appointmentRef, {
          appointmentDate,
          appointmentTime: normalizedNewTime, // Always store in 24-hour format
          updatedAt: new Date().toISOString(),
        })

        transaction.set(newSlotRef, {
          appointmentId,
          doctorId,
          appointmentDate,
          appointmentTime: normalizedNewTime, // Always store in 24-hour format
          createdAt: new Date().toISOString(),
          hospitalId: appointmentHospitalId,
        })
      })

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: "Invalid mode" }, { status: 400 })
  } catch (error) {
    const message = (error as Error).message
    
    // Log error with context
    logApiError(error, request, auth, {
      action: "book-appointment",
      hospitalId: (await getAppointmentHospitalId((error as { appointmentId?: string }).appointmentId || "").catch(() => null)) || undefined,
      appointmentId: (error as { appointmentId?: string }).appointmentId,
    })
    
    if (message === "SLOT_ALREADY_BOOKED") {
      return NextResponse.json({ error: "This slot was just booked. Please choose another time." }, { status: 409 })
    }
    if (message === "APPOINTMENT_NOT_FOUND") {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 })
    }
    if (message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "You cannot modify this appointment" }, { status: 403 })
    }
    return createErrorResponse(error, request, auth, { action: "book-appointment" })
  }
}

