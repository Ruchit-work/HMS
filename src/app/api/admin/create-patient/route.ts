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
      console.warn("Firebase Admin env vars missing for create-patient API.")
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
    const patientData = body?.patientData
    if (!patientData) {
      return Response.json({ error: "Missing patientData" }, { status: 400 })
    }

    // Basic required fields
    const { firstName, lastName, email } = patientData
    if (!firstName || !lastName || !email) {
      return Response.json({ error: "firstName, lastName, and email are required" }, { status: 400 })
    }

    const nowIso = new Date().toISOString()
    const docData = {
      status: patientData.status || "active",
      firstName: String(firstName).trim(),
      lastName: String(lastName).trim(),
      email: String(email).trim().toLowerCase(),
      phone: patientData.phone || "",
      gender: patientData.gender || "",
      bloodGroup: patientData.bloodGroup || "",
      address: patientData.address || "",
      dateOfBirth: patientData.dateOfBirth || "",
      createdAt: patientData.createdAt || nowIso,
      updatedAt: nowIso,
      createdBy: patientData.createdBy || "receptionist"
    }

    const ref = await admin.firestore().collection("patients").add(docData)

    return Response.json({ success: true, id: ref.id })
  } catch (error: any) {
    console.error("create-patient error:", error)
    return Response.json({ error: error?.message || "Failed to create patient" }, { status: 500 })
  }
}


