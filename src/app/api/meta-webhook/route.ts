import { NextResponse } from "next/server"
import { sendFlowMessage, sendTextMessage, formatPhoneNumber } from "@/server/metaWhatsApp"
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

    if (messageType === "flow") {
      return await handleFlowCompletion(value)
    }

    if (messageType === "text") {
      await handleIncomingText(from, message.text?.body ?? "")
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
  const flowId = process.env.META_WHATSAPP_FLOW_ID

  if (!flowId) {
    await sendTextMessage(
      phone,
      "Hi! Our WhatsApp booking form isn’t configured yet. Please contact our reception at +91-XXXXXXXXXX."
    )
    return
  }

  const flowToken = `token_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
  const flowResponse = await sendFlowMessage(
    phone,
    flowId,
    flowToken,
    "Book Your Appointment",
    "Please fill out a few quick steps to schedule your visit.",
    "Harmony Medical Services"
  )

  if (!flowResponse.success) {
    console.error("[Meta WhatsApp] Failed to send Flow:", flowResponse.error)
    await sendTextMessage(
      phone,
      "We’re having trouble opening the booking form. Please try again in a moment or contact reception."
    )
    return
  }

  await sendTextMessage(
    phone,
    "I've sent you our booking form. Please tap it to complete your appointment request."
  )
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

  const flowDoctorId = flowData.doctor_id || ""
  const appointmentDate = flowData.appointment_date
  const flowTimeSlot = flowData.appointment_time || ""
  const appointmentTime = toClockTime(flowData.appointment_time)

  const appointmentPayload = {
    symptomCategory: flowData.symptom_category || "",
    chiefComplaint: flowData.chief_complaint || "General consultation",
    doctorId: "",
    appointmentDate,
    appointmentTime,
    medicalHistory: flowData.medical_history || "",
    paymentOption: flowData.payment_option || "",
    paymentStatus: flowData.payment_status || "pending",
  }

  if (!appointmentPayload.appointmentDate || !appointmentPayload.appointmentTime) {
    await sendTextMessage(
      from,
      "❌ We couldn’t read your preferred date or time. Please start again by typing “Book”."
    )
    return NextResponse.json({ success: true })
  }

  const patient = await findPatientByPhone(db, from)
  if (!patient) {
    await sendTextMessage(
      from,
      "We couldn’t find your patient profile. Please contact reception to register before booking."
    )
    return NextResponse.json({ success: true })
  }

  const doctor = await resolveDoctorFromFlow(db, flowDoctorId)
  if (!doctor) {
    await sendTextMessage(
      from,
      "We couldn’t match your selected doctor. Please try booking again or contact reception."
    )
    return NextResponse.json({ success: true })
  }

  appointmentPayload.doctorId = doctor.id

  try {
    const appointmentId = await createAppointment(db, patient, doctor, appointmentPayload, from)
    await sendBookingConfirmation(from, patient, doctor.data, appointmentPayload, appointmentId)
    return NextResponse.json({ success: true, appointmentId })
  } catch (error: any) {
    console.error("[Meta WhatsApp] Failed to create appointment:", error)
    const message =
      error?.message === "SLOT_ALREADY_BOOKED"
        ? "❌ That slot was just booked by someone else. Please open the form again and choose another time."
        : "❌ Something went wrong while confirming your booking. Please try again later or contact our team."

    await sendTextMessage(from, message)
    return NextResponse.json({ success: false })
  }
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

async function resolveDoctorFromFlow(
  db: FirebaseFirestore.Firestore,
  flowDoctorId: string
): Promise<{ id: string; data: FirebaseFirestore.DocumentData } | null> {
  if (!flowDoctorId) return null

  // If Flow already passes a Firestore doc ID
  const directDoc = await db.collection("doctors").doc(flowDoctorId).get()
  if (directDoc.exists) {
    return { id: directDoc.id, data: directDoc.data()! }
  }

  const docs = await db.collection("doctors").where("status", "==", "active").get()
  if (docs.empty) return null

  const normalizedFlow = normalizeString(flowDoctorId)
  for (const doc of docs.docs) {
    const data = doc.data()
    const candidate = normalizeString(`${data.firstName || ""}${data.lastName || ""}`)
    if (candidate.includes(normalizedFlow) || normalizedFlow.includes(candidate)) {
      return { id: doc.id, data }
    }
  }

  // fallback to first active doctor
  const fallback = docs.docs[0]
  return { id: fallback.id, data: fallback.data() }
}

function normalizeString(input: string) {
  return (input || "").toLowerCase().replace(/[^a-z0-9]/g, "")
}

function toClockTime(slot: string) {
  if (!slot) return ""
  if (slot.includes(":")) return slot
  if (slot.startsWith("slot_")) {
    const raw = slot.replace("slot_", "")
    if (raw.length === 4) {
      return `${raw.substring(0, 2)}:${raw.substring(2, 4)}`
    }
  }
  if (slot.length === 4) {
    return `${slot.substring(0, 2)}:${slot.substring(2, 4)}`
  }
  return slot
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
  payload: { appointmentDate: string; appointmentTime: string },
  appointmentId: string
) {
  const doctorName = `${doctorData.firstName || ""} ${doctorData.lastName || ""}`.trim()
  const patientName = `${patient.data.firstName || ""} ${patient.data.lastName || ""}`.trim()
  const dateDisplay = new Date(payload.appointmentDate + "T00:00:00").toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })
  const [h, m] = payload.appointmentTime.split(":").map(Number)
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

If you need to reschedule, just reply here or call us at +91-XXXXXXXXXX.`
  )
}
