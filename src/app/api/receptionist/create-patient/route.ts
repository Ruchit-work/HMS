import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { sendWhatsAppNotification } from "@/server/whatsapp"

const buildWelcomeMessage = (firstName?: string, patientId?: string) => {
  const friendlyName = firstName?.trim() || "there"
  const idCopy = patientId ? ` Your patient ID is ${patientId}.` : ""
  return `Hi ${friendlyName}, welcome to Harmony Medical Services.${idCopy} We'll share appointment updates here on WhatsApp.`
}

export async function POST(request: Request) {
  try {
    const initResult = initFirebaseAdmin("create-patient API")
    if (!initResult.ok) {
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

    const db = admin.firestore()
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
      createdBy: patientData.createdBy || "receptionist",
      patientId
    }

    // Store patient doc with ID = authUid (so patient dashboard can load by user.uid)
    await db.collection("patients").doc(authUid).set(docData, { merge: true })

    const phoneCandidates = [
      patientData.phone,
      `${patientData.phoneCountryCode || ""}${patientData.phoneNumber || ""}`,
      patientData.phoneNumber,
    ].filter((phone) => phone && phone.trim() !== "")

    // Send WhatsApp notification only if we have a phone number (don't block on this)
    if (phoneCandidates.length > 0) {
      sendWhatsAppNotification({
        to: phoneCandidates[0],
        fallbackRecipients: phoneCandidates.slice(1),
        message: buildWelcomeMessage(docData.firstName, patientId),
      }).catch((error) => {
        console.error("[create-patient] WhatsApp notification failed:", error)
      })
    }

    return Response.json({ success: true, id: authUid, authUid, patientId })
  } catch (error: any) {
    console.error("receptionist create-patient error:", error)
    return Response.json({ error: error?.message || "Failed to create patient" }, { status: 500 })
  }
}


