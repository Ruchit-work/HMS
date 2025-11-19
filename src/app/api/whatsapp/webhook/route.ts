/**
 * WhatsApp Webhook Handler
 * Handles incoming WhatsApp messages, button clicks, and manages conversation flow
 * 
 * This endpoint receives webhooks from Twilio when:
 * - User sends a message
 * - User clicks an interactive button
 * - Message status updates occur
 */

import { NextResponse } from "next/server"
import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { sendWhatsAppNotification } from "@/server/whatsapp"
import { normalizeTime } from "@/utils/timeSlots"

// Helper: Get day name from date
const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
function getDayName(date: Date): string {
  return DAY_NAMES[date.getDay()]
}

// Booking conversation states
type BookingState = 
  | "initial"           // Just clicked "Book Appointment"
  | "doctor_selection"  // Selecting doctor
  | "date_selection"    // Selecting date
  | "time_selection"    // Selecting time
  | "confirming"        // Reviewing and confirming
  | "completed"         // Booking completed

interface BookingSession {
  phone: string
  patientId?: string
  state: BookingState
  selectedDoctorId?: string
  selectedDate?: string
  selectedTime?: string
  isRecheckup?: boolean
  recheckupAppointmentId?: string // Original appointment ID for re-checkup
  createdAt: Date
  updatedAt: Date
}

/**
 * POST /api/whatsapp/webhook
 * Receives webhooks from Twilio WhatsApp
 */
export async function POST(request: Request) {
  // Apply rate limiting (protect against spam)
  const { applyRateLimit } = await import("@/utils/rateLimit")
  const rateLimitResult = await applyRateLimit(request, "WEBHOOK")
  if (rateLimitResult instanceof Response) {
    return rateLimitResult // Rate limited
  }

  try {
    const initResult = initFirebaseAdmin("whatsapp-webhook API")
    if (!initResult.ok) {
      return NextResponse.json({ error: "Server not configured" }, { status: 500 })
    }

    const formData = await request.formData()
    const messageBody = formData.get("Body") as string
    const fromNumber = formData.get("From") as string
    const toNumber = formData.get("To") as string
    const messageSid = formData.get("MessageSid") as string
    
    // Handle interactive button clicks
    const buttonPayload = formData.get("ButtonPayload") as string
    const buttonText = formData.get("ButtonText") as string

    // Normalize phone number (remove whatsapp: prefix)
    const phone = fromNumber?.replace("whatsapp:", "") || ""
    
    if (!phone) {
      return NextResponse.json({ error: "Missing phone number" }, { status: 400 })
    }

    const db = admin.firestore()

    // Get or create booking session
    let session: BookingSession | null = null
    const sessionsRef = db.collection("whatsapp_booking_sessions")
    const existingSession = await sessionsRef
      .where("phone", "==", phone)
      .where("state", "!=", "completed")
      .orderBy("updatedAt", "desc")
      .limit(1)
      .get()

    if (!existingSession.empty) {
      const sessionDoc = existingSession.docs[0]
      session = { id: sessionDoc.id, ...sessionDoc.data() } as any
    }

    // Handle "Book Appointment" or "Schedule Appointment" button click / text
    const lowerMessage = messageBody?.toLowerCase().trim() || ""
    const lowerButtonText = buttonText?.toLowerCase().trim() || ""
    
    if (
      buttonText === "Book Appointment" || 
      buttonText === "Schedule Appointment" ||
      lowerMessage.includes("book appointment") ||
      lowerMessage.includes("schedule appointment") ||
      lowerMessage === "book" ||
      lowerMessage === "schedule"
    ) {
      // Check if this is a re-checkup request
      const isRecheckup = lowerMessage.includes("recheckup") || 
                         lowerMessage.includes("re-checkup") ||
                         lowerMessage.includes("follow up") ||
                         lowerMessage.includes("follow-up")
      
      return await handleBookingStart(db, phone, sessionsRef, session, isRecheckup)
    }

    // Handle conversation flow based on current state
    if (session) {
      switch (session.state) {
        case "doctor_selection":
          return await handleDoctorSelection(db, phone, messageBody, sessionsRef, session)
        case "date_selection":
          return await handleDateSelection(db, phone, messageBody, sessionsRef, session)
        case "time_selection":
          return await handleTimeSelection(db, phone, messageBody, sessionsRef, session)
        case "confirming":
          return await handleConfirmation(db, phone, messageBody, sessionsRef, session)
        default:
          return await sendWelcomeMessage(phone)
      }
    }

    // Default: Send welcome message
    return await sendWelcomeMessage(phone)

  } catch (error: any) {
    console.error("[whatsapp-webhook] Error:", error)
    return NextResponse.json(
      { error: error?.message || "Webhook processing failed" },
      { status: 500 }
    )
  }
}

/**
 * Handle booking start - show patient info and doctor list
 */
async function handleBookingStart(
  db: admin.firestore.Firestore,
  phone: string,
  sessionsRef: admin.firestore.CollectionReference,
  existingSession: BookingSession | null,
  isRecheckup: boolean = false
) {
  // Find patient by phone (try multiple fields)
  let patientsSnapshot = await db.collection("patients")
    .where("phone", "==", phone)
    .limit(1)
    .get()

  if (patientsSnapshot.empty) {
    patientsSnapshot = await db.collection("patients")
      .where("phoneNumber", "==", phone)
      .limit(1)
      .get()
  }

  if (patientsSnapshot.empty) {
    patientsSnapshot = await db.collection("patients")
      .where("contact", "==", phone)
      .limit(1)
      .get()
  }

  let patientId: string | undefined
  let patientName = "Patient"
  let patientData: any = null

  if (!patientsSnapshot.empty) {
    patientData = patientsSnapshot.docs[0].data()
    patientId = patientsSnapshot.docs[0].id
    patientName = `${patientData.firstName || ""} ${patientData.lastName || ""}`.trim() || "Patient"
  }

  // Get active doctors
  const doctorsSnapshot = await db.collection("doctors")
    .where("status", "==", "active")
    .get()

  const doctors = doctorsSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }))

  if (doctors.length === 0) {
    await sendWhatsAppNotification({
      to: phone,
      message: "Sorry, no doctors are currently available. Please try again later.",
    })
    return NextResponse.json({ success: true })
  }

  // If re-checkup, try to find the original appointment and doctor
  let recheckupAppointmentId: string | undefined
  let suggestedDoctorId: string | undefined
  
  if (isRecheckup && patientId) {
    try {
      // Find the most recent re-checkup request for this patient
      const recheckupQuery = db.collection("recheckup_requests")
        .where("patientId", "==", patientId)
        .where("status", "==", "pending")
        .orderBy("sentAt", "desc")
        .limit(1)
      
      const recheckupSnapshot = await recheckupQuery.get()
      if (!recheckupSnapshot.empty) {
        const recheckupData = recheckupSnapshot.docs[0].data()
        recheckupAppointmentId = recheckupData.appointmentId
        
        // Get original appointment to find the doctor
        if (recheckupAppointmentId) {
          const originalAppt = await db.collection("appointments").doc(recheckupAppointmentId).get()
          if (originalAppt.exists) {
            const originalData = originalAppt.data()
            suggestedDoctorId = originalData?.doctorId
          }
        }
      }
    } catch (error) {
      console.error("[whatsapp-webhook] Error finding re-checkup info:", error)
      // If orderBy fails due to missing index, try without it
      try {
        const recheckupQuery = db.collection("recheckup_requests")
          .where("patientId", "==", patientId)
          .where("status", "==", "pending")
          .limit(1)
        
        const recheckupSnapshot = await recheckupQuery.get()
        if (!recheckupSnapshot.empty) {
          const recheckupData = recheckupSnapshot.docs[0].data()
          recheckupAppointmentId = recheckupData.appointmentId
          
          if (recheckupAppointmentId) {
            const originalAppt = await db.collection("appointments").doc(recheckupAppointmentId).get()
            if (originalAppt.exists) {
              const originalData = originalAppt.data()
              suggestedDoctorId = originalData?.doctorId
            }
          }
        }
      } catch (err) {
        console.error("[whatsapp-webhook] Error finding re-checkup info (fallback):", err)
      }
    }
  }

  // Create or update session
  const sessionData: Partial<BookingSession> = {
    phone,
    patientId,
    state: "doctor_selection",
    isRecheckup: isRecheckup || Boolean(recheckupAppointmentId),
    recheckupAppointmentId,
    createdAt: existingSession?.createdAt || new Date(),
    updatedAt: new Date(),
  }
  
  // Format message - different for re-checkup vs new appointment
  let message = `Hi ${patientName}! 👋\n\n`
  let dateListSent = false
  
  // If re-checkup and we have a suggested doctor, pre-select it and show dates
  if ((isRecheckup || recheckupAppointmentId) && suggestedDoctorId) {
    const suggestedDoctor = doctors.find((d: any) => d.id === suggestedDoctorId)
    if (suggestedDoctor) {
      const doctorName = `${(suggestedDoctor as any).firstName || ""} ${(suggestedDoctor as any).lastName || ""}`.trim()
      const doctorSpec = (suggestedDoctor as any).specialization || "General"
      
      message += `🔄 *Re-checkup Appointment*\n\n`
      message += `I see you're scheduling a follow-up appointment.`
      
      // Skip to date selection with pre-selected doctor
      sessionData.selectedDoctorId = suggestedDoctorId
      sessionData.state = "date_selection"
      
      // Generate and send date list directly
      const today = new Date()
      const availableDates: Array<{ date: string; display: string }> = []
      
      for (let i = 0; i < 14; i++) {
        const date = new Date(today)
        date.setDate(date.getDate() + i)
        const dayName = getDayName(date)
        const visitingHours = (suggestedDoctor as any).visitingHours || {}
        const daySchedule = visitingHours[dayName] || { isAvailable: false }
        
        if (daySchedule.isAvailable) {
          const dateStr = date.toISOString().split("T")[0]
          const display = date.toLocaleDateString("en-IN", {
            weekday: "short",
            month: "short",
            day: "numeric",
          })
          availableDates.push({ date: dateStr, display })
          if (availableDates.length >= 7) break
        }
      }

      if (availableDates.length > 0) {
        let dateListMsg = `📅 *Select a Date for Re-checkup with Dr. ${doctorName}:*\n\n`
        availableDates.forEach((dateOption, index) => {
          dateListMsg += `${index + 1}. ${dateOption.display}\n`
        })
        dateListMsg += "\nPlease reply with the number (1-7) to select a date."

        await sendWhatsAppNotification({
          to: phone,
          message: message + `\n${dateListMsg}`,
        })
        
        dateListSent = true
      } else {
        // No available dates, show doctor list instead
        message += `Your previous doctor *Dr. ${doctorName}* (${doctorSpec}) is not available soon. Please select another doctor:\n\n`
        sessionData.state = "doctor_selection" // Reset to doctor selection
      }
    }
  } else if (isRecheckup || recheckupAppointmentId) {
    // Re-checkup but no suggested doctor found
    message += `🔄 *Re-checkup Appointment*\n\n`
    message += `I see you're scheduling a follow-up appointment.`
  }
  
  // Update session in Firestore
  if (existingSession) {
    await sessionsRef.doc((existingSession as any).id).update(sessionData)
  } else {
    await sessionsRef.add(sessionData)
  }
  
  // If not already sent a date list, show doctor list
  if (!dateListSent) {
    let doctorList = "👨‍⚕️ *Select a Doctor:*\n\n"
    doctors.slice(0, 10).forEach((doctor: any, index) => {
      const name = `${doctor.firstName || ""} ${doctor.lastName || ""}`.trim()
      const spec = doctor.specialization || "General"
      doctorList += `${index + 1}. *${name}*\n   ${spec}\n\n`
    })

    doctorList += "Please reply with the number (1-10) to select a doctor."

    await sendWhatsAppNotification({
      to: phone,
      message: message + doctorList,
    })
  }

  return NextResponse.json({ success: true })
}

/**
 * Handle doctor selection - show date options
 */
async function handleDoctorSelection(
  db: admin.firestore.Firestore,
  phone: string,
  messageBody: string,
  sessionsRef: admin.firestore.CollectionReference,
  session: BookingSession
) {
  // Parse doctor selection (number 1-10)
  const doctorNumber = parseInt(messageBody.trim())
  
  if (isNaN(doctorNumber) || doctorNumber < 1 || doctorNumber > 10) {
    await sendWhatsAppNotification({
      to: phone,
      message: "Invalid selection. Please reply with a number between 1-10.",
    })
    return NextResponse.json({ success: true })
  }

  // Get doctors list
  const doctorsSnapshot = await db.collection("doctors")
    .where("status", "==", "active")
    .get()

  const doctors = doctorsSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }))

  if (doctorNumber > doctors.length) {
    await sendWhatsAppNotification({
      to: phone,
      message: "Invalid selection. Please choose a valid number.",
    })
    return NextResponse.json({ success: true })
  }

  const selectedDoctor = doctors[doctorNumber - 1]
  const selectedDoctorId = selectedDoctor.id

  // Update session
  await sessionsRef.doc((session as any).id).update({
    selectedDoctorId,
    state: "date_selection",
    updatedAt: new Date(),
  })

  // Generate next 7 available dates
  const today = new Date()
  const availableDates: Array<{ date: string; display: string }> = []
  
  for (let i = 0; i < 14; i++) {
    const date = new Date(today)
    date.setDate(date.getDate() + i)
    
    // Skip if doctor is not available on this day (simplified check)
    const dayName = getDayName(date)
    const visitingHours = (selectedDoctor as any).visitingHours || {}
    const daySchedule = visitingHours[dayName] || { isAvailable: false }
    
    if (daySchedule.isAvailable) {
      const dateStr = date.toISOString().split("T")[0]
      const display = date.toLocaleDateString("en-IN", {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
      availableDates.push({ date: dateStr, display })
      
      if (availableDates.length >= 7) break
    }
  }

  if (availableDates.length === 0) {
    await sendWhatsAppNotification({
      to: phone,
      message: "Sorry, no available dates found for this doctor. Please try another doctor.",
    })
    return NextResponse.json({ success: true })
  }

  const doctorName = `${(selectedDoctor as any).firstName || ""} ${(selectedDoctor as any).lastName || ""}`.trim()
  
  let dateList = `📅 *Select a Date for Dr. ${doctorName}:*\n\n`
  availableDates.forEach((dateOption, index) => {
    dateList += `${index + 1}. ${dateOption.display}\n`
  })
  dateList += "\nPlease reply with the number (1-7) to select a date."

  await sendWhatsAppNotification({
    to: phone,
    message: dateList,
  })

  return NextResponse.json({ success: true })
}

/**
 * Handle date selection - show time slots
 */
async function handleDateSelection(
  db: admin.firestore.Firestore,
  phone: string,
  messageBody: string,
  sessionsRef: admin.firestore.CollectionReference,
  session: BookingSession
) {
  // Parse date selection (number 1-7)
  const dateNumber = parseInt(messageBody.trim())
  
  if (isNaN(dateNumber) || dateNumber < 1 || dateNumber > 7) {
    await sendWhatsAppNotification({
      to: phone,
      message: "Invalid selection. Please reply with a number between 1-7.",
    })
    return NextResponse.json({ success: true })
  }

  // Generate available dates (same logic as above)
  const today = new Date()
  const availableDates: Array<{ date: string; display: string }> = []
  
  const doctorsSnapshot = await db.collection("doctors")
    .where("status", "==", "active")
    .get()
  
  const doctor = doctorsSnapshot.docs.find(d => d.id === session.selectedDoctorId)
  if (!doctor) {
    await sendWhatsAppNotification({
      to: phone,
      message: "Doctor not found. Please start over.",
    })
    return NextResponse.json({ success: true })
  }

  const doctorData = { id: doctor.id, ...doctor.data() }

  for (let i = 0; i < 14; i++) {
    const date = new Date(today)
    date.setDate(date.getDate() + i)
    const dayName = getDayName(date)
    const visitingHours = (doctorData as any).visitingHours || {}
    const daySchedule = visitingHours[dayName] || { isAvailable: false }
    
    if (daySchedule.isAvailable) {
      const dateStr = date.toISOString().split("T")[0]
      const display = date.toLocaleDateString("en-IN", {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
      availableDates.push({ date: dateStr, display })
      if (availableDates.length >= 7) break
    }
  }

  if (dateNumber > availableDates.length) {
    await sendWhatsAppNotification({
      to: phone,
      message: "Invalid selection. Please choose a valid number.",
    })
    return NextResponse.json({ success: true })
  }

  const selectedDate = availableDates[dateNumber - 1].date

  // Get available time slots for this doctor and date
  const appointmentsSnapshot = await db.collection("appointments")
    .where("doctorId", "==", session.selectedDoctorId)
    .where("appointmentDate", "==", selectedDate)
    .where("status", "==", "confirmed")
    .get()

  const bookedSlots = appointmentsSnapshot.docs.map(doc => doc.data().appointmentTime)

  // Generate time slots from doctor's visiting hours
  const dateObj = new Date(selectedDate + "T00:00:00")
  const dayName = getDayName(dateObj)
  const visitingHours = (doctorData as any).visitingHours || {}
  const daySchedule = visitingHours[dayName] || { slots: [] }

  let allSlots: string[] = []
  if (daySchedule.slots && daySchedule.slots.length > 0) {
      daySchedule.slots.forEach((slot: any) => {
        const start = slot.start || "09:00"
        const end = slot.end || "17:00"
        
        // Generate 15-minute slots
        const [startH, startM] = start.split(":").map(Number)
        const [endH, endM] = end.split(":").map(Number)
        
        let currentMin = startM
        for (let hour = startH; hour < endH || (hour === endH && currentMin < endM); hour++) {
          for (let min = currentMin; min < 60; min += 15) {
            if (hour === endH && min >= endM) break
            const slotTime = `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`
            if (!bookedSlots.includes(slotTime)) {
              allSlots.push(slotTime)
            }
          }
          currentMin = 0
        }
      })
  }

  // Filter out past slots
  const now = new Date()
  const selectedDateTime = new Date(selectedDate + "T00:00:00")
  allSlots = allSlots.filter(slot => {
    const [hours, minutes] = slot.split(":").map(Number)
    const slotDateTime = new Date(selectedDateTime)
    slotDateTime.setHours(hours, minutes, 0, 0)
    return slotDateTime > now
  })

  if (allSlots.length === 0) {
    await sendWhatsAppNotification({
      to: phone,
      message: "Sorry, no available time slots found for this date. Please select another date.",
    })
    return NextResponse.json({ success: true })
  }

  // Update session
  await sessionsRef.doc((session as any).id).update({
    selectedDate,
    state: "time_selection",
    updatedAt: new Date(),
  })

  // Format time slots (show first 10)
  const displaySlots = allSlots.slice(0, 10)
  let timeList = `🕐 *Select a Time Slot:*\n\n`
  displaySlots.forEach((slot, index) => {
    const [hours, minutes] = slot.split(":").map(Number)
    const displayTime = new Date(2000, 0, 1, hours, minutes).toLocaleTimeString("en-IN", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    timeList += `${index + 1}. ${displayTime}\n`
  })
  timeList += "\nPlease reply with the number (1-10) to select a time."

  await sendWhatsAppNotification({
    to: phone,
    message: timeList,
  })

  return NextResponse.json({ success: true })
}

/**
 * Handle time selection - show confirmation
 */
async function handleTimeSelection(
  db: admin.firestore.Firestore,
  phone: string,
  messageBody: string,
  sessionsRef: admin.firestore.CollectionReference,
  session: BookingSession
) {
  // Parse time selection (number 1-10)
  const timeNumber = parseInt(messageBody.trim())
  
  if (isNaN(timeNumber) || timeNumber < 1 || timeNumber > 10) {
    await sendWhatsAppNotification({
      to: phone,
      message: "Invalid selection. Please reply with a number between 1-10.",
    })
    return NextResponse.json({ success: true })
  }

  // Get doctor data
  const doctorDoc = await db.collection("doctors").doc(session.selectedDoctorId!).get()
  if (!doctorDoc.exists) {
    await sendWhatsAppNotification({
      to: phone,
      message: "Doctor not found. Please start over.",
    })
    return NextResponse.json({ success: true })
  }

  const doctorData = doctorDoc.data()!

  // Get available slots again (same logic as date selection)
  const appointmentsSnapshot = await db.collection("appointments")
    .where("doctorId", "==", session.selectedDoctorId)
    .where("appointmentDate", "==", session.selectedDate)
    .where("status", "==", "confirmed")
    .get()

  const bookedSlots = appointmentsSnapshot.docs.map(doc => doc.data().appointmentTime)

  const dateObj = new Date(session.selectedDate! + "T00:00:00")
  const dayName = getDayName(dateObj)
  const visitingHours = (doctorData as any).visitingHours || {}
  const daySchedule = visitingHours[dayName] || { slots: [] }

  let allSlots: string[] = []
  if (daySchedule.slots && daySchedule.slots.length > 0) {
    daySchedule.slots.forEach((slot: any) => {
      const start = slot.start || "09:00"
      const end = slot.end || "17:00"
      const [startH, startM] = start.split(":").map(Number)
      const [endH, endM] = end.split(":").map(Number)
      
      let currentMin = startM
      for (let hour = startH; hour < endH || (hour === endH && currentMin < endM); hour++) {
        for (let min = currentMin; min < 60; min += 15) {
          if (hour === endH && min >= endM) break
          const slotTime = `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`
          if (!bookedSlots.includes(slotTime)) {
            allSlots.push(slotTime)
          }
        }
        currentMin = 0
      }
    })
  }

  const now = new Date()
  const selectedDateTime = new Date(session.selectedDate! + "T00:00:00")
  allSlots = allSlots.filter(slot => {
    const [hours, minutes] = slot.split(":").map(Number)
    const slotDateTime = new Date(selectedDateTime)
    slotDateTime.setHours(hours, minutes, 0, 0)
    return slotDateTime > now
  })

  if (timeNumber > allSlots.length) {
    await sendWhatsAppNotification({
      to: phone,
      message: "Invalid selection. Please choose a valid number.",
    })
    return NextResponse.json({ success: true })
  }

  const selectedTime = allSlots[timeNumber - 1]

  // Update session
  await sessionsRef.doc((session as any).id).update({
    selectedTime,
    state: "confirming",
    updatedAt: new Date(),
  })

  // Format confirmation message
  const doctorName = `${doctorData.firstName || ""} ${doctorData.lastName || ""}`.trim()
  const dateDisplay = new Date(session.selectedDate! + "T00:00:00").toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })
  const [hours, minutes] = selectedTime.split(":").map(Number)
  const timeDisplay = new Date(2000, 0, 1, hours, minutes).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })

  const confirmationMessage = `✅ *Confirm Appointment:*\n\n` +
    `👨‍⚕️ Doctor: ${doctorName}\n` +
    `📅 Date: ${dateDisplay}\n` +
    `🕐 Time: ${timeDisplay}\n\n` +
    `Reply "YES" to confirm or "NO" to cancel.`

  await sendWhatsAppNotification({
    to: phone,
    message: confirmationMessage,
  })

  return NextResponse.json({ success: true })
}

/**
 * Handle confirmation - create appointment
 */
async function handleConfirmation(
  db: admin.firestore.Firestore,
  phone: string,
  messageBody: string,
  sessionsRef: admin.firestore.CollectionReference,
  session: BookingSession
) {
  const response = messageBody?.toLowerCase().trim()

  if (response === "no" || response === "cancel") {
    await sessionsRef.doc((session as any).id).update({
      state: "completed",
      updatedAt: new Date(),
    })

    await sendWhatsAppNotification({
      to: phone,
      message: "Appointment booking cancelled. You can start over anytime by sending 'Book Appointment'.",
    })
    return NextResponse.json({ success: true })
  }

  if (response !== "yes" && response !== "confirm") {
    await sendWhatsAppNotification({
      to: phone,
      message: 'Please reply "YES" to confirm or "NO" to cancel.',
    })
    return NextResponse.json({ success: true })
  }

  // Get patient data
  let patientData: any = null
  if (session.patientId) {
    const patientDoc = await db.collection("patients").doc(session.patientId).get()
    if (patientDoc.exists) {
      patientData = patientDoc.data()
    }
  }

  if (!patientData) {
    // Try to find patient by phone (try multiple fields)
    let patientsSnapshot = await db.collection("patients")
      .where("phone", "==", phone)
      .limit(1)
      .get()

    if (patientsSnapshot.empty) {
      patientsSnapshot = await db.collection("patients")
        .where("phoneNumber", "==", phone)
        .limit(1)
        .get()
    }

    if (patientsSnapshot.empty) {
      patientsSnapshot = await db.collection("patients")
        .where("contact", "==", phone)
        .limit(1)
        .get()
    }

    if (!patientsSnapshot.empty) {
      patientData = patientsSnapshot.docs[0].data()
      session.patientId = patientsSnapshot.docs[0].id
    }
  }

  if (!patientData) {
    await sendWhatsAppNotification({
      to: phone,
      message: "Patient record not found. Please contact reception to register first.",
    })
    return NextResponse.json({ success: true })
  }

  // Get doctor data
  const doctorDoc = await db.collection("doctors").doc(session.selectedDoctorId!).get()
  if (!doctorDoc.exists) {
    await sendWhatsAppNotification({
      to: phone,
      message: "Doctor not found. Please start over.",
    })
    return NextResponse.json({ success: true })
  }

  const doctorData = doctorDoc.data()!

  // Normalize appointment time to 24-hour format for consistent storage
  const normalizedAppointmentTime = normalizeTime(session.selectedTime!)

  // Create appointment
  const appointmentData = {
    patientId: session.patientId,
    patientUid: session.patientId,
    patientName: `${patientData.firstName || ""} ${patientData.lastName || ""}`.trim(),
    patientEmail: patientData.email || "",
    patientPhone: phone,
    doctorId: session.selectedDoctorId,
    doctorName: `${doctorData.firstName || ""} ${doctorData.lastName || ""}`.trim(),
    doctorSpecialization: doctorData.specialization || "",
    appointmentDate: session.selectedDate,
    appointmentTime: normalizedAppointmentTime, // Always store in 24-hour format
    status: "confirmed",
    chiefComplaint: "General consultation",
    medicalHistory: "",
    paymentAmount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: "whatsapp",
  }
  // Use normalized time for slot document ID
  const slotDocId = `${session.selectedDoctorId}_${session.selectedDate}_${normalizedAppointmentTime}`.replace(/[:\s]/g, "-")
  let appointmentId = ""

  try {
    await db.runTransaction(async (transaction) => {
      const slotRef = db.collection("appointmentSlots").doc(slotDocId)
      const slotSnap = await transaction.get(slotRef)
      if (slotSnap.exists) {
        throw new Error("SLOT_ALREADY_BOOKED")
      }

      const appointmentRef = db.collection("appointments").doc()
      appointmentId = appointmentRef.id

      transaction.set(appointmentRef, appointmentData)
      transaction.set(slotRef, {
        appointmentId,
        doctorId: session.selectedDoctorId,
        appointmentDate: session.selectedDate,
        appointmentTime: normalizedAppointmentTime, // Always store in 24-hour format
        createdAt: new Date().toISOString(),
      })
    })
  } catch (error) {
    if ((error as Error).message === "SLOT_ALREADY_BOOKED") {
      await sendWhatsAppNotification({
        to: phone,
        message: "That slot was just booked by another patient. Please pick a different time slot.",
      })
      return NextResponse.json({ success: true })
    }
    throw error
  }

  // Update session
  await sessionsRef.doc((session as any).id).update({
    state: "completed",
    updatedAt: new Date(),
  })

  // Send confirmation message
  const doctorName = `${doctorData.firstName || ""} ${doctorData.lastName || ""}`.trim()
  const patientName = `${patientData.firstName || ""} ${patientData.lastName || ""}`.trim()
  const dateDisplay = new Date(session.selectedDate! + "T00:00:00").toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })
  const [hours, minutes] = session.selectedTime!.split(":").map(Number)
  const timeDisplay = new Date(2000, 0, 1, hours, minutes).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })

  const successMessage = `🎉 *Appointment Confirmed!*\n\n` +
    `Hi ${patientName},\n\n` +
    `Your appointment has been successfully booked:\n\n` +
    `👨‍⚕️ Doctor: ${doctorName}\n` +
    `📅 Date: ${dateDisplay}\n` +
    `🕐 Time: ${timeDisplay}\n` +
    `📋 Appointment ID: ${appointmentId}\n\n` +
    `We'll send you a reminder before your appointment. See you soon! 🏥`

  await sendWhatsAppNotification({
    to: phone,
    message: successMessage,
  })

  return NextResponse.json({ success: true, appointmentId })
}

/**
 * Send welcome message
 */
async function sendWelcomeMessage(phone: string) {
  const message = `👋 *Welcome to Harmony Medical Services!*\n\n` +
    `I can help you book an appointment. Type "Book Appointment" to get started.`

  await sendWhatsAppNotification({
    to: phone,
    message,
  })

  return NextResponse.json({ success: true })
}
