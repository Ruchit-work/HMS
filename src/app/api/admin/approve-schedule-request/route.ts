import { NextRequest } from "next/server"
import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { authenticateRequest, createAuthErrorResponse } from "@/utils/apiAuth"
import { applyRateLimit } from "@/utils/rateLimit"
import { getDoctorHospitalId, getHospitalCollectionPath } from "@/utils/serverHospitalQueries"

export async function POST(req: NextRequest) {
  // Apply rate limiting first
  const rateLimitResult = await applyRateLimit(req, "ADMIN")
  if (rateLimitResult instanceof Response) {
    return rateLimitResult // Rate limited
  }

  // Authenticate request - requires admin role
  const auth = await authenticateRequest(req, "admin")
  if (!auth.success) {
    return createAuthErrorResponse(auth)
  }
  if (!auth.user) {
    return Response.json({ error: "Authenticated user context missing" }, { status: 403 })
  }
  const adminUser = auth.user

  // Re-apply rate limit with user ID for better tracking
  const rateLimitWithUser = await applyRateLimit(req, "ADMIN", adminUser.uid)
  if (rateLimitWithUser instanceof Response) {
    return rateLimitWithUser // Rate limited
  }

  try {
    const initResult = initFirebaseAdmin("approve-schedule-request API")
    if (!initResult.ok) return Response.json({ error: 'Server not configured' }, { status: 500 })

    const body = await req.json().catch(() => ({}))
    const { requestId } = body || {}
    if (!requestId) return Response.json({ error: 'Missing requestId' }, { status: 400 })

    const db = admin.firestore()
    const reqRef = db.collection('doctor_schedule_requests').doc(String(requestId))
    const snap = await reqRef.get()
    if (!snap.exists) return Response.json({ error: 'Request not found' }, { status: 404 })
    const request = snap.data() as any
    if (request.status !== 'pending') {
      return Response.json({ error: 'Request is not pending' }, { status: 400 })
    }

    const doctorId = String(request.doctorId)
    const blockedDates: string[] = Array.isArray(request.blockedDates) ? request.blockedDates.map((d: any) => (typeof d === 'string' ? d.slice(0,10) : String(d?.date || '').slice(0,10))).filter(Boolean) : []
    const applyVisitingHours = request.requestType === 'visitingHours' || request.requestType === 'both'
    const applyBlockedDates = request.requestType === 'blockedDates' || request.requestType === 'both'

    // Get doctor's hospital ID to update hospital-scoped collection
    const doctorHospitalId = await getDoctorHospitalId(doctorId)
    
    // Start batch to update doctor doc and mark request approved
    const batch = db.batch()
    const updateData: any = {}
    if (applyVisitingHours) updateData.visitingHours = request.visitingHours || null
    if (applyBlockedDates) updateData.blockedDates = request.blockedDates || []
    updateData.updatedAt = new Date().toISOString()
    
    // Update legacy doctors collection (for backward compatibility)
    const doctorRef = db.collection('doctors').doc(doctorId)
    batch.update(doctorRef, updateData)
    
    // Also update hospital-scoped doctors collection (where booking form reads from)
    if (doctorHospitalId) {
      const hospitalDoctorRef = db.collection(getHospitalCollectionPath(doctorHospitalId, 'doctors')).doc(doctorId)
      batch.update(hospitalDoctorRef, updateData)
    }

    // Collect conflicting appointments (confirmed on blocked dates)
    let conflicts: admin.firestore.QueryDocumentSnapshot[] = []
    if (applyBlockedDates && blockedDates.length > 0) {
      const chunk = (arr: string[], size: number) => arr.reduce((acc: string[][], _, i) => (i % size ? acc : [...acc, arr.slice(i, i + size)]), [])
      const chunks = chunk(blockedDates, 10)
      for (const c of chunks) {
        const q = db.collection('appointments')
          .where('doctorId', '==', doctorId)
          .where('status', '==', 'confirmed')
          .where('appointmentDate', 'in', c)
        const qs = await q.get()
        conflicts = conflicts.concat(qs.docs)
      }
    }

    const nowIso = new Date().toISOString()
    const cancelledCount = 0
    let awaitingCount = 0

    for (const docSnap of conflicts) {
      const apt = docSnap.data() as any
      // Permanent rule: do not auto-cancel; always let patient reschedule
      const newStatus = 'awaiting_reschedule'
      awaitingCount++
      batch.update(docSnap.ref, {
        status: newStatus,
        cancellationReason: 'doctor_unavailable',
        affectedByLeaveRequestId: requestId,
        conflictDetectedAt: nowIso,
        updatedAt: nowIso,
      })
      // Event log
      const evtRef = db.collection('appointment_change_events').doc()
      batch.set(evtRef, {
        type: 'doctor_leave_conflict',
        appointmentId: docSnap.id,
        doctorId,
        patientId: apt.patientId || null,
        requestId,
        createdAt: nowIso,
        prevStatus: 'confirmed',
        nextStatus: newStatus,
      })

      // In-app notification for patient
      if (apt.patientId) {
        const notifRef = db.collection('notifications').doc()
        batch.set(notifRef, {
          userId: apt.patientId,
          type: 'warning',
          title: 'Appointment affected by doctor leave',
          message: `Your appointment with Dr. ${apt.doctorName || ''} on ${apt.appointmentDate} is ${newStatus === 'awaiting_reschedule' ? 'awaiting reschedule' : 'cancelled'}. Please reschedule.`.trim(),
          appointmentId: docSnap.id,
          createdAt: nowIso,
          read: false,
        })
      }
    }

    batch.update(reqRef, {
      status: 'approved',
      approvedAt: nowIso,
      conflictsDetected: conflicts.length,
      awaitingCount,
      cancelledCount,
    })

    await batch.commit()


    return Response.json({ success: true, conflicts: conflicts.length, awaitingCount, cancelledCount })
  } catch (e: any) {
    return Response.json({ error: e?.message || 'Failed to approve request' }, { status: 500 })
  }
}


