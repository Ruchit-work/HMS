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
      console.warn("Firebase Admin env vars missing for receptionist create-patient API.")
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
    const password: string | undefined = body?.password
    if (!patientData) {
      return Response.json({ error: "Missing patientData" }, { status: 400 })
    }

    const { firstName, lastName, email } = patientData
    if (!firstName || !lastName || !email) {
      return Response.json({ error: "firstName, lastName, and email are required" }, { status: 400 })
    }
    if (!password || password.length < 6) {
      return Response.json({ error: "Password must be at least 6 characters" }, { status: 400 })
    }

    // Create Auth user with provided password
    let authUid: string
    try {
      const existing = await admin.auth().getUserByEmail(String(email).trim().toLowerCase())
      // If exists, update password
      authUid = existing.uid
      await admin.auth().updateUser(authUid, { password })
    } catch (_e) {
      const created = await admin.auth().createUser({
        email: String(email).trim().toLowerCase(),
        emailVerified: false,
        disabled: false,
        password
      })
      authUid = created.uid
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

    // Store patient doc with ID = authUid (so patient dashboard can load by user.uid)
    await admin.firestore().collection("patients").doc(authUid).set(docData, { merge: true })

    return Response.json({ success: true, id: authUid, authUid })
  } catch (error: any) {
    console.error("receptionist create-patient error:", error)
    return Response.json({ error: error?.message || "Failed to create patient" }, { status: 500 })
  }
}


