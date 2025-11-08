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

    // Start batch to update doctor doc and mark request approved
    const batch = db.batch()
    const doctorRef = db.collection('doctors').doc(doctorId)
    if (applyVisitingHours) batch.update(doctorRef, { visitingHours: request.visitingHours || null, updatedAt: new Date().toISOString() })
    if (applyBlockedDates) batch.update(doctorRef, { blockedDates: request.blockedDates || [], updatedAt: new Date().toISOString() })

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
    console.error('approve-schedule-request error', e)
    return Response.json({ error: e?.message || 'Failed to approve request' }, { status: 500 })
  }
}


