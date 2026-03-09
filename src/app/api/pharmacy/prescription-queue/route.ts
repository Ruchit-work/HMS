/**
 * Prescription queue: completed appointments with medicine not yet dispensed
 */

import { NextRequest, NextResponse } from 'next/server'
import { admin, initFirebaseAdmin } from '@/server/firebaseAdmin'
import { authenticateRequest, createAuthErrorResponse } from '@/utils/firebase/apiAuth'
import { getPharmacyAuthContext, getPharmacyCollectionPath } from '@/utils/pharmacy/serverPharmacy'
import { getHospitalCollectionPath } from '@/utils/firebase/serverHospitalQueries'
import { parsePrescription } from '@/utils/appointments/prescriptionParsers'

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
  const dispensedAppointmentIds = new Set(salesSnap.docs.map(d => (d.data() as { appointmentId?: string }).appointmentId).filter(Boolean))

  const queue: Array<{
    appointmentId: string
    patientName: string
    doctorName: string
    appointmentDate: string
    branchId?: string
    branchName?: string
    medicineText: string
    medicines: Array<{ name: string; dosage: string; frequency: string; duration: string }>
    dispensed: boolean
  }> = []

  for (const { id, data } of docs) {
    const medicineText = data.medicine || ''
    if (!medicineText || !medicineText.trim()) continue

    const dispensed = dispensedAppointmentIds.has(id)
    const parsed = parsePrescription(medicineText)
    const medicines = parsed?.medicines?.map(m => ({
      name: m.name,
      dosage: m.dosage,
      frequency: m.frequency,
      duration: m.duration,
    })) ?? []

    queue.push({
      appointmentId: id,
      patientName: data.patientName || 'Unknown',
      doctorName: data.doctorName || 'Unknown',
      appointmentDate: data.appointmentDate || '',
      branchId: data.branchId,
      branchName: data.branchName,
      medicineText,
      medicines,
      dispensed,
    })
  }

  return NextResponse.json({ success: true, queue })
}
