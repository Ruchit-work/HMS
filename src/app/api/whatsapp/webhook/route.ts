/**
 * Meta WhatsApp Webhook Handler
 * Receives incoming messages from Meta WhatsApp and sends automated responses
 * 
 * Webhook URL: https://yourdomain.com/api/whatsapp/webhook
 * 
 * Setup in Meta Business Manager:
 * 1. Go to WhatsApp → Configuration → Webhook
 * 2. Set Callback URL: https://yourdomain.com/api/whatsapp/webhook
 * 3. Set Verify Token: (same as META_WHATSAPP_VERIFY_TOKEN in .env)
 */

import { NextResponse } from "next/server"
import { sendTextMessage, sendFlowMessage } from "@/server/metaWhatsApp"
import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { normalizeTime } from "@/utils/timeSlots"

const VERIFY_TOKEN = process.env.META_WHATSAPP_VERIFY_TOKEN || "harmony_verify_token_97431d8b"

// Booking conversation states
type BookingState = 
  | "idle"
  | "selecting_doctor"
  | "selecting_date"
  | "selecting_time"
  | "confirming"

interface BookingSession {
  phone: string
  state: BookingState
  selectedDoctorId?: string
  selectedDate?: string
  selectedTime?: string
  createdAt: Date
  updatedAt: Date
}

/**
 * GET - Webhook verification (required by Meta)
 * Meta sends a GET request to verify the webhook
 */
export async function GET(request: Request) {
  try {
  const { searchParams } = new URL(request.url)

  const mode = searchParams.get("hub.mode")
  const token = searchParams.get("hub.verify_token")
  const challenge = searchParams.get("hub.challenge")

    console.log("[Meta WhatsApp] Webhook verification attempt:", {
      mode,
      tokenReceived: token ? "***" + token.slice(-4) : "none",
      tokenExpected: VERIFY_TOKEN ? "***" + VERIFY_TOKEN.slice(-4) : "none",
    })

    // Verify the webhook
  if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("[Meta WhatsApp] ✅ Webhook verified successfully")
      // Return the challenge as plain text (not JSON)
      return new NextResponse(challenge || "", {
        status: 200,
        headers: {
          "Content-Type": "text/plain",
        },
      })
    }

    // Log why verification failed
    if (mode !== "subscribe") {
      console.error("[Meta WhatsApp] ❌ Invalid mode:", mode)
    }
    if (token !== VERIFY_TOKEN) {
      console.error("[Meta WhatsApp] ❌ Token mismatch")
    }

    return new NextResponse("Forbidden", { status: 403 })
  } catch (error: any) {
    console.error("[Meta WhatsApp] Verification error:", error)
    return new NextResponse("Internal Server Error", { status: 500 })
  }
}

/**
 * POST - Receive incoming messages
 * Meta sends POST requests when users send messages
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    // Meta sends webhook data in this format
    const entry = body.entry?.[0]
    const changes = entry?.changes?.[0]
    const value = changes?.value

    // Initialize Firebase Admin
    const initResult = initFirebaseAdmin("whatsapp-webhook")
    if (!initResult.ok) {
      console.error("[Meta WhatsApp] Firebase Admin initialization failed")
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
    }

    // Handle status updates (message delivered, read, etc.)
    if (value?.statuses) {
      console.log("[Meta WhatsApp] Status update:", value.statuses)
      return NextResponse.json({ success: true })
    }

    // Handle Flow completion (when user completes the Flow form)
    if (value?.messages?.[0]?.type === "flow") {
      return await handleFlowCompletion(value)
    }

    // Handle incoming messages
    if (value?.messages?.[0]) {
      const message = value.messages[0]
      const from = message.from // Phone number (without +)
      const messageId = message.id
      const messageType = message.type
      const text = message.text?.body || ""

      console.log("[Meta WhatsApp] Received message:", {
        from,
        messageId,
        type: messageType,
        text,
        timestamp: new Date().toISOString(),
      })

      // Only process text messages for now
      if (messageType === "text" && text) {
        // Handle booking conversation flow
        const responseMessage = await handleBookingConversation(from, text)

        // Send automated response back to the user
        const result = await sendTextMessage(from, responseMessage)

        if (!result.success) {
          console.error("[Meta WhatsApp] Failed to send response:", result.error)
          return NextResponse.json(
            { error: "Failed to send response", details: result.error },
            { status: 500 }
          )
        }

        console.log("[Meta WhatsApp] ✅ Response sent successfully:", {
          to: from,
          messageId: result.messageId,
        })

        return NextResponse.json({
          success: true,
          message: "Message received and response sent",
          responseMessageId: result.messageId,
        })
      }

      // For non-text messages, just acknowledge
      return NextResponse.json({
        success: true,
        message: "Message received (non-text, no response sent)",
      })
    }

    // No action needed
    return NextResponse.json({ success: true, message: "No action needed" })
  } catch (error: any) {
    console.error("[Meta WhatsApp Webhook] Error:", error)
    return NextResponse.json(
      { error: "Webhook processing failed", details: error.message },
      { status: 500 }
    )
  }
}

/**
 * Handle booking conversation flow with state management
 */
async function handleBookingConversation(phone: string, message: string): Promise<string> {
  const db = admin.firestore()
  const normalizedMessage = message.toLowerCase().trim()

  // Get or create booking session
  const sessionRef = db.collection("whatsappBookingSessions").doc(phone)
  const sessionDoc = await sessionRef.get()
  const session: BookingSession = sessionDoc.exists
    ? { ...sessionDoc.data() as BookingSession, phone }
    : {
        phone,
        state: "idle",
        createdAt: new Date(),
        updatedAt: new Date(),
      }

  // Handle cancel/restart commands
  if (normalizedMessage === "cancel" || normalizedMessage === "restart" || normalizedMessage === "start over") {
    await sessionRef.delete()
    return "✅ Booking cancelled. How can I help you today?\n\nType 'Book' to start a new appointment booking."
  }

  // Handle booking flow based on state
  switch (session.state) {
    case "idle":
      // Check if user wants to book
      if (normalizedMessage.includes("book") || normalizedMessage.includes("appointment")) {
        return await startBookingFlow(db, sessionRef, phone)
      }
      // Fall through to general responses
      break

    case "selecting_doctor":
      return await handleDoctorSelection(db, sessionRef, phone, message, session)

    case "selecting_date":
      return await handleDateSelection(db, sessionRef, phone, message, session)

    case "selecting_time":
      return await handleTimeSelection(db, sessionRef, phone, message, session)

    case "confirming":
      if (normalizedMessage === "yes" || normalizedMessage === "confirm" || normalizedMessage === "y") {
        return await confirmAppointment(db, sessionRef, phone, session)
      } else if (normalizedMessage === "no" || normalizedMessage === "cancel" || normalizedMessage === "n") {
        await sessionRef.delete()
        return "❌ Appointment booking cancelled. Type 'Book' to start again."
      } else {
        return "Please reply with 'Yes' to confirm or 'No' to cancel."
      }
  }

  // General responses when not in booking flow
  return generateGeneralResponse(normalizedMessage)
}

/**
 * Start booking flow - send WhatsApp Flow
 */
async function startBookingFlow(
  db: FirebaseFirestore.Firestore,
  sessionRef: FirebaseFirestore.DocumentReference,
  phone: string
): Promise<string> {
  try {
    const flowId = process.env.META_WHATSAPP_FLOW_ID
    if (!flowId) {
      // Fallback to text-based flow if Flow ID not configured
      return await startTextBookingFlow(db, sessionRef, phone)
    }

    // Generate flow token
    const flowToken = `token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Send Flow message
    const result = await sendFlowMessage(
      phone,
      flowId,
      flowToken,
      "Book Your Appointment",
      "Fill out the form below to schedule your appointment with our doctors.",
      "Harmony Medical Services"
    )

    if (!result.success) {
      console.error("[Meta WhatsApp] Failed to send Flow:", result.error)
      // Fallback to text-based flow
      return await startTextBookingFlow(db, sessionRef, phone)
    }

    // Store flow token in session for later reference
    await sessionRef.set({
      phone,
      state: "idle", // Flow handles its own state
      flowToken,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    return "" // Flow message sent, no text response needed
  } catch (error: any) {
    console.error("[Meta WhatsApp] Error starting booking flow:", error)
    // Fallback to text-based flow
    return await startTextBookingFlow(db, sessionRef, phone)
  }
}

/**
 * Fallback: Start text-based booking flow
 */
async function startTextBookingFlow(
  db: FirebaseFirestore.Firestore,
  sessionRef: FirebaseFirestore.DocumentReference,
  phone: string
): Promise<string> {
  try {
    // Fetch active doctors
    const doctorsSnapshot = await db
      .collection("doctors")
      .where("status", "==", "active")
      .limit(10)
      .get()

    if (doctorsSnapshot.empty) {
      return "❌ No doctors available at the moment. Please contact reception at +91-XXXXXXXXXX"
    }

    const doctors = doctorsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }))

    // Update session state
    await sessionRef.set({
      phone,
      state: "selecting_doctor",
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    // Format doctors list
    let doctorsList = "👨‍⚕️ *Available Doctors:*\n\n"
    doctors.forEach((doctor: any, index: number) => {
      const name = `${doctor.firstName || ""} ${doctor.lastName || ""}`.trim()
      const specialization = doctor.specialization || "General"
      doctorsList += `${index + 1}. *${name}* - ${specialization}\n`
    })
    doctorsList += `\nPlease reply with the *doctor number* (1-${doctors.length}) or *doctor name* to select.`

    return doctorsList
  } catch (error: any) {
    console.error("[Meta WhatsApp] Error starting text booking flow:", error)
    return "❌ Error loading doctors. Please try again or contact reception."
  }
}

/**
 * Handle doctor selection
 */
async function handleDoctorSelection(
  db: FirebaseFirestore.Firestore,
  sessionRef: FirebaseFirestore.DocumentReference,
  phone: string,
  message: string,
  session: BookingSession
): Promise<string> {
  try {
    // Fetch doctors
    const doctorsSnapshot = await db
      .collection("doctors")
      .where("status", "==", "active")
      .limit(10)
      .get()

    const doctors = doctorsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }))

    // Try to match by number
    const messageNum = parseInt(message.trim())
    if (!isNaN(messageNum) && messageNum >= 1 && messageNum <= doctors.length) {
      const selectedDoctor = doctors[messageNum - 1] as any
      await sessionRef.update({
        selectedDoctorId: selectedDoctor.id,
        state: "selecting_date",
        updatedAt: new Date(),
      })
      const doctorName = `${selectedDoctor.firstName || ""} ${selectedDoctor.lastName || ""}`.trim()
      return `✅ Doctor selected: *${doctorName}*\n\n📅 Please provide the appointment date.\n\nFormat: *DD/MM/YYYY* (e.g., 15/01/2024)\n\nOr type 'Cancel' to start over.`
    }

    // Try to match by name
    const normalizedMessage = message.toLowerCase()
    const matchedDoctor = doctors.find((doc: any) => {
      const fullName = `${doc.firstName || ""} ${doc.lastName || ""}`.toLowerCase()
      return fullName.includes(normalizedMessage) || normalizedMessage.includes(fullName)
    }) as any

    if (matchedDoctor) {
      await sessionRef.update({
        selectedDoctorId: matchedDoctor.id,
        state: "selecting_date",
        updatedAt: new Date(),
      })
      const doctorName = `${matchedDoctor.firstName || ""} ${matchedDoctor.lastName || ""}`.trim()
      return `✅ Doctor selected: *${doctorName}*\n\n📅 Please provide the appointment date.\n\nFormat: *DD/MM/YYYY* (e.g., 15/01/2024)\n\nOr type 'Cancel' to start over.`
    }

    return "❌ Doctor not found. Please reply with the *doctor number* (1-10) or *doctor name*.\n\nOr type 'Cancel' to start over."
  } catch (error: any) {
    console.error("[Meta WhatsApp] Error handling doctor selection:", error)
    return "❌ Error processing selection. Please try again."
  }
}

/**
 * Handle date selection
 */
async function handleDateSelection(
  db: FirebaseFirestore.Firestore,
  sessionRef: FirebaseFirestore.DocumentReference,
  phone: string,
  message: string,
  session: BookingSession
): Promise<string> {
  try {
    // Parse date (accept DD/MM/YYYY or DD-MM-YYYY)
    const dateMatch = message.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/)
    if (!dateMatch) {
      return "❌ Invalid date format. Please use *DD/MM/YYYY* (e.g., 15/01/2024)\n\nOr type 'Cancel' to start over."
    }

    const [, day, month, year] = dateMatch
    const selectedDate = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`

    // Validate date is not in the past
    const dateObj = new Date(selectedDate)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (dateObj < today) {
      return "❌ Cannot book appointments in the past. Please provide a future date.\n\nFormat: *DD/MM/YYYY* (e.g., 15/01/2024)"
    }

    // Update session
    await sessionRef.update({
      selectedDate,
      state: "selecting_time",
      updatedAt: new Date(),
    })

    return `✅ Date selected: *${day}/${month}/${year}*\n\n🕐 Please provide the appointment time.\n\nFormat: *HH:MM* (24-hour format, e.g., 14:30 for 2:30 PM)\n\nAvailable slots: 09:00 - 17:00\n\nOr type 'Cancel' to start over.`
  } catch (error: any) {
    console.error("[Meta WhatsApp] Error handling date selection:", error)
    return "❌ Error processing date. Please try again with format *DD/MM/YYYY*"
  }
}

/**
 * Handle time selection
 */
async function handleTimeSelection(
  db: FirebaseFirestore.Firestore,
  sessionRef: FirebaseFirestore.DocumentReference,
  phone: string,
  message: string,
  session: BookingSession
): Promise<string> {
  try {
    // Parse time (accept HH:MM or HHMM)
    const timeMatch = message.match(/(\d{1,2}):?(\d{2})/)
    if (!timeMatch) {
      return "❌ Invalid time format. Please use *HH:MM* (e.g., 14:30 for 2:30 PM)\n\nOr type 'Cancel' to start over."
    }

    const [, timeHours, timeMinutes] = timeMatch
    const hourNum = parseInt(timeHours)
    const minNum = parseInt(timeMinutes)

    if (hourNum < 9 || hourNum > 17 || minNum < 0 || minNum > 59) {
      return "❌ Appointment time must be between 09:00 and 17:00.\n\nPlease provide a valid time."
    }

    const normalizedTime = normalizeTime(`${timeHours}:${timeMinutes}`)
    const selectedTime = normalizedTime

    // Check if slot is available
    if (!session.selectedDoctorId || !session.selectedDate) {
      await sessionRef.delete()
      return "❌ Session expired. Type 'Book' to start again."
    }

    const slotDocId = `${session.selectedDoctorId}_${session.selectedDate}_${selectedTime}`.replace(/[:\s]/g, "-")
    const slotRef = db.collection("appointmentSlots").doc(slotDocId)
    const slotDoc = await slotRef.get()

    if (slotDoc.exists) {
      return "❌ This time slot is already booked. Please choose another time.\n\nFormat: *HH:MM* (e.g., 14:30)"
    }

    // Update session
    await sessionRef.update({
      selectedTime,
      state: "confirming",
      updatedAt: new Date(),
    })

    // Get doctor details for confirmation
    const doctorDoc = await db.collection("doctors").doc(session.selectedDoctorId).get()
    const doctorData = doctorDoc.data()
    const doctorName = doctorData
      ? `${doctorData.firstName || ""} ${doctorData.lastName || ""}`.trim()
      : "Doctor"

    const dateDisplay = new Date(session.selectedDate + "T00:00:00").toLocaleDateString("en-IN", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })

    const [confirmHours, confirmMins] = selectedTime.split(":").map(Number)
    const timeDisplay = new Date(2000, 0, 1, confirmHours, confirmMins).toLocaleTimeString("en-IN", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })

    return `📋 *Appointment Summary*\n\n👨‍⚕️ Doctor: ${doctorName}\n📅 Date: ${dateDisplay}\n🕐 Time: ${timeDisplay}\n\nPlease confirm by replying:\n• *Yes* - to confirm booking\n• *No* - to cancel`
  } catch (error: any) {
    console.error("[Meta WhatsApp] Error handling time selection:", error)
    return "❌ Error processing time. Please try again."
  }
}

/**
 * Confirm and create appointment
 */
async function confirmAppointment(
  db: FirebaseFirestore.Firestore,
  sessionRef: FirebaseFirestore.DocumentReference,
  phone: string,
  session: BookingSession
): Promise<string> {
  try {
    if (!session.selectedDoctorId || !session.selectedDate || !session.selectedTime) {
      await sessionRef.delete()
      return "❌ Session expired. Type 'Book' to start again."
    }

    // Find patient by phone
    let patientsSnapshot = await db
      .collection("patients")
      .where("phone", "==", phone)
      .limit(1)
      .get()

    if (patientsSnapshot.empty) {
      patientsSnapshot = await db
        .collection("patients")
        .where("phoneNumber", "==", phone)
        .limit(1)
        .get()
    }

    let patientId: string | undefined
    let patientData: any = null

    if (!patientsSnapshot.empty) {
      patientData = patientsSnapshot.docs[0].data()
      patientId = patientsSnapshot.docs[0].id
    }

    if (!patientId) {
      await sessionRef.delete()
      return "❌ Patient record not found. Please contact reception to register first.\n\nPhone: +91-XXXXXXXXXX"
    }

    // Get doctor data
    const doctorDoc = await db.collection("doctors").doc(session.selectedDoctorId).get()
    if (!doctorDoc.exists) {
      await sessionRef.delete()
      return "❌ Doctor not found. Type 'Book' to start again."
    }

    const doctorData = doctorDoc.data()!
    const normalizedTime = normalizeTime(session.selectedTime)

    // Create appointment
    const slotDocId = `${session.selectedDoctorId}_${session.selectedDate}_${normalizedTime}`.replace(/[:\s]/g, "-")
    let appointmentId = ""

    await db.runTransaction(async (transaction) => {
      const slotRef = db.collection("appointmentSlots").doc(slotDocId)
      const slotSnap = await transaction.get(slotRef)
      if (slotSnap.exists) {
        throw new Error("SLOT_ALREADY_BOOKED")
      }

      const appointmentRef = db.collection("appointments").doc()
      appointmentId = appointmentRef.id

      transaction.set(appointmentRef, {
        patientId,
        patientUid: patientId,
        patientName: `${patientData.firstName || ""} ${patientData.lastName || ""}`.trim(),
        patientEmail: patientData.email || "",
        patientPhone: phone,
        doctorId: session.selectedDoctorId,
        doctorName: `${doctorData.firstName || ""} ${doctorData.lastName || ""}`.trim(),
        doctorSpecialization: doctorData.specialization || "",
        appointmentDate: session.selectedDate,
        appointmentTime: normalizedTime,
        status: "confirmed",
        chiefComplaint: "General consultation",
        medicalHistory: "",
        paymentAmount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: "whatsapp",
      })

      transaction.set(slotRef, {
        appointmentId,
        doctorId: session.selectedDoctorId,
        appointmentDate: session.selectedDate,
        appointmentTime: normalizedTime,
        createdAt: new Date().toISOString(),
      })
    })

    // Clear session
    await sessionRef.delete()

    // Format confirmation message
    const doctorName = `${doctorData.firstName || ""} ${doctorData.lastName || ""}`.trim()
    const patientName = `${patientData.firstName || ""} ${patientData.lastName || ""}`.trim()
    const dateDisplay = new Date(session.selectedDate + "T00:00:00").toLocaleDateString("en-IN", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
    const [hours, minutes] = normalizedTime.split(":").map(Number)
    const timeDisplay = new Date(2000, 0, 1, hours, minutes).toLocaleTimeString("en-IN", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })

    return `🎉 *Appointment Confirmed!*\n\nHi ${patientName},\n\nYour appointment has been successfully booked:\n\n👨‍⚕️ Doctor: ${doctorName}\n📅 Date: ${dateDisplay}\n🕐 Time: ${timeDisplay}\n📋 Appointment ID: ${appointmentId}\n\nWe'll send you a reminder before your appointment. See you soon! 🏥`
  } catch (error: any) {
    console.error("[Meta WhatsApp] Error confirming appointment:", error)
    await sessionRef.delete()

    if (error.message === "SLOT_ALREADY_BOOKED") {
      return "❌ That slot was just booked by another patient. Please type 'Book' to try again with a different time."
    }

    return "❌ Error creating appointment. Please contact reception at +91-XXXXXXXXXX"
  }
}

/**
 * Handle Flow completion - when user completes the WhatsApp Flow form
 */
async function handleFlowCompletion(value: any): Promise<NextResponse> {
  const db = admin.firestore()
  const message = value.messages[0]
  const from = message.from // Phone number
  const flowResponse = message.flow

  console.log("[Meta WhatsApp] Flow response received:", {
    from,
    flowId: flowResponse.id,
    flowToken: flowResponse.token,
    flowResponsePayload: flowResponse.response,
  })

  // Parse Flow response data
  const flowData = flowResponse.response?.data || {}

  // Extract appointment booking data from Flow
  const flowDoctorId = flowData.doctor_id || ""
  const flowTimeSlot = flowData.appointment_time || "" // Format: "slot_0900", "slot_0930", etc.
  
  // Map Flow time slot to actual time (e.g., "slot_0900" -> "09:00")
  let appointmentTime = ""
  if (flowTimeSlot.startsWith("slot_")) {
    const timeStr = flowTimeSlot.replace("slot_", "")
    if (timeStr.length === 4) {
      appointmentTime = `${timeStr.substring(0, 2)}:${timeStr.substring(2, 4)}`
    }
  } else if (flowTimeSlot.includes(":")) {
    appointmentTime = flowTimeSlot // Already in HH:MM format
  } else {
    // Try to parse as HHMM format
    if (flowTimeSlot.length === 4) {
      appointmentTime = `${flowTimeSlot.substring(0, 2)}:${flowTimeSlot.substring(2, 4)}`
    }
  }

  const appointmentData = {
    symptomCategory: flowData.symptom_category || "",
    chiefComplaint: flowData.chief_complaint || "General consultation",
    flowDoctorId: flowDoctorId, // Keep original for mapping
    doctorId: "", // Will be mapped from flowDoctorId
    appointmentDate: flowData.appointment_date || "",
    appointmentTime: appointmentTime,
    medicalHistory: flowData.medical_history || "",
    paymentOption: flowData.payment_option || "",
    paymentStatus: flowData.payment_status || "pending",
    patientPhone: from,
  }

  // Map Flow doctor ID to actual Firestore doctor ID
  // Flow uses IDs like "doctor_smith", we need to find the actual doctor
  if (appointmentData.flowDoctorId) {
    // Try to find doctor by matching name or use a mapping
    // For now, we'll search by name pattern (you may need to adjust this)
    const doctorsSnapshot = await db
      .collection("doctors")
      .where("status", "==", "active")
      .limit(20)
      .get()

    const doctors = doctorsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }))

    // Try to match Flow doctor ID to actual doctor
    // You may need to create a mapping table or use doctor names
    // For now, we'll try to find by checking if Flow ID contains doctor name
    const matchedDoctor = doctors.find((doc: any) => {
      const fullName = `${doc.firstName || ""} ${doc.lastName || ""}`.toLowerCase().replace(/\s+/g, "_")
      const flowIdLower = appointmentData.flowDoctorId.toLowerCase()
      return flowIdLower.includes(fullName) || fullName.includes(flowIdLower.replace("doctor_", ""))
    }) as any

    if (matchedDoctor) {
      appointmentData.doctorId = matchedDoctor.id
    } else {
      // If no match, use first doctor as fallback (you may want to handle this differently)
      console.warn(`[Meta WhatsApp] Could not map Flow doctor ID: ${appointmentData.flowDoctorId}`)
      if (doctors.length > 0) {
        appointmentData.doctorId = doctors[0].id
      }
    }
  }

  // Validate required fields
  if (!appointmentData.doctorId || !appointmentData.appointmentDate || !appointmentData.appointmentTime) {
    await sendTextMessage(
      from,
      "❌ Missing appointment information. Please try booking again by typing 'Book'."
    )
    return NextResponse.json({ success: true })
  }

  // Find patient by phone
  let patientsSnapshot = await db
    .collection("patients")
    .where("phone", "==", from)
    .limit(1)
    .get()

  if (patientsSnapshot.empty) {
    patientsSnapshot = await db
      .collection("patients")
      .where("phoneNumber", "==", from)
      .limit(1)
      .get()
  }

  let patientId: string | undefined
  let patientData: any = null

  if (!patientsSnapshot.empty) {
    patientData = patientsSnapshot.docs[0].data()
    patientId = patientsSnapshot.docs[0].id
  }

  if (!patientId) {
    await sendTextMessage(
      from,
      "❌ Patient record not found. Please contact reception to register first.\n\nPhone: +91-XXXXXXXXXX"
    )
    return NextResponse.json({ success: true })
  }

  // Get doctor data
  const doctorDoc = await db.collection("doctors").doc(appointmentData.doctorId).get()
  if (!doctorDoc.exists) {
    await sendTextMessage(
      from,
      "❌ Doctor not found. Please try booking again by typing 'Book'."
    )
    return NextResponse.json({ success: true })
  }

  const doctorData = doctorDoc.data()!
  const normalizedTime = normalizeTime(appointmentData.appointmentTime)

  // Create appointment
  const slotDocId = `${appointmentData.doctorId}_${appointmentData.appointmentDate}_${normalizedTime}`.replace(/[:\s]/g, "-")
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

      transaction.set(appointmentRef, {
        patientId,
        patientUid: patientId,
        patientName: `${patientData.firstName || ""} ${patientData.lastName || ""}`.trim(),
        patientEmail: patientData.email || "",
        patientPhone: from,
        doctorId: appointmentData.doctorId,
        doctorName: `${doctorData.firstName || ""} ${doctorData.lastName || ""}`.trim(),
        doctorSpecialization: doctorData.specialization || "",
        appointmentDate: appointmentData.appointmentDate,
        appointmentTime: normalizedTime,
        status: appointmentData.paymentStatus === "user_confirmed" ? "confirmed" : "pending",
        chiefComplaint: appointmentData.chiefComplaint,
        medicalHistory: appointmentData.medicalHistory,
        symptomCategory: appointmentData.symptomCategory,
        paymentAmount: 0,
        paymentMethod: appointmentData.paymentOption,
        paymentStatus: appointmentData.paymentStatus,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: "whatsapp_flow",
      })

      transaction.set(slotRef, {
        appointmentId,
        doctorId: appointmentData.doctorId,
        appointmentDate: appointmentData.appointmentDate,
        appointmentTime: normalizedTime,
        createdAt: new Date().toISOString(),
      })
    })

    // Send confirmation message
    const doctorName = `${doctorData.firstName || ""} ${doctorData.lastName || ""}`.trim()
    const patientName = `${patientData.firstName || ""} ${patientData.lastName || ""}`.trim()
    const dateDisplay = new Date(appointmentData.appointmentDate + "T00:00:00").toLocaleDateString("en-IN", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
    const timeParts = normalizedTime.split(":").map(Number)
    const timeDisplay = new Date(2000, 0, 1, timeParts[0], timeParts[1]).toLocaleTimeString("en-IN", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })

    const successMessage = `🎉 *Appointment Confirmed!*\n\nHi ${patientName},\n\nYour appointment has been successfully booked:\n\n👨‍⚕️ Doctor: ${doctorName}\n📅 Date: ${dateDisplay}\n🕐 Time: ${timeDisplay}\n📋 Appointment ID: ${appointmentId}\n\nWe'll send you a reminder before your appointment. See you soon! 🏥`

    await sendTextMessage(from, successMessage)

    return NextResponse.json({ success: true, appointmentId })
  } catch (error: any) {
    console.error("[Meta WhatsApp] Error creating appointment from Flow:", error)
    
    if (error.message === "SLOT_ALREADY_BOOKED") {
      await sendTextMessage(
        from,
        "❌ That slot was just booked by another patient. Please try booking again by typing 'Book'."
      )
      return NextResponse.json({ success: true })
    }

    await sendTextMessage(
      from,
      "❌ Error creating appointment. Please contact reception at +91-XXXXXXXXXX"
    )
    return NextResponse.json({ success: true })
  }
}

/**
 * Generate general responses (when not in booking flow)
 */
function generateGeneralResponse(message: string): string {
  // Handle "how was your day" message
  if (message.includes("how was your day") || message.includes("how's your day")) {
    return "Thank you for asking! 😊\n\nI'm doing great and ready to help you with your medical needs.\n\nHow can I assist you today?\n\n• Type 'Book' - to book an appointment\n• Type 'Appointments' - to view your appointments\n• Type 'Help' - for more options\n\nHope you're having a wonderful day! 🌟"
  }

  // Simple keyword-based responses
  if (message.includes("hello") || message.includes("hi") || message.includes("hey")) {
    return "👋 Hello! Welcome to Harmony Medical Services.\n\nHow can I help you today?\n\nType:\n• 'Book' - to book an appointment\n• 'Appointments' - to view your appointments\n• 'Help' - for more options"
  }

  if (message.includes("appointments") || message.includes("my appointment")) {
    return "📋 *Your Appointments*\n\nTo view your appointments, please visit our patient portal or contact reception.\n\nWe're here to help! 🙏"
  }

  if (message.includes("help") || message.includes("support")) {
    return "🆘 *Help & Support*\n\nWe're here to assist you!\n\n📞 Phone: +91-XXXXXXXXXX\n📧 Email: info@harmonymedical.com\n🌐 Website: [Your Website]\n\nFor urgent matters, please call us directly."
  }

  // Default response for unrecognized messages
  return "Thank you for your message! 🙏\n\nI'm an automated assistant. For specific inquiries, please:\n\n• Type 'Book' for appointments\n• Type 'Help' for support\n• Call us at +91-XXXXXXXXXX\n\nWe'll respond to your message soon!"
}

