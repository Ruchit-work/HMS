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
  doctorSelection: {
    english: "👨‍⚕️ *Select a Doctor*\n\nChoose your preferred doctor:",
    gujarati: "👨‍⚕️ *ડૉક્ટર પસંદ કરો*\n\nતમારો પસંદીદા ડૉક્ટર પસંદ કરો:",
  },
  dateSelection: {
    english: "📅 *Select Appointment Date*\n\nTap the button below to see all available dates:",
    gujarati: "📅 *અપોઇન્ટમેન્ટ તારીખ પસંદ કરો*\n\nઉપલબ્ધ તારીખો જોવા માટે નીચેનું બટન ટેપ કરો:",
  },
  timeSelection: {
    english: "🕐 *Select Appointment Time*\n\nChoose your preferred time slot:",
    gujarati: "🕐 *સમય પસંદ કરો*\n\nતમારો પસંદીદા સમય પસંદ કરો:",
  },
  symptomsEntry: {
    english: "📋 *Symptoms/Reason for Visit:*\nPlease describe your symptoms or reason for the appointment.\n\n(You can type \"skip\" if you don't want to add symptoms now)",
    gujarati: "📋 *લક્ષણો/મુલાકાતનું કારણ:*\nકૃપા કરીને તમારા લક્ષણો અથવા અપોઇન્ટમેન્ટનું કારણ વર્ણન કરો.\n\n(જો તમે હમણાં લક્ષણો ઉમેરવા નહીં માંગતા હો તો \"skip\" ટાઇપ કરી શકો છો)",
  },
  paymentMethod: {
    english: "💳 *Select Payment Method*\n\nConsultation Fee: ₹{fee}\n\nChoose your preferred payment method:",
    gujarati: "💳 *ચુકવણીની પદ્ધતિ પસંદ કરો*\n\nસલાહ ફી: ₹{fee}\n\nતમારી પસંદીદા ચુકવણી પદ્ધતિ પસંદ કરો:",
  },
  paymentType: {
    english: "💳 *Payment Type*\n\nPayment Method: {method}\nConsultation Fee: ₹{fee}\n\nChoose payment type:",
    gujarati: "💳 *ચુકવણીનો પ્રકાર*\n\nચુકવણી પદ્ધતિ: {method}\nસલાહ ફી: ₹{fee}\n\nચુકવણીનો પ્રકાર પસંદ કરો:",
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

// Booking conversation states
type BookingState = "idle" | "selecting_language" | "selecting_doctor" | "selecting_date" | "selecting_time" | "entering_symptoms" | "selecting_payment" | "confirming"

interface BookingSession {
  state: BookingState
  language?: "gujarati" | "english" // Selected language for the booking session
  doctorId?: string
  appointmentDate?: string
  appointmentTime?: string
  symptoms?: string
  paymentMethod?: "card" | "upi" | "cash" | "wallet"
  paymentType?: "full" | "partial"
  consultationFee?: number
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
        paymentStatus: "pending",
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
    case "selecting_doctor":
      return await handleDoctorSelection(db, phone, normalizedPhone, sessionRef, text, session)
    case "selecting_date":
      return await handleDateSelection(db, phone, normalizedPhone, sessionRef, text, session)
    case "selecting_time":
      return await handleTimeSelection(db, phone, normalizedPhone, sessionRef, text, session)
    case "entering_symptoms":
      return await handleSymptomsEntry(db, phone, normalizedPhone, sessionRef, text, session)
    case "selecting_payment":
      return await handlePaymentSelection(db, phone, normalizedPhone, sessionRef, text, session)
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

  // Update session with selected language and move to doctor selection
  await sessionRef.update({
    language: selectedLanguage,
    state: "selecting_doctor",
    updatedAt: new Date().toISOString(),
  })

  // Send doctor picker
  await sendDoctorPicker(phone, selectedLanguage)
  return true
}

async function sendDoctorPicker(phone: string, language: "english" | "gujarati" = "english") {
  const db = admin.firestore()
  
  // Get available doctors
  const doctorsSnapshot = await db.collection("doctors").where("status", "==", "active").limit(10).get()
  if (doctorsSnapshot.empty) {
    const noDoctorsMsg = language === "gujarati" 
      ? "❌ આ સમયે કોઈ ડૉક્ટર ઉપલબ્ધ નથી. કૃપા કરીને રિસેપ્શનનો સંપર્ક કરો."
      : "❌ No doctors available at the moment. Please contact reception."
    await sendTextMessage(phone, noDoctorsMsg)
    return
  }

  const doctors = doctorsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))

  // Create doctor options for list message
  // WhatsApp List message limits:
  // - Row title: max 24 characters
  // - Row description: max 72 characters
  // - Section title: max 24 characters
  // - Button text: max 20 characters
  const doctorOptions = doctors.map((doc: any, index: number) => {
    const name = `${doc.firstName || ""} ${doc.lastName || ""}`.trim()
    const specialization = doc.specialization || "General"
    
    // Truncate title to 24 chars (WhatsApp limit)
    let title = `${name} - ${specialization}`
    if (title.length > 24) {
      // Try to fit name and specialization
      const namePart = name.length > 15 ? name.substring(0, 15) + "..." : name
      title = `${namePart} - ${specialization.substring(0, 24 - namePart.length - 3)}`
      if (title.length > 24) {
        title = title.substring(0, 24)
      }
    }
    
    // Truncate description to 72 chars (WhatsApp limit)
    let description = specialization
    if (description.length > 72) {
      description = description.substring(0, 72)
    }
    
    return {
      id: `doctor_${doc.id}`,
      title: title,
      description: description,
    }
  })

  // Split into sections if more than 10 (WhatsApp list limit is 10 rows per section)
  const sections = []
  for (let i = 0; i < doctorOptions.length; i += 10) {
    const sectionTitle = i === 0 
      ? (language === "gujarati" ? "ડૉક્ટરો" : "Available Doctors")
      : (language === "gujarati" ? "વધુ ડૉક્ટરો" : "More Doctors")
    
    // Ensure section title is max 24 chars
    const truncatedTitle = sectionTitle.length > 24 ? sectionTitle.substring(0, 24) : sectionTitle
    
    sections.push({
      title: truncatedTitle,
      rows: doctorOptions.slice(i, i + 10),
    })
  }

  const doctorMsg = language === "gujarati"
    ? "👨‍⚕️ *ડૉક્ટર પસંદ કરો*\n\nતમારો પસંદીદા ડૉક્ટર પસંદ કરો:"
    : "👨‍⚕️ *Select a Doctor*\n\nChoose your preferred doctor:"

  // Button text max 20 chars
  const buttonText = language === "gujarati" ? "ડૉક્ટર પસંદ કરો" : "Select Doctor"
  const truncatedButtonText = buttonText.length > 20 ? buttonText.substring(0, 20) : buttonText

  const listResponse = await sendListMessage(
    phone,
    doctorMsg,
    truncatedButtonText,
    sections,
    "Harmony Medical Services"
  )

  if (!listResponse.success) {
    console.error("[Meta WhatsApp] Failed to send doctor list message:", {
      error: listResponse.error,
      errorCode: listResponse.errorCode,
      phone: phone,
      doctorCount: doctors.length,
    })
    
    // Retry once with simplified format
    console.log("[Meta WhatsApp] Retrying doctor list with simplified format...")
    const simplifiedOptions = doctors.map((doc: any) => {
      const name = `${doc.firstName || ""} ${doc.lastName || ""}`.trim()
      const specialization = doc.specialization || "General"
      // Use just name if too long, or truncate
      const title = name.length > 24 ? name.substring(0, 21) + "..." : name
      return {
        id: `doctor_${doc.id}`,
        title: title,
        description: specialization.length > 72 ? specialization.substring(0, 72) : specialization,
      }
    })
    
    const simplifiedSections = []
    for (let i = 0; i < simplifiedOptions.length; i += 10) {
      simplifiedSections.push({
        title: i === 0 ? "Doctors" : "More",
        rows: simplifiedOptions.slice(i, i + 10),
      })
    }
    
    const retryResponse = await sendListMessage(
      phone,
      language === "gujarati" ? "ડૉક્ટર પસંદ કરો:" : "Select a Doctor:",
      "Select",
      simplifiedSections,
      "HMS"
    )
    
    if (!retryResponse.success) {
      console.error("[Meta WhatsApp] Retry also failed:", retryResponse.error)
      // Only fallback to text if both attempts fail
      const fallbackMsg = language === "gujarati"
        ? "👨‍⚕️ *ડૉક્ટર પસંદ કરો:*\n\n"
        : "👨‍⚕️ *Select a Doctor:*\n\n"
      
      let doctorList = fallbackMsg
      doctors.forEach((doc: any, index: number) => {
        const name = `${doc.firstName || ""} ${doc.lastName || ""}`.trim()
        const specialization = doc.specialization || "General"
        doctorList += `${index + 1}. ${name} - ${specialization}\n`
      })
      
      const promptMsg = language === "gujarati"
        ? "\nકૃપા કરીને તમે બુક કરવા માંગો છો તે ડૉક્ટરનો નંબર (1-10) રિપ્લાય કરો."
        : "\nPlease reply with the number (1-10) of the doctor you'd like to book with."
      
      await sendTextMessage(phone, doctorList + promptMsg)
    } else {
      console.log("[Meta WhatsApp] ✅ Doctor list sent successfully on retry")
    }
  } else {
    console.log("[Meta WhatsApp] ✅ Doctor list sent successfully")
  }
}

async function handleDoctorSelection(
  db: FirebaseFirestore.Firestore,
  phone: string,
  normalizedPhone: string,
  sessionRef: FirebaseFirestore.DocumentReference,
  text: string,
  session: BookingSession
): Promise<boolean> {
  const language = session.language || "english"
  
  // Try to parse as number first (fallback for text input)
  const doctorNum = parseInt(text)
  if (!isNaN(doctorNum) && doctorNum >= 1 && doctorNum <= 10) {
    const doctorsSnapshot = await db.collection("doctors").where("status", "==", "active").limit(10).get()
    const doctors = doctorsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))

    if (doctorNum <= doctors.length) {
      const selectedDoctor = doctors[doctorNum - 1] as any
      await sessionRef.update({
        state: "selecting_date",
        doctorId: selectedDoctor.id,
        updatedAt: new Date().toISOString(),
      })

      const confirmMsg = language === "gujarati"
        ? `✅ પસંદ કર્યું: ${selectedDoctor.firstName} ${selectedDoctor.lastName}\n\n📅 હવે તમારી પસંદીદા અપોઇન્ટમેન્ટ તારીખ પસંદ કરો:`
        : `✅ Selected: ${selectedDoctor.firstName} ${selectedDoctor.lastName}\n\n📅 Now select your preferred appointment date:`

      await sendTextMessage(phone, confirmMsg)
      await sendDatePicker(phone, selectedDoctor.id, language)
      return true
    }
  }

  // Invalid input, resend doctor picker
  await sendDoctorPicker(phone, language)
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

    await sendTimePicker(phone, session.doctorId!, selectedDate, language)
    return true
  }

  // No text provided, send date picker
  await sendDatePicker(phone, session.doctorId, language)
  return true
}

async function sendDatePicker(phone: string, doctorId?: string, language: Language = "english", showButtons: boolean = true) {
  const db = admin.firestore()
  let doctorData: any = null
  
  // Fetch doctor data if doctor ID is provided to check blocked dates
  if (doctorId) {
    const doctorDoc = await db.collection("doctors").doc(doctorId).get()
    if (doctorDoc.exists) {
      doctorData = doctorDoc.data()!
    }
  }
  
  // If showButtons is true, send quick action buttons first
  if (showButtons) {
    const today = new Date().toISOString().split("T")[0]
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().split("T")[0]
    const dayAfter = new Date()
    dayAfter.setDate(dayAfter.getDate() + 2)
    const dayAfterStr = dayAfter.toISOString().split("T")[0]

    // Check which quick dates are available
    const availableQuickDates: Array<{ id: string; title: string; date: string }> = []
    
    if (!doctorData || !checkDateAvailability(today, doctorData).isBlocked) {
      availableQuickDates.push({
        id: `date_${today}`,
        title: language === "gujarati" ? "📅 આજે (Today)" : "📅 Today",
        date: today,
      })
    }
    
    if (!doctorData || !checkDateAvailability(tomorrowStr, doctorData).isBlocked) {
      availableQuickDates.push({
        id: `date_${tomorrowStr}`,
        title: language === "gujarati" ? "📅 આવતીકાલ (Tomorrow)" : "📅 Tomorrow",
        date: tomorrowStr,
      })
    }

    // If we have at least one quick date, show buttons
    if (availableQuickDates.length > 0) {
      const quickButtons = availableQuickDates.map(qd => ({
        id: qd.id,
        title: qd.title,
      }))
      
      // Add "See All Dates" button (max 3 buttons allowed)
      if (quickButtons.length < 3) {
        quickButtons.push({
          id: "date_show_all",
          title: language === "gujarati" ? "📋 બધી તારીખો (See All)" : "📋 See All Dates",
        })
      }

      const dateMsg = language === "gujarati"
        ? "📅 *અપોઇન્ટમેન્ટ તારીખ પસંદ કરો*\n\nઝડપી પસંદગી માટે નીચેના બટનમાંથી પસંદ કરો અથવા બધી તારીખો જોવા માટે 'See All Dates' પસંદ કરો:"
        : "📅 *Select Appointment Date*\n\nChoose from quick options below or tap 'See All Dates' to view all available dates:"

      const buttonResponse = await sendMultiButtonMessage(
        phone,
        dateMsg,
        quickButtons,
        "Harmony Medical Services"
      )

      if (buttonResponse.success) {
        return // Buttons sent successfully
      } else {
        console.error("[Meta WhatsApp] Failed to send date buttons, falling back to list:", buttonResponse.error)
        // Fallback to list
      }
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
  
  // Split date options into sections if more than 10 (WhatsApp list limit is 10 rows per section)
  const sections = []
  for (let i = 0; i < dateOptions.length; i += 10) {
    sections.push({
      title: i === 0 ? (language === "gujarati" ? "ઉપલબ્ધ તારીખો" : "Available Dates") : (language === "gujarati" ? "વધુ તારીખો" : "More Dates"),
      rows: dateOptions.slice(i, i + 10),
    })
  }

  const dateMsg = language === "gujarati"
    ? "📅 *અપોઇન્ટમેન્ટ તારીખ પસંદ કરો*\n\nઉપલબ્ધ તારીખો જોવા માટે નીચેનું બટન ટેપ કરો:"
    : "📅 *Select Appointment Date*\n\nTap the button below to see all available dates:"

  const listResponse = await sendListMessage(
    phone,
    dateMsg,
    language === "gujarati" ? "📅 તારીખ પસંદ કરો" : "📅 Pick a Date",
    sections,
    "Harmony Medical Services"
  )

  if (!listResponse.success) {
    console.error("[Meta WhatsApp] Failed to send date picker list:", listResponse.error)
    // Fallback to text-based selection
    const fallbackMsg = language === "gujarati"
      ? "📅 *તારીખ પસંદ કરો:*\n\nકૃપા કરીને તમારી પસંદીદા તારીખ દાખલ કરો:\n• આજે માટે 'today' ટાઇપ કરો\n• આવતીકાલ માટે 'tomorrow' ટાઇપ કરો\n• અથવા YYYY-MM-DD સ્વરૂપમાં તારીખ દાખલ કરો (દા.ત., 2025-01-15)"
      : "📅 *Select Date:*\n\nPlease enter your preferred date:\n• Type 'today' for today\n• Type 'tomorrow' for tomorrow\n• Or enter date as YYYY-MM-DD (e.g., 2025-01-15)"
    await sendTextMessage(phone, fallbackMsg)
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
      state: "selecting_doctor",
      updatedAt: new Date().toISOString(),
    })

    // Send doctor list picker
    await sendDoctorPicker(phone, selectedLanguage)
    return
  }

  // Check if it's a doctor selection (ID starts with "doctor_")
  if (selectedId.startsWith("doctor_")) {
    const selectedDoctorId = selectedId.replace("doctor_", "")
    
    // Verify doctor exists
    const doctorDoc = await db.collection("doctors").doc(selectedDoctorId).get()
    if (!doctorDoc.exists) {
      const errorMsg = language === "gujarati"
        ? "❌ ડૉક્ટર મળ્યો નથી. કૃપા કરીને ફરીથી પ્રયાસ કરો."
        : "❌ Doctor not found. Please try again."
      await sendTextMessage(phone, errorMsg)
      await sendDoctorPicker(phone, language)
      return
    }

    const doctorData = doctorDoc.data()!
    const doctorName = `${doctorData.firstName || ""} ${doctorData.lastName || ""}`.trim()

    await sessionRef.update({
      state: "selecting_date",
      doctorId: selectedDoctorId,
      updatedAt: new Date().toISOString(),
    })

    const confirmMsg = language === "gujarati"
      ? `✅ પસંદ કર્યું: ${doctorName}\n\n📅 હવે તમારી પસંદીદા અપોઇન્ટમેન્ટ તારીખ પસંદ કરો:`
      : `✅ Selected: ${doctorName}\n\n📅 Now select your preferred appointment date:`

    await sendTextMessage(phone, confirmMsg)
    await sendDatePicker(phone, selectedDoctorId, language)
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
    await sendTimePicker(phone, session.doctorId!, selectedDate, language)
    return
  }

  // Check if it's a time selection (ID starts with "time_")
  if (selectedId.startsWith("time_")) {
    const selectedTime = selectedId.replace("time_", "")
    const normalizedTime = normalizeTime(selectedTime)

    // Check if slot is already booked
    const slotDocId = `${session.doctorId}_${session.appointmentDate}_${normalizedTime}`.replace(/[:\s]/g, "-")
    const slotRef = db.collection("appointmentSlots").doc(slotDocId)
    const slotDoc = await slotRef.get()

    if (slotDoc.exists) {
      const errorMsg = language === "gujarati"
        ? "❌ આ સમય સ્લોટ પહેલેથી બુક થયેલ છે. કૃપા કરીને બીજો સમય પસંદ કરો."
        : "❌ This time slot is already booked. Please select another time."
      await sendTextMessage(phone, errorMsg)
      // Resend time picker
      await sendTimePicker(phone, session.doctorId!, session.appointmentDate!, language)
      return
    }

    await sessionRef.update({
      state: "entering_symptoms",
      appointmentTime: normalizedTime,
      updatedAt: new Date().toISOString(),
    })

    const symptomsMsg = language === "gujarati"
      ? `✅ પસંદ કર્યું: ${selectedTime}\n\n📋 *લક્ષણો/મુલાકાતનું કારણ:*\nકૃપા કરીને તમારા લક્ષણો અથવા અપોઇન્ટમેન્ટનું કારણ વર્ણન કરો.\n\n(જો તમે હમણાં લક્ષણો ઉમેરવા નહીં માંગતા હો તો "skip" ટાઇપ કરી શકો છો)`
      : `✅ Selected: ${selectedTime}\n\n📋 *Symptoms/Reason for Visit:*\nPlease describe your symptoms or reason for the appointment.\n\n(You can type "skip" if you don't want to add symptoms now)`
    await sendTextMessage(phone, symptomsMsg)
    return
  }

  // Check if it's a payment method selection (ID starts with "pay_")
  if (selectedId.startsWith("pay_")) {
    const paymentMethod = selectedId.replace("pay_", "") as "card" | "upi" | "cash" | "wallet"
    await sessionRef.update({
      paymentMethod: paymentMethod,
      updatedAt: new Date().toISOString(),
    })

    // Now ask for payment type (full or partial)
    await sendPaymentTypePicker(phone, session.consultationFee || 500, paymentMethod)
    return
  }

  // Check if it's a payment type selection (ID starts with "paytype_")
  if (selectedId.startsWith("paytype_")) {
    const paymentType = selectedId.replace("paytype_", "") as "full" | "partial"
    await sessionRef.update({
      paymentType: paymentType,
      state: "confirming",
      updatedAt: new Date().toISOString(),
    })

    // Show confirmation with all details
    await showBookingConfirmation(phone, sessionRef, session)
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
    await sendDatePicker(phone, session.doctorId, language, false) // false = show list, not buttons
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

  await sendTimePicker(phone, session.doctorId!, selectedDate, language)
}

// Handler for time button clicks (Morning, Afternoon, See All)
async function handleTimeButtonClick(phone: string, buttonId: string) {
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
  if (buttonId === "time_show_all") {
    await sendTimePicker(phone, session.doctorId!, session.appointmentDate!, language, false) // false = show list, not buttons
    return
  }

  // Get available slots for the selected time period
  const timeSlots = generateTimeSlots()
  let selectedSlots: string[] = []

  if (buttonId === "time_quick_morning") {
    // Morning slots: 9:00 to 11:30
    selectedSlots = timeSlots.filter(slot => {
      const hour = parseInt(slot.split(":")[0])
      return hour >= 9 && hour < 12
    })
  } else if (buttonId === "time_quick_afternoon") {
    // Afternoon slots: 12:00 to 17:00
    selectedSlots = timeSlots.filter(slot => {
      const hour = parseInt(slot.split(":")[0])
      return hour >= 12 && hour < 17
    })
  }

  if (selectedSlots.length === 0) {
    const errorMsg = language === "gujarati"
      ? "❌ આ સમય અવધિ માટે કોઈ સ્લોટ ઉપલબ્ધ નથી. કૃપા કરીને બીજો સમય પસંદ કરો."
      : "❌ No slots available for this time period. Please select another time."
    await sendTextMessage(phone, errorMsg)
    await sendTimePicker(phone, session.doctorId!, session.appointmentDate!, language)
    return
  }

  // Check which slots are actually available (not booked) and find the FIRST available slot
  let firstAvailableSlot: { id: string; title: string; time: string } | null = null
  
  // Sort slots in chronological order to find the first available
  const sortedSlots = [...selectedSlots].sort((a, b) => {
    const [hA, mA] = a.split(":").map(Number)
    const [hB, mB] = b.split(":").map(Number)
    return hA * 60 + mA - (hB * 60 + mB)
  })
  
  for (const slot of sortedSlots) {
    const normalizedTime = normalizeTime(slot)
    const slotDocId = `${session.doctorId}_${session.appointmentDate}_${normalizedTime}`.replace(/[:\s]/g, "-")
    const slotRef = db.collection("appointmentSlots").doc(slotDocId)
    const slotDoc = await slotRef.get()
    
    if (!slotDoc.exists) {
      // Found first available slot - book it automatically
      firstAvailableSlot = {
        id: `time_${slot}`,
        title: slot,
        time: normalizedTime,
      }
      break // Stop at first available slot
    }
  }

  if (!firstAvailableSlot) {
    // No slots available in this time period
    const errorMsg = language === "gujarati"
      ? "❌ આ સમય અવધિ માટે બધા સ્લોટ બુક થયેલા છે. કૃપા કરીને બીજો સમય પસંદ કરો."
      : "❌ All slots for this time period are booked. Please select another time."
    await sendTextMessage(phone, errorMsg)
    await sendTimePicker(phone, session.doctorId!, session.appointmentDate!, language)
    return
  }

  // Automatically book the first available slot
  await sessionRef.update({
    state: "entering_symptoms",
    appointmentTime: firstAvailableSlot.time,
    updatedAt: new Date().toISOString(),
  })

  const periodName = buttonId === "time_quick_morning" 
    ? (language === "gujarati" ? "સવાર" : "Morning")
    : (language === "gujarati" ? "બપોર" : "Afternoon")
  
  const symptomsMsg = language === "gujarati"
    ? `✅ ${periodName} માટે પહેલું ઉપલબ્ધ સ્લોટ પસંદ કર્યું: ${firstAvailableSlot.title}\n\n📋 *લક્ષણો/મુલાકાતનું કારણ:*\nકૃપા કરીને તમારા લક્ષણો અથવા અપોઇન્ટમેન્ટનું કારણ વર્ણન કરો.\n\n(જો તમે હમણાં લક્ષણો ઉમેરવા નહીં માંગતા હો તો "skip" ટાઇપ કરી શકો છો)`
    : `✅ First available ${periodName.toLowerCase()} slot selected: ${firstAvailableSlot.title}\n\n📋 *Symptoms/Reason for Visit:*\nPlease describe your symptoms or reason for the appointment.\n\n(You can type "skip" if you don't want to add symptoms now)`
  
  await sendTextMessage(phone, symptomsMsg)
}

async function sendTimePicker(phone: string, doctorId: string, appointmentDate: string, language: Language = "english", showButtons: boolean = true) {
  const db = admin.firestore()
  const timeSlots = generateTimeSlots()
  
  // Check which slots are available (filter out already booked slots)
  const availableSlots: Array<{ id: string; title: string; description?: string }> = []
  
  for (const slot of timeSlots) {
    const normalizedTime = normalizeTime(slot)
    const slotDocId = `${doctorId}_${appointmentDate}_${normalizedTime}`.replace(/[:\s]/g, "-")
    const slotRef = db.collection("appointmentSlots").doc(slotDocId)
    const slotDoc = await slotRef.get()
    
    if (!slotDoc.exists) {
      availableSlots.push({
        id: `time_${slot}`,
        title: slot, // Just the time like "09:00", "09:30", etc.
        description: "", // Empty for cleaner look in interactive list (radio button style)
      })
    }
  }
  
  if (availableSlots.length === 0) {
    const noSlotsMsg = language === "gujarati"
      ? "❌ આ તારીખ માટે કોઈ સમય સ્લોટ ઉપલબ્ધ નથી. કૃપા કરીને બીજી તારીખ પસંદ કરો."
      : "❌ No time slots available for this date. Please select another date."
    await sendTextMessage(phone, noSlotsMsg)
    await sendDatePicker(phone, doctorId, language)
    return
  }

  // If showButtons is true, send quick action buttons first
  if (showButtons && availableSlots.length > 0) {
    // Group slots into time periods
    const morningSlots = availableSlots.filter(s => {
      const hour = parseInt(s.title.split(":")[0])
      return hour >= 9 && hour < 12
    })
    
    const afternoonSlots = availableSlots.filter(s => {
      const hour = parseInt(s.title.split(":")[0])
      return hour >= 12 && hour < 17
    })

    const quickButtons: Array<{ id: string; title: string }> = []
    
    // Add Morning button if slots available
    if (morningSlots.length > 0) {
      quickButtons.push({
        id: "time_quick_morning",
        title: language === "gujarati" ? "🌅 સવાર (9AM-12PM)" : "🌅 Morning (9AM-12PM)",
      })
    }
    
    // Add Afternoon button if slots available
    if (afternoonSlots.length > 0 && quickButtons.length < 2) {
      quickButtons.push({
        id: "time_quick_afternoon",
        title: language === "gujarati" ? "☀️ બપોર (12PM-5PM)" : "☀️ Afternoon (12PM-5PM)",
      })
    }
    
    // Add "See All Times" button ONLY if we have exactly 2 quick buttons (Morning + Afternoon)
    // If only one period is available, don't show "See All" button
    if (quickButtons.length === 2) {
      quickButtons.push({
        id: "time_show_all",
        title: language === "gujarati" ? "📋 બધા સમય (See All)" : "📋 See All Times",
      })
    }

    if (quickButtons.length > 0) {
      const timeMsg = language === "gujarati"
        ? "🕐 *સમય પસંદ કરો*\n\nઝડપી પસંદગી માટે નીચેના બટનમાંથી પસંદ કરો અથવા બધા સમય જોવા માટે 'See All Times' પસંદ કરો:"
        : "🕐 *Select Appointment Time*\n\nChoose from quick options below or tap 'See All Times' to view all available time slots:"

      const buttonResponse = await sendMultiButtonMessage(
        phone,
        timeMsg,
        quickButtons,
        "Harmony Medical Services"
      )

      if (buttonResponse.success) {
        return // Buttons sent successfully
      } else {
        console.error("[Meta WhatsApp] Failed to send time buttons, falling back to list:", buttonResponse.error)
        // Fallback to list
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

  // Format slots for list message - just the time, clean and simple
  const formattedSlots = sortedSlots.map(slot => ({
    id: slot.id,
    title: slot.title, // Just the time like "09:00", "09:30", etc.
    description: "", // Empty description for cleaner look
  }))

  // Split into sections if more than 10 (WhatsApp list limit is 10 rows per section)
  const sections = []
  for (let i = 0; i < formattedSlots.length; i += 10) {
    const sectionTitle = i === 0 
      ? (language === "gujarati" ? "સમય પસંદ કરો" : "Available Times")
      : (language === "gujarati" ? "વધુ સમય" : "More Times")
    
    // Ensure section title doesn't exceed 24 chars
    const truncatedSectionTitle = sectionTitle.length > 24 ? sectionTitle.substring(0, 24) : sectionTitle
    
    sections.push({
      title: truncatedSectionTitle,
      rows: formattedSlots.slice(i, i + 10),
    })
  }

  const timeMsg = language === "gujarati"
    ? "🕐 *સમય પસંદ કરો*\n\nતમારો પસંદીદા સમય પસંદ કરો:"
    : "🕐 *Select Time*\n\nChoose your preferred time slot:"

  // Button text max 20 chars
  const buttonText = language === "gujarati" ? "સમય પસંદ કરો" : "Select Time"
  const truncatedButtonText = buttonText.length > 20 ? buttonText.substring(0, 20) : buttonText

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
    
    // Retry with simplified format
    console.log("[Meta WhatsApp] Retrying time slot list with simplified format...")
    const simplifiedSlots = formattedSlots.map(slot => ({
      id: slot.id,
      title: slot.title.length > 24 ? slot.title.substring(0, 21) + "..." : slot.title,
      description: "",
    }))

    const simplifiedSections = []
    for (let i = 0; i < simplifiedSlots.length; i += 10) {
      simplifiedSections.push({
        title: i === 0 ? "Times" : "More",
        rows: simplifiedSlots.slice(i, i + 10),
      })
    }

    const retryResponse = await sendListMessage(
      phone,
      language === "gujarati" ? "સમય પસંદ કરો:" : "Select Time:",
      "Select",
      simplifiedSections,
      "HMS"
    )

    if (!retryResponse.success) {
      console.error("[Meta WhatsApp] Retry also failed:", retryResponse.error)
      // Only fallback to text if both attempts fail
      const timeListMsg = language === "gujarati" ? "🕐 *સમય પસંદ કરો:*\n\n" : "🕐 *Select Time:*\n\n"
      let timeList = timeListMsg
      sortedSlots.forEach((slot, index) => {
        timeList += `${index + 1}. ${slot.title}\n`
      })
      const promptMsg = language === "gujarati"
        ? "\nકૃપા કરીને તમારા પસંદીદા સમય સ્લોટનો નંબર રિપ્લાય કરો."
        : "\nPlease reply with the number of your preferred time slot."
      timeList += promptMsg
      await sendTextMessage(phone, timeList)
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
  
  // Fallback: if user types a number, treat it as time slot selection
  const slotNum = parseInt(text)
  const timeSlots = generateTimeSlots()

  if (isNaN(slotNum) || slotNum < 1 || slotNum > timeSlots.length) {
    // Resend time picker
    await sendTimePicker(phone, session.doctorId!, session.appointmentDate!, language)
    return true
  }

  const selectedTime = timeSlots[slotNum - 1]
  const normalizedTime = normalizeTime(selectedTime)

  // Check if slot is already booked
  const slotDocId = `${session.doctorId}_${session.appointmentDate}_${normalizedTime}`.replace(/[:\s]/g, "-")
  const slotRef = db.collection("appointmentSlots").doc(slotDocId)
  const slotDoc = await slotRef.get()

  if (slotDoc.exists) {
    const errorMsg = language === "gujarati"
      ? "❌ આ સમય સ્લોટ પહેલેથી બુક થયેલ છે. કૃપા કરીને બીજો સમય પસંદ કરો."
      : "❌ This time slot is already booked. Please select another time."
    await sendTextMessage(phone, errorMsg)
    await sendTimePicker(phone, session.doctorId!, session.appointmentDate!, language)
    return true
  }

  await sessionRef.update({
    state: "entering_symptoms",
    appointmentTime: normalizedTime,
    updatedAt: new Date().toISOString(),
  })

  const symptomsMsg = language === "gujarati"
    ? `✅ પસંદ કર્યું: ${selectedTime}\n\n📋 *લક્ષણો/મુલાકાતનું કારણ:*\nકૃપા કરીને તમારા લક્ષણો અથવા અપોઇન્ટમેન્ટનું કારણ વર્ણન કરો.\n\n(જો તમે હમણાં લક્ષણો ઉમેરવા નહીં માંગતા હો તો "skip" ટાઇપ કરી શકો છો)`
    : `✅ Selected: ${selectedTime}\n\n📋 *Symptoms/Reason for Visit:*\nPlease describe your symptoms or reason for the appointment.\n\n(You can type "skip" if you don't want to add symptoms now)`
  await sendTextMessage(phone, symptomsMsg)
  return true
}

async function handleSymptomsEntry(
  db: FirebaseFirestore.Firestore,
  phone: string,
  normalizedPhone: string,
  sessionRef: FirebaseFirestore.DocumentReference,
  text: string,
  session: BookingSession
): Promise<boolean> {
  const symptoms = text.trim().toLowerCase() === "skip" ? "" : text.trim()

  // Get doctor info to get consultation fee
  const doctorDoc = await db.collection("doctors").doc(session.doctorId!).get()
  const doctorData = doctorDoc.data()!
  const consultationFee = doctorData.consultationFee || 500

  await sessionRef.update({
    state: "selecting_payment",
    symptoms: symptoms,
    consultationFee: consultationFee,
    updatedAt: new Date().toISOString(),
  })

  // Send payment method picker
  await sendPaymentMethodPicker(phone, consultationFee)
  return true
}

async function handlePaymentSelection(
  db: FirebaseFirestore.Firestore,
  phone: string,
  normalizedPhone: string,
  sessionRef: FirebaseFirestore.DocumentReference,
  text: string,
  session: BookingSession
): Promise<boolean> {
  // If text is provided, try to parse it as payment method (fallback)
  const trimmedText = text.trim().toLowerCase()
  
  if (trimmedText === "card" || trimmedText === "upi" || trimmedText === "cash" || trimmedText === "wallet") {
    await sessionRef.update({
      paymentMethod: trimmedText as "card" | "upi" | "cash" | "wallet",
      updatedAt: new Date().toISOString(),
    })
    await sendPaymentTypePicker(phone, session.consultationFee || 500, trimmedText as "card" | "upi" | "cash" | "wallet")
    return true
  }

  // Invalid input, resend payment picker
  await sendPaymentMethodPicker(phone, session.consultationFee || 500)
  return true
}

async function sendPaymentMethodPicker(phone: string, consultationFee: number) {
  const paymentOptions = [
    { id: "pay_card", title: "💳 Card Payment", description: "Credit/Debit Card" },
    { id: "pay_upi", title: "📱 UPI Payment", description: "Google Pay, PhonePe, etc." },
    { id: "pay_cash", title: "💵 Cash Payment", description: "Pay at hospital" },
    { id: "pay_wallet", title: "💰 Wallet Payment", description: "Use wallet balance" },
  ]

  const listResponse = await sendListMessage(
    phone,
    `💳 *Select Payment Method*\n\nConsultation Fee: ₹${consultationFee}\n\nChoose your preferred payment method:`,
    "Select Payment",
    [
      {
        title: "Payment Methods",
        rows: paymentOptions,
      },
    ],
    "Harmony Medical Services"
  )

  if (!listResponse.success) {
    // Fallback to text-based selection
    await sendTextMessage(
      phone,
      `💳 *Select Payment Method*\n\nConsultation Fee: ₹${consultationFee}\n\nPlease reply with:\n• "card" for Card Payment\n• "upi" for UPI Payment\n• "cash" for Cash Payment\n• "wallet" for Wallet Payment`
    )
  }
}

async function sendPaymentTypePicker(phone: string, consultationFee: number, paymentMethod: string) {
  const PARTIAL_PAYMENT_AMOUNT = Math.ceil(consultationFee * 0.1) // 10% upfront
  const REMAINING_AMOUNT = consultationFee - PARTIAL_PAYMENT_AMOUNT

  const paymentTypeOptions = [
    {
      id: "paytype_full",
      title: `💰 Full Payment - ₹${consultationFee}`,
      description: "Pay complete amount now",
    },
    {
      id: "paytype_partial",
      title: `💵 Partial Payment - ₹${PARTIAL_PAYMENT_AMOUNT}`,
      description: `Pay ₹${PARTIAL_PAYMENT_AMOUNT} now, ₹${REMAINING_AMOUNT} at hospital`,
    },
  ]

  const methodLabel = paymentMethod === "card" ? "Card" : paymentMethod === "upi" ? "UPI" : paymentMethod === "cash" ? "Cash" : "Wallet"

  const listResponse = await sendListMessage(
    phone,
    `💳 *Payment Type*\n\nPayment Method: ${methodLabel}\nConsultation Fee: ₹${consultationFee}\n\nChoose payment type:`,
    "Select Type",
    [
      {
        title: "Payment Options",
        rows: paymentTypeOptions,
      },
    ],
    "Harmony Medical Services"
  )

  if (!listResponse.success) {
    // Fallback to text-based selection
    await sendTextMessage(
      phone,
      `💳 *Payment Type*\n\nPayment Method: ${methodLabel}\nConsultation Fee: ₹${consultationFee}\n\nPlease reply with:\n• "full" to pay ₹${consultationFee} now\n• "partial" to pay ₹${PARTIAL_PAYMENT_AMOUNT} now (₹${REMAINING_AMOUNT} at hospital)`
    )
  }
}

async function showBookingConfirmation(
  phone: string,
  sessionRef: FirebaseFirestore.DocumentReference,
  session: BookingSession
) {
  const db = admin.firestore()
  const normalizedPhone = formatPhoneNumber(phone)

  // Get doctor and patient info
  const doctorDoc = await db.collection("doctors").doc(session.doctorId!).get()
  const doctorData = doctorDoc.data()!
  const patient = await findPatientByPhone(db, normalizedPhone)

  const doctorName = `${doctorData.firstName || ""} ${doctorData.lastName || ""}`.trim()
  const patientName = patient ? `${patient.data.firstName || ""} ${patient.data.lastName || ""}`.trim() : "Patient"
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

  const consultationFee = session.consultationFee || 500
  const PARTIAL_PAYMENT_AMOUNT = Math.ceil(consultationFee * 0.1)
  const amountToPay = session.paymentType === "partial" ? PARTIAL_PAYMENT_AMOUNT : consultationFee
  const paymentMethodLabel = session.paymentMethod === "card" ? "Card" : session.paymentMethod === "upi" ? "UPI" : session.paymentMethod === "cash" ? "Cash" : "Wallet"
  const paymentTypeLabel = session.paymentType === "partial" ? `Partial (₹${amountToPay} now, ₹${consultationFee - amountToPay} at hospital)` : "Full"

  let confirmMsg = `📋 *Confirm Appointment:*\n\n`
  confirmMsg += `👨‍⚕️ Doctor: ${doctorName}\n`
  confirmMsg += `📅 Date: ${dateDisplay}\n`
  confirmMsg += `🕐 Time: ${timeDisplay}\n`
  if (session.symptoms) {
    confirmMsg += `📝 Symptoms: ${session.symptoms}\n`
  }
  confirmMsg += `\n💳 Payment:\n`
  confirmMsg += `   Method: ${paymentMethodLabel}\n`
  confirmMsg += `   Type: ${paymentTypeLabel}\n`
  confirmMsg += `   Amount: ₹${amountToPay}\n`
  confirmMsg += `\nReply "confirm" to book or "cancel" to start over.`

  await sendTextMessage(phone, confirmMsg)
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
    
    // Determine payment status based on method and type
    let paymentStatus = "pending"
    if (session.paymentMethod === "cash") {
      paymentStatus = "pending" // Cash is paid at hospital
    } else if (session.paymentMethod === "card" || session.paymentMethod === "upi" || session.paymentMethod === "wallet") {
      paymentStatus = "pending" // Will be processed (can be updated later when payment is actually processed)
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
        paymentOption: session.paymentMethod,
        paymentStatus: paymentStatus,
      },
      normalizedPhone
    )

    await sendBookingConfirmation(normalizedPhone, patient, doctorData, session, appointmentId)
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
  for (let hour = 9; hour <= 17; hour++) {
    slots.push(`${hour.toString().padStart(2, "0")}:00`)
    if (hour < 17) {
      slots.push(`${hour.toString().padStart(2, "0")}:30`)
    }
  }
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
  doctor: { id: string; data: FirebaseFirestore.DocumentData },
  payload: {
    symptomCategory: string
    chiefComplaint: string
    doctorId: string
    appointmentDate: string
    appointmentTime: string
    medicalHistory: string
    paymentOption: string
    paymentStatus: string
  },
  phone: string
) {
  const appointmentTime = normalizeTime(payload.appointmentTime)
  const slotDocId = `${payload.doctorId}_${payload.appointmentDate}_${appointmentTime}`.replace(
    /[:\s]/g,
    "-"
  )

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
      patientId: patient.id,
      patientUid: patient.id,
      patientName: `${patient.data.firstName || ""} ${patient.data.lastName || ""}`.trim(),
      patientEmail: patient.data.email || "",
      patientPhone: phone,
      doctorId: payload.doctorId,
      doctorName: `${doctor.data.firstName || ""} ${doctor.data.lastName || ""}`.trim(),
      doctorSpecialization: doctor.data.specialization || "",
      appointmentDate: payload.appointmentDate,
      appointmentTime,
      symptomCategory: payload.symptomCategory,
      chiefComplaint: payload.chiefComplaint,
      medicalHistory: payload.medicalHistory,
      paymentMethod: payload.paymentOption,
      paymentStatus: payload.paymentStatus,
      paymentAmount: 0,
      status: payload.paymentStatus === "user_confirmed" ? "confirmed" : "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: "whatsapp_flow",
    })

    transaction.set(slotRef, {
      appointmentId,
      doctorId: payload.doctorId,
      appointmentDate: payload.appointmentDate,
      appointmentTime,
      createdAt: new Date().toISOString(),
    })
  })

  return appointmentId
}

async function sendBookingConfirmation(
  phone: string,
  patient: { id: string; data: FirebaseFirestore.DocumentData },
  doctorData: FirebaseFirestore.DocumentData,
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
  const doctorName = `${doctorData.firstName || ""} ${doctorData.lastName || ""}`.trim()
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

  const consultationFee = session.consultationFee || doctorData.consultationFee || 500
  const PARTIAL_PAYMENT_AMOUNT = Math.ceil(consultationFee * 0.1)
  const amountToPay = session.paymentType === "partial" ? PARTIAL_PAYMENT_AMOUNT : consultationFee

  // Send confirmation message
  await sendTextMessage(
    phone,
    `🎉 *Appointment Confirmed!*

Hi ${patientName},

Your appointment has been booked successfully:
• 👨‍⚕️ Doctor: ${doctorName}
• 📅 Date: ${dateDisplay}
• 🕒 Time: ${timeDisplay}
• 📋 Appointment ID: ${appointmentId}
${session.symptoms ? `• 📝 Symptoms: ${session.symptoms}` : ""}
• 💳 Payment: ${session.paymentMethod?.toUpperCase()} - ${session.paymentType === "partial" ? `₹${amountToPay} (₹${consultationFee - amountToPay} at hospital)` : `₹${amountToPay}`}

✅ Your appointment is now visible in our system. Admin and receptionist can see it.

If you need to reschedule, just reply here or call us at +91-XXXXXXXXXX.`
  )

  // Generate and send PDF
  try {
    const appointment: Appointment = {
      id: appointmentId,
      transactionId: appointmentId,
      patientId: patient.id,
      patientUid: patient.id,
      patientName: patientName,
      patientEmail: patient.data.email || "",
      patientPhone: phone,
      doctorId: session.doctorId!,
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
      paymentAmount: amountToPay,
      remainingAmount: session.paymentType === "partial" ? consultationFee - amountToPay : 0,
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

