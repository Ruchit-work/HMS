/**
 * Prescription queue: completed appointments with prescribed medicine.
 * Active queue = Pending only (not dispensed / removed / expired).
 * Lifecycle fields live on the appointment document so medical history is never deleted.
 */

import { NextRequest, NextResponse } from 'next/server'
import { admin, initFirebaseAdmin } from '@/server/firebaseAdmin'
import { authenticateRequest, createAuthErrorResponse } from '@/shared/utils/firebase/apiAuth'
import { getPharmacyAuthContext, getPharmacyCollectionPath } from '@/shared/utils/pharmacy/serverPharmacy'
import { getHospitalCollectionPath } from '@/shared/utils/firebase/serverHospitalQueries'
import { parsePrescription } from '@/shared/utils/appointments/prescriptionParsers'

const QUEUE_TTL_MS = 24 * 60 * 60 * 1000

export type PharmacyQueueStatus = 'pending' | 'dispensed' | 'removed' | 'expired'

function parseTimestampMs(value: unknown): number | null {
  if (!value) return null
  if (typeof value === 'string' || typeof value === 'number') {
    const ms = new Date(value).getTime()
    return Number.isFinite(ms) ? ms : null
  }
  if (typeof value === 'object' && value !== null && typeof (value as { toDate?: () => Date }).toDate === 'function') {
    const ms = (value as { toDate: () => Date }).toDate().getTime()
    return Number.isFinite(ms) ? ms : null
  }
  return null
}

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.success || !auth.user) return createAuthErrorResponse(auth)

  const init = initFirebaseAdmin('pharmacy/prescription-queue')
  if (!init.ok) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

  const { searchParams } = new URL(request.url)
  const hospitalIdParam = searchParams.get('hospitalId') || undefined
  const branchIdParam = searchParams.get('branchId') || undefined

  const ctxResult = await getPharmacyAuthContext(auth.user, {
    hospitalId: hospitalIdParam,
    branchId: branchIdParam,
  })
  if (!ctxResult.success) return NextResponse.json({ success: false, error: ctxResult.error }, { status: 403 })

  const db = admin.firestore()
  const hospitalId = ctxResult.context.hospitalId
  const appointmentsPath = getHospitalCollectionPath(hospitalId, 'appointments')

  let appointmentsQuery = db
    .collection(appointmentsPath)
    .where('status', '==', 'completed')
    .limit(500)

  if (ctxResult.context.branchId) {
    appointmentsQuery = appointmentsQuery.where('branchId', '==', ctxResult.context.branchId) as typeof appointmentsQuery
  }

  const appointmentsSnap = await appointmentsQuery.get()
  const docs = appointmentsSnap.docs
    .map((d) => ({ id: d.id, data: d.data(), updatedAt: d.data()?.updatedAt ?? '' }))
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
    .slice(0, 200)

  const salesPath = getPharmacyCollectionPath(hospitalId, 'sales')
  const salesSnap = await db.collection(salesPath).get()
  const dispensedAppointmentIds = new Set(
    salesSnap.docs
      .map((d) => (d.data() as { appointmentId?: string }).appointmentId)
      .filter((id): id is string => Boolean(id))
  )

  const now = Date.now()
  const expireWrites: Array<Promise<unknown>> = []

  const queue: Array<{
    appointmentId: string
    patientName: string
    patientId: string | null
    patientUid: string | null
    doctorName: string
    department: string
    appointmentDate: string
    prescriptionTime: string
    branchId?: string
    branchName?: string
    medicineText: string
    medicines: Array<{ name: string; dosage: string; frequency: string; duration: string }>
    medicineCount: number
    dispensed: boolean
    queueStatus: PharmacyQueueStatus
  }> = []

  for (const { id, data } of docs) {
    const medicineText = typeof data.medicine === 'string' ? data.medicine : ''
    if (!medicineText.trim()) continue

    const storedStatus = String(data.pharmacyQueueStatus || '').toLowerCase()
    if (storedStatus === 'removed' || storedStatus === 'expired') continue

    const dispensed = dispensedAppointmentIds.has(id)
    if (dispensed) continue // Active queue shows Pending only

    const completedMs =
      parseTimestampMs(data.completedAt) ||
      parseTimestampMs(data.updatedAt) ||
      parseTimestampMs(data.appointmentDate)
    const isExpired = completedMs != null && now - completedMs > QUEUE_TTL_MS
    if (isExpired) {
      // Persist expired so subsequent reads stay fast; never delete prescription fields.
      expireWrites.push(
        db.collection(appointmentsPath).doc(id).set(
          {
            pharmacyQueueStatus: 'expired',
            pharmacyQueueExpiredAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        )
      )
      continue
    }

    const parsed = parsePrescription(medicineText)
    let medicines =
      parsed?.medicines?.map((m) => ({
        name: m.name,
        dosage: m.dosage,
        frequency: m.frequency,
        duration: m.duration,
      })) ?? []

    // Legacy / free-text prescriptions that don't match the emoji format still belong in the queue
    if (medicines.length === 0) {
      const compact = medicineText.replace(/\s+/g, ' ').trim()
      if (!compact) continue
      medicines = [{ name: compact.slice(0, 120), dosage: '', frequency: '', duration: '' }]
    }

    const resolvedPatientName =
      (typeof data.patientName === 'string' && data.patientName.trim()) ||
      [data.patientFirstName, data.patientLastName]
        .filter((p) => typeof p === 'string' && p.trim())
        .join(' ')
        .trim() ||
      (typeof data.patientFullName === 'string' && data.patientFullName.trim()) ||
      'Unknown'

    const prescriptionTime =
      (typeof data.completedAt === 'string' && data.completedAt) ||
      (typeof data.updatedAt === 'string' && data.updatedAt) ||
      (typeof data.appointmentDate === 'string' && data.appointmentDate) ||
      ''

    const patientIdValue =
      (typeof data.displayPatientId === 'string' && data.displayPatientId.trim()) ||
      (typeof data.patientHospitalId === 'string' && data.patientHospitalId.trim()) ||
      // Prefer sequential hospital patient number when present and distinct from auth UID
      (typeof data.patientCode === 'string' && data.patientCode.trim()) ||
      null

    // patientId on appointments is usually the Firebase Auth UID for front-desk bookings
    const patientUid =
      (typeof data.patientUid === 'string' && data.patientUid.trim()) ||
      (typeof data.patientId === 'string' && data.patientId.trim()) ||
      null

    queue.push({
      appointmentId: id,
      patientName: resolvedPatientName,
      patientId: patientIdValue || patientUid,
      patientUid,
      doctorName: data.doctorName || 'Unknown',
      department: data.doctorSpecialization || data.department || '',
      appointmentDate: data.appointmentDate || '',
      prescriptionTime,
      branchId: data.branchId,
      branchName: data.branchName,
      medicineText,
      medicines,
      medicineCount: medicines.length,
      dispensed: false,
      queueStatus: 'pending',
    })
  }

  if (expireWrites.length > 0) {
    await Promise.allSettled(expireWrites)
  }

  return NextResponse.json({ success: true, queue })
}
