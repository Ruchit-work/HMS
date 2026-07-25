/**
 * Remove a prescription from the active pharmacy queue without deleting
 * the appointment or prescription medical history.
 */

import { NextRequest, NextResponse } from 'next/server'
import { admin, initFirebaseAdmin } from '@/server/firebaseAdmin'
import { authenticateRequest, createAuthErrorResponse } from '@/shared/utils/firebase/apiAuth'
import { getPharmacyAuthContext } from '@/shared/utils/pharmacy/serverPharmacy'
import { getHospitalCollectionPath } from '@/shared/utils/firebase/serverHospitalQueries'

interface Params {
  appointmentId: string
}

export async function POST(request: NextRequest, context: { params: Promise<Params> }) {
  const auth = await authenticateRequest(request)
  if (!auth.success || !auth.user) return createAuthErrorResponse(auth)

  const init = initFirebaseAdmin('pharmacy/prescription-queue-remove')
  if (!init.ok) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

  const ctxResult = await getPharmacyAuthContext(auth.user, {})
  if (!ctxResult.success) {
    return NextResponse.json({ success: false, error: ctxResult.error }, { status: 403 })
  }

  const { appointmentId } = await context.params
  if (!appointmentId) {
    return NextResponse.json({ success: false, error: 'Missing appointmentId' }, { status: 400 })
  }

  const body = await request.json().catch(() => ({}))
  const action = typeof body?.action === 'string' ? body.action.trim().toLowerCase() : 'remove'
  if (action !== 'remove') {
    return NextResponse.json({ success: false, error: 'Unsupported action' }, { status: 400 })
  }

  const hospitalId = ctxResult.context.hospitalId
  const db = admin.firestore()
  const appointmentRef = db
    .collection(getHospitalCollectionPath(hospitalId, 'appointments'))
    .doc(appointmentId)

  const snap = await appointmentRef.get()
  if (!snap.exists) {
    return NextResponse.json({ success: false, error: 'Appointment not found' }, { status: 404 })
  }

  const data = snap.data() || {}
  if (String(data.status || '') !== 'completed') {
    return NextResponse.json({ success: false, error: 'Only completed prescriptions can be removed from the queue' }, { status: 400 })
  }

  // Soft-remove from pharmacy working queue only — medicine / notes / diagnosis stay intact.
  await appointmentRef.set(
    {
      pharmacyQueueStatus: 'removed',
      pharmacyQueueRemovedAt: new Date().toISOString(),
      pharmacyQueueRemovedBy: auth.user.uid,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  )

  return NextResponse.json({
    success: true,
    appointmentId,
    queueStatus: 'removed',
    message: 'Prescription removed from pharmacy queue. Medical history retained.',
  })
}
