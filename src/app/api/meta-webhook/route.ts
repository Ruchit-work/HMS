import { NextResponse } from "next/server"
import { sendTextMessage, sendButtonMessage, formatPhoneNumber } from "@/server/metaWhatsApp"
import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { normalizeTime } from "@/utils/timeSlots"

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
type BookingState = "idle" | "selecting_doctor" | "selecting_date" | "selecting_time" | "entering_symptoms" | "confirming"

interface BookingSession {
  state: BookingState
  doctorId?: string
  appointmentDate?: string
  appointmentTime?: string
  symptoms?: string
  createdAt: string
  updatedAt: string
}

async function startBookingConversation(phone: string) {
  const db = admin.firestore()
  const normalizedPhone = formatPhoneNumber(phone)

  // Check if patient exists
  const patient = await findPatientByPhone(db, normalizedPhone)
  if (!patient) {
    await sendTextMessage(
      phone,
      "❌ We couldn't find your patient profile. Please contact reception to register before booking.\n\nPhone: +91-XXXXXXXXXX"
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
      await sendTextMessage(phone, "❌ Invalid date format. Please use YYYY-MM-DD (e.g., 2025-01-15)")
      return true
    }
  }

  // Validate date is not in the past
  const selected = new Date(selectedDate + "T00:00:00")
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (selected < today) {
    await sendTextMessage(phone, "❌ Please select a date that is today or in the future.")
    return true
  }

  await sessionRef.update({
    state: "selecting_time",
    appointmentDate: selectedDate,
    updatedAt: new Date().toISOString(),
  })

  // Get available time slots for the doctor
  const timeSlots = generateTimeSlots()
  let timeList = "🕐 *Select Time:*\n\n"
  timeSlots.forEach((slot, index) => {
    timeList += `${index + 1}. ${slot}\n`
  })
  timeList += "\nPlease reply with the number of your preferred time slot."

  await sendTextMessage(phone, timeList)
  return true
}

async function handleTimeSelection(
  db: FirebaseFirestore.Firestore,
  phone: string,
  normalizedPhone: string,
  sessionRef: FirebaseFirestore.DocumentReference,
  text: string,
  session: BookingSession
): Promise<boolean> {
  const slotNum = parseInt(text)
  const timeSlots = generateTimeSlots()

  if (isNaN(slotNum) || slotNum < 1 || slotNum > timeSlots.length) {
    await sendTextMessage(phone, `❌ Please enter a number between 1 and ${timeSlots.length}.`)
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

  await sessionRef.update({
    state: "confirming",
    symptoms: symptoms,
    updatedAt: new Date().toISOString(),
  })

  // Get doctor and patient info for confirmation
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

  let confirmMsg = `📋 *Confirm Appointment:*\n\n`
  confirmMsg += `👨‍⚕️ Doctor: ${doctorName}\n`
  confirmMsg += `📅 Date: ${dateDisplay}\n`
  confirmMsg += `🕐 Time: ${timeDisplay}\n`
  if (symptoms) {
    confirmMsg += `📝 Symptoms: ${symptoms}\n`
  }
  confirmMsg += `\nReply "confirm" to book or "cancel" to start over.`

  await sendTextMessage(phone, confirmMsg)
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

  // Create appointment
  try {
    const patient = await findPatientByPhone(db, normalizedPhone)
    if (!patient) {
      await sendTextMessage(phone, "❌ Patient record not found. Please contact reception.")
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
        paymentOption: "cash",
        paymentStatus: "pending",
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

If you need to reschedule, just reply here or call us at +91-XXXXXXXXXX.`
  )
}

