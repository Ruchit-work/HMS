import admin from "firebase-admin"
import type { NextRequest } from "next/server"

interface Params {
  requestId: string
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
      console.warn("Firebase Admin credentials missing for receptionist cancel admission request API.")
      return false
    }

    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey })
    })
  }
  return true
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<Params> }
) {
  try {
    const ok = initAdmin()
    if (!ok) {
      return Response.json({ error: "Server not configured for admin" }, { status: 500 })
    }

    const { reason } = await req.json().catch(() => ({}))
    const { requestId } = await context.params
    if (!requestId) {
      return Response.json({ error: "Missing requestId" }, { status: 400 })
    }

    const firestore = admin.firestore()
    const requestRef = firestore.collection("admission_requests").doc(requestId)
    const requestSnap = await requestRef.get()

    if (!requestSnap.exists) {
      return Response.json({ error: "Admission request not found" }, { status: 404 })
    }

    const requestData = requestSnap.data() || {}
    if (requestData.status !== "pending") {
      return Response.json({ error: "Admission request is not pending" }, { status: 400 })
    }

    const appointmentId = String(requestData.appointmentId || "")
    if (!appointmentId) {
      return Response.json({ error: "Request missing appointmentId" }, { status: 400 })
    }

    const appointmentRef = firestore.collection("appointments").doc(appointmentId)
    const appointmentSnap = await appointmentRef.get()
    if (!appointmentSnap.exists) {
      return Response.json({ error: "Appointment not found" }, { status: 404 })
    }

    const nowIso = new Date().toISOString()

    await firestore.runTransaction(async (tx) => {
      tx.update(requestRef, {
        status: "cancelled",
        cancelledAt: nowIso,
        updatedAt: nowIso,
        cancelReason: typeof reason === "string" && reason.trim() ? reason.trim() : null
      })

      tx.update(appointmentRef, {
        status: "completed",
        admissionRequestId: null,
        updatedAt: nowIso
      })
    })

    return Response.json({ success: true })
  } catch (error: any) {
    console.error("admission-request cancel error", error)
    return Response.json(
      { error: error?.message || "Failed to cancel admission request" },
      { status: 500 }
    )
  }
}


