import { NextRequest } from "next/server"
import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { authenticateRequest, createAuthErrorResponse } from "@/utils/apiAuth"

export async function POST(req: NextRequest) {
  // Authenticate request - requires doctor role
  const auth = await authenticateRequest(req, "doctor")
  if (!auth.success) {
    return createAuthErrorResponse(auth)
  }

  try {
    const initResult = initFirebaseAdmin("doctor-schedule-request API")
    if (!initResult.ok) return Response.json({ error: 'Server not configured' }, { status: 500 })
    const body = await req.json().catch(() => ({}))
    const { doctorId, requestType, visitingHours, blockedDates } = body || {}

    if (!doctorId || !requestType) {
      return Response.json({ error: "Missing doctorId or requestType" }, { status: 400 })
    }

    // Verify doctor can only create schedule requests for themselves
    if (doctorId !== auth.user?.uid) {
      return Response.json({ error: "You can only create schedule requests for your own account" }, { status: 403 })
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
    return Response.json({ error: e?.message || 'Failed to create request' }, { status: 500 })
  }
}


