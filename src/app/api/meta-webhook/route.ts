import { NextResponse } from "next/server"
import { sendTextMessage, sendButtonMessage, sendMultiButtonMessage, sendListMessage, sendDocumentMessage, sendFlowMessage, formatPhoneNumber } from "@/server/metaWhatsApp"
import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { normalizeTime, isDoctorAvailableOnDate, getDayName, DEFAULT_VISITING_HOURS } from "@/utils/timeSlots"
import { isDateBlocked as isDateBlockedFromRaw, normalizeBlockedDates } from "@/utils/blockedDates"
import { generateAppointmentConfirmationPDFBase64 } from "@/utils/appointmentConfirmationPDF"
import { Appointment } from "@/types/patient"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get("hub.mode")
  const token = searchParams.get("hub.verify_token")
  const challenge = searchParams.get("hub.challenge")

  if (mode === "subscribe" && token === process.env.META_WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge ?? "", { status: 200 })
  }

  return new NextResponse("Forbidden", { status: 403 })
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    console.log("WEBHOOK RECEIVED:", JSON.stringify(body, null, 2))

    const entry = body.entry?.[0]
    const changes = entry?.changes?.[0]
    const value = changes?.value
    const message = value?.messages?.[0]

    const initResult = initFirebaseAdmin("meta-whatsapp-webhook")
    if (!initResult.ok) {
      console.error("[Meta WhatsApp] Firebase Admin not initialised")
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
    }

    if (value?.statuses) {
      console.log("[Meta WhatsApp] Status update:", JSON.stringify(value.statuses))
      return NextResponse.json({ success: true })
    }

    if (!message) {
      return NextResponse.json({ success: true })
    }

    const from = message.from
    const messageType = message.type

    // Handle Flow completion (when user completes the Flow form)
    if (messageType === "flow") {
      return await handleFlowCompletion(value)
    }

    // Handle button clicks
    if (messageType === "interactive" && message.interactive?.type === "button_reply") {
      const buttonId = message.interactive.button_reply?.id
      if (buttonId === "book_appointment") {
        await startBookingWithFlow(from)
        return NextResponse.json({ success: true })
      }
      if (buttonId === "help_center") {
        await handleHelpCenter(from)
        return NextResponse.json({ success: true })
      }
      
      if (buttonId === "booking_confirm" || buttonId === "booking_cancel") {
        await handleConfirmationButtonClick(from, buttonId === "booking_confirm" ? "confirm" : "cancel")
        return NextResponse.json({ success: true })
      }

      // Handle date quick buttons (including "date_show_all")
      if (buttonId.startsWith("date_")) {
        await handleDateButtonClick(from, buttonId)
        return NextResponse.json({ success: true })
      }
      
      // Handle time quick buttons
      if (buttonId.startsWith("time_quick_")) {
        await handleTimeButtonClick(from, buttonId)
        return NextResponse.json({ success: true })
      }
    }

    // Handle list selections (date/time pickers)
    if (messageType === "interactive" && message.interactive?.type === "list_reply") {
      const selectedId = message.interactive.list_reply?.id
      const selectedTitle = message.interactive.list_reply?.title
      await handleListSelection(from, selectedId, selectedTitle)
      return NextResponse.json({ success: true })
    }

    // Handle text messages - check if user is in booking conversation
    if (messageType === "text") {
      const text = message.text?.body ?? ""
      const isInBooking = await handleBookingConversation(from, text)
      if (!isInBooking) {
        const trimmedText = text.trim().toLowerCase()
        
        // Check for "thanks" message
        if (trimmedText === "thanks" || trimmedText === "thank you" || trimmedText === "thankyou" || trimmedText.includes("thank")) {
          await sendTextMessage(
            from,
            "You're welcome! 😊\n\nFeel free to contact our help center if you found any issue.\n\nWe're here to help! 🏥"
          )
          return NextResponse.json({ success: true })
        }
        
        // Check for greetings (hello, hi, hy, etc.)
        const greetings = ["hello", "hi", "hy", "hey", "hii", "hiii", "hlo", "helo", "hie", "hai"]
        if (greetings.some(greeting => trimmedText === greeting || trimmedText.startsWith(greeting + " "))) {
          await handleGreeting(from)
          return NextResponse.json({ success: true })
        }
        
        // Not in booking, send welcome button
        await handleIncomingText(from, text)
      }
      return NextResponse.json({ success: true })
    }

    // Fallback for other message types
    await sendTextMessage(
      from,
      "Thanks for reaching out. Please send a text message to start your appointment booking."
    )
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[Meta WhatsApp] Webhook error:", err)
    return NextResponse.json(
      { error: "Webhook processing failed", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}


async function handleGreeting(phone: string) {
  // Send greeting with two buttons
  const buttonResponse = await sendMultiButtonMessage(
    phone,
    "Hello! 👋\n\nHow can I help you today?",
    [
      { id: "book_appointment", title: "📅 Book Appointment" },
      { id: "help_center", title: "🆘 Help Center" },
    ],
    "Harmony Medical Services"
  )

  if (!buttonResponse.success) {
    console.error("[Meta WhatsApp] Failed to send greeting buttons:", buttonResponse.error)
    // Fallback to text message
    await sendTextMessage(
      phone,
      "Hello! 👋\n\nHow can I help you today?\n\n• Type 'Book' to book an appointment\n• Type 'Help' for assistance\n\nOr contact our reception at +91-XXXXXXXXXX"
    )
  }
}

async function handleHelpCenter(phone: string) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://hospitalmanagementsystem-hazel.vercel.app"
  
  await sendTextMessage(
    phone,
    `🆘 *Help Center*\n\nWe're here to help you!\n\n📞 *Contact Us:*\nPhone: +91-XXXXXXXXXX\nEmail: support@harmonymedical.com\n\n🌐 *Visit Our Website:*\n${baseUrl}\n\n⏰ *Support Hours:*\nMonday - Saturday: 9:00 AM - 6:00 PM\nSunday: 10:00 AM - 2:00 PM\n\nFor urgent medical assistance, please visit our emergency department or call emergency services.`
  )
}

async function handleIncomingText(phone: string, text: string) {
  // Send button message instead of Flow directly
  const buttonResponse = await sendButtonMessage(
    phone,
    "Hi! 👋 Welcome to Harmony Medical Services.\n\nWould you like to book an appointment? Click the button below to get started.",
    "Harmony Medical Services",
    "book_appointment",
    "Book Appointment"
  )

  if (!buttonResponse.success) {
    console.error("[Meta WhatsApp] Failed to send button:", buttonResponse.error)
    await sendTextMessage(
      phone,
      "Hi! 👋 Welcome to Harmony Medical Services.\n\nTo book an appointment, please contact our reception at +91-XXXXXXXXXX."
    )
  }
}

// Translation helper for multi-language support
type Language = "gujarati" | "english"

interface Translations {
  [key: string]: {
    english: string
    gujarati: string
  }
}

const translations: Translations = {
  languageSelection: {
    english: "🌐 *Select Language*\n\nPlease choose your preferred language:",
    gujarati: "🌐 *ભાષા પસંદ કરો*\n\nકૃપા કરીને તમારી પ્રિય ભાષા પસંદ કરો:",
  },
  registrationFullName: {
    english: "🆕 *Create Patient Profile*\n\nPlease enter your full name (e.g., John Doe).",
    gujarati: "🆕 *દર્દી પ્રોફાઇલ બનાવો*\n\nકૃપા કરીને તમારું સંપૂર્ણ નામ દાખલ કરો (ઉદાહરણ: રાજેશ પટેલ).",
  },
  dateSelection: {
    english: "📅 *Select Appointment Date*\n\nTap the button below to see all available dates:",
    gujarati: "📅 *અપોઇન્ટમેન્ટ તારીખ પસંદ કરો*\n\nઉપલબ્ધ તારીખો જોવા માટે નીચેનું બટન ટેપ કરો:",
  },
  timeSelection: {
    english: "🕐 *Select Appointment Time*\n\nChoose your preferred time slot:",
    gujarati: "🕐 *સમય પસંદ કરો*\n\nતમારો પસંદીદા સમય પસંદ કરો:",
  },
  confirmAppointment: {
    english: "📋 *Confirm Appointment:*\n\n",
    gujarati: "📋 *અપોઇન્ટમેન્ટ ખાતરી કરો:*\n\n",
  },
  appointmentConfirmed: {
    english: "🎉 *Appointment Confirmed!*",
    gujarati: "🎉 *અપોઇન્ટમેન્ટ ખાતરી થઈ!*",
  },
}

function getTranslation(key: keyof typeof translations, language: Language = "english"): string {
  return translations[key]?.[language] || translations[key]?.english || ""
}

function formatTranslation(template: string, vars: Record<string, string | number>): string {
  let result = template
  Object.keys(vars).forEach((key) => {
    result = result.replace(new RegExp(`\\{${key}\\}`, "g"), String(vars[key]))
  })
  return result
}

function capitalizeName(value: string): string {
  if (!value) return ""
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ")
}

async function ensureDefaultDoctor(
  db: FirebaseFirestore.Firestore,
  sessionRef: FirebaseFirestore.DocumentReference,
  session: BookingSession | null,
  phone: string,
  language: Language
) {
  if (session?.doctorId) {
    const doctorDoc = await db.collection("doctors").doc(session.doctorId).get()
    if (doctorDoc.exists) {
      return { id: doctorDoc.id, data: doctorDoc.data()! }
    }
  }

  const doctorsSnapshot = await db.collection("doctors").where("status", "==", "active").limit(1).get()
  if (doctorsSnapshot.empty) {
    const msg =
      language === "gujarati"
        ? "❌ હાલમાં કોઈ ડૉક્ટર ઉપલબ્ધ નથી. કૃપા કરીને થોડા સમય પછી ફરી પ્રયત્ન કરો અથવા રિસેપ્શનનો સંપર્ક કરો."
        : "❌ No doctors are available right now. Please try again later or contact reception."
    await sendTextMessage(phone, msg)
    return null
  }

  const doctorDoc = doctorsSnapshot.docs[0]
  await sessionRef.update({
    doctorId: doctorDoc.id,
    updatedAt: new Date().toISOString(),
  })

  return { id: doctorDoc.id, data: doctorDoc.data()! }
}

async function moveToDateSelection(
  db: FirebaseFirestore.Firestore,
  phone: string,
  normalizedPhone: string,
  sessionRef: FirebaseFirestore.DocumentReference,
  language: Language
) {
  await sessionRef.update({
    state: "selecting_date",
    updatedAt: new Date().toISOString(),
  })

  const introMsg =
    language === "gujarati"
      ? "📅 ચાલો તમારી મુલાકાત માટે તારીખ પસંદ કરીએ. ઉપલબ્ધ તારીખો નીચે બતાવવામાં આવશે."
      : "📅 Let's pick your appointment date. Available dates will be shown next."
  await sendTextMessage(phone, introMsg)

  // No doctor needed for WhatsApp bookings - receptionist will assign later
  await sendDatePicker(phone, undefined, language)
}

async function sendConfirmationButtons(
  phone: string,
  sessionRef: FirebaseFirestore.DocumentReference,
  session: BookingSession
) {
  const language = session.language || "english"

  if (!session.appointmentDate || !session.appointmentTime) {
    const msg =
      language === "gujarati"
        ? "❌ તારીખ અથવા સમય મળ્યો નથી. કૃપા કરીને ફરીથી તારીખ પસંદ કરો."
        : "❌ Missing date or time. Please select the date again."
    await sendTextMessage(phone, msg)
    await sessionRef.update({ state: "selecting_date" })
    return
  }

  // Set default consultation fee (receptionist will update after doctor assignment)
  const consultationFee = 500
  await sessionRef.update({
    state: "confirming",
    consultationFee,
    paymentMethod: "cash",
    paymentType: "full",
    paymentAmount: 0,
    remainingAmount: consultationFee,
    updatedAt: new Date().toISOString(),
  })

  const dateDisplay = new Date(session.appointmentDate + "T00:00:00").toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })
  const [hours, minutes] = session.appointmentTime.split(":").map(Number)
  const timeDisplay = new Date(2000, 0, 1, hours, minutes).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })

  const message =
    language === "gujarati"
      ? `📋 *અપોઇન્ટમેન્ટની વિગતો*\n\n📅 તારીખ: ${dateDisplay}\n🕒 સમય: ${timeDisplay}\n\nકૃપા કરીને ખાતરી કરો. ડૉક્ટર રિસેપ્શન દ્વારા સોંપવામાં આવશે.`
      : `📋 *Appointment Details*\n\n📅 Date: ${dateDisplay}\n🕒 Time: ${timeDisplay}\n\nPlease confirm. Doctor will be assigned by reception.`

  const buttons = [
    {
      id: "booking_confirm",
      title: language === "gujarati" ? "✅ ખાતરી કરો" : "✅ Confirm",
    },
    {
      id: "booking_cancel",
      title: language === "gujarati" ? "❌ રદ કરો" : "❌ Cancel",
    },
  ]

  const buttonResponse = await sendMultiButtonMessage(phone, message, buttons, "Harmony Medical Services")

  if (!buttonResponse.success) {
    console.error("[Meta WhatsApp] Failed to send confirmation buttons:", buttonResponse.error)
    const fallback =
      language === "gujarati"
        ? `${message}\n\nકૃપા કરીને "confirm" અથવા "cancel" લખી જવાબ આપો.`
        : `${message}\n\nPlease reply with "confirm" or "cancel".`
    await sendTextMessage(phone, fallback)
  }
}

async function processBookingConfirmation(
  db: FirebaseFirestore.Firestore,
  phone: string,
  normalizedPhone: string,
  sessionRef: FirebaseFirestore.DocumentReference,
  session: BookingSession,
  action: "confirm" | "cancel"
) {
  const language = session.language || "english"

  if (action === "cancel") {
    await sessionRef.delete()
    const msg =
      language === "gujarati"
        ? "❌ બુકિંગ રદ કરાયું. તમે જ્યારે ઇચ્છો ત્યારે ફરીથી 'Book Appointment' લખીને શરૂ કરી શકો છો."
        : "❌ Booking cancelled. You can start again anytime by typing 'Book Appointment'."
    await sendTextMessage(phone, msg)
    return
  }

  if (!session.appointmentDate || !session.appointmentTime) {
    const errorMsg =
      language === "gujarati"
        ? "❌ તારીખ અથવા સમય મળ્યો નથી. કૃપા કરીને ફરીથી શરૂઆત કરો."
        : "❌ Missing date or time. Please start over."
    await sendTextMessage(phone, errorMsg)
    await sessionRef.delete()
    return
  }

  const patient = await findPatientByPhone(db, normalizedPhone)
  if (!patient) {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://hospitalmanagementsystem-hazel.vercel.app"
    const msg =
      language === "gujarati"
        ? `❌ દર્દી રેકોર્ડ મળ્યો નથી.\n\n📝 કૃપા કરીને પહેલા નોંધણી કરો:\n${baseUrl}`
        : `❌ Patient record not found.\n\n📝 Please register first:\n${baseUrl}`
    await sendTextMessage(phone, msg)
    await sessionRef.delete()
    return
  }

  // WhatsApp bookings don't require doctor assignment - receptionist will assign later
  const consultationFee = session.consultationFee || 500
  const paymentMethod = session.paymentMethod || "cash"
  const paymentAmount = session.paymentAmount ?? 0
  const remainingAmount = consultationFee
  const paymentStatus: "pending" | "paid" = "pending"

  try {
    const appointmentId = await createAppointment(
      db,
      patient,
      null, // No doctor assigned yet
      {
        symptomCategory: "",
        chiefComplaint: "General consultation",
        doctorId: "", // Empty - will be assigned by receptionist
        appointmentDate: session.appointmentDate,
        appointmentTime: session.appointmentTime,
        medicalHistory: "",
        paymentOption: paymentMethod,
        paymentStatus,
        paymentType: "full",
        consultationFee,
        paymentAmount,
        remainingAmount,
      },
      normalizedPhone,
      true // Mark as WhatsApp pending
    )

    await sendBookingConfirmation(
      normalizedPhone,
      patient,
      null, // No doctor data yet
      {
        state: "confirming",
        appointmentDate: session.appointmentDate,
        appointmentTime: session.appointmentTime,
        paymentMethod,
        paymentType: "full",
        consultationFee,
        paymentAmount,
        remainingAmount,
      } as BookingSession,
      appointmentId
    )

    await sessionRef.delete()
  } catch (error: any) {
    console.error("[Meta WhatsApp] Error creating appointment:", error)
    if (error.message === "SLOT_ALREADY_BOOKED") {
      const msg =
        language === "gujarati"
          ? "❌ આ સમય સ્લોટ હમણાં જ બુક થયો છે. કૃપા કરીને બીજો સમય પસંદ કરો."
          : "❌ That slot was just booked. Please choose another time."
      await sendTextMessage(phone, msg)
      await sessionRef.update({ state: "selecting_time" })
    } else {
      await sendTextMessage(
        phone,
        language === "gujarati"
          ? "❌ બુકિંગ દરમિયાન ભૂલ આવી. કૃપા કરીને થોડા સમય પછી ફરી પ્રયાસ કરો."
          : "❌ We hit an error while booking. Please try again shortly."
      )
      await sessionRef.delete()
    }
  }
}

async function handleConfirmationButtonClick(phone: string, action: "confirm" | "cancel") {
  const db = admin.firestore()
  const normalizedPhone = formatPhoneNumber(phone)
  const sessionRef = db.collection("whatsappBookingSessions").doc(normalizedPhone)
  const sessionSnap = await sessionRef.get()

  if (!sessionSnap.exists) {
    await sendTextMessage(
      phone,
      action === "confirm"
        ? "❌ Session expired. Please start booking again."
        : "✅ Already cancelled. You can start a new booking anytime."
    )
    return
  }

  const session = sessionSnap.data() as BookingSession
  await processBookingConfirmation(db, phone, normalizedPhone, sessionRef, session, action)
}


// Booking conversation states
type BookingState =
  | "idle"
  | "selecting_language"
  | "selecting_date"
  | "selecting_time"
  | "confirming"

interface BookingSession {
  state: BookingState
  language?: "gujarati" | "english" // Selected language for the booking session
  needsRegistration?: boolean
  doctorId?: string
  appointmentDate?: string
  appointmentTime?: string
  symptoms?: string
  paymentMethod?: "card" | "upi" | "cash" | "wallet"
  paymentType?: "full" | "partial"
  consultationFee?: number
  paymentAmount?: number
  remainingAmount?: number
  registrationData?: {
    firstName?: string
    lastName?: string
    email?: string
    dateOfBirth?: string
    gender?: string
  }
  createdAt: string
  updatedAt: string
}

async function startBookingWithFlow(phone: string) {
  const db = admin.firestore()
  const normalizedPhone = formatPhoneNumber(phone)
  const flowId = process.env.META_WHATSAPP_FLOW_ID

  // Check if patient exists
  const patient = await findPatientByPhone(db, normalizedPhone)
  if (!patient) {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://hospitalmanagementsystem-hazel.vercel.app"
    
    await sendTextMessage(
      phone,
      `❌ We couldn't find your patient profile.\n\n📝 *Please register first to book appointments:*\n\n${baseUrl}\n\nOr contact reception:\nPhone: +91-XXXXXXXXXX\n\nAfter registration, you can book appointments via WhatsApp! 🏥`
    )
    return
  }

  // If Flow ID is configured, use Flow (better UI)
  if (flowId) {
    const flowToken = `token_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
    const flowResponse = await sendFlowMessage(
      phone,
      flowId,
      flowToken,
      "Book Your Appointment",
      "Please fill out the form below to schedule your appointment with our doctors.",
      "Harmony Medical Services"
    )

    if (flowResponse.success) {
      console.log("[Meta WhatsApp] Flow sent successfully:", flowResponse.messageId)
      return
    } else {
      console.error("[Meta WhatsApp] Failed to send Flow, falling back to text-based booking:", flowResponse.error)
      // Fallback to text-based booking if Flow fails
      await startBookingConversation(phone)
      return
    }
  }

  // No Flow ID configured, use text-based booking
  await startBookingConversation(phone)
}

async function handleFlowCompletion(value: any): Promise<Response> {
  const db = admin.firestore()
  const message = value.messages?.[0]

  if (!message?.flow) {
    return NextResponse.json({ success: true })
  }

  const from = formatPhoneNumber(message.from)
  const flowResponse = message.flow
  const flowData = flowResponse.response?.data || {}

  console.log("[Meta WhatsApp] Flow completion received:", {
    from,
    flowId: flowResponse.id,
    flowToken: flowResponse.token,
    flowData: JSON.stringify(flowData, null, 2),
  })

  // Extract data from Flow (adjust field names based on your Flow structure)
  const flowDoctorId = flowData.doctor_id || flowData.doctor || ""
  let appointmentDate = flowData.appointment_date || flowData.date || ""
  const flowTimeSlot = flowData.appointment_time || flowData.time || flowData.time_slot || ""
  const symptoms = flowData.symptom_category || flowData.symptoms || flowData.chief_complaint || ""
  const paymentMethod = flowData.payment_option || flowData.payment_method || "cash"
  const paymentType = flowData.payment_type || "full"

  // Normalize date format from DatePicker (handles various formats)
  // DatePicker typically returns YYYY-MM-DD format
  if (appointmentDate) {
    // Remove time portion if present (e.g., "2025-01-15T00:00:00Z" -> "2025-01-15")
    appointmentDate = appointmentDate.split("T")[0].split(" ")[0]
    
    // Validate date format (should be YYYY-MM-DD)
    const datePattern = /^\d{4}-\d{2}-\d{2}$/
    if (!datePattern.test(appointmentDate)) {
      // Try to parse and reformat if not in correct format
      try {
        const parsedDate = new Date(appointmentDate)
        if (!isNaN(parsedDate.getTime())) {
          const year = parsedDate.getFullYear()
          const month = String(parsedDate.getMonth() + 1).padStart(2, "0")
          const day = String(parsedDate.getDate()).padStart(2, "0")
          appointmentDate = `${year}-${month}-${day}`
        }
      } catch (e) {
        console.error("[Meta WhatsApp] Error parsing date from Flow:", appointmentDate, e)
      }
    }
  }

  // Convert time slot format if needed
  let appointmentTime = ""
  if (flowTimeSlot) {
    if (flowTimeSlot.includes(":")) {
      appointmentTime = flowTimeSlot
    } else if (flowTimeSlot.startsWith("slot_")) {
      const timeStr = flowTimeSlot.replace("slot_", "")
      if (timeStr.length === 4) {
        appointmentTime = `${timeStr.substring(0, 2)}:${timeStr.substring(2, 4)}`
      }
    } else if (flowTimeSlot.length === 4) {
      appointmentTime = `${flowTimeSlot.substring(0, 2)}:${flowTimeSlot.substring(2, 4)}`
    } else {
      appointmentTime = flowTimeSlot
    }
  }

  if (!appointmentDate || !appointmentTime) {
    await sendTextMessage(
      from,
      "❌ Missing appointment information. Please try booking again by clicking 'Book Appointment'."
    )
    return NextResponse.json({ success: true })
  }

  // Find patient
  const patient = await findPatientByPhone(db, from)
  if (!patient) {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://hospitalmanagementsystem-hazel.vercel.app"
    await sendTextMessage(
      from,
      `❌ Patient record not found.\n\n📝 *Please register first:*\n\n${baseUrl}\n\nOr contact reception for assistance.`
    )
    return NextResponse.json({ success: true })
  }

  // Check if user already has an appointment on this date
  const existingAppointments = await db
    .collection("appointments")
    .where("patientId", "==", patient.id)
    .where("appointmentDate", "==", appointmentDate)
    .where("status", "in", ["pending", "confirmed"])
    .get()

  if (!existingAppointments.empty) {
    const existingAppt = existingAppointments.docs[0].data()
    const existingTime = existingAppt.appointmentTime || ""
    await sendTextMessage(
      from,
      `❌ *Appointment Already Booked*\n\nYour appointment for ${appointmentDate}${existingTime ? ` at ${existingTime}` : ""} is already booked.\n\nPlease select a different date to book another appointment.`
    )
    return NextResponse.json({ success: true })
  }

  // Resolve doctor from Flow data
  let doctorId = ""
  if (flowDoctorId) {
    // Try direct doc ID first
    const directDoc = await db.collection("doctors").doc(flowDoctorId).get()
    if (directDoc.exists) {
      doctorId = directDoc.id
    } else {
      // Try to match by name
      const doctorsSnapshot = await db.collection("doctors").where("status", "==", "active").limit(20).get()
      const doctors = doctorsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))

      const matchedDoctor = doctors.find((doc: any) => {
        const fullName = `${doc.firstName || ""} ${doc.lastName || ""}`.toLowerCase().replace(/\s+/g, "_")
        const flowIdLower = flowDoctorId.toLowerCase()
        return flowIdLower.includes(fullName) || fullName.includes(flowIdLower.replace("doctor_", ""))
      }) as any

      if (matchedDoctor) {
        doctorId = matchedDoctor.id
      } else if (doctors.length > 0) {
        // Fallback to first active doctor
        doctorId = doctors[0].id
      }
    }
  }

  if (!doctorId) {
    await sendTextMessage(
      from,
      "❌ Doctor not found. Please try booking again."
    )
    return NextResponse.json({ success: true })
  }

  const doctorDoc = await db.collection("doctors").doc(doctorId).get()
  if (!doctorDoc.exists) {
    await sendTextMessage(
      from,
      "❌ Doctor not found. Please try booking again."
    )
    return NextResponse.json({ success: true })
  }

  const doctorData = doctorDoc.data()!
  
  // Check if date is blocked (system-wide like Sunday OR doctor-specific)
  const availabilityCheck = checkDateAvailability(appointmentDate, doctorData)
  if (availabilityCheck.isBlocked) {
    await sendTextMessage(
      from,
      `❌ *Date Not Available*\n\n${availabilityCheck.reason}\n\nPlease try booking again by clicking 'Book Appointment' and selecting a different date.`
    )
    return NextResponse.json({ success: true })
  }
  
  // Check if time slot is already booked
  const normalizedTime = normalizeTime(appointmentTime)
  const slotDocId = `${doctorId}_${appointmentDate}_${normalizedTime}`.replace(/[:\s]/g, "-")
  const slotRef = db.collection("appointmentSlots").doc(slotDocId)
  const slotDoc = await slotRef.get()
  
  if (slotDoc.exists) {
    await sendTextMessage(
      from,
      `❌ *Time Slot Already Booked*\n\nThe time slot ${appointmentTime} on ${appointmentDate} is already booked.\n\nPlease try booking again by clicking 'Book Appointment' and selecting a different time.`
    )
    return NextResponse.json({ success: true })
  }
  
  const consultationFee = doctorData.consultationFee || 500
  const PARTIAL_PAYMENT_AMOUNT = Math.ceil(consultationFee * 0.1)
  const amountToPay = paymentType === "partial" ? PARTIAL_PAYMENT_AMOUNT : consultationFee
  const isCash = paymentMethod === "cash"
  const collectedAmount = isCash ? 0 : amountToPay
  const remainingAmount = Math.max(consultationFee - collectedAmount, 0)
  const paymentStatus: "pending" | "paid" =
    !isCash && remainingAmount === 0 ? "paid" : "pending"

  // Create appointment
  try {
    const appointmentId = await createAppointment(
      db,
      patient,
      { id: doctorId, data: doctorData },
      {
        symptomCategory: "",
        chiefComplaint: symptoms || "General consultation",
        doctorId: doctorId,
        appointmentDate: appointmentDate,
        appointmentTime: normalizedTime,
        medicalHistory: "",
        paymentOption: paymentMethod,
        paymentStatus,
        paymentType: paymentType as "full" | "partial",
        consultationFee,
        paymentAmount: collectedAmount,
        remainingAmount,
      },
      from
    )

    // Send confirmation
    await sendBookingConfirmation(
      from,
      patient,
      doctorData,
      {
        state: "confirming" as BookingState,
        doctorId: doctorId,
        appointmentDate: appointmentDate,
        appointmentTime: normalizedTime,
        symptoms: symptoms,
        paymentMethod: paymentMethod as "card" | "upi" | "cash" | "wallet",
        paymentType: paymentType as "full" | "partial",
        consultationFee: consultationFee,
        paymentAmount: collectedAmount,
        remainingAmount,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      appointmentId
    )

    return NextResponse.json({ success: true, appointmentId })
  } catch (error: any) {
    console.error("[Meta WhatsApp] Error creating appointment from Flow:", error)
    if (error.message === "SLOT_ALREADY_BOOKED") {
      await sendTextMessage(
        from,
        "❌ That slot was just booked by another patient. Please try booking again."
      )
    } else {
      await sendTextMessage(
        from,
        "❌ Error creating appointment. Please contact reception at +91-XXXXXXXXXX"
      )
    }
    return NextResponse.json({ success: false })
  }
}

async function startBookingConversation(phone: string) {
  const db = admin.firestore()
  const normalizedPhone = formatPhoneNumber(phone)

  // Check if patient exists
  const patient = await findPatientByPhone(db, normalizedPhone)
  if (!patient) {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://hospitalmanagementsystem-hazel.vercel.app"
    
    await sendTextMessage(
      phone,
      `❌ We couldn't find your patient profile.\n\n📝 *Please register first to book appointments:*\n\n${baseUrl}\n\nOr contact reception:\nPhone: +91-XXXXXXXXXX\n\nAfter registration, you can book appointments via WhatsApp! 🏥`
    )
    return
  }

  // Create booking session with language selection state
  const sessionRef = db.collection("whatsappBookingSessions").doc(normalizedPhone)
  await sessionRef.set({
    state: "selecting_language",
    needsRegistration: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })

  // Send language selection picker
  await sendLanguagePicker(phone)
}

async function sendLanguagePicker(phone: string) {
  const languageOptions = [
    { id: "lang_english", title: "🇬🇧 English", description: "Continue in English" },
    { id: "lang_gujarati", title: "🇮🇳 ગુજરાતી (Gujarati)", description: "ગુજરાતીમાં ચાલુ રાખો" },
  ]

  const listResponse = await sendListMessage(
    phone,
    "🌐 *Select Language*\n\nPlease choose your preferred language:",
    "🌐 Choose Language",
    [
      {
        title: "Available Languages",
        rows: languageOptions,
      },
    ],
    "Harmony Medical Services"
  )

  if (!listResponse.success) {
    // Fallback to text-based selection
    await sendTextMessage(
      phone,
      "🌐 *Select Language:*\n\nPlease reply with:\n• \"english\" for English\n• \"gujarati\" for ગુજરાતી"
    )
  }
}

async function handleBookingConversation(phone: string, text: string): Promise<boolean> {
  const db = admin.firestore()
  const normalizedPhone = formatPhoneNumber(phone)
  const sessionRef = db.collection("whatsappBookingSessions").doc(normalizedPhone)
  const sessionDoc = await sessionRef.get()

  if (!sessionDoc.exists) {
    return false // Not in booking conversation
  }

  const session = sessionDoc.data() as BookingSession
  const trimmedText = text.trim().toLowerCase()

  // Handle cancel/stop/abort - check for various cancel keywords
  const cancelKeywords = [
    "cancel", "stop", "abort", "quit", "exit", "no", "nevermind", 
    "never mind", "don't", "dont", "skip", "end", "finish"
  ]
  
  if (cancelKeywords.some(keyword => trimmedText === keyword || trimmedText.includes(keyword))) {
    await sessionRef.delete()
    await sendTextMessage(
      phone,
      "❌ Booking cancelled.\n\nYou can start a new booking anytime by typing 'Book' or clicking the 'Book Appointment' button."
    )
    return true
  }

  switch (session.state) {
    case "selecting_language":
      return await handleLanguageSelection(db, phone, normalizedPhone, sessionRef, text, session)
    case "selecting_date":
      return await handleDateSelection(db, phone, normalizedPhone, sessionRef, text, session)
    case "selecting_time":
      return await handleTimeSelection(db, phone, normalizedPhone, sessionRef, text, session)
    case "confirming":
      return await handleConfirmation(db, phone, normalizedPhone, sessionRef, text, session)
    default:
      await sessionRef.delete()
      return false
  }
}

async function handleLanguageSelection(
  db: FirebaseFirestore.Firestore,
  phone: string,
  normalizedPhone: string,
  sessionRef: FirebaseFirestore.DocumentReference,
  text: string,
  session: BookingSession
): Promise<boolean> {
  const trimmedText = text.trim().toLowerCase()
  let selectedLanguage: "english" | "gujarati" = "english"

  // Handle text input for language selection (fallback)
  if (trimmedText === "english" || trimmedText === "en" || trimmedText === "1") {
    selectedLanguage = "english"
  } else if (trimmedText === "gujarati" || trimmedText === "guj" || trimmedText === "gu" || trimmedText === "2") {
    selectedLanguage = "gujarati"
  } else {
    // Invalid input, resend language picker
    await sendLanguagePicker(phone)
    return true
  }

  // Update session with selected language
  await sessionRef.update({
    language: selectedLanguage,
    updatedAt: new Date().toISOString(),
  })

  const needsRegistration = session.needsRegistration ?? false

  if (needsRegistration) {
    await sessionRef.update({
      state: "registering_full_name",
      registrationData: session.registrationData || {},
    })
    await sendTextMessage(phone, getTranslation("registrationFullName", selectedLanguage))
    return true
  }

  await moveToDateSelection(db, phone, normalizedPhone, sessionRef, selectedLanguage)
  return true
}

async function handleDateSelection(
  db: FirebaseFirestore.Firestore,
  phone: string,
  normalizedPhone: string,
  sessionRef: FirebaseFirestore.DocumentReference,
  text: string,
  session: BookingSession
): Promise<boolean> {
  const language = session.language || "english"
  
  // If text is provided, try to parse it as date (fallback for text input)
  if (text && text.trim()) {
    let selectedDate = ""
    const trimmedText = text.trim().toLowerCase()

    if (trimmedText === "today") {
      selectedDate = new Date().toISOString().split("T")[0]
    } else if (trimmedText === "tomorrow") {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      selectedDate = tomorrow.toISOString().split("T")[0]
    } else {
      // Try to parse YYYY-MM-DD
      const dateMatch = text.match(/(\d{4})-(\d{2})-(\d{2})/)
      if (dateMatch) {
        selectedDate = dateMatch[0]
      } else {
        // Invalid format, send date picker
        await sendDatePicker(phone, session.doctorId, language)
        return true
      }
    }

    // Validate date is not in the past
    const selected = new Date(selectedDate + "T00:00:00")
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (selected < today) {
      const errorMsg = language === "gujarati"
        ? "❌ કૃપા કરીને આજની અથવા ભવિષ્યની તારીખ પસંદ કરો."
        : "❌ Please select a date that is today or in the future."
      await sendTextMessage(phone, errorMsg)
      await sendDatePicker(phone, session.doctorId, language)
      return true
    }

    // Check if date is blocked (system-wide like Sunday OR doctor-specific)
    if (session.doctorId) {
      const doctorDoc = await db.collection("doctors").doc(session.doctorId).get()
      if (doctorDoc.exists) {
        const doctorData = doctorDoc.data()!
        const availabilityCheck = checkDateAvailability(selectedDate, doctorData)
        if (availabilityCheck.isBlocked) {
          const errorMsg = language === "gujarati"
            ? `❌ *તારીખ ઉપલબ્ધ નથી*\n\n${availabilityCheck.reason}\n\nકૃપા કરીને બીજી તારીખ પસંદ કરો.`
            : `❌ *Date Not Available*\n\n${availabilityCheck.reason}\n\nPlease select another date.`
          await sendTextMessage(phone, errorMsg)
          await sendDatePicker(phone, session.doctorId, language)
          return true
        }
      }
    }

    // Check if user already has an appointment on this date
    const patient = await findPatientByPhone(db, normalizedPhone)
    if (patient) {
      const existingAppointments = await db
        .collection("appointments")
        .where("patientId", "==", patient.id)
        .where("appointmentDate", "==", selectedDate)
        .where("status", "in", ["pending", "confirmed"])
        .get()

      if (!existingAppointments.empty) {
        const existingAppt = existingAppointments.docs[0].data()
        const existingTime = existingAppt.appointmentTime || ""
        const errorMsg = language === "gujarati"
          ? `❌ *અપોઇન્ટમેન્ટ પહેલેથી બુક થયેલ છે*\n\nતમારે ${selectedDate}${existingTime ? ` at ${existingTime}` : ""} માટે પહેલેથી અપોઇન્ટમેન્ટ બુક કરેલ છે.\n\nકૃપા કરીને બીજી તારીખ પસંદ કરો.`
          : `❌ *Appointment Already Booked*\n\nYou already have an appointment booked for ${selectedDate}${existingTime ? ` at ${existingTime}` : ""}.\n\nPlease select a different date.`
        await sendTextMessage(phone, errorMsg)
        await sendDatePicker(phone, session.doctorId, language)
        return true
      }
    }

    // Date is valid and no existing appointment, proceed to time selection
    await sessionRef.update({
      state: "selecting_time",
      appointmentDate: selectedDate,
      updatedAt: new Date().toISOString(),
    })

    // Show Morning/Afternoon buttons for the selected date
    await sendTimePicker(phone, undefined, selectedDate, language)
    return true
  }

  // No text provided, send date picker
  await sendDatePicker(phone, session.doctorId, language)
  return true
}

async function sendDatePicker(phone: string, doctorId?: string, language: Language = "english") {
  const db = admin.firestore()
  let doctorData: any = null
  
  // Fetch doctor data if doctor ID is provided to check blocked dates
  if (doctorId) {
    const doctorDoc = await db.collection("doctors").doc(doctorId).get()
    if (doctorDoc.exists) {
      doctorData = doctorDoc.data()!
    }
  }
  
  // If buttons failed or not requested, show list message
  const dateOptions = generateDateOptions(doctorData)
  
  // If all dates are filtered out (all blocked), show error message
  if (dateOptions.length === 0) {
    const noDatesMsg = language === "gujarati"
      ? "❌ *કોઈ તારીખ ઉપલબ્ધ નથી*\n\nબધી તારીખો હાલમાં અવરોધિત અથવા ઉપલબ્ધ નથી.\n\nકૃપા કરીને સહાયતા માટે રિસેપ્શનને +91-XXXXXXXXXX પર કૉલ કરો."
      : "❌ *No Available Dates*\n\nAll dates are currently blocked or unavailable.\n\nPlease contact reception at +91-XXXXXXXXXX for assistance."
    await sendTextMessage(phone, noDatesMsg)
    return
  }
  
  // WhatsApp list message limit: 10 rows TOTAL (not per section)
  // Limit dates to first 10 available
  const datesToShow = dateOptions.slice(0, 10)
  
  // Create single section with max 10 date options
  const sections = [{
    title: language === "gujarati" ? "ઉપલબ્ધ તારીખો" : "Available Dates",
    rows: datesToShow,
  }]

  const dateMsg = language === "gujarati"
    ? "📅 *અપોઇન્ટમેન્ટ તારીખ પસંદ કરો*\n\nતમારો પસંદીદા તારીખ પસંદ કરો:"
    : "📅 *Select Appointment Date*\n\nChoose your preferred date:"

  // Button text max 20 chars
  const buttonText = language === "gujarati" ? "📅 તારીખ પસંદ કરો" : "📅 Pick a Date"
  const truncatedButtonText = buttonText.length > 20 ? buttonText.substring(0, 20) : buttonText

  console.log("[Meta WhatsApp] Sending date picker list message:", {
    phone,
    dateCount: datesToShow.length,
    buttonText: truncatedButtonText,
  })

  const listResponse = await sendListMessage(
    phone,
    dateMsg,
    truncatedButtonText,
    sections,
    "Harmony Medical Services"
  )

  if (!listResponse.success) {
    console.error("[Meta WhatsApp] Failed to send date picker list:", {
      error: listResponse.error,
      errorCode: listResponse.errorCode,
      phone: phone,
      dateCount: datesToShow.length,
    })
    
    // Retry with simplified format
    console.log("[Meta WhatsApp] Retrying date picker list with simplified format...")
    const simplifiedDates = datesToShow.map(date => ({
      id: date.id,
      title: date.title.length > 24 ? date.title.substring(0, 21) + "..." : date.title,
      description: date.description || "Available",
    }))

    const simplifiedSections = [{
      title: "Dates",
      rows: simplifiedDates,
    }]

    const retryResponse = await sendListMessage(
      phone,
      language === "gujarati" ? "તારીખ પસંદ કરો:" : "Select Date:",
      "Select",
      simplifiedSections,
      "HMS"
    )

    if (!retryResponse.success) {
      console.error("[Meta WhatsApp] Both attempts failed to send date picker list:", {
        originalError: listResponse.error,
        retryError: retryResponse.error,
      })
      // Send error message instead of text fallback
      const errorMsg = language === "gujarati"
        ? "❌ ક્ષમા કરો, અમે તારીખ પસંદ કરવા માટે સૂચિ બતાવી શક્યા નથી. કૃપા કરીને પાછળથી પ્રયાસ કરો અથવા રિસેપ્શનનો સંપર્ક કરો."
        : "❌ Sorry, we couldn't display the date selection. Please try again later or contact reception."
      await sendTextMessage(phone, errorMsg)
    } else {
      console.log("[Meta WhatsApp] ✅ Date picker list sent successfully on retry")
    }
  } else {
    console.log("[Meta WhatsApp] ✅ Date picker list sent successfully")
  }
}

async function sendTimeSlotListForPeriod(
  phone: string,
  slots: Array<{ raw: string; normalized: string }>,
  language: Language,
  periodLabel: string
) {
  if (slots.length === 0) {
    return
  }

  const chunkSize = 10
  const totalChunks = Math.ceil(slots.length / chunkSize)

  for (let i = 0; i < slots.length; i += chunkSize) {
    const chunk = slots.slice(i, i + chunkSize)
    const chunkIndex = Math.floor(i / chunkSize)

    const baseTitle =
      language === "gujarati"
        ? periodLabel.replace("સવાર", "સવાર સ્લોટ્સ").replace("બપોર", "બપોર સ્લોટ્સ")
        : periodLabel.replace("Morning", "Morning Slots").replace("Afternoon", "Afternoon Slots")

    const rows = chunk.map((slot) => {
      const [hours, minutes] = slot.raw.split(":").map(Number)
      const hour12 = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours
      const ampm = hours >= 12 ? "PM" : "AM"
      const displayTime = `${hour12}:${minutes.toString().padStart(2, "0")} ${ampm}`

      return {
        id: `time_${slot.raw}`,
        title: displayTime.length > 24 ? displayTime.slice(0, 24) : displayTime,
        description: language === "gujarati" ? "ઉપલબ્ધ" : "Available",
      }
    })

    let listTitle =
      totalChunks > 1
        ? `${baseTitle} ${chunkIndex + 1}/${totalChunks}`
        : baseTitle

    if (listTitle.length > 24) {
      listTitle = listTitle.slice(0, 24)
    }

    const listResponse = await sendListMessage(
      phone,
      language === "gujarati"
        ? `🕐 *સમય પસંદ કરો*\n\n${periodLabel} માટે ઉપલબ્ધ સમય સ્લોટમાંથી પસંદ કરો.`
        : `🕐 *Select Time*\n\nChoose your preferred slot for ${periodLabel}.`,
      language === "gujarati" ? "સમય પસંદ કરો" : "Select Time",
      [
        {
          title: listTitle,
          rows,
        },
      ],
      "Harmony Medical Services"
    )

    if (!listResponse.success) {
      console.error("[Meta WhatsApp] Failed to send time slot list chunk:", {
        error: listResponse.error,
        chunkIndex,
      })

      let fallback = language === "gujarati"
        ? `🕐 *સમય સ્લોટ્સ (${listTitle})*\n`
        : `🕐 *Time Slots (${listTitle})*\n`

      chunk.forEach((slot) => {
        const [hours, minutes] = slot.raw.split(":").map(Number)
        const hour12 = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours
        const ampm = hours >= 12 ? "PM" : "AM"
        fallback += `• ${hour12}:${minutes.toString().padStart(2, "0")} ${ampm}\n`
      })
      fallback += language === "gujarati"
        ? "\nકૃપા કરીને તમારા પસંદીના સમય (ઉદાહરણ: 10:30) લખી જવાબ આપો."
        : "\nPlease reply with your preferred time (e.g., 10:30)."

      await sendTextMessage(phone, fallback)
    }
  }
}

async function handleListSelection(phone: string, selectedId: string, selectedTitle: string) {
  const db = admin.firestore()
  const normalizedPhone = formatPhoneNumber(phone)
  const sessionRef = db.collection("whatsappBookingSessions").doc(normalizedPhone)
  const sessionDoc = await sessionRef.get()

  if (!sessionDoc.exists) {
    return
  }

  const session = sessionDoc.data() as BookingSession
  const language = session.language || "english"

  // Check if it's a language selection (ID starts with "lang_")
  if (selectedId.startsWith("lang_")) {
    const selectedLanguage = selectedId.replace("lang_", "") as "english" | "gujarati"
    await sessionRef.update({
      language: selectedLanguage,
      updatedAt: new Date().toISOString(),
    })

    await moveToDateSelection(db, phone, normalizedPhone, sessionRef, selectedLanguage)
    return
  }

  // Check if it's a date selection (ID starts with "date_")
  if (selectedId.startsWith("date_")) {
    const selectedDate = selectedId.replace("date_", "")
    
    // Validate date is not in the past
    const selected = new Date(selectedDate + "T00:00:00")
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (selected < today) {
      const errorMsg = language === "gujarati"
        ? "❌ કૃપા કરીને આજની અથવા ભવિષ્યની તારીખ પસંદ કરો."
        : "❌ Please select a date that is today or in the future."
      await sendTextMessage(phone, errorMsg)
      await sendDatePicker(phone, session.doctorId, language)
      return
    }

    // Check if date is blocked (system-wide like Sunday OR doctor-specific)
    if (session.doctorId) {
      const doctorDoc = await db.collection("doctors").doc(session.doctorId).get()
      if (doctorDoc.exists) {
        const doctorData = doctorDoc.data()!
        const availabilityCheck = checkDateAvailability(selectedDate, doctorData)
        if (availabilityCheck.isBlocked) {
          const errorMsg = language === "gujarati"
            ? `❌ *તારીખ ઉપલબ્ધ નથી*\n\n${availabilityCheck.reason}\n\nકૃપા કરીને બીજી તારીખ પસંદ કરો.`
            : `❌ *Date Not Available*\n\n${availabilityCheck.reason}\n\nPlease select another date.`
          await sendTextMessage(phone, errorMsg)
          await sendDatePicker(phone, session.doctorId, language)
          return
        }
      }
    }

    // Check if user already has an appointment on this date
    const patient = await findPatientByPhone(db, normalizedPhone)
    if (patient) {
      const existingAppointments = await db
        .collection("appointments")
        .where("patientId", "==", patient.id)
        .where("appointmentDate", "==", selectedDate)
        .where("status", "in", ["pending", "confirmed"])
        .get()

      if (!existingAppointments.empty) {
        const existingAppt = existingAppointments.docs[0].data()
        const existingTime = existingAppt.appointmentTime || ""
        const errorMsg = language === "gujarati"
          ? `❌ *અપોઇન્ટમેન્ટ પહેલેથી બુક થયેલ છે*\n\nતમારે ${selectedDate}${existingTime ? ` at ${existingTime}` : ""} માટે પહેલેથી અપોઇન્ટમેન્ટ બુક કરેલ છે.\n\nકૃપા કરીને બીજી તારીખ પસંદ કરો.`
          : `❌ *Appointment Already Booked*\n\nYou already have an appointment booked for ${selectedDate}${existingTime ? ` at ${existingTime}` : ""}.\n\nPlease select a different date.`
        await sendTextMessage(phone, errorMsg)
        await sendDatePicker(phone, session.doctorId, language)
        return
      }
    }

    await sessionRef.update({
      state: "selecting_time",
      appointmentDate: selectedDate,
      updatedAt: new Date().toISOString(),
    })

    // Send time picker
    await sendTimePicker(phone, undefined, selectedDate, language)
    return
  }

  // Check if it's a time selection (ID starts with "time_")
  if (selectedId.startsWith("time_")) {
    const selectedTime = selectedId.replace("time_", "")
    const normalizedTime = normalizeTime(selectedTime)

    // Validate that the selected time is not in the past (for today's appointments)
    const isToday = session.appointmentDate === new Date().toISOString().split("T")[0]
    if (isToday) {
      const now = new Date()
      const currentTime = now.getTime()
      const minimumTime = currentTime + (15 * 60 * 1000) // 15 minutes buffer
      const slotDateTime = new Date(`${session.appointmentDate}T${normalizedTime}:00`)
      const slotTime = slotDateTime.getTime()
      
      // Reject if slot is in the past or less than 15 minutes away
      if (slotTime <= minimumTime) {
        const errorMsg = language === "gujarati"
          ? "❌ આ સમય પસાર થઈ ગયો છે અથવા ખૂબ નજીક છે. કૃપા કરીને ભવિષ્યનો સમય પસંદ કરો (ઓછામાં ઓછું 15 મિનિટ અંતર)."
          : "❌ That time has already passed or is too soon. Please pick a future slot (at least 15 minutes from now)."
        await sendTextMessage(phone, errorMsg)
        await sendTimePicker(phone, undefined, session.appointmentDate!, language)
        return
      }
    }

    // Skip slot checking since no doctor is assigned yet - receptionist will check when assigning doctor

    await sessionRef.update({
      appointmentTime: normalizedTime,
      updatedAt: new Date().toISOString(),
    })

    const updatedSession: BookingSession = {
      ...session,
      appointmentTime: normalizedTime,
    }

    await sendConfirmationButtons(phone, sessionRef, updatedSession)
    return
  }

}

// Handler for date button clicks (Today, Tomorrow, See All)
async function handleDateButtonClick(phone: string, buttonId: string) {
  const db = admin.firestore()
  const normalizedPhone = formatPhoneNumber(phone)
  const sessionRef = db.collection("whatsappBookingSessions").doc(normalizedPhone)
  const sessionDoc = await sessionRef.get()

  if (!sessionDoc.exists) {
    return
  }

  const session = sessionDoc.data() as BookingSession
  const language = session.language || "english"

  // If "See All" button clicked, show list
  if (buttonId === "date_show_all") {
    await sendDatePicker(phone, session.doctorId, language)
    return
  }

  // Extract date from button ID (format: "date_YYYY-MM-DD")
  const selectedDate = buttonId.replace("date_", "")
  
  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
    await sendDatePicker(phone, session.doctorId, language)
    return
  }

  // Validate date is not in the past
  const selected = new Date(selectedDate + "T00:00:00")
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (selected < today) {
    const errorMsg = language === "gujarati"
      ? "❌ કૃપા કરીને આજની અથવા ભવિષ્યની તારીખ પસંદ કરો."
      : "❌ Please select a date that is today or in the future."
    await sendTextMessage(phone, errorMsg)
    await sendDatePicker(phone, session.doctorId, language)
    return
  }

  // Check if date is blocked
  if (session.doctorId) {
    const doctorDoc = await db.collection("doctors").doc(session.doctorId).get()
    if (doctorDoc.exists) {
      const doctorData = doctorDoc.data()!
      const availabilityCheck = checkDateAvailability(selectedDate, doctorData)
      if (availabilityCheck.isBlocked) {
        const errorMsg = language === "gujarati"
          ? `❌ *તારીખ ઉપલબ્ધ નથી*\n\n${availabilityCheck.reason}\n\nકૃપા કરીને બીજી તારીખ પસંદ કરો.`
          : `❌ *Date Not Available*\n\n${availabilityCheck.reason}\n\nPlease select another date.`
        await sendTextMessage(phone, errorMsg)
        await sendDatePicker(phone, session.doctorId, language)
        return
      }
    }
  }

  // Check if user already has an appointment on this date
  const patient = await findPatientByPhone(db, normalizedPhone)
  if (patient) {
    const existingAppointments = await db
      .collection("appointments")
      .where("patientId", "==", patient.id)
      .where("appointmentDate", "==", selectedDate)
      .where("status", "in", ["pending", "confirmed"])
      .get()

    if (!existingAppointments.empty) {
      const existingAppt = existingAppointments.docs[0].data()
      const existingTime = existingAppt.appointmentTime || ""
      const errorMsg = language === "gujarati"
        ? `❌ *અપોઇન્ટમેન્ટ પહેલેથી બુક થયેલ છે*\n\nતમારે ${selectedDate}${existingTime ? ` at ${existingTime}` : ""} માટે પહેલેથી અપોઇન્ટમેન્ટ બુક કરેલ છે.\n\nકૃપા કરીને બીજી તારીખ પસંદ કરો.`
        : `❌ *Appointment Already Booked*\n\nYou already have an appointment booked for ${selectedDate}${existingTime ? ` at ${existingTime}` : ""}.\n\nPlease select a different date.`
      await sendTextMessage(phone, errorMsg)
      await sendDatePicker(phone, session.doctorId, language)
      return
    }
  }

  // Date is valid, proceed to time selection
  await sessionRef.update({
    state: "selecting_time",
    appointmentDate: selectedDate,
    updatedAt: new Date().toISOString(),
  })

  await sendTimePicker(phone, undefined, selectedDate, language)
}

// Handler for time button clicks (Morning, Afternoon, See All)
async function handleTimeButtonClick(phone: string, buttonId: string) {
  const db = admin.firestore()
  const normalizedPhone = formatPhoneNumber(phone)
  const sessionRef = db.collection("whatsappBookingSessions").doc(normalizedPhone)
  const sessionDoc = await sessionRef.get()

  if (!sessionDoc.exists) {
    console.error("[Meta WhatsApp] Session not found for time button click:", normalizedPhone)
    return
  }

  const session = sessionDoc.data() as BookingSession
  const language = session.language || "english"

  // Validate required session data (doctorId no longer required)
  if (!session.appointmentDate) {
    console.error("[Meta WhatsApp] Missing appointmentDate in session:", {
      appointmentDate: session.appointmentDate,
    })
    const errorMsg = language === "gujarati"
      ? "❌ સત્ર મળ્યું નથી. કૃપા કરીને ફરીથી પ્રયાસ કરો."
      : "❌ Session not found. Please try again."
    await sendTextMessage(phone, errorMsg)
    return
  }

  // Note: "See All Times" button has been removed - only Morning/Afternoon buttons are shown

  // Get available slots for the selected time period
  const timeSlots = generateTimeSlots()
  let selectedSlots: string[] = []

  const isToday = session.appointmentDate === new Date().toISOString().split("T")[0]

  if (buttonId === "time_quick_morning") {
    // Morning slots: 9:00 AM to 1:00 PM (09:00 to 13:00)
    selectedSlots = timeSlots.filter(slot => {
      const hour = parseInt(slot.split(":")[0])
      return hour >= 9 && hour <= 13
    })
    console.log("[Meta WhatsApp] Morning button clicked, found slots:", selectedSlots.length)
  } else if (buttonId === "time_quick_afternoon") {
    // Afternoon slots: 2:00 PM to 5:00 PM (14:00 to 17:00)
    selectedSlots = timeSlots.filter(slot => {
      const hour = parseInt(slot.split(":")[0])
      return hour >= 14 && hour <= 17
    })
    console.log("[Meta WhatsApp] Afternoon button clicked, found slots:", selectedSlots.length)
  } else {
    console.error("[Meta WhatsApp] Unknown button ID:", buttonId)
    await sendTimePicker(phone, undefined, session.appointmentDate, language)
    return
  }

  if (selectedSlots.length === 0) {
    console.error("[Meta WhatsApp] No slots found for time period:", buttonId)
    const errorMsg = language === "gujarati"
      ? "❌ આ સમય અવધિ માટે કોઈ સ્લોટ ઉપલબ્ધ નથી. કૃપા કરીને બીજો સમય પસંદ કરો."
      : "❌ No slots available for this time period. Please select another time."
    await sendTextMessage(phone, errorMsg)
    await sendTimePicker(phone, undefined, session.appointmentDate, language)
    return
  }

  // Gather available slots in this period
  const availableSlotsForPeriod: Array<{ raw: string; normalized: string }> = []
  
  // Sort slots in chronological order
  const sortedSlots = [...selectedSlots].sort((a, b) => {
    const [hA, mA] = a.split(":").map(Number)
    const [hB, mB] = b.split(":").map(Number)
    return hA * 60 + mA - (hB * 60 + mB)
  })
  
  console.log("[Meta WhatsApp] Checking availability for", sortedSlots.length, "slots on", session.appointmentDate)
  
  for (const slot of sortedSlots) {
    const normalizedTime = normalizeTime(slot)
    if (!normalizedTime) {
      console.warn("[Meta WhatsApp] Failed to normalize time slot:", slot)
      continue
    }

    if (isToday) {
      const now = new Date()
      const currentTime = now.getTime()
      const minimumTime = currentTime + (15 * 60 * 1000) // 15 minutes buffer
      const slotDateTime = new Date(`${session.appointmentDate}T${normalizedTime}:00`)
      const slotTime = slotDateTime.getTime()
      
      // Reject if slot is in the past or less than 15 minutes away
      if (slotTime <= minimumTime) {
        console.log("[Meta WhatsApp] Skipping past/near slot:", normalizedTime, "Current time:", now.toISOString())
        continue
      }
    }
    
    // Skip slot checking since no doctor is assigned yet - show all slots, receptionist will check when assigning doctor
    availableSlotsForPeriod.push({ raw: slot, normalized: normalizedTime })
  }

  if (availableSlotsForPeriod.length === 0) {
    // No slots available in this time period
    console.error("[Meta WhatsApp] ❌ All slots booked for period:", buttonId, "on", session.appointmentDate)
    const errorMsg = language === "gujarati"
      ? "❌ આ સમય અવધિ માટે બધા સ્લોટ બુક થયેલા છે. કૃપા કરીને બીજો સમય પસંદ કરો."
      : "❌ All slots for this time period are booked. Please select another time."
    await sendTextMessage(phone, errorMsg)
    await sendTimePicker(phone, undefined, session.appointmentDate, language)
    return
  }

  const periodLabel =
    buttonId === "time_quick_morning"
      ? language === "gujarati"
        ? "સવાર 9:00 - 1:00"
        : "Morning 9:00 - 1:00"
      : language === "gujarati"
      ? "બપોર 2:00 - 5:00"
      : "Afternoon 2:00 - 5:00"

  await sendTimeSlotListForPeriod(phone, availableSlotsForPeriod, language, periodLabel)
}

async function sendTimePicker(phone: string, doctorId: string | undefined, appointmentDate: string, language: Language = "english", showButtons: boolean = true) {
  const db = admin.firestore()
  const timeSlots = generateTimeSlots()
  
  // Check which slots are available (filter out already booked slots only if doctor is assigned)
  const availableSlots: Array<{ id: string; title: string; description?: string }> = []
  
  const isToday = appointmentDate === new Date().toISOString().split("T")[0]
  const now = new Date()
  const currentTime = now.getTime()
  // Add 15 minute buffer - don't allow booking slots less than 15 minutes from now
  const minimumTime = currentTime + (15 * 60 * 1000) // 15 minutes in milliseconds

  for (const slot of timeSlots) {
    const normalizedTime = normalizeTime(slot)
    
    // Skip past slots for today (with 15 minute buffer)
    if (isToday) {
      const slotDateTime = new Date(`${appointmentDate}T${normalizedTime}:00`)
      const slotTime = slotDateTime.getTime()
      
      // Reject if slot is in the past or less than 15 minutes away
      if (slotTime <= minimumTime) {
        console.log("[Meta WhatsApp] Skipping past/near slot:", normalizedTime, "Current time:", now.toISOString())
        continue
      }
    }
    
    // Only check slot availability if doctor is assigned
    if (doctorId) {
      const slotDocId = `${doctorId}_${appointmentDate}_${normalizedTime}`.replace(/[:\s]/g, "-")
      const slotRef = db.collection("appointmentSlots").doc(slotDocId)
      const slotDoc = await slotRef.get()
      
      if (slotDoc.exists) {
        continue // Slot already booked for this doctor
      }
    }
    
    // Slot is available (either no doctor assigned yet, or not booked)
    availableSlots.push({
      id: `time_${slot}`,
      title: slot, // Time in 24-hour format like "09:00", "09:30", etc.
      description: "Available", // Add description to match doctor picker format
    })
  }
  
  if (availableSlots.length === 0) {
    const noSlotsMsg = language === "gujarati"
      ? "❌ આ તારીખ માટે કોઈ સમય સ્લોટ ઉપલબ્ધ નથી. કૃપા કરીને બીજી તારીખ પસંદ કરો."
      : "❌ No time slots available for this date. Please select another date."
    await sendTextMessage(phone, noSlotsMsg)
      await sendDatePicker(phone, undefined, language)
    return
  }

  // Show Morning/Afternoon buttons first (default behavior)
  if (showButtons && availableSlots.length > 0) {
    // Group slots into time periods
    const morningSlots = availableSlots.filter(s => {
      const hour = parseInt(s.title.split(":")[0])
      return hour >= 9 && hour <= 13 // 9 AM to 1 PM
    })
    
    const afternoonSlots = availableSlots.filter(s => {
      const hour = parseInt(s.title.split(":")[0])
      return hour >= 14 && hour <= 17 // 2 PM to 5 PM
    })

    const quickButtons: Array<{ id: string; title: string }> = []
    
    // Add Morning button if slots available
    if (morningSlots.length > 0) {
      quickButtons.push({
        id: "time_quick_morning",
        title: language === "gujarati" ? "🌅 સવાર 9-1" : "🌅 Morning 9-1",
      })
    }
    
    // Add Afternoon button if slots available
    if (afternoonSlots.length > 0 && quickButtons.length < 3) {
      quickButtons.push({
        id: "time_quick_afternoon",
        title: language === "gujarati" ? "☀️ બપોર 2-5" : "☀️ Afternoon 2-5",
      })
    }
    
    if (quickButtons.length > 0) {
      const timeMsg = language === "gujarati"
        ? "🕐 *સમય પસંદ કરો*\n\nઝડપી પસંદગી માટે નીચેના બટનમાંથી પસંદ કરો:\n• સવાર (Morning) - પહેલું ઉપલબ્ધ સ્લોટ આપમેળે પસંદ થશે\n• બપોર (Afternoon) - પહેલું ઉપલબ્ધ સ્લોટ આપમેળે પસંદ થશે"
        : "🕐 *Select Appointment Time*\n\nChoose from quick options below:\n• Morning - First available slot will be auto-selected\n• Afternoon - First available slot will be auto-selected"

      console.log("[Meta WhatsApp] Sending time period buttons:", {
        phone,
        buttonCount: quickButtons.length,
        buttons: quickButtons.map(b => b.id),
        date: appointmentDate,
      })

      const buttonResponse = await sendMultiButtonMessage(
        phone,
        timeMsg,
        quickButtons,
        "Harmony Medical Services"
      )

      if (buttonResponse.success) {
        console.log("[Meta WhatsApp] ✅ Time period buttons sent successfully")
        return // Buttons sent successfully
      } else {
        console.error("[Meta WhatsApp] ❌ Failed to send time buttons:", {
          error: buttonResponse.error,
          errorCode: buttonResponse.errorCode,
          phone,
        })
        // Retry once before falling back to list
        console.log("[Meta WhatsApp] Retrying time buttons...")
        const retryResponse = await sendMultiButtonMessage(
          phone,
          language === "gujarati" ? "સમય પસંદ કરો:" : "Select Time:",
          quickButtons,
          "HMS"
        )
        
        if (retryResponse.success) {
          console.log("[Meta WhatsApp] ✅ Time buttons sent successfully on retry")
          return
        } else {
          console.error("[Meta WhatsApp] ❌ Retry also failed, falling back to list:", retryResponse.error)
          // Fallback to list if buttons fail
        }
      }
    }
  }

  // Format time slots for interactive list message (radio button style)
  // Sort slots chronologically for better UX
  const sortedSlots = [...availableSlots].sort((a, b) => {
    const [hA, mA] = a.title.split(":").map(Number)
    const [hB, mB] = b.title.split(":").map(Number)
    return hA * 60 + mA - (hB * 60 + mB)
  })

  // WhatsApp list messages have a maximum of 10 rows TOTAL across all sections
  // Distribute slots between morning (9 AM - 1 PM) and afternoon (2 PM - 5 PM) parts
  // Separate slots into morning and afternoon
  const morningSlots = sortedSlots.filter(slot => {
    const hour = parseInt(slot.title.split(":")[0])
    return hour >= 9 && hour <= 13 // 9 AM to 1 PM
  })
  
  const afternoonSlots = sortedSlots.filter(slot => {
    const hour = parseInt(slot.title.split(":")[0])
    return hour >= 14 && hour <= 17 // 2 PM to 5 PM
  })
  
  // Distribute 10 slots between both parts (5 from morning, 5 from afternoon)
  // If one part has fewer slots, show more from the other part
  const maxSlots = 10
  let slotsToShow: typeof sortedSlots = []
  
  if (morningSlots.length > 0 && afternoonSlots.length > 0) {
    // Both parts have slots - distribute evenly
    const morningCount = Math.min(morningSlots.length, Math.ceil(maxSlots / 2))
    const afternoonCount = Math.min(afternoonSlots.length, maxSlots - morningCount)
    
    slotsToShow = [
      ...morningSlots.slice(0, morningCount),
      ...afternoonSlots.slice(0, afternoonCount)
    ]
  } else if (morningSlots.length > 0) {
    // Only morning slots available
    slotsToShow = morningSlots.slice(0, maxSlots)
  } else if (afternoonSlots.length > 0) {
    // Only afternoon slots available
    slotsToShow = afternoonSlots.slice(0, maxSlots)
  } else {
    // Fallback: just take first 10
    slotsToShow = sortedSlots.slice(0, maxSlots)
  }

  // Format slots for list message - match doctor picker format exactly
  // Ensure title is max 24 chars, description max 72 chars
  const formattedSlots = slotsToShow.map(slot => {
    const timeStr = slot.title // "09:00" format
    // Format time for title display (09:00 -> 9:00 AM)
    const [hours, minutes] = timeStr.split(":").map(Number)
    const hour12 = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours
    const ampm = hours >= 12 ? "PM" : "AM"
    const displayTime = `${hour12}:${minutes.toString().padStart(2, "0")} ${ampm}`
    
    // Title: just the time (max 24 chars) - this will show as "9:00 AM" format
    let title = displayTime
    if (title.length > 24) {
      title = title.substring(0, 21) + "..."
    }
    
    // Description: "Available" to match doctor format (has specialization as description)
    let description = language === "gujarati" ? "ઉપલબ્ધ" : "Available"
    if (description.length > 72) {
      description = description.substring(0, 69) + "..."
    }
    
    return {
      id: slot.id, // Keep "time_09:00" format for backend
      title: title, // Display format like "9:00 AM"
      description: description, // Simple description to match doctor format
    }
  })

  // WhatsApp list message limit: 10 rows TOTAL (not per section)
  // Create single section with max 10 rows
  const sections = [{
    title: language === "gujarati" ? "સમય પસંદ કરો" : "Available Times",
    rows: formattedSlots,
  }]

  const timeMsg = language === "gujarati"
    ? "🕐 *સમય પસંદ કરો*\n\nતમારો પસંદીદા સમય પસંદ કરો:"
    : "🕐 *Select Time*\n\nChoose your preferred time slot:"

  // Button text max 20 chars - keep it short and simple
  const buttonText = language === "gujarati" ? "સમય પસંદ કરો" : "Select Time"
  const truncatedButtonText = buttonText.length > 20 ? buttonText.substring(0, 20) : buttonText

  console.log("[Meta WhatsApp] Sending time slot list message:", {
    phone,
    slotCount: formattedSlots.length,
    sectionCount: sections.length,
    buttonText: truncatedButtonText,
  })

  const listResponse = await sendListMessage(
    phone,
    timeMsg,
    truncatedButtonText,
    sections,
    "Harmony Medical Services"
  )

  if (!listResponse.success) {
    console.error("[Meta WhatsApp] Failed to send time slot list message:", {
      error: listResponse.error,
      errorCode: listResponse.errorCode,
      phone: phone,
      slotCount: formattedSlots.length,
    })
    
    // Retry with simplified format - still limit to 10 rows total
    console.log("[Meta WhatsApp] Retrying time slot list with simplified format...")
    const simplifiedSlots = formattedSlots.map(slot => ({
      id: slot.id,
      title: slot.title.length > 24 ? slot.title.substring(0, 21) + "..." : slot.title,
      description: "Available", // Keep description to avoid WhatsApp rejection
    }))

    // Single section with max 10 rows (WhatsApp limit)
    const simplifiedSections = [{
      title: "Times",
      rows: simplifiedSlots,
    }]

    const retryResponse = await sendListMessage(
      phone,
      language === "gujarati" ? "સમય પસંદ કરો:" : "Select Time:",
      "Select",
      simplifiedSections,
      "HMS"
    )

    if (!retryResponse.success) {
      console.error("[Meta WhatsApp] Both attempts failed to send time slot list:", {
        originalError: listResponse.error,
        retryError: retryResponse.error,
      })
      // Send error message instead of text fallback
      const errorMsg = language === "gujarati"
        ? "❌ ક્ષમા કરો, અમે સમય સ્લોટ પસંદ કરવા માટે સૂચિ બતાવી શક્યા નથી. કૃપા કરીને પાછળથી પ્રયાસ કરો અથવા રિસેપ્શનનો સંપર્ક કરો."
        : "❌ Sorry, we couldn't display the time slot selection. Please try again later or contact reception."
      await sendTextMessage(phone, errorMsg)
    } else {
      console.log("[Meta WhatsApp] ✅ Time slot list sent successfully on retry")
    }
  } else {
    console.log("[Meta WhatsApp] ✅ Time slot list sent successfully")
  }
}

function generateDateOptions(doctorData?: any): Array<{ id: string; title: string; description?: string }> {
  const options: Array<{ id: string; title: string; description?: string }> = []
  const today = new Date()
  
  // Generate next 14 days and filter out blocked dates
  for (let i = 0; i < 14; i++) {
    const date = new Date(today)
    date.setDate(today.getDate() + i)
    const dateStr = date.toISOString().split("T")[0]
    
    // Check if date is blocked (system-wide like Sunday OR doctor-specific)
    if (doctorData) {
      const availabilityCheck = checkDateAvailability(dateStr, doctorData)
      if (availabilityCheck.isBlocked) {
        // Skip blocked dates - don't include them in the list
        continue
      }
    }
    
    const dayName = date.toLocaleDateString("en-IN", { weekday: "short" })
    const dateDisplay = date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
    })

    let title = ""
    if (i === 0) {
      title = `Today - ${dateDisplay}`
    } else if (i === 1) {
      title = `Tomorrow - ${dateDisplay}`
    } else {
      title = `${dayName} - ${dateDisplay}`
    }

    options.push({
      id: `date_${dateStr}`,
      title: title,
      description: i === 0 ? "Today" : i === 1 ? "Tomorrow" : dayName,
    })
  }

  return options
}

async function handleTimeSelection(
  db: FirebaseFirestore.Firestore,
  phone: string,
  normalizedPhone: string,
  sessionRef: FirebaseFirestore.DocumentReference,
  text: string,
  session: BookingSession
): Promise<boolean> {
  const language = session.language || "english"
  
  const timeSlots = generateTimeSlots()
  const trimmed = text.trim().toLowerCase()

  let selectedTime = ""

  // Try numeric selection (legacy fallback)
  const slotNum = parseInt(trimmed)
  if (!isNaN(slotNum) && slotNum >= 1 && slotNum <= timeSlots.length) {
    selectedTime = timeSlots[slotNum - 1]
  }

  // Try direct time input (e.g., 10:30 or 1030)
  if (!selectedTime) {
    const timeMatch = trimmed.match(/(\d{1,2})([:.\s]?)(\d{2})/)
    if (timeMatch) {
      let hours = parseInt(timeMatch[1])
      const minutes = parseInt(timeMatch[3])
      if (trimmed.includes("pm") && hours < 12) {
        hours += 12
      }
      if (trimmed.includes("am") && hours === 12) {
        hours = 0
      }
      if (!isNaN(hours) && minutes >= 0 && minutes < 60) {
        const candidate = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`
        if (timeSlots.includes(candidate)) {
          selectedTime = candidate
        }
      }
    }
  }

  if (!selectedTime) {
    const errorMsg = language === "gujarati"
      ? "❌ કૃપા કરીને માન્ય સમય પસંદ કરો (ઉદાહરણ: 10:30)."
      : "❌ Please choose a valid time slot (e.g., 10:30)."
    await sendTextMessage(phone, errorMsg)
    await sendTimePicker(phone, undefined, session.appointmentDate!, language)
    return true
  }

  const normalizedTime = normalizeTime(selectedTime)

  const isToday = session.appointmentDate === new Date().toISOString().split("T")[0]
  if (isToday) {
    const now = new Date()
    const currentTime = now.getTime()
    const minimumTime = currentTime + (15 * 60 * 1000) // 15 minutes buffer
    const slotDateTime = new Date(`${session.appointmentDate}T${normalizedTime}:00`)
    const slotTime = slotDateTime.getTime()
    
    // Reject if slot is in the past or less than 15 minutes away
    if (slotTime <= minimumTime) {
      const errorMsg = language === "gujarati"
        ? "❌ આ સમય પસાર થઈ ગયો છે અથવા ખૂબ નજીક છે. કૃપા કરીને ભવિષ્યનો સમય પસંદ કરો (ઓછામાં ઓછું 15 મિનિટ અંતર)."
        : "❌ That time has already passed or is too soon. Please pick a future slot (at least 15 minutes from now)."
      await sendTextMessage(phone, errorMsg)
      await sendTimePicker(phone, undefined, session.appointmentDate!, language)
      return true
    }
  }

  // Skip slot checking since no doctor is assigned yet - receptionist will check when assigning doctor

  await sessionRef.update({
    appointmentTime: normalizedTime,
    updatedAt: new Date().toISOString(),
  })

  const updatedSession: BookingSession = {
    ...session,
    appointmentTime: normalizedTime,
  }

  await sendConfirmationButtons(phone, sessionRef, updatedSession)
  return true
}

async function handleConfirmation(
  db: FirebaseFirestore.Firestore,
  phone: string,
  normalizedPhone: string,
  sessionRef: FirebaseFirestore.DocumentReference,
  text: string,
  session: BookingSession
): Promise<boolean> {
  const trimmedText = text.trim().toLowerCase()

  if (trimmedText !== "confirm" && trimmedText !== "yes") {
    await sendTextMessage(phone, "Booking cancelled. Type 'Book' to start again.")
    await sessionRef.delete()
    return true
  }

  // Validate payment info is set
  if (!session.paymentMethod || !session.paymentType) {
    await sendTextMessage(phone, "❌ Payment information missing. Please start booking again.")
    await sessionRef.delete()
    return true
  }

  // Create appointment
  try {
    const patient = await findPatientByPhone(db, normalizedPhone)
    if (!patient) {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://hospitalmanagementsystem-hazel.vercel.app"
      
      await sendTextMessage(
        phone,
        `❌ Patient record not found.\n\n📝 *Please register first:*\n\n${baseUrl}\n\nOr contact reception for assistance.`
      )
      await sessionRef.delete()
      return true
    }

    const doctorDoc = await db.collection("doctors").doc(session.doctorId!).get()
    if (!doctorDoc.exists) {
      await sendTextMessage(phone, "❌ Doctor not found. Please try again.")
      await sessionRef.delete()
      return true
    }

    const doctorData = doctorDoc.data()!
    const consultationFee = session.consultationFee || doctorData.consultationFee || 500
    const PARTIAL_PAYMENT_AMOUNT = Math.ceil(consultationFee * 0.1)
    
    const paymentMethod = session.paymentMethod || "cash"
    const paymentType = session.paymentType || "full"
    const isCash = paymentMethod === "cash"
    const collectedAmount = isCash ? 0 : (paymentType === "partial" ? PARTIAL_PAYMENT_AMOUNT : consultationFee)
    const remainingAmount = Math.max(consultationFee - collectedAmount, 0)

    // Determine payment status based on method and amount collected
    let paymentStatus: "pending" | "paid" = "pending"
    if (!isCash && remainingAmount === 0) {
      paymentStatus = "paid"
    }

    const appointmentId = await createAppointment(
      db,
      patient,
      { id: session.doctorId!, data: doctorData },
      {
        symptomCategory: "",
        chiefComplaint: session.symptoms || "General consultation",
        doctorId: session.doctorId!,
        appointmentDate: session.appointmentDate!,
        appointmentTime: session.appointmentTime!,
        medicalHistory: "",
        paymentOption: paymentMethod,
        paymentStatus: paymentStatus,
        paymentType,
        consultationFee,
        paymentAmount: collectedAmount,
        remainingAmount,
      },
      normalizedPhone
    )

    const sessionForConfirmation: BookingSession = {
      ...session,
      paymentMethod,
      paymentType,
      consultationFee,
      paymentAmount: collectedAmount,
      remainingAmount,
    }

    await sendBookingConfirmation(normalizedPhone, patient, doctorData, sessionForConfirmation, appointmentId)
    await sessionRef.delete()

    return true
  } catch (error: any) {
    console.error("[Meta WhatsApp] Error creating appointment:", error)
    if (error.message === "SLOT_ALREADY_BOOKED") {
      await sendTextMessage(phone, "❌ That slot was just booked. Please try again.")
    } else {
      await sendTextMessage(phone, "❌ Error creating appointment. Please contact reception.")
    }
    await sessionRef.delete()
    return true
  }
}

function generateTimeSlots(): string[] {
  const slots: string[] = []
  const SLOT_DURATION = 15 // 15-minute intervals
  
  // First part: 9:00 AM to 1:00 PM (09:00 to 13:00)
  // Generate slots every 15 minutes: 09:00, 09:15, 09:30, 09:45, 10:00, ..., 12:45
  for (let hour = 9; hour < 13; hour++) {
    for (let minute = 0; minute < 60; minute += SLOT_DURATION) {
      slots.push(`${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`)
    }
  }
  
  // Add 13:00 (1:00 PM) as the last morning slot
  slots.push("13:00")
  
  // Lunch break: 1:00 PM to 2:00 PM (13:00 to 14:00) - no slots
  
  // Second part: 2:00 PM to 5:00 PM (14:00 to 17:00)
  // Generate slots every 15 minutes: 14:00, 14:15, 14:30, 14:45, 15:00, ..., 16:45
  for (let hour = 14; hour < 17; hour++) {
    for (let minute = 0; minute < 60; minute += SLOT_DURATION) {
      slots.push(`${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`)
    }
  }
  
  // Add 17:00 (5:00 PM) as the last afternoon slot
  slots.push("17:00")
  
  return slots
}

/**
 * Check if a date is blocked (system-wide like Sunday OR doctor-specific blocked dates)
 * @param dateStr - Date string in YYYY-MM-DD format
 * @param doctorData - Doctor data from Firestore
 * @returns Object with isBlocked boolean and reason string if blocked
 */
function checkDateAvailability(dateStr: string, doctorData: any): { isBlocked: boolean; reason?: string } {
  if (!dateStr) return { isBlocked: false }

  const selectedDate = new Date(dateStr + "T00:00:00")
  
  // Check if date is a system-wide blocked day (e.g., Sunday)
  const visitingHours = doctorData?.visitingHours || DEFAULT_VISITING_HOURS
  const dayName = getDayName(selectedDate)
  const daySchedule = visitingHours[dayName]
  
  if (!daySchedule?.isAvailable || !daySchedule?.slots || daySchedule.slots.length === 0) {
    return { 
      isBlocked: true, 
      reason: `${dayName.charAt(0).toUpperCase() + dayName.slice(1)} is a blocked day. Please select another date.` 
    }
  }

  // Check if date is in doctor's specific blocked dates
  const blockedDates: any[] = Array.isArray(doctorData?.blockedDates) ? doctorData.blockedDates : []
  if (blockedDates.length > 0) {
    if (isDateBlockedFromRaw(dateStr, blockedDates)) {
      // Find the reason for the blocked date
      const normalizedDates = normalizeBlockedDates(blockedDates)
      const blockedDate = blockedDates.find((bd: any) => {
        const normalizedDate = bd?.date ? String(bd.date).slice(0, 10) : ""
        return normalizedDate === dateStr
      })
      const reason = blockedDate?.reason || "Doctor not available"
      return { 
        isBlocked: true, 
        reason: `This date is blocked: ${reason}. Please select another date.` 
      }
    }
  }

  return { isBlocked: false }
}

async function findPatientByPhone(db: FirebaseFirestore.Firestore, phone: string) {
  let snapshot = await db.collection("patients").where("phone", "==", phone).limit(1).get()
  if (snapshot.empty) {
    snapshot = await db.collection("patients").where("phoneNumber", "==", phone).limit(1).get()
  }
  if (snapshot.empty) return null
  const doc = snapshot.docs[0]
  return { id: doc.id, data: doc.data() }
}


async function createAppointment(
  db: FirebaseFirestore.Firestore,
  patient: { id: string; data: FirebaseFirestore.DocumentData },
  doctor: { id: string; data: FirebaseFirestore.DocumentData } | null,
  payload: {
    symptomCategory: string
    chiefComplaint: string
    doctorId: string
    appointmentDate: string
    appointmentTime: string
    medicalHistory: string
    paymentOption: string
    paymentStatus: string
    paymentType: "full" | "partial"
    consultationFee: number
    paymentAmount: number
    remainingAmount: number
  },
  phone: string,
  whatsappPending: boolean = false
) {
  const appointmentTime = normalizeTime(payload.appointmentTime)
  let appointmentId = ""

  await db.runTransaction(async (transaction) => {
    // Only create slot if doctor is assigned
    if (doctor && payload.doctorId) {
      const slotDocId = `${payload.doctorId}_${payload.appointmentDate}_${appointmentTime}`.replace(
        /[:\s]/g,
        "-"
      )
      const slotRef = db.collection("appointmentSlots").doc(slotDocId)
      const slotSnap = await transaction.get(slotRef)
      if (slotSnap.exists) {
        throw new Error("SLOT_ALREADY_BOOKED")
      }
    }

    const appointmentRef = db.collection("appointments").doc()
    appointmentId = appointmentRef.id

    const appointmentData: any = {
      patientId: patient.id,
      patientUid: patient.id,
      patientName: `${patient.data.firstName || ""} ${patient.data.lastName || ""}`.trim(),
      patientEmail: patient.data.email || "",
      patientPhone: phone,
      doctorId: payload.doctorId || "",
      doctorName: doctor ? `${doctor.data.firstName || ""} ${doctor.data.lastName || ""}`.trim() : "",
      doctorSpecialization: doctor ? (doctor.data.specialization || "") : "",
      appointmentDate: payload.appointmentDate,
      appointmentTime,
      symptomCategory: payload.symptomCategory,
      chiefComplaint: payload.chiefComplaint,
      medicalHistory: payload.medicalHistory,
      paymentMethod: payload.paymentOption,
      paymentStatus: payload.paymentStatus,
      paymentType: payload.paymentType,
      consultationFee: payload.consultationFee,
      totalConsultationFee: payload.consultationFee,
      paymentAmount: payload.paymentAmount,
      remainingAmount: payload.remainingAmount,
      status: whatsappPending ? "whatsapp_pending" : (payload.paymentStatus === "user_confirmed" ? "confirmed" : "pending"),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: whatsappPending ? "whatsapp" : "whatsapp_flow",
      whatsappPending: whatsappPending,
    }

    transaction.set(appointmentRef, appointmentData)

    // Only create slot if doctor is assigned
    if (doctor && payload.doctorId) {
      const slotDocId = `${payload.doctorId}_${payload.appointmentDate}_${appointmentTime}`.replace(
        /[:\s]/g,
        "-"
      )
      const slotRef = db.collection("appointmentSlots").doc(slotDocId)
      transaction.set(slotRef, {
        appointmentId,
        doctorId: payload.doctorId,
        appointmentDate: payload.appointmentDate,
        appointmentTime,
        createdAt: new Date().toISOString(),
      })
    }
  })

  return appointmentId
}

async function sendBookingConfirmation(
  phone: string,
  patient: { id: string; data: FirebaseFirestore.DocumentData },
  doctorData: FirebaseFirestore.DocumentData | null,
  session: BookingSession,
  appointmentId: string
) {
  const db = admin.firestore()
  
  // Fetch the created appointment to get all details
  const appointmentDoc = await db.collection("appointments").doc(appointmentId).get()
  if (!appointmentDoc.exists) {
    await sendTextMessage(phone, "❌ Error: Appointment not found. Please contact reception.")
    return
  }

  const appointmentData = appointmentDoc.data()! as any
  const doctorName = doctorData ? `${doctorData.firstName || ""} ${doctorData.lastName || ""}`.trim() : "To be assigned"
  const patientName = `${patient.data.firstName || ""} ${patient.data.lastName || ""}`.trim()
  const dateDisplay = new Date(session.appointmentDate! + "T00:00:00").toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })
  const [h, m] = session.appointmentTime!.split(":").map(Number)
  const timeDisplay = new Date(2000, 0, 1, h, m).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })

  const consultationFee = session.consultationFee || (doctorData?.consultationFee) || 500
  const amountCollected = session.paymentAmount !== undefined ? session.paymentAmount : 0
  const remainingAmount = session.remainingAmount !== undefined ? session.remainingAmount : consultationFee

  // Send confirmation message
  const isPending = !doctorData
  const confirmationMsg = isPending
    ? `🎉 *Appointment Request Received!*

Hi ${patientName},

Your appointment request has been received:
• 📅 Date: ${dateDisplay}
• 🕒 Time: ${timeDisplay}
• 📋 Appointment ID: ${appointmentId}
• 👨‍⚕️ Doctor: Will be assigned by reception

✅ Our receptionist will confirm your appointment and assign a doctor shortly. You'll receive a confirmation message once processed.

If you need to reschedule, just reply here or call us at +91-XXXXXXXXXX.`
    : `🎉 *Appointment Confirmed!*

Hi ${patientName},

Your appointment has been booked successfully:
• 👨‍⚕️ Doctor: ${doctorName}
• 📅 Date: ${dateDisplay}
• 🕒 Time: ${timeDisplay}
• 📋 Appointment ID: ${appointmentId}
• 💳 Payment: ${session.paymentMethod?.toUpperCase() || "CASH"} - ₹${amountCollected}${remainingAmount > 0 ? ` (₹${remainingAmount} due at hospital)` : " (paid)"}

✅ Your appointment is now visible in our system. Admin and receptionist can see it.

If you need to reschedule, just reply here or call us at +91-XXXXXXXXXX.`

  await sendTextMessage(phone, confirmationMsg)

  // Generate and send PDF only if doctor is assigned (not pending)
  if (!isPending && doctorData) {
    try {
      const appointment: Appointment = {
        id: appointmentId,
        transactionId: appointmentId,
        patientId: patient.id,
        patientUid: patient.id,
        patientName: patientName,
        patientEmail: patient.data.email || "",
        patientPhone: phone,
        doctorId: session.doctorId || "",
        doctorName: doctorName,
        doctorSpecialization: doctorData.specialization || "",
        appointmentDate: session.appointmentDate!,
        appointmentTime: session.appointmentTime!,
        status: (appointmentData.status === "confirmed" || appointmentData.status === "completed" || appointmentData.status === "cancelled") 
          ? appointmentData.status 
          : "confirmed",
        chiefComplaint: session.symptoms || "General consultation",
        medicalHistory: "",
        paymentMethod: session.paymentMethod || "cash",
        paymentStatus: appointmentData.paymentStatus || "pending",
        paymentType: session.paymentType || "full",
        totalConsultationFee: consultationFee,
        paymentAmount: amountCollected,
        remainingAmount,
        paidAt: appointmentData.paidAt || "",
        createdAt: appointmentData.createdAt || new Date().toISOString(),
        updatedAt: appointmentData.updatedAt || new Date().toISOString(),
      }

    // Generate PDF as base64
    const pdfBase64 = generateAppointmentConfirmationPDFBase64(appointment)
    
    // Extract base64 data (remove data:application/pdf;base64, prefix)
    const base64Data = pdfBase64.split(",")[1]

    // Store PDF in Firestore temporarily (for API endpoint to serve it)
    await db.collection("appointmentPDFs").doc(appointmentId).set({
      pdfBase64: base64Data,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
    })

    // Create PDF URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://hospitalmanagementsystem-hazel.vercel.app"
    
    const pdfUrl = `${baseUrl}/api/appointments/${appointmentId}/confirmation-pdf`
    
    // Verify PDF URL is accessible before sending
    try {
      const testResponse = await fetch(pdfUrl, { method: "HEAD" })
      if (!testResponse.ok) {
        throw new Error(`PDF URL not accessible: ${testResponse.status}`)
      }
    } catch (urlError: any) {
      console.error("[Meta WhatsApp] PDF URL verification failed:", urlError)
      // Still try to send, but log the issue
    }
    
    // Send PDF document via WhatsApp
    console.log("[Meta WhatsApp] Attempting to send PDF:", { phone, pdfUrl, appointmentId })
    const docResult = await sendDocumentMessage(
      phone,
      pdfUrl,
      `Appointment-Confirmation-${appointmentId}.pdf`,
      `📄 Your appointment confirmation PDF\n\nAppointment ID: ${appointmentId}`
    )

    if (!docResult.success) {
      console.error("[Meta WhatsApp] Failed to send PDF:", {
        error: docResult.error,
        errorCode: docResult.errorCode,
        pdfUrl,
        appointmentId,
      })
      // Fallback: send message with link to download
      await sendTextMessage(
        phone,
        `📄 *Download Your Appointment Confirmation*\n\nYour appointment confirmation PDF is ready:\n\n${pdfUrl}\n\nThis link is valid for 7 days.\n\nTap the link above to download your PDF.`
      )
    } else {
      console.log("[Meta WhatsApp] PDF sent successfully:", { messageId: docResult.messageId, appointmentId })
      // Send a follow-up message confirming PDF was sent
      await sendTextMessage(
        phone,
        "📄 Your appointment confirmation PDF has been sent above. Please check your WhatsApp messages."
      )
    }
    } catch (error: any) {
      console.error("[Meta WhatsApp] Error generating/sending PDF:", error)
      // Don't fail the booking if PDF fails
      await sendTextMessage(
        phone,
        "📄 Your appointment confirmation is available in your patient dashboard."
      )
    }
  }
}

