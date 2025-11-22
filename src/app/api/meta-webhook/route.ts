import { NextResponse } from "next/server"
import { sendTextMessage, sendButtonMessage, sendListMessage, sendDocumentMessage, formatPhoneNumber } from "@/server/metaWhatsApp"
import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { normalizeTime } from "@/utils/timeSlots"
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

    // Handle button clicks
    if (messageType === "interactive" && message.interactive?.type === "button_reply") {
      const buttonId = message.interactive.button_reply?.id
      if (buttonId === "book_appointment") {
        await startBookingConversation(from)
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

// Booking conversation states
type BookingState = "idle" | "selecting_doctor" | "selecting_date" | "selecting_time" | "entering_symptoms" | "selecting_payment" | "confirming"

interface BookingSession {
  state: BookingState
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

async function startBookingConversation(phone: string) {
  const db = admin.firestore()
  const normalizedPhone = formatPhoneNumber(phone)

  // Check if patient exists
  const patient = await findPatientByPhone(db, normalizedPhone)
  if (!patient) {
    // Get base URL for signup link
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : "https://hospitalmanagementsystem-hazel.vercel.app"
    const signupUrl = `${baseUrl}/auth/signup?role=patient`
    
    await sendTextMessage(
      phone,
      `❌ We couldn't find your patient profile.\n\n📝 *Please register first to book appointments:*\n\n${signupUrl}\n\nOr contact reception:\nPhone: +91-XXXXXXXXXX\n\nAfter registration, you can book appointments via WhatsApp! 🏥`
    )
    return
  }

  // Get available doctors
  const doctorsSnapshot = await db.collection("doctors").where("status", "==", "active").limit(10).get()
  if (doctorsSnapshot.empty) {
    await sendTextMessage(phone, "❌ No doctors available at the moment. Please contact reception.")
    return
  }

  const doctors = doctorsSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }))

  // Create booking session
  const sessionRef = db.collection("whatsappBookingSessions").doc(normalizedPhone)
  await sessionRef.set({
    state: "selecting_doctor",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })

  // Send doctor list
  let doctorList = "👨‍⚕️ *Select a Doctor:*\n\n"
  doctors.forEach((doc: any, index: number) => {
    const name = `${doc.firstName || ""} ${doc.lastName || ""}`.trim()
    const specialization = doc.specialization || "General"
    doctorList += `${index + 1}. ${name} - ${specialization}\n`
  })
  doctorList += "\nPlease reply with the number (1-10) of the doctor you'd like to book with."

  await sendTextMessage(phone, doctorList)
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

  // Handle cancel/reset
  if (trimmedText === "cancel" || trimmedText === "reset" || trimmedText === "start over") {
    await sessionRef.delete()
    await sendTextMessage(phone, "Booking cancelled. Type 'Book' or click the button to start again.")
    return true
  }

  switch (session.state) {
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

async function handleDoctorSelection(
  db: FirebaseFirestore.Firestore,
  phone: string,
  normalizedPhone: string,
  sessionRef: FirebaseFirestore.DocumentReference,
  text: string,
  session: BookingSession
): Promise<boolean> {
  const doctorNum = parseInt(text)
  if (isNaN(doctorNum) || doctorNum < 1 || doctorNum > 10) {
    await sendTextMessage(phone, "❌ Please enter a number between 1 and 10.")
    return true
  }

  const doctorsSnapshot = await db.collection("doctors").where("status", "==", "active").limit(10).get()
  const doctors = doctorsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))

  if (doctorNum > doctors.length) {
    await sendTextMessage(phone, "❌ Invalid selection. Please try again.")
    return true
  }

  const selectedDoctor = doctors[doctorNum - 1] as any
  await sessionRef.update({
    state: "selecting_date",
    doctorId: selectedDoctor.id,
    updatedAt: new Date().toISOString(),
  })

  await sendTextMessage(
    phone,
    `✅ Selected: ${selectedDoctor.firstName} ${selectedDoctor.lastName}\n\n📅 *Select Date:*\nPlease enter your preferred date in YYYY-MM-DD format (e.g., 2025-01-15)\n\nOr type "today" or "tomorrow"`
  )
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
        await sendDatePicker(phone)
        return true
      }
    }

    // Validate date is not in the past
    const selected = new Date(selectedDate + "T00:00:00")
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (selected < today) {
      await sendTextMessage(phone, "❌ Please select a date that is today or in the future.")
      await sendDatePicker(phone)
      return true
    }

    // Date is valid, proceed to time selection
    await sessionRef.update({
      state: "selecting_time",
      appointmentDate: selectedDate,
      updatedAt: new Date().toISOString(),
    })

    await sendTimePicker(phone, session.doctorId!, selectedDate)
    return true
  }

  // No text provided, send date picker
  await sendDatePicker(phone)
  return true
}

async function sendDatePicker(phone: string) {
  const dateOptions = generateDateOptions()
  
  const listResponse = await sendListMessage(
    phone,
    "📅 *Select Appointment Date*\n\nChoose your preferred date:",
    "Select Date",
    [
      {
        title: "Available Dates",
        rows: dateOptions,
      },
    ],
    "Harmony Medical Services"
  )

  if (!listResponse.success) {
    // Fallback to text-based selection
    await sendTextMessage(
      phone,
      "📅 *Select Date:*\n\nPlease enter your preferred date:\n• Type 'today' for today\n• Type 'tomorrow' for tomorrow\n• Or enter date as YYYY-MM-DD (e.g., 2025-01-15)"
    )
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

  // Check if it's a date selection (ID starts with "date_")
  if (selectedId.startsWith("date_")) {
    const selectedDate = selectedId.replace("date_", "")
    
    // Validate date is not in the past
    const selected = new Date(selectedDate + "T00:00:00")
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (selected < today) {
      await sendTextMessage(phone, "❌ Please select a date that is today or in the future.")
      return
    }

    await sessionRef.update({
      state: "selecting_time",
      appointmentDate: selectedDate,
      updatedAt: new Date().toISOString(),
    })

    // Send time picker
    await sendTimePicker(phone, session.doctorId!, session.appointmentDate!)
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
      await sendTextMessage(phone, "❌ This time slot is already booked. Please select another time.")
      // Resend time picker
      await sendTimePicker(phone, session.doctorId!, session.appointmentDate!)
      return
    }

    await sessionRef.update({
      state: "entering_symptoms",
      appointmentTime: normalizedTime,
      updatedAt: new Date().toISOString(),
    })

    await sendTextMessage(
      phone,
      `✅ Selected: ${selectedTime}\n\n📋 *Symptoms/Reason for Visit:*\nPlease describe your symptoms or reason for the appointment.\n\n(You can type "skip" if you don't want to add symptoms now)`
    )
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

async function sendTimePicker(phone: string, doctorId: string, appointmentDate: string) {
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
        title: slot,
        description: "Available",
      })
    }
  }
  
  if (availableSlots.length === 0) {
    await sendTextMessage(phone, "❌ No time slots available for this date. Please select another date.")
    await sendDatePicker(phone)
    return
  }

  // Split into sections if more than 10 (WhatsApp list limit is 10 rows per section)
  const sections = []
  for (let i = 0; i < availableSlots.length; i += 10) {
    sections.push({
      title: i === 0 ? "Available Time Slots" : "More Time Slots",
      rows: availableSlots.slice(i, i + 10),
    })
  }

  const listResponse = await sendListMessage(
    phone,
    "🕐 *Select Appointment Time*\n\nChoose your preferred time slot:",
    "Select Time",
    sections,
    "Harmony Medical Services"
  )

  if (!listResponse.success) {
    // Fallback to text-based selection
    let timeList = "🕐 *Select Time:*\n\n"
    timeSlots.forEach((slot, index) => {
      timeList += `${index + 1}. ${slot}\n`
    })
    timeList += "\nPlease reply with the number of your preferred time slot."
    await sendTextMessage(phone, timeList)
  }
}

function generateDateOptions(): Array<{ id: string; title: string; description?: string }> {
  const options: Array<{ id: string; title: string; description?: string }> = []
  const today = new Date()
  
  // Generate next 14 days
  for (let i = 0; i < 14; i++) {
    const date = new Date(today)
    date.setDate(today.getDate() + i)
    const dateStr = date.toISOString().split("T")[0]
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
  // Fallback: if user types a number, treat it as time slot selection
  const slotNum = parseInt(text)
  const timeSlots = generateTimeSlots()

  if (isNaN(slotNum) || slotNum < 1 || slotNum > timeSlots.length) {
    // Resend time picker
    await sendTimePicker(phone, session.doctorId!, session.appointmentDate!)
    return true
  }

  const selectedTime = timeSlots[slotNum - 1]
  const normalizedTime = normalizeTime(selectedTime)

  // Check if slot is already booked
  const slotDocId = `${session.doctorId}_${session.appointmentDate}_${normalizedTime}`.replace(/[:\s]/g, "-")
  const slotRef = db.collection("appointmentSlots").doc(slotDocId)
  const slotDoc = await slotRef.get()

  if (slotDoc.exists) {
    await sendTextMessage(phone, "❌ This time slot is already booked. Please select another time.")
    await sendTimePicker(phone, session.doctorId!, session.appointmentDate!)
    return true
  }

  await sessionRef.update({
    state: "entering_symptoms",
    appointmentTime: normalizedTime,
    updatedAt: new Date().toISOString(),
  })

  await sendTextMessage(
    phone,
    `✅ Selected: ${selectedTime}\n\n📋 *Symptoms/Reason for Visit:*\nPlease describe your symptoms or reason for the appointment.\n\n(You can type "skip" if you don't want to add symptoms now)`
  )
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
      // Get base URL for signup link
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL 
        ? `https://${process.env.VERCEL_URL}` 
        : "https://hospitalmanagementsystem-hazel.vercel.app"
      const signupUrl = `${baseUrl}/auth/signup?role=patient`
      
      await sendTextMessage(
        phone,
        `❌ Patient record not found.\n\n📝 *Please register first:*\n\n${signupUrl}\n\nOr contact reception for assistance.`
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
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : "https://your-domain.com"
    
    const pdfUrl = `${baseUrl}/api/appointments/${appointmentId}/confirmation-pdf`
    
    // Send PDF document via WhatsApp
    const docResult = await sendDocumentMessage(
      phone,
      pdfUrl,
      `Appointment-Confirmation-${appointmentId}.pdf`,
      `📄 Your appointment confirmation PDF\n\nAppointment ID: ${appointmentId}`
    )

    if (!docResult.success) {
      console.error("[Meta WhatsApp] Failed to send PDF:", docResult.error)
      // Fallback: send message with link to download
      await sendTextMessage(
        phone,
        `📄 Download your appointment confirmation PDF:\n${pdfUrl}\n\nThis link is valid for 7 days.`
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

