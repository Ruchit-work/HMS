import admin from "firebase-admin"
import { sendWhatsAppNotification } from "@/server/whatsapp"

const formatAppointmentDateTime = (date: string, time: string) => {
  if (!date) return "the scheduled time"
  const iso = `${date}T${time || "00:00"}`
  const dt = new Date(iso)
  if (Number.isNaN(dt.getTime())) {
    return time ? `${date} at ${time}` : date
  }

  const formattedDate = dt.toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })

  if (!time) return formattedDate

  const formattedTime = dt.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  })

  return `${formattedDate} at ${formattedTime}`
}

const sendAppointmentWhatsApp = async (appointmentData: Record<string, any>) => {
  const patientName: string = appointmentData.patientName || "there"
  const friendlyName = patientName.trim().split(" ")[0] || "there"
  const doctorName: string = appointmentData.doctorName || "our doctor"
  const schedule = formatAppointmentDateTime(appointmentData.appointmentDate, appointmentData.appointmentTime)
  const message = `Hi ${friendlyName}, your appointment with ${doctorName} on ${schedule} is confirmed. Reply here if you need any help.`

  // Try multiple phone number fields
  const phoneCandidates = [
    appointmentData.patientPhone,
    appointmentData.patientPhoneNumber,
    appointmentData.patientContact,
    appointmentData.phone,
  ].filter(Boolean)

  await sendWhatsAppNotification({
    to: phoneCandidates[0] || null,
    fallbackRecipients: phoneCandidates.slice(1),
    message,
  })
}

function initAdmin() {
  if (!admin.apps.length) {
    const projectId = process.env.FIREBASE_PROJECT_ID
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
    let privateKey = process.env.FIREBASE_PRIVATE_KEY

    if (privateKey && privateKey.startsWith("\"") && privateKey.endsWith("\"")) {
      privateKey = privateKey.slice(1, -1)
    }
    if (privateKey) {
      privateKey = privateKey.replace(/\\n/g, "\n")
    }

    if (!projectId || !clientEmail || !privateKey) {
      console.warn("Firebase Admin env vars missing for create-appointment API.")
      return false
    }

    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey })
    })
  }
  return true
}

export async function POST(request: Request) {
  try {
    const ok = initAdmin()
    if (!ok) {
      return Response.json({ error: "Server not configured for admin" }, { status: 500 })
    }

    const body = await request.json().catch(() => ({}))
    const appointmentData = body?.appointmentData
    if (!appointmentData) {
      return Response.json({ error: "Missing appointmentData" }, { status: 400 })
    }

    const required = ["patientId", "patientName", "doctorId", "doctorName", "appointmentDate", "appointmentTime"]
    for (const k of required) {
      if (!appointmentData[k]) {
        return Response.json({ error: `Missing ${k}` }, { status: 400 })
      }
    }

    const nowIso = new Date().toISOString()
    
    // Helper function to ensure no undefined values
    const safeValue = (val: any, defaultValue: any = "") => {
      return val !== undefined && val !== null ? val : defaultValue
    }
    
    const docData: any = {
      patientId: String(appointmentData.patientId),
      patientName: String(appointmentData.patientName),
      patientEmail: safeValue(appointmentData.patientEmail, ""),
      patientPhone: safeValue(appointmentData.patientPhone, ""),
      doctorId: String(appointmentData.doctorId),
      doctorName: String(appointmentData.doctorName),
      doctorSpecialization: safeValue(appointmentData.doctorSpecialization, ""),
      appointmentDate: String(appointmentData.appointmentDate),
      appointmentTime: String(appointmentData.appointmentTime),
      status: safeValue(appointmentData.status, "confirmed"),
      paymentAmount: typeof appointmentData.paymentAmount === 'number' ? appointmentData.paymentAmount : 0,
      createdAt: safeValue(appointmentData.createdAt, nowIso),
      updatedAt: nowIso,
      createdBy: safeValue(appointmentData.createdBy, "receptionist")
    }
    
    // Include optional patient health fields only if they exist and are not undefined
    if (appointmentData.patientGender !== undefined) docData.patientGender = safeValue(appointmentData.patientGender, "")
    if (appointmentData.patientBloodGroup !== undefined) docData.patientBloodGroup = safeValue(appointmentData.patientBloodGroup, "")
    if (appointmentData.patientDateOfBirth !== undefined) docData.patientDateOfBirth = safeValue(appointmentData.patientDateOfBirth, "")
    if (appointmentData.patientDrinkingHabits !== undefined) docData.patientDrinkingHabits = safeValue(appointmentData.patientDrinkingHabits, "")
    if (appointmentData.patientSmokingHabits !== undefined) docData.patientSmokingHabits = safeValue(appointmentData.patientSmokingHabits, "")
    if (appointmentData.patientVegetarian !== undefined) docData.patientVegetarian = appointmentData.patientVegetarian ?? false
    if (appointmentData.patientOccupation !== undefined) docData.patientOccupation = safeValue(appointmentData.patientOccupation, "")
    if (appointmentData.patientFamilyHistory !== undefined) docData.patientFamilyHistory = safeValue(appointmentData.patientFamilyHistory, "")
    if (appointmentData.patientPregnancyStatus !== undefined) docData.patientPregnancyStatus = safeValue(appointmentData.patientPregnancyStatus, "")
    if (appointmentData.patientHeightCm !== undefined) docData.patientHeightCm = appointmentData.patientHeightCm ?? null
    if (appointmentData.patientWeightKg !== undefined) docData.patientWeightKg = appointmentData.patientWeightKg ?? null
    if (appointmentData.patientAllergies !== undefined) docData.patientAllergies = safeValue(appointmentData.patientAllergies, "")
    if (appointmentData.patientCurrentMedications !== undefined) docData.patientCurrentMedications = safeValue(appointmentData.patientCurrentMedications, "")
    
    // Include appointment-specific fields
    if (appointmentData.chiefComplaint !== undefined) docData.chiefComplaint = safeValue(appointmentData.chiefComplaint, "")
    if (appointmentData.medicalHistory !== undefined) docData.medicalHistory = safeValue(appointmentData.medicalHistory, "")
    if (appointmentData.patientAdditionalConcern !== undefined) docData.patientAdditionalConcern = safeValue(appointmentData.patientAdditionalConcern, "")
    if (appointmentData.symptomOnset !== undefined) docData.symptomOnset = safeValue(appointmentData.symptomOnset, "")
    if (appointmentData.symptomDuration !== undefined) docData.symptomDuration = safeValue(appointmentData.symptomDuration, "")
    if (appointmentData.symptomSeverity !== undefined) docData.symptomSeverity = appointmentData.symptomSeverity ?? null
    if (appointmentData.symptomProgression !== undefined) docData.symptomProgression = safeValue(appointmentData.symptomProgression, "")
    if (appointmentData.symptomTriggers !== undefined) docData.symptomTriggers = safeValue(appointmentData.symptomTriggers, "")
    if (appointmentData.associatedSymptoms !== undefined) docData.associatedSymptoms = safeValue(appointmentData.associatedSymptoms, "")
    
    // Remove any undefined values that might have slipped through
    Object.keys(docData).forEach(key => {
      if (docData[key] === undefined) {
        delete docData[key]
      }
    })

    const ref = await admin.firestore().collection("appointments").add(docData)

    // If patient phone is missing, try to fetch it from the patient record
    let patientPhone = docData.patientPhone || appointmentData.patientPhone
    if (!patientPhone || patientPhone.trim() === "") {
      try {
        const patientDoc = await admin.firestore().collection("patients").doc(appointmentData.patientId).get()
        if (patientDoc.exists) {
          const patientData = patientDoc.data()
          patientPhone = patientData?.phone || patientData?.phoneNumber || patientData?.contact || patientData?.mobile || ""
        }
      } catch (error) {
        console.error("[create-appointment] Error fetching patient phone:", error)
      }
    }

    // Send WhatsApp notification only if we have a phone number (don't block on this)
    if (patientPhone && patientPhone.trim() !== "") {
      sendAppointmentWhatsApp({
        ...appointmentData,
        patientPhone: patientPhone,
        patientName: docData.patientName,
        doctorName: docData.doctorName,
        appointmentDate: docData.appointmentDate,
        appointmentTime: docData.appointmentTime,
      }).catch((error) => {
        console.error("[create-appointment] WhatsApp notification failed:", error)
      })
    }

    return Response.json({ success: true, id: ref.id })
  } catch (error: any) {
    console.error("create-appointment error:", error)
    return Response.json({ error: error?.message || "Failed to create appointment" }, { status: 500 })
  }
}


