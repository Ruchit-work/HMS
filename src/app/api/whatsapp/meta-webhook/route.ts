/**
 * Meta WhatsApp Webhook Handler
 * Handles incoming messages and Flow responses from Meta WhatsApp Business API
 * 
 * Webhook verification: GET request with hub.verify_token and hub.challenge
 * Message handling: POST request with message data
 */

import { NextResponse } from "next/server"
import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { sendTextMessage, sendButtonMessage, sendListMessage, sendFlowMessage } from "@/server/metaWhatsApp"
import { normalizeTime } from "@/utils/timeSlots"

const VERIFY_TOKEN = process.env.META_WHATSAPP_VERIFY_TOKEN || "harmony_verify_token_97431d8b"

// Helper: Get day name from date
const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
function getDayName(date: Date): string {
  return DAY_NAMES[date.getDay()]
}

// Booking conversation states
type BookingState = 
  | "initial"
  | "doctor_selection"
  | "date_selection"
  | "time_selection"
  | "confirming"
  | "completed"

interface BookingSession {
  phone: string
  patientId?: string
  state: BookingState
  selectedDoctorId?: string
  selectedDate?: string
  selectedTime?: string
  isRecheckup?: boolean
  recheckupAppointmentId?: string
  createdAt: Date
  updatedAt: Date
}

/**
 * GET /api/whatsapp/meta-webhook
 * Webhook verification for Meta
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const mode = searchParams.get("hub.mode")
    const token = searchParams.get("hub.verify_token")
    const challenge = searchParams.get("hub.challenge")

    // Log verification attempt for debugging
    console.log("[Meta WhatsApp] Verification attempt:", {
      mode,
      tokenReceived: token ? "***" + token.slice(-4) : "none",
      tokenExpected: VERIFY_TOKEN ? "***" + VERIFY_TOKEN.slice(-4) : "none",
      challenge: challenge ? "present" : "none",
    })

    // Verify the webhook
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("[Meta WhatsApp] Webhook verified successfully")
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
      console.error("[Meta WhatsApp] Invalid mode:", mode)
    }
    if (token !== VERIFY_TOKEN) {
      console.error("[Meta WhatsApp] Token mismatch")
    }

    return new NextResponse("Forbidden", { status: 403 })
  } catch (error: any) {
    console.error("[Meta WhatsApp] Verification error:", error)
    return new NextResponse("Internal Server Error", { status: 500 })
  }
}

/**
 * POST /api/whatsapp/meta-webhook
 * Handle incoming messages and Flow responses
 */
export async function POST(request: Request) {
  try {
    const initResult = initFirebaseAdmin("meta-whatsapp-webhook")
    if (!initResult.ok) {
      return NextResponse.json({ error: "Server not configured" }, { status: 500 })
    }

    const body = await request.json()
    
    // Meta sends webhook data in this format
    const entry = body.entry?.[0]
    const changes = entry?.changes?.[0]
    const value = changes?.value

    // Handle Flow completion
    if (value?.messages?.[0]?.type === "flow") {
      return await handleFlowResponse(value)
    }

    // Handle regular text messages
    if (value?.messages?.[0]?.type === "text") {
      return await handleTextMessage(value)
    }

    // Handle button/list responses
    if (value?.messages?.[0]?.type === "interactive") {
      return await handleInteractiveMessage(value)
    }

    // Handle status updates (message delivered, read, etc.)
    if (value?.statuses) {
      console.log("[Meta WhatsApp] Status update:", value.statuses)
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ success: true, message: "No action needed" })
  } catch (error: any) {
    console.error("[Meta WhatsApp Webhook] Error:", error)
    return NextResponse.json(
      { error: error?.message || "Webhook processing failed" },
      { status: 500 }
    )
  }
}

/**
 * Handle Flow response (when user completes the Flow form)
 */
async function handleFlowResponse(value: any) {
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
  const appointmentData = {
    doctorId: flowData.doctor_id || flowData.doctorId,
    date: flowData.date || flowData.appointment_date,
    time: flowData.time || flowData.appointment_time,
    problem: flowData.problem || flowData.chief_complaint || "General consultation",
    medicalHistory: flowData.medical_history || "",
    patientPhone: from,
  }

  // Find patient by phone
  let patientsSnapshot = await db.collection("patients")
    .where("phone", "==", from)
    .limit(1)
    .get()

  if (patientsSnapshot.empty) {
    patientsSnapshot = await db.collection("patients")
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
      "❌ Patient record not found. Please contact reception to register first."
    )
    return NextResponse.json({ success: true })
  }

  // Validate appointment data
  if (!appointmentData.doctorId || !appointmentData.date || !appointmentData.time) {
    await sendTextMessage(
      from,
      "❌ Missing appointment information. Please try booking again."
    )
    return NextResponse.json({ success: true })
  }

  // Get doctor data
  const doctorDoc = await db.collection("doctors").doc(appointmentData.doctorId).get()
  if (!doctorDoc.exists) {
    await sendTextMessage(
      from,
      "❌ Doctor not found. Please try booking again."
    )
    return NextResponse.json({ success: true })
  }

  const doctorData = doctorDoc.data()!
  const normalizedTime = normalizeTime(appointmentData.time)

  // Create appointment
  const slotDocId = `${appointmentData.doctorId}_${appointmentData.date}_${normalizedTime}`.replace(/[:\s]/g, "-")
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
        appointmentDate: appointmentData.date,
        appointmentTime: normalizedTime,
        status: "confirmed",
        chiefComplaint: appointmentData.problem,
        medicalHistory: appointmentData.medicalHistory,
        paymentAmount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: "whatsapp_flow",
      })

      transaction.set(slotRef, {
        appointmentId,
        doctorId: appointmentData.doctorId,
        appointmentDate: appointmentData.date,
        appointmentTime: normalizedTime,
        createdAt: new Date().toISOString(),
      })
    })

    // Send confirmation message
    const doctorName = `${doctorData.firstName || ""} ${doctorData.lastName || ""}`.trim()
    const patientName = `${patientData.firstName || ""} ${patientData.lastName || ""}`.trim()
    const dateDisplay = new Date(appointmentData.date + "T00:00:00").toLocaleDateString("en-IN", {
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

    const successMessage = `🎉 *Appointment Confirmed!*\n\n` +
      `Hi ${patientName},\n\n` +
      `Your appointment has been successfully booked:\n\n` +
      `👨‍⚕️ Doctor: ${doctorName}\n` +
      `📅 Date: ${dateDisplay}\n` +
      `🕐 Time: ${timeDisplay}\n` +
      `📋 Appointment ID: ${appointmentId}\n\n` +
      `We'll send you a reminder before your appointment. See you soon! 🏥`

    await sendTextMessage(from, successMessage)

    return NextResponse.json({ success: true, appointmentId })
  } catch (error: any) {
    if (error.message === "SLOT_ALREADY_BOOKED") {
      await sendTextMessage(
        from,
        "❌ That slot was just booked by another patient. Please try booking again with a different time."
      )
      return NextResponse.json({ success: true })
    }
    throw error
  }
}

/**
 * Handle text messages
 */
async function handleTextMessage(value: any) {
  const db = admin.firestore()
  const message = value.messages[0]
  const from = message.from
  const text = message.text?.body?.toLowerCase().trim() || ""

  // Check if user wants to book appointment
  if (
    text.includes("book appointment") ||
    text.includes("schedule appointment") ||
    text === "book" ||
    text === "schedule" ||
    text === "hi" ||
    text === "hello" ||
    text === "start"
  ) {
    // Send Flow message for appointment booking (if Flow ID is configured)
    const flowId = process.env.META_WHATSAPP_FLOW_ID
    if (flowId) {
      // Generate flow token (you can use a session ID or random token)
      const flowToken = `token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      await sendFlowMessage(
        from,
        flowId,
        flowToken,
        "Book Your Appointment",
        "Fill out the form below to schedule your appointment with our doctors.",
        "Harmony Medical Services"
      )

      return NextResponse.json({ success: true })
    } else {
      // Fallback to button message if Flow not configured yet
      await sendButtonMessage(
        from,
        "👋 *Welcome to Harmony Medical Services!*\n\nI can help you book an appointment. Please select an option:",
        [
          { id: "book_appointment", title: "📅 Book Appointment" },
          { id: "view_appointments", title: "📋 View Appointments" },
          { id: "contact", title: "📞 Contact Us" },
        ],
        "Harmony Medical Services"
      )
      return NextResponse.json({ success: true })
    }
  }

  // Default response
  await sendTextMessage(
    from,
    "👋 Hi! Type 'Book Appointment' to schedule a visit, or 'Help' for more options."
  )

  return NextResponse.json({ success: true })
}

/**
 * Handle interactive messages (button clicks, list selections)
 */
async function handleInteractiveMessage(value: any) {
  const db = admin.firestore()
  const message = value.messages[0]
  const from = message.from
  const interactive = message.interactive

  if (interactive.type === "button_reply") {
    const buttonId = interactive.button_reply.id

    if (buttonId === "book_appointment") {
      const flowId = process.env.META_WHATSAPP_FLOW_ID
      if (flowId) {
        const flowToken = `token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        await sendFlowMessage(
          from,
          flowId,
          flowToken,
          "Book Your Appointment",
          "Fill out the form below to schedule your appointment.",
          "Harmony Medical Services"
        )
      } else {
        // Flow not configured yet - send helpful message
        await sendTextMessage(
          from,
          "📅 *Book Appointment*\n\nTo book an appointment, please:\n\n1. Visit our website\n2. Call us at +91-XXXXXXXXXX\n3. Or wait for our Flow to be set up (coming soon!)\n\nThank you! 🙏"
        )
      }
    } else if (buttonId === "view_appointments") {
      await sendTextMessage(
        from,
        "To view your appointments, please visit our patient portal or contact reception."
      )
    } else if (buttonId === "contact") {
      await sendTextMessage(
        from,
        "📞 *Contact Information*\n\nPhone: +91-XXXXXXXXXX\nEmail: info@harmonymedical.com\n\nWe're here to help!"
      )
    }
  }

  return NextResponse.json({ success: true })
}

