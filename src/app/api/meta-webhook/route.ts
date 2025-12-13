import { NextResponse } from "next/server"
import { sendTextMessage, sendButtonMessage, sendMultiButtonMessage, sendListMessage, sendDocumentMessage, sendFlowMessage, formatPhoneNumber } from "@/server/metaWhatsApp"
import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { normalizeTime, getDayName, DEFAULT_VISITING_HOURS } from "@/utils/timeSlots"
import { isDateBlocked as isDateBlockedFromRaw, normalizeBlockedDates } from "@/utils/blockedDates"
import { generateAppointmentConfirmationPDFBase64 } from "@/utils/pdfGenerators"
import { Appointment } from "@/types/patient"
import { getDoctorHospitalId, getHospitalCollectionPath, getAllActiveHospitals } from "@/utils/serverHospitalQueries"

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
      
      if (buttonId === "register_yes") {
        await handleRegistrationPrompt(from)
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
      
      // Handle re-checkup pick date button
      if (buttonId === "recheckup_pick_date") {
        await handleRecheckupPickDate(from)
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

    // Handle text messages - check greetings first, then booking conversation
    if (messageType === "text") {
      const text = message.text?.body ?? ""
      const trimmedText = text.trim().toLowerCase()
      
      // Check for greetings FIRST (before booking conversation check)
      // This ensures greetings always show, even if there's an existing booking session
      const greetings = ["hello", "hi", "hy", "hey", "hii", "hiii", "hlo", "helo", "hie", "hai"]
      if (greetings.some(greeting => trimmedText === greeting || trimmedText.startsWith(greeting + " "))) {
        // Clear any existing booking session when greeting
        const db = admin.firestore()
        const normalizedPhone = formatPhoneNumber(from)
        const sessionRef = db.collection("whatsappBookingSessions").doc(normalizedPhone)
        const sessionDoc = await sessionRef.get()
        if (sessionDoc.exists) {
          await sessionRef.delete()
        }
        await handleGreeting(from)
        return NextResponse.json({ success: true })
      }
      
      // Check for cancel/stop keywords even when not in booking (to acknowledge the command)
      const cancelKeywords = [
        "cancel", "stop", "abort", "quit", "exit", "no", "nevermind", 
        "never mind", "don't", "dont", "skip", "end", "finish"
      ]
      if (cancelKeywords.some(keyword => trimmedText === keyword || trimmedText.includes(keyword))) {
        // Check if there's a booking session to cancel
        const db = admin.firestore()
        const normalizedPhone = formatPhoneNumber(from)
        const sessionRef = db.collection("whatsappBookingSessions").doc(normalizedPhone)
        const sessionDoc = await sessionRef.get()
        
        if (sessionDoc.exists) {
          // Cancel existing booking session
          await sessionRef.delete()
          await sendTextMessage(
            from,
            "❌ Booking cancelled.\n\nYou can start a new booking anytime by typing 'Book' or clicking the 'Book Appointment' button."
          )
        } else {
          // No active booking, just acknowledge
          await sendTextMessage(
            from,
            "✅ Understood. No active booking to cancel.\n\nHow can I help you today? Type 'hi' to see options or 'Book' to start booking an appointment."
          )
        }
        return NextResponse.json({ success: true })
      }
      
      // Check if user is in booking conversation
      const isInBooking = await handleBookingConversation(from, text)
      if (!isInBooking) {
        // Check for "thanks" message
        if (trimmedText === "thanks" || trimmedText === "thank you" || trimmedText === "thankyou" || trimmedText.includes("thank")) {
          await sendTextMessage(
            from,
            "You're welcome! 😊\n\nFeel free to contact our help center if you found any issue.\n\nWe're here to help! 🏥"
          )
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
  const db = admin.firestore()
  const normalizedPhone = formatPhoneNumber(phone)
  
  // Check if patient exists
  const patient = await findPatientByPhone(db, normalizedPhone)
  
  if (!patient) {
    // Unknown number - ask for registration
    const buttonResponse = await sendMultiButtonMessage(
      phone,
      "Hello! 👋\n\nWelcome to Harmony Medical Services!\n\nWe don't have your profile yet. Would you like to register?",
      [
        { id: "register_yes", title: "✅ Yes, Register" },
        { id: "help_center", title: "🆘 Help Center" },
      ],
      "Harmony Medical Services"
    )

    if (!buttonResponse.success) {
      console.error("[Meta WhatsApp] Failed to send registration prompt:", buttonResponse.error)
      // Fallback to text message
      await sendTextMessage(
        phone,
        "Hello! 👋\n\nWelcome to Harmony Medical Services!\n\nWe don't have your profile yet. Would you like to register?\n\nReply 'Yes' to register or 'Help' for assistance."
      )
    }
  } else {
    // Registered patient - greet and ask about booking
    const buttonResponse = await sendButtonMessage(
      phone,
      "Hello! 👋\n\nHow can I help you today?\n\nDo you want to book an appointment?",
      "Harmony Medical Services",
      "book_appointment",
      "📅 Book Appointment"
    )

    if (!buttonResponse.success) {
      console.error("[Meta WhatsApp] Failed to send greeting button:", buttonResponse.error)
      // Fallback to text message
      await sendTextMessage(
        phone,
        "Hello! 👋\n\nHow can I help you today?\n\nDo you want to book an appointment?\n\nType 'Book' to book an appointment or 'Help' for assistance."
      )
    }
  }
}

async function handleHelpCenter(phone: string) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://hospitalmanagementsystem-hazel.vercel.app"
  
  await sendTextMessage(
    phone,
    `🆘 *Help Center*\n\nWe're here to help you!\n\n📞 *Contact Us:*\nPhone: +91-XXXXXXXXXX\nEmail: support@harmonymedical.com\n\n🌐 *Visit Our Website:*\n${baseUrl}\n\n⏰ *Support Hours:*\nMonday - Saturday: 9:00 AM - 6:00 PM\nSunday: 10:00 AM - 2:00 PM\n\nFor urgent medical assistance, please visit our emergency department or call emergency services.`
  )
}

async function handleIncomingText(phone: string, _text: string) {
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

function _formatTranslation(template: string, vars: Record<string, string | number>): string {
  let result = template
  Object.keys(vars).forEach((key) => {
    result = result.replace(new RegExp(`\\{${key}\\}`, "g"), String(vars[key]))
  })
  return result
}

function _capitalizeName(value: string): string {
  if (!value) return ""
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ")
}

async function _ensureDefaultDoctor(
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

  // Validate that appointment time is not in the past (for today's appointments) - BEFORE creating appointment
  const { normalizeTime } = await import("@/utils/timeSlots")
  const normalizedTime = normalizeTime(session.appointmentTime)
  const today = new Date()
  const todayDateString = today.toISOString().split("T")[0]
  const isToday = session.appointmentDate === todayDateString
  
  if (isToday) {
    const now = new Date()
    const currentTime = now.getTime()
    const minimumTime = currentTime + (15 * 60 * 1000) // 15 minutes buffer
    
    // Create slot datetime in local timezone
    const [year, month, day] = session.appointmentDate.split('-').map(Number)
    const [hours, minutes] = normalizedTime.split(':').map(Number)
    const slotDateTime = new Date(year, month - 1, day, hours, minutes, 0)
    const slotTime = slotDateTime.getTime()
    
    // Reject if slot is in the past or less than 15 minutes away
    if (slotTime <= minimumTime) {
      const errorMsg = language === "gujarati"
        ? "❌ આ સમય પસાર થઈ ગયો છે અથવા ખૂબ નજીક છે. કૃપા કરીને ફરીથી બુકિંગ કરો અને ભવિષ્યનો સમય પસંદ કરો (ઓછામાં ઓછું 15 મિનિટ અંતર)."
        : "❌ This time has already passed or is too soon. Please book again and select a future time (at least 15 minutes from now)."
      await sendTextMessage(phone, errorMsg)
      await sessionRef.delete()
      return
    }
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

  const paymentMethod = session.paymentMethod || "cash"
  let consultationFee = session.consultationFee
  let assignedDoctorId = session.doctorId || ""
  let doctorDataForAppointment: { id: string; data: FirebaseFirestore.DocumentData } | null = null
  let originalAppointmentData: FirebaseFirestore.DocumentData | null = null

  if (session.isRecheckup && session.originalAppointmentId) {
    try {
      const originalAppointmentDoc = await db.collection("appointments").doc(session.originalAppointmentId).get()
      if (originalAppointmentDoc.exists) {
        originalAppointmentData = originalAppointmentDoc.data() || null
        if (!assignedDoctorId && originalAppointmentData?.doctorId) {
          assignedDoctorId = originalAppointmentData.doctorId
        }
        if (!consultationFee) {
          consultationFee =
            originalAppointmentData?.totalConsultationFee ||
            originalAppointmentData?.consultationFee ||
            undefined
        }
      }
    } catch (error) {
      console.error("[Meta WhatsApp] Failed to read original appointment for re-checkup:", error)
    }
  }

  if (assignedDoctorId) {
    try {
      const doctorDoc = await db.collection("doctors").doc(assignedDoctorId).get()
      if (doctorDoc.exists) {
        doctorDataForAppointment = { id: assignedDoctorId, data: doctorDoc.data()! }
        if (!consultationFee && doctorDoc.data()?.consultationFee) {
          consultationFee = doctorDoc.data()?.consultationFee
        }
      }
    } catch (error) {
      console.error("[Meta WhatsApp] Failed to load doctor for re-checkup booking:", error)
    }

    if (!doctorDataForAppointment && originalAppointmentData) {
      const originalDoctorName = originalAppointmentData.doctorName || ""
      const [firstName, ...rest] = originalDoctorName.split(" ")
      doctorDataForAppointment = {
        id: assignedDoctorId,
        data: {
          firstName: firstName || originalDoctorName,
          lastName: rest.join(" "),
          specialization: originalAppointmentData.doctorSpecialization || "",
          consultationFee:
            consultationFee ||
            originalAppointmentData.totalConsultationFee ||
            originalAppointmentData.consultationFee ||
            0,
        },
      }
    }
  }

  consultationFee = consultationFee ?? 500
  const paymentAmount = session.paymentAmount ?? 0
  const remainingAmount = consultationFee
  const paymentStatus: "pending" | "paid" = "pending"

  // Determine chief complaint based on whether it's a re-checkup
  let chiefComplaint = "General consultation"
  if (session.isRecheckup) {
    chiefComplaint = session.recheckupNote 
      ? `Re-checkup: ${session.recheckupNote}`
      : "Re-checkup appointment"
  }

  try {
    const appointmentId = await createAppointment(
      db,
      patient,
      doctorDataForAppointment,
      {
        symptomCategory: "",
        chiefComplaint,
        doctorId: assignedDoctorId,
        appointmentDate: session.appointmentDate,
        appointmentTime: session.appointmentTime,
        medicalHistory: "",
        paymentOption: paymentMethod,
        paymentStatus,
        paymentType: "full",
        consultationFee,
        paymentAmount,
        remainingAmount,
        isRecheckup: session.isRecheckup || false,
        recheckupNote: session.recheckupNote || "",
        originalAppointmentId: session.originalAppointmentId || "",
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
    } else if (error.message?.startsWith("DATE_BLOCKED:")) {
      const reason = error.message.replace("DATE_BLOCKED: ", "")
      const errorMsg = language === "gujarati"
        ? `❌ *તારીખ ઉપલબ્ધ નથી*\n\n${reason}\n\nકૃપા કરીને બીજી તારીખ પસંદ કરો.`
        : `❌ *Date Not Available*\n\n${reason}\n\nPlease select another date.`
      await sendTextMessage(phone, errorMsg)
      await sendDatePicker(phone, assignedDoctorId, language)
      await sessionRef.update({ state: "selecting_date" })
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
  | "registering_full_name"

interface BookingSession {
  state: BookingState
  language?: "gujarati" | "english" // Selected language for the booking session
  needsRegistration?: boolean
  patientUid?: string
  doctorId?: string
  appointmentDate?: string
  appointmentTime?: string
  symptoms?: string
  paymentMethod?: "card" | "upi" | "cash"
  paymentType?: "full" | "partial"
  consultationFee?: number
  paymentAmount?: number
  remainingAmount?: number
  isRecheckup?: boolean // Flag for re-checkup bookings
  recheckupNote?: string // Note from doctor for re-checkup
  originalAppointmentId?: string // Original appointment ID for re-checkup
  originalAppointmentDate?: string // Original appointment date for re-checkup
  registrationData?: {
    firstName?: string
    lastName?: string
    email?: string
    dateOfBirth?: string
    gender?: string
    patientId?: string
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
  
  // Validate that appointment time is not in the past (for today's appointments) - BEFORE creating appointment
  const normalizedTime = normalizeTime(appointmentTime)
  const today = new Date()
  const todayDateString = today.toISOString().split("T")[0]
  const isToday = appointmentDate === todayDateString
  
  if (isToday) {
    const now = new Date()
    const currentTime = now.getTime()
    const minimumTime = currentTime + (15 * 60 * 1000) // 15 minutes buffer
    
    // Create slot datetime in local timezone
    const [year, month, day] = appointmentDate.split('-').map(Number)
    const [hours, minutes] = normalizedTime.split(':').map(Number)
    const slotDateTime = new Date(year, month - 1, day, hours, minutes, 0)
    const slotTime = slotDateTime.getTime()
    
    // Reject if slot is in the past or less than 15 minutes away
    if (slotTime <= minimumTime) {
      await sendTextMessage(
        from,
        `❌ *Time Slot Not Available*\n\nThis time (${appointmentTime}) has already passed or is too soon. Please book again and select a future time (at least 15 minutes from now).`
      )
      return NextResponse.json({ success: true })
    }
  }

  // Check if time slot is already booked
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
        paymentMethod: paymentMethod as "card" | "upi" | "cash",
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
    } else if (error.message?.startsWith("DATE_BLOCKED:")) {
      const reason = error.message.replace("DATE_BLOCKED: ", "")
      await sendTextMessage(
        from,
        `❌ *Date Not Available*\n\n${reason}\n\nPlease try booking again by clicking 'Book Appointment' and selecting a different date.`
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
    patientUid: patient.id,
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
    case "registering_full_name":
      return await handleRegistrationFullName(db, phone, normalizedPhone, sessionRef, text, session)
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

async function handleRegistrationPrompt(phone: string) {
  const db = admin.firestore()
  const normalizedPhone = formatPhoneNumber(phone)
  
  try {
    // Find or create patient record immediately (phone-only registration)
    let patient = await findPatientByPhone(db, normalizedPhone)
    if (!patient) {
      const placeholderName = `WhatsApp Patient ${normalizedPhone.slice(-4)}`
      const { patientUid } = await createPatientFromWhatsApp(db, normalizedPhone, placeholderName, "")
      const patientDoc = await db.collection("patients").doc(patientUid).get()
      if (patientDoc.exists) {
        patient = { id: patientDoc.id, data: patientDoc.data()! }
      }
    }

    if (!patient) {
      await sendTextMessage(
        phone,
        "❌ We couldn't register you right now. Please try again or contact reception."
      )
      return
    }

    // Create/Update session with patient context and jump straight to language selection
    const sessionRef = db.collection("whatsappBookingSessions").doc(normalizedPhone)
    await sessionRef.set({
      state: "selecting_language",
      needsRegistration: false,
      patientUid: patient.id,
      registrationData: {
        firstName: patient.data.firstName || "",
        lastName: patient.data.lastName || "",
        patientId: patient.data.patientId || "",
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    await sendTextMessage(
      phone,
      "✅ Registration received! We'll have our reception team collect any missing details later. Let's continue booking your appointment."
    )

    // Send language picker
    await sendLanguagePicker(phone)
  } catch (error) {
    console.error("[Meta WhatsApp] Failed to auto-register patient:", error)
    await sendTextMessage(
      phone,
      "❌ We couldn't register you right now. Please try again or contact reception."
    )
  }
}

async function handleRegistrationFullName(
  db: FirebaseFirestore.Firestore,
  phone: string,
  normalizedPhone: string,
  sessionRef: FirebaseFirestore.DocumentReference,
  text: string,
  session: BookingSession
): Promise<boolean> {
  const language = session.language || "english"
  const fullName = text.trim()
  
  if (!fullName || fullName.length < 2) {
    const errorMsg = language === "gujarati"
      ? "❌ કૃપા કરીને માન્ય નામ દાખલ કરો (ઓછામાં ઓછું 2 અક્ષરો)."
      : "❌ Please enter a valid name (at least 2 characters)."
    await sendTextMessage(phone, errorMsg)
    await sendTextMessage(phone, getTranslation("registrationFullName", language))
    return true
  }
  
  // Split name into first and last name
  const nameParts = fullName.split(/\s+/).filter(Boolean)
  const firstName = nameParts[0] || fullName
  const lastName = nameParts.slice(1).join(" ") || ""
  
  // Create minimal patient record (name + phone only)
  try {
    const { patientUid, patientId } = await createPatientFromWhatsApp(db, normalizedPhone, firstName, lastName)
    
    // Update session
    await sessionRef.update({
      state: "selecting_language",
      needsRegistration: false,
      patientUid,
      registrationData: {
        ...(session.registrationData || {}),
        firstName,
        lastName,
        patientId,
      },
      updatedAt: new Date().toISOString(),
    })
    
    const successMsg = language === "gujarati"
      ? `✅ *રજિસ્ટ્રેશન સફળ!*\n\nતમારું પ્રોફાઇલ બનાવવામાં આવ્યું છે.\n\nહવે તમે અપોઇન્ટમેન્ટ બુક કરી શકો છો. શું તમે અપોઇન્ટમેન્ટ બુક કરવા માંગો છો?`
      : `✅ *Registration Successful!*\n\nYour profile has been created.\n\nNow you can book appointments. Would you like to book an appointment?`
    
    await sendTextMessage(phone, successMsg)
    
    // Ask if they want to book
    const buttonResponse = await sendMultiButtonMessage(
      phone,
      language === "gujarati"
        ? "શું તમે અપોઇન્ટમેન્ટ બુક કરવા માંગો છો?"
        : "Would you like to book an appointment?",
      [
        { id: "book_appointment", title: "📅 Book Appointment" },
        { id: "help_center", title: "🆘 Help Center" },
      ],
      "Harmony Medical Services"
    )
    
    if (!buttonResponse.success) {
      await sendTextMessage(
        phone,
        language === "gujarati"
          ? "અપોઇન્ટમેન્ટ બુક કરવા માટે 'Book' ટાઇપ કરો."
          : "Type 'Book' to book an appointment."
      )
    }
    
    return true
  } catch (error: any) {
    console.error("[Meta WhatsApp] Error creating patient:", error)
    const errorMsg = language === "gujarati"
      ? "❌ રજિસ્ટ્રેશન દરમિયાન ભૂલ આવી. કૃપા કરીને ફરીથી પ્રયાસ કરો અથવા રિસેપ્શનને કૉલ કરો."
      : "❌ Error during registration. Please try again or contact reception."
    await sendTextMessage(phone, errorMsg)
    return true
  }
}

async function createPatientFromWhatsApp(
  db: FirebaseFirestore.Firestore,
  phone: string,
  firstName: string,
  lastName: string
): Promise<{ patientUid: string; patientId: string }> {
  // Check if patient already exists
  const existing = await findPatientByPhone(db, phone)
  if (existing) {
    const existingData = existing.data || {}
    return {
      patientUid: existing.id,
      patientId: existingData.patientId || existing.id,
    }
  }
  
  // Generate patient ID
  const START_NUMBER = 12906
  const patientId = await db.runTransaction(async (transaction) => {
    const counterRef = db.collection("meta").doc("patientIdCounter")
    const counterSnap = await transaction.get(counterRef)
    
    let lastNumber = START_NUMBER - 1
    if (counterSnap.exists) {
      const data = counterSnap.data()
      const stored = typeof data?.lastNumber === "number" ? data.lastNumber : undefined
      if (stored && stored >= START_NUMBER - 1) {
        lastNumber = stored
      }
    }
    
    const nextNumber = lastNumber + 1
    transaction.set(
      counterRef,
      {
        lastNumber: nextNumber,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    )
    
    return nextNumber.toString().padStart(6, "0")
  })
  
  // Create patient document (no Firebase Auth user - receptionist will add email/password later)
  const patientRef = db.collection("patients").doc()
  const patientUid = patientRef.id
  
  await patientRef.set({
    patientId,
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    phone,
    phoneNumber: phone.replace(/^\+91/, ""), // Remove country code for phoneNumber field
    status: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: "whatsapp",
    whatsappRegistered: true, // Flag to indicate registered via WhatsApp
  })
  
  return { patientUid, patientId }
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
    }
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

async function handleListSelection(phone: string, selectedId: string, _selectedTitle: string) {
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
    let doctorData = {}
    if (session.doctorId) {
      const doctorDoc = await db.collection("doctors").doc(session.doctorId).get()
      if (doctorDoc.exists) {
        doctorData = doctorDoc.data()!
      }
    }
    
    const availabilityCheck = checkDateAvailability(selectedDate, doctorData)
    if (availabilityCheck.isBlocked) {
      const errorMsg = language === "gujarati"
        ? `❌ *તારીખ ઉપલબ્ધ નથી*\n\n${availabilityCheck.reason}\n\nકૃપા કરીને બીજી તારીખ પસંદ કરો.`
        : `❌ *Date Not Available*\n\n${availabilityCheck.reason}\n\nPlease select another date.`
      await sendTextMessage(phone, errorMsg)
      await sendDatePicker(phone, session.doctorId, language)
      return
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

  // Check if it's an hourly slot selection (ID starts with "hourly_")
  if (selectedId.startsWith("hourly_")) {
    const hourStr = selectedId.replace("hourly_", "")
    const hour = parseInt(hourStr)
    
    if (isNaN(hour)) {
      console.error("[Meta WhatsApp] Invalid hourly slot ID:", selectedId)
      return
    }
    
    // Find the next available 15-minute slot within this hour
    const db = admin.firestore()
    const nextAvailableSlot = await getNextAvailable15MinSlot(
      db,
      hour,
      session.appointmentDate!,
      undefined // No doctor assigned yet
    )
    
    if (!nextAvailableSlot) {
      const errorMsg = language === "gujarati"
        ? "❌ આ સમય સ્લોટમાં કોઈ ઉપલબ્ધ સમય નથી. કૃપા કરીને બીજો સમય પસંદ કરો."
        : "❌ No available time in this slot. Please select another time."
      await sendTextMessage(phone, errorMsg)
      await sendTimePicker(phone, undefined, session.appointmentDate!, language)
      return
    }
    
    const normalizedTime = normalizeTime(nextAvailableSlot)
    
    // Validate that the selected time is not in the past (for today's appointments)
    const isToday = session.appointmentDate === new Date().toISOString().split("T")[0]
    if (isToday && session.appointmentDate) {
      const now = new Date()
      const currentTime = now.getTime()
      const minimumTime = currentTime + (15 * 60 * 1000) // 15 minutes buffer
      
      // Create slot datetime in local timezone to avoid timezone issues
      const [year, month, day] = session.appointmentDate.split('-').map(Number)
      const [hours, minutes] = normalizedTime.split(':').map(Number)
      const slotDateTime = new Date(year, month - 1, day, hours, minutes, 0)
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

  // Check if it's a time selection (ID starts with "time_") - legacy support
  if (selectedId.startsWith("time_")) {
    const selectedTime = selectedId.replace("time_", "")
    const normalizedTime = normalizeTime(selectedTime)

    // Validate that the selected time is not in the past (for today's appointments)
    const isToday = session.appointmentDate === new Date().toISOString().split("T")[0]
    if (isToday && session.appointmentDate) {
      const now = new Date()
      const currentTime = now.getTime()
      const minimumTime = currentTime + (15 * 60 * 1000) // 15 minutes buffer
      
      // Create slot datetime in local timezone to avoid timezone issues
      const [year, month, day] = session.appointmentDate.split('-').map(Number)
      const [hours, minutes] = normalizedTime.split(':').map(Number)
      const slotDateTime = new Date(year, month - 1, day, hours, minutes, 0)
      const slotTime = slotDateTime.getTime()
      
      // Reject if slot is in the past or less than 15 minutes away
      if (slotTime <= minimumTime) {
        const errorMsg = language === "gujarati"
          ? "❌ આ સમય પસાર થઈ ગયો છે અથવા ખૂબ નજીક છે. કૃપા કરીને ભવિષ્યનો સમય પસંદ કરો (ઓછામાં ઓછું 15 મિનિટ અંતર)."
          : "❌ That time has already passed or is too soon. Please pick a future slot (at least 15 minutes from now)."
        await sendTextMessage(phone, errorMsg)
        await sendTimePicker(phone, undefined, session.appointmentDate, language)
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

// Handler for re-checkup pick date button
async function handleRecheckupPickDate(phone: string) {
  const db = admin.firestore()
  const normalizedPhone = formatPhoneNumber(phone)
  const sessionRef = db.collection("whatsappBookingSessions").doc(normalizedPhone)
  const sessionDoc = await sessionRef.get()
  const session = sessionDoc.exists ? (sessionDoc.data() as BookingSession) : undefined
  const patient = await findPatientByPhone(db, normalizedPhone)

  if (!sessionDoc.exists) {
    // Create a new session for re-checkup
    await sessionRef.set({
      state: "selecting_date",
      isRecheckup: true,
      language: "english",
      needsRegistration: false,
      patientUid: patient?.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
  } else if (!session?.patientUid && patient) {
    await sessionRef.update({
      patientUid: patient.id,
      updatedAt: new Date().toISOString(),
    })
  }

  // Show date picker (for re-checkup, no doctor ID needed)
  await sendDatePicker(phone, undefined, "english")
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
  let doctorData = {}
  if (session.doctorId) {
    const doctorDoc = await db.collection("doctors").doc(session.doctorId).get()
    if (doctorDoc.exists) {
      doctorData = doctorDoc.data()!
    }
  }
  
  const availabilityCheck = checkDateAvailability(selectedDate, doctorData)
  if (availabilityCheck.isBlocked) {
    const errorMsg = language === "gujarati"
      ? `❌ *તારીખ ઉપલબ્ધ નથી*\n\n${availabilityCheck.reason}\n\nકૃપા કરીને બીજી તારીખ પસંદ કરો.`
      : `❌ *Date Not Available*\n\n${availabilityCheck.reason}\n\nPlease select another date.`
    await sendTextMessage(phone, errorMsg)
    await sendDatePicker(phone, session.doctorId, language)
    return
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
  } else if (buttonId === "time_quick_afternoon") {
    // Afternoon slots: 2:00 PM to 5:00 PM (14:00 to 17:00)
    selectedSlots = timeSlots.filter(slot => {
      const hour = parseInt(slot.split(":")[0])
      return hour >= 14 && hour <= 17
    })
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
  
  for (const slot of sortedSlots) {
    const normalizedTime = normalizeTime(slot)
    if (!normalizedTime) {
      console.warn("[Meta WhatsApp] Failed to normalize time slot:", slot)
      continue
    }

    if (isToday && session.appointmentDate) {
      const now = new Date()
      const currentTime = now.getTime()
      const minimumTime = currentTime + (15 * 60 * 1000) // 15 minutes buffer
      
      // Create slot datetime in local timezone
      const [year, month, day] = session.appointmentDate.split('-').map(Number)
      const [hours, minutes] = normalizedTime.split(':').map(Number)
      const slotDateTime = new Date(year, month - 1, day, hours, minutes, 0)
      const slotTime = slotDateTime.getTime()
      
      if (slotTime <= minimumTime) {
        continue // Skip past slots
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

async function sendTimePicker(phone: string, doctorId: string | undefined, appointmentDate: string, language: Language = "english", _showButtons: boolean = true) {
  const db = admin.firestore()
  
  // Use new hourly slot system
  const hourlySlots = generateHourlyTimeSlots()
  const availableHourlySlots: Array<{ id: string; title: string; description?: string }> = []
  
  // Check if appointment is today - need to filter out past hourly slots
  const now = new Date()
  const today = new Date()
  today.setHours(0, 0, 0, 0) // Normalize to start of day for comparison
  const todayDateString = today.toISOString().split("T")[0]
  const isToday = appointmentDate === todayDateString
  const minimumTime = now.getTime() + (15 * 60 * 1000) // 15 minutes buffer
  
  // Check availability for each hourly slot
  for (const hourlySlot of hourlySlots) {
    // For today's appointments, filter out hourly slots that are completely in the past
    if (isToday && appointmentDate) {
      const [year, month, day] = appointmentDate.split('-').map(Number)
      
      // Check if the hour END has passed
      // If the hour end time has passed the minimum time (now + 15 min buffer), skip the entire hour
      const hourEndTime = hourlySlot.hour + 1
      const hourEndDateTime = new Date(year, month - 1, day, hourEndTime, 0, 0)
      const hourEndTimeMs = hourEndDateTime.getTime()
      
      // If the hour end has passed the minimum acceptable time, skip it
      // Example: At 12:04 PM, minimumTime = 12:19 PM. If hour ends at 10:00 AM, skip it.
      if (hourEndTimeMs <= minimumTime) {
        continue // Skip this hourly slot - it's completely in the past
      }
    }
    
    const nextAvailableSlot = await getNextAvailable15MinSlot(
      db,
      hourlySlot.hour,
      appointmentDate,
      doctorId
    )
    
    // Double-check: Even if getNextAvailable15MinSlot returns a slot, verify it's not in the past
    if (nextAvailableSlot) {
      // For today, verify the returned slot is actually in the future
      if (isToday && appointmentDate) {
        const [year, month, day] = appointmentDate.split('-').map(Number)
        const [hours, minutes] = nextAvailableSlot.split(':').map(Number)
        const slotDateTime = new Date(year, month - 1, day, hours, minutes, 0)
        
        if (slotDateTime.getTime() <= minimumTime) {
          continue // Skip this slot - it's in the past
        }
      }
      
      // This hourly slot has at least one available 15-minute slot that's in the future
      availableHourlySlots.push({
        id: hourlySlot.id,
        title: hourlySlot.title,
        description: language === "gujarati" ? "ઉપલબ્ધ" : "Available"
      })
    }
  }
  
  if (availableHourlySlots.length === 0) {
    const noSlotsMsg = language === "gujarati"
      ? "❌ આ તારીખ માટે કોઈ સમય સ્લોટ ઉપલબ્ધ નથી. કૃપા કરીને બીજી તારીખ પસંદ કરો."
      : "❌ No time slots available for this date. Please select another date."
    await sendTextMessage(phone, noSlotsMsg)
    await sendDatePicker(phone, undefined, language)
    return
  }

  // Send hourly slot selection as list message
  const timeMsg = language === "gujarati"
    ? "🕰️ *સમય પસંદ કરો*\n\nતમારો પસંદીદા સમય સ્લોટ પસંદ કરો:"
    : "🕰️ *Choose Time*\n\nSelect your preferred time slot:"

  const buttonText = language === "gujarati" ? "🕰️ સમય પસંદ કરો" : "🕰️ Choose Time"
  const truncatedButtonText = buttonText.length > 20 ? buttonText.substring(0, 17) + "..." : buttonText

  const sections = [{
    title: language === "gujarati" ? "ઉપલબ્ધ સમય" : "Available Times",
    rows: availableHourlySlots.slice(0, 10)
  }]

  const listResponse = await sendListMessage(
    phone,
    timeMsg,
    truncatedButtonText,
    sections,
    "Harmony Medical Services"
  )

  if (!listResponse.success) {
    console.error("[Meta WhatsApp] Failed to send hourly time slots:", {
      error: listResponse.error,
      errorCode: listResponse.errorCode,
    })
    
    // Fallback to text message
    let fallbackMsg = language === "gujarati"
      ? "🕰️ *ઉપલબ્ધ સમય સ્લોટ્સ*\n\n"
      : "🕰️ *Available Time Slots*\n\n"
    
    availableHourlySlots.forEach((slot, index) => {
      fallbackMsg += `${index + 1}. ${slot.title}\n`
    })
    
    fallbackMsg += language === "gujarati"
      ? "\nકૃપા કરીને નંબર લખી જવાબ આપો (ઉદાહરણ: 1)."
      : "\nPlease reply with the number of your preferred slot (e.g., 1)."
    
    await sendTextMessage(phone, fallbackMsg)
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
    
    // Always check if date is blocked (system-wide like Sunday OR doctor-specific)
    const availabilityCheck = checkDateAvailability(dateStr, doctorData || {})
    if (availabilityCheck.isBlocked) {
      // Skip blocked dates - don't include them in the list
      continue
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
  if (isToday && session.appointmentDate) {
    const now = new Date()
    const currentTime = now.getTime()
    const minimumTime = currentTime + (15 * 60 * 1000) // 15 minutes buffer
    
    // Create slot datetime in local timezone to avoid timezone issues
    const [year, month, day] = session.appointmentDate.split('-').map(Number)
    const [hours, minutes] = normalizedTime.split(':').map(Number)
    const slotDateTime = new Date(year, month - 1, day, hours, minutes, 0)
    const slotTime = slotDateTime.getTime()
    
    // Reject if slot is in the past or less than 15 minutes away
    if (slotTime <= minimumTime) {
      const errorMsg = language === "gujarati"
        ? "❌ આ સમય પસાર થઈ ગયો છે અથવા ખૂબ નજીક છે. કૃપા કરીને ભવિષ્યનો સમય પસંદ કરો (ઓછામાં ઓછું 15 મિનિટ અંતર)."
        : "❌ That time has already passed or is too soon. Please pick a future slot (at least 15 minutes from now)."
      await sendTextMessage(phone, errorMsg)
      await sendTimePicker(phone, undefined, session.appointmentDate, language)
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
  const language = session.language || "english"

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

  // Validate that appointment time is not in the past (for today's appointments)
  if (session.appointmentDate && session.appointmentTime) {
    const { normalizeTime } = await import("@/utils/timeSlots")
    const normalizedTime = normalizeTime(session.appointmentTime)
    const today = new Date()
    const todayDateString = today.toISOString().split("T")[0]
    const isToday = session.appointmentDate === todayDateString
    
    if (isToday) {
      const now = new Date()
      const currentTime = now.getTime()
      const minimumTime = currentTime + (15 * 60 * 1000) // 15 minutes buffer
      
      // Create slot datetime in local timezone
      const [year, month, day] = session.appointmentDate.split('-').map(Number)
      const [hours, minutes] = normalizedTime.split(':').map(Number)
      const slotDateTime = new Date(year, month - 1, day, hours, minutes, 0)
      const slotTime = slotDateTime.getTime()
      
      // Reject if slot is in the past or less than 15 minutes away
      if (slotTime <= minimumTime) {
        const errorMsg = language === "gujarati"
          ? "❌ આ સમય પસાર થઈ ગયો છે અથવા ખૂબ નજીક છે. કૃપા કરીને ફરીથી બુકિંગ કરો અને ભવિષ્યનો સમય પસંદ કરો (ઓછામાં ઓછું 15 મિનિટ અંતર)."
          : "❌ This time has already passed or is too soon. Please book again and select a future time (at least 15 minutes from now)."
        await sendTextMessage(phone, errorMsg)
        await sessionRef.delete()
        return true
      }
    }
  }

  // Create appointment
  try {
    let patient: { id: string; data: FirebaseFirestore.DocumentData } | null = null

    if (session.patientUid) {
      const patientDoc = await db.collection("patients").doc(session.patientUid).get()
      if (patientDoc.exists) {
        patient = { id: patientDoc.id, data: patientDoc.data()! }
      }
    }

    if (!patient) {
      patient = await findPatientByPhone(db, normalizedPhone)
    }

    if (!patient && session.registrationData?.firstName) {
      try {
        const recreated = await createPatientFromWhatsApp(
          db,
          normalizedPhone,
          session.registrationData.firstName,
          session.registrationData?.lastName || ""
        )
        const patientDoc = await db.collection("patients").doc(recreated.patientUid).get()
        if (patientDoc.exists) {
          patient = { id: patientDoc.id, data: patientDoc.data()! }
          await sessionRef.update({
            patientUid: recreated.patientUid,
            registrationData: {
              ...(session.registrationData || {}),
              patientId: recreated.patientId,
            },
            updatedAt: new Date().toISOString(),
          })
        }
      } catch (recreateError) {
        console.error("[Meta WhatsApp] Failed to recreate patient record:", recreateError)
      }
    }

    if (!patient) {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://hospitalmanagementsystem-hazel.vercel.app"
      const msg =
        language === "gujarati"
          ? `❌ દર્દી રેકોર્ડ મળ્યો નથી.\n\n📝 કૃપા કરીને પહેલા નોંધણી કરો:\n${baseUrl}`
          : `❌ Patient record not found.\n\n📝 *Please register first:*\n\n${baseUrl}\n\nOr contact reception for assistance.`
      await sendTextMessage(phone, msg)
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
    } else if (error.message?.startsWith("DATE_BLOCKED:")) {
      const reason = error.message.replace("DATE_BLOCKED: ", "")
      const language = session.language || "english"
      const errorMsg = language === "gujarati"
        ? `❌ *તારીખ ઉપલબ્ધ નથી*\n\n${reason}\n\nકૃપા કરીને બીજી તારીખ પસંદ કરો.`
        : `❌ *Date Not Available*\n\n${reason}\n\nPlease select another date.`
      await sendTextMessage(phone, errorMsg)
      await sendDatePicker(phone, session.doctorId, language)
    } else {
      await sendTextMessage(phone, "❌ Error creating appointment. Please contact reception.")
    }
    await sessionRef.delete()
    return true
  }
}

// Generate hourly time slots for the new system
function generateHourlyTimeSlots(): Array<{ id: string; title: string; description?: string; hour: number }> {
  const hourlySlots = [
    { hour: 9, title: "09:00 – 10:00", id: "hourly_09" },
    { hour: 10, title: "10:00 – 11:00", id: "hourly_10" },
    { hour: 11, title: "11:00 – 12:00", id: "hourly_11" },
    { hour: 12, title: "12:00 – 13:00", id: "hourly_12" },
    { hour: 14, title: "14:00 – 15:00", id: "hourly_14" },
    { hour: 15, title: "15:00 – 16:00", id: "hourly_15" },
    { hour: 16, title: "16:00 – 17:00", id: "hourly_16" },
  ]
  
  return hourlySlots.map(slot => ({
    id: slot.id,
    title: slot.title,
    description: "Available",
    hour: slot.hour
  }))
}

// Generate 15-minute sub-slots within an hour
function generate15MinuteSubSlots(hour: number): string[] {
  const slots: string[] = []
  const hourStr = hour.toString().padStart(2, "0")
  
  // Generate 4 sub-slots: 00, 15, 30, 45
  for (let minute = 0; minute < 60; minute += 15) {
    slots.push(`${hourStr}:${minute.toString().padStart(2, "0")}`)
  }
  
  return slots
}

// Get next available 15-minute slot within an hour
async function getNextAvailable15MinSlot(
  db: FirebaseFirestore.Firestore,
  hour: number,
  appointmentDate: string,
  doctorId?: string
): Promise<string | null> {
  const subSlots = generate15MinuteSubSlots(hour)
  
  // Check each 15-minute slot for availability
  for (const slot of subSlots) {
    const normalizedTime = normalizeTime(slot)
    
    // Skip past slots for today with proper time validation
    const today = new Date()
    const todayDateString = today.toISOString().split("T")[0]
    const isToday = appointmentDate === todayDateString
    
    if (isToday && appointmentDate) {
      // Create proper datetime for the slot using local timezone
      const [year, month, day] = appointmentDate.split('-').map(Number)
      const [hours, minutes] = normalizedTime.split(':').map(Number)
      const slotDateTime = new Date(year, month - 1, day, hours, minutes, 0)
      const now = new Date()
      const minimumTime = now.getTime() + (15 * 60 * 1000)
      
      if (slotDateTime.getTime() <= minimumTime) {
        continue
      }
    }
    
    // Check if slot is available (only if doctor is assigned)
    if (doctorId) {
      const slotDocId = `${doctorId}_${appointmentDate}_${normalizedTime}`.replace(/[:\s]/g, "-")
      const slotRef = db.collection("appointmentSlots").doc(slotDocId)
      const slotDoc = await slotRef.get()
      
      if (slotDoc.exists) {
        continue
      }
    }
    
    return slot
  }
  
  return null
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
      const _normalizedDates = normalizeBlockedDates(blockedDates)
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
    isRecheckup?: boolean
    recheckupNote?: string
    originalAppointmentId?: string
  },
  phone: string,
  whatsappPending: boolean = false
) {
  const appointmentTime = normalizeTime(payload.appointmentTime)
  
  // Prefer patient's registered hospital, then doctor's hospital, then first active hospital (BEFORE transaction)
  let hospitalId: string | null = null
  // 1) Try patient record hospitals
  const patientData = patient.data || {}
  if (patientData.hospitalId) {
    hospitalId = String(patientData.hospitalId)
  } else if (Array.isArray(patientData.hospitals) && patientData.hospitals.length > 0) {
    hospitalId = String(patientData.hospitals[0])
  } else if (patientData.activeHospital) {
    hospitalId = String(patientData.activeHospital)
  }

  // 2) Fallback to doctor's hospital if patient hospital is not set
  if (!hospitalId && payload.doctorId) {
    hospitalId = await getDoctorHospitalId(payload.doctorId)
  }
  
  // 3) Final fallback: use first active hospital if still not found
  if (!hospitalId) {
    const activeHospitals = await getAllActiveHospitals()
    if (activeHospitals.length > 0) {
      hospitalId = activeHospitals[0].id
    }
  }
  
  if (!hospitalId) {
    throw new Error("No hospital available for appointment creation")
  }
  
  // Validate that appointment time is not in the past (for today's appointments)
  const isToday = payload.appointmentDate === new Date().toISOString().split("T")[0]
  if (isToday && payload.appointmentDate) {
    const now = new Date()
    const currentTime = now.getTime()
    const minimumTime = currentTime + (15 * 60 * 1000) // 15 minutes buffer
    
    // Create slot datetime in local timezone to avoid timezone issues
    const [year, month, day] = payload.appointmentDate.split('-').map(Number)
    const [hours, minutes] = appointmentTime.split(':').map(Number)
    const slotDateTime = new Date(year, month - 1, day, hours, minutes, 0)
    const slotTime = slotDateTime.getTime()
    
    // Reject if slot is in the past or less than 15 minutes away
    if (slotTime <= minimumTime) {
      throw new Error("Cannot book appointment: Selected time has already passed or is too soon (must be at least 15 minutes from now)")
    }
  }
  
  // Validate blocked date BEFORE creating appointment (if doctor is assigned)
  if (payload.doctorId && doctor) {
    const availabilityCheck = checkDateAvailability(payload.appointmentDate, doctor.data)
    if (availabilityCheck.isBlocked) {
      throw new Error(`DATE_BLOCKED: ${availabilityCheck.reason || "Doctor is not available on this date"}`)
    }
  }
  
  let appointmentId = ""

  await db.runTransaction(async (transaction) => {
    // Reserve slot even if no doctor assigned (to prevent double booking)
    // Use placeholder slot ID if no doctor
    const checkSlotDocId = payload.doctorId
      ? `${payload.doctorId}_${payload.appointmentDate}_${appointmentTime}`.replace(/[:\s]/g, "-")
      : `PENDING_${payload.appointmentDate}_${appointmentTime}`.replace(/[:\s]/g, "-")
    
    const checkSlotRef = db.collection("appointmentSlots").doc(checkSlotDocId)
    const checkSlotSnap = await transaction.get(checkSlotRef)
    
    if (checkSlotSnap.exists) {
      // Check if it's the same appointment (for updates)
      const existingSlotData = checkSlotSnap.data()
      if (existingSlotData && existingSlotData.appointmentId && existingSlotData.appointmentId !== appointmentId) {
        throw new Error("SLOT_ALREADY_BOOKED")
      }
    }

    // Create appointment in hospital-scoped subcollection
    const appointmentRef = db.collection(getHospitalCollectionPath(hospitalId, "appointments")).doc()
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
      isRecheckup: payload.isRecheckup || false,
      recheckupNote: payload.recheckupNote || "",
      originalAppointmentId: payload.originalAppointmentId || "",
      hospitalId: hospitalId, // Store hospital association
    }

    transaction.set(appointmentRef, appointmentData)

    // Reserve slot (even if no doctor assigned - prevents double booking)
    const finalSlotDocId = payload.doctorId
      ? `${payload.doctorId}_${payload.appointmentDate}_${appointmentTime}`.replace(/[:\s]/g, "-")
      : `PENDING_${payload.appointmentDate}_${appointmentTime}`.replace(/[:\s]/g, "-")
    
    const finalSlotRef = db.collection("appointmentSlots").doc(finalSlotDocId)
    transaction.set(finalSlotRef, {
      appointmentId,
      doctorId: payload.doctorId || null,
      appointmentDate: payload.appointmentDate,
      appointmentTime,
      createdAt: new Date().toISOString(),
      pending: !payload.doctorId, // Flag to indicate slot is pending doctor assignment
      hospitalId: hospitalId, // Store hospitalId in slot
    })
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

  // Check if this is a re-checkup appointment
  const isRecheckup = session.isRecheckup || false
  const recheckupNote = session.recheckupNote || ""
  
  // Send confirmation message
  const isPending = !doctorData
  const recheckupHeader = isRecheckup ? "🔄 *Re-checkup Appointment Request Received!*\n\n" : "🎉 *Appointment Request Received!*\n\n"
  const recheckupHeaderConfirmed = isRecheckup ? "🔄 *Re-checkup Appointment Confirmed!*\n\n" : "🎉 *Appointment Confirmed!*\n\n"
  
  const confirmationMsg = isPending
    ? `${recheckupHeader}Hi ${patientName},

Your ${isRecheckup ? "re-checkup " : ""}appointment request has been received:
• 📅 Date: ${dateDisplay}
• 🕒 Time: ${timeDisplay}
• 📋 Appointment ID: ${appointmentId}
• 👨‍⚕️ Doctor: Will be assigned by reception${recheckupNote ? `\n• 📝 Note: ${recheckupNote}` : ""}

✅ Our receptionist will confirm your appointment and assign a doctor shortly. You'll receive a confirmation message once processed.

If you need to reschedule, just reply here or call us at +91-XXXXXXXXXX.`
    : `${recheckupHeaderConfirmed}Hi ${patientName},

Your ${isRecheckup ? "re-checkup " : ""}appointment has been booked successfully:
• 👨‍⚕️ Doctor: ${doctorName}
• 📅 Date: ${dateDisplay}
• 🕒 Time: ${timeDisplay}
• 📋 Appointment ID: ${appointmentId}${recheckupNote ? `\n• 📝 Note: ${recheckupNote}` : ""}
• 💳 Payment: ${session.paymentMethod?.toUpperCase() || "CASH"} - ₹${amountCollected}${remainingAmount > 0 ? ` (₹${remainingAmount} due at hospital)` : " (paid)"}

✅ Your appointment is now visible in our system. Admin and receptionist can see it.

If you need to reschedule, just reply here or call us at +91-XXXXXXXXXX.`

  await sendTextMessage(phone, confirmationMsg)

  // Generate and send PDF only if doctor is assigned (not pending)
  if (!isPending && doctorData) {
    try {
      const nowIso = new Date().toISOString()
      const paidAt = remainingAmount === 0 ? nowIso : ""
      const appointmentStatus: Appointment["status"] = "confirmed"
      const paymentStatus = remainingAmount === 0 ? "paid" : "pending"

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
        status: appointmentStatus,
        chiefComplaint: session.symptoms || "General consultation",
        medicalHistory: "",
        paymentMethod: session.paymentMethod || "cash",
        paymentStatus,
        paymentType: session.paymentType || "full",
        totalConsultationFee: consultationFee,
        paymentAmount: amountCollected,
        remainingAmount,
        paidAt,
        createdAt: nowIso,
        updatedAt: nowIso,
      }

    // Generate PDF as base64
    const pdfBase64 = generateAppointmentConfirmationPDFBase64(appointment)
    
    // Extract base64 data (remove data:application/pdf;base64, prefix)
    const base64Data = pdfBase64.split(",")[1]

    // Store PDF in Firestore temporarily (for API endpoint to serve it)
    const db = admin.firestore()
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

