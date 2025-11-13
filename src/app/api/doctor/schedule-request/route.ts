import { NextRequest } from "next/server"
import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"

export async function POST(req: NextRequest) {
  try {
    const initResult = initFirebaseAdmin("doctor-schedule-request API")
    if (!initResult.ok) return Response.json({ error: 'Server not configured' }, { status: 500 })
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


