import { NextRequest } from "next/server"
import admin from "firebase-admin"

function initAdmin() {
  if (!admin.apps.length) {
    const projectId = process.env.FIREBASE_PROJECT_ID
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
    let privateKey = process.env.FIREBASE_PRIVATE_KEY
    if (privateKey && privateKey.startsWith("\"") && privateKey.endsWith("\"")) {
      privateKey = privateKey.slice(1, -1)
    }
    if (privateKey) privateKey = privateKey.replace(/\\n/g, "\n")
    if (!projectId || !clientEmail || !privateKey) return false
    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey })
    })
  }
  return true
}

export async function POST(req: NextRequest) {
  try {
    const ok = initAdmin()
    if (!ok) return Response.json({ error: 'Server not configured' }, { status: 500 })
    const body = await req.json().catch(() => ({}))
    const { doctorId, requestType, visitingHours, blockedDates } = body || {}

    if (!doctorId || !requestType) {
      return Response.json({ error: "Missing doctorId or requestType" }, { status: 400 })
    }

    const payload: any = {
      doctorId,
      requestType, // 'visitingHours' | 'blockedDates' | 'both'
      status: 'pending',
      createdAt: new Date().toISOString(),
    }

    if (requestType === 'visitingHours' || requestType === 'both') {
      payload.visitingHours = visitingHours || null
    }
    if (requestType === 'blockedDates' || requestType === 'both') {
      payload.blockedDates = blockedDates || null
    }

    const ref = await admin.firestore().collection('doctor_schedule_requests').add(payload)
    return Response.json({ success: true, id: ref.id })
  } catch (e: any) {
    console.error('schedule-request error', e)
    return Response.json({ error: e?.message || 'Failed to create request' }, { status: 500 })
  }
}


