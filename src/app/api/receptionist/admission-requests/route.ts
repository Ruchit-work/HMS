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
      console.warn("Firebase Admin credentials missing for receptionist admission requests API.")
      return false
    }

    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey })
    })
  }
  return true
}

export async function GET() {
  try {
    const ok = initAdmin()
    if (!ok) {
      return Response.json({ error: "Server not configured for admin" }, { status: 500 })
    }

    const firestore = admin.firestore()
    const snapshot = await firestore
      .collection("admission_requests")
      .orderBy("createdAt", "desc")
      .get()

    const requests = await Promise.all(
      snapshot.docs.map(async (docSnap) => {
        const data = docSnap.data() || {}
        const appointmentId = String(data.appointmentId || "")
        let appointmentDetails: Record<string, unknown> | null = null

        if (appointmentId) {
          try {
            const aptSnap = await firestore.collection("appointments").doc(appointmentId).get()
            if (aptSnap.exists) {
              const aptData = aptSnap.data() || {}
              appointmentDetails = {
                appointmentDate: aptData.appointmentDate || null,
                appointmentTime: aptData.appointmentTime || null,
                patientPhone: aptData.patientPhone || null,
                doctorSpecialization: aptData.doctorSpecialization || null
              }
            }
          } catch (err) {
            console.warn("Failed to load appointment details for admission request", appointmentId, err)
          }
        }

        return {
          id: docSnap.id,
          ...data,
          appointmentDetails
        }
      })
    )

    return Response.json({ requests })
  } catch (error: any) {
    console.error("admission-requests GET error", error)
    return Response.json(
      { error: error?.message || "Failed to load admission requests" },
      { status: 500 }
    )
  }
}


