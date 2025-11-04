import admin from "firebase-admin"

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
    const docData = {
      patientId: String(appointmentData.patientId),
      patientName: String(appointmentData.patientName),
      patientEmail: appointmentData.patientEmail || "",
      patientPhone: appointmentData.patientPhone || "",
      doctorId: String(appointmentData.doctorId),
      doctorName: String(appointmentData.doctorName),
      doctorSpecialization: appointmentData.doctorSpecialization || "",
      appointmentDate: String(appointmentData.appointmentDate),
      appointmentTime: String(appointmentData.appointmentTime),
      status: appointmentData.status || "confirmed",
      paymentAmount: typeof appointmentData.paymentAmount === 'number' ? appointmentData.paymentAmount : 0,
      createdAt: appointmentData.createdAt || nowIso,
      updatedAt: nowIso,
      createdBy: appointmentData.createdBy || "receptionist"
    }

    const ref = await admin.firestore().collection("appointments").add(docData)
    return Response.json({ success: true, id: ref.id })
  } catch (error: any) {
    console.error("create-appointment error:", error)
    return Response.json({ error: error?.message || "Failed to create appointment" }, { status: 500 })
  }
}


