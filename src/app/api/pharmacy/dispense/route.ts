/**
 * Dispense prescription: create sale and deduct stock (FIFO by expiry)
 */

import { NextRequest, NextResponse } from 'next/server'
import { admin, initFirebaseAdmin } from '@/server/firebaseAdmin'
import { authenticateRequest, createAuthErrorResponse } from '@/utils/firebase/apiAuth'
import { getPharmacyAuthContext, getPharmacyCollectionPath, nanoidLike } from '@/utils/pharmacy/serverPharmacy'
import { acquireIdempotencyKey, clearIdempotencyKey, completeIdempotencyKey, sanitizeIdempotencyKey } from '@/utils/pharmacy/idempotency'
import { writePharmacyAuditEvent } from '@/utils/pharmacy/audit'
import { pharmacyError } from '@/utils/pharmacy/apiResponse'
import { getHospitalCollectionPath } from '@/utils/firebase/serverHospitalQueries'
import type { MedicineBatch, PharmacySale, PharmacySaleLine } from '@/types/pharmacy'

function getStockDocId(branchId: string, medicineId: string): string {
  return `${branchId}_${medicineId}`
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.success || !auth.user) return createAuthErrorResponse(auth)

  const init = initFirebaseAdmin('pharmacy/dispense')
  if (!init.ok) return pharmacyError('Server not configured', 500, 'SERVER_NOT_CONFIGURED')

  const ctxResult = await getPharmacyAuthContext(auth.user, {})
  if (!ctxResult.success) return pharmacyError(ctxResult.error, 403, 'PHARMACY_AUTH_FORBIDDEN')

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return pharmacyError('Invalid JSON body', 400, 'INVALID_JSON_BODY')
  }
  const { appointmentId, branchId, lines, customerName, customerPhone, paymentMode, tenderNotes, changeNotes, changeGiven } = body as {
    appointmentId?: string
    branchId: string
    lines: Array<{ medicineId: string; quantity: number; batchId?: string }>
    customerName?: string
    customerPhone?: string
    paymentMode?: string
    tenderNotes?: Record<string, number>
    changeNotes?: Record<string, number>
    changeGiven?: number
  }
  const paymentModeValue = (paymentMode ?? '').toLowerCase()
  const allowedPaymentModes = ['cash', 'card', 'upi', 'credit', 'other'] as const
  const validPaymentMode = allowedPaymentModes.includes(paymentModeValue as (typeof allowedPaymentModes)[number])
    ? paymentModeValue
    : 'cash'

  const isWalkIn = !appointmentId || appointmentId === ''

  if (!branchId || !Array.isArray(lines) || lines.length === 0) {
    return NextResponse.json(
      { success: false, error: 'branchId and lines (array) are required' },
      { status: 400 }
    )
  }

  const db = admin.firestore()
  const hospitalId = ctxResult.context.hospitalId
  const sessionsPath = getPharmacyCollectionPath(hospitalId, 'cashSessions')
  const sessionCheck = await db
    .collection(sessionsPath)
    .where('cashierId', '==', auth.user.uid)
    .where('branchId', '==', branchId)
    .where('status', '==', 'open')
    .limit(1)
    .get()
  if (sessionCheck.empty) {
    return NextResponse.json(
      { success: false, error: 'Please start a cash session first to complete sales.' },
      { status: 403 }
    )
  }

  if (isWalkIn) {
    if (!customerName || typeof customerName !== 'string' || !customerName.trim()) {
      return NextResponse.json(
        { success: false, error: 'Walk-in sale requires customerName and customerPhone' },
        { status: 400 }
      )
    }
    if (!customerPhone || typeof customerPhone !== 'string' || !customerPhone.trim()) {
      return NextResponse.json(
        { success: false, error: 'Walk-in sale requires customerPhone' },
        { status: 400 }
      )
    }
  }

  let patientName: string
  let patientId: string | undefined
  let doctorId: string | undefined
  let doctorName: string | undefined
  let appointmentIdFinal: string | undefined
  let customerPhoneFinal: string | undefined
  const saleType = isWalkIn ? 'walk_in' : 'prescription'

  if (isWalkIn) {
    patientName = String(customerName).trim()
    customerPhoneFinal = String(customerPhone).trim()
    appointmentIdFinal = undefined
    patientId = undefined
    doctorId = undefined
    doctorName = undefined
  } else {
    const appointmentsPath = getHospitalCollectionPath(hospitalId, 'appointments')
    const appointmentRef = db.collection(appointmentsPath).doc(appointmentId!)
    const appointmentSnap = await appointmentRef.get()
    if (!appointmentSnap.exists) {
      return pharmacyError('Appointment not found', 404, 'APPOINTMENT_NOT_FOUND')
    }
    const appointment = appointmentSnap.data()!
    patientName = appointment.patientName || 'Unknown'
    patientId = appointment.patientId || appointment.patientUid
    doctorId = appointment.doctorId
    doctorName = appointment.doctorName
    appointmentIdFinal = appointmentId
  }

  const medicinesPath = getPharmacyCollectionPath(hospitalId, 'medicines')
  const stockPath = getPharmacyCollectionPath(hospitalId, 'stock')

  const saleLines: PharmacySaleLine[] = []
  type DocRef = FirebaseFirestore.DocumentReference
const deductions: Array<{ stockRef: DocRef; batches: MedicineBatch[]; totalQty: number; lineQty: number; medicineId: string; medicineName: string; unitPrice: number }> = []

  for (const line of lines) {
    const qty = Math.floor(Number(line.quantity) || 0)
    if (qty < 1) continue

    const medicineDoc = await db.collection(medicinesPath).doc(line.medicineId).get()
    if (!medicineDoc.exists) {
      return pharmacyError(`Medicine ${line.medicineId} not found`, 400, 'MEDICINE_NOT_FOUND')
    }
    const medData = medicineDoc.data() as { name: string; sellingPrice: number; unit?: string }
    const stockRef = db.collection(stockPath).doc(getStockDocId(branchId, line.medicineId))
    const stockSnap = await stockRef.get()
    if (!stockSnap.exists) {
      return NextResponse.json(
        { success: false, error: `No stock for medicine ${medData.name} at this branch` },
        { status: 400 }
      )
    }

    const stockData = stockSnap.data()!
    let batches: MedicineBatch[] = Array.isArray(stockData.batches) ? [...stockData.batches] : []
    const totalQty = Number(stockData.totalQuantity) || 0
    if (totalQty < qty) {
      return NextResponse.json(
        { success: false, error: `Insufficient stock for ${medData.name}. Available: ${totalQty}` },
        { status: 400 }
      )
    }

    batches = batches
      .filter(b => (b as MedicineBatch).quantity > 0)
      .sort((a, b) => (a.expiryDate || '').localeCompare(b.expiryDate || ''))
    let remaining = qty
    const newBatches: MedicineBatch[] = []
    for (const b of batches) {
      if (remaining <= 0) {
        newBatches.push(b)
        continue
      }
      const take = Math.min(remaining, b.quantity)
      remaining -= take
      if (b.quantity - take > 0) {
        newBatches.push({ ...b, quantity: b.quantity - take })
      }
    }
    if (remaining > 0) {
      return NextResponse.json(
        { success: false, error: `Insufficient stock for ${medData.name}` },
        { status: 400 }
      )
    }

    const unitPrice = Number(medData.sellingPrice) || 0
    saleLines.push({
      medicineId: line.medicineId,
      medicineName: medData.name,
      quantity: qty,
      unitPrice,
      batchNumber: batches[0]?.batchNumber,
      expiryDate: batches[0]?.expiryDate,
      unit: medData.unit || 'tablets',
    })
    deductions.push({
      stockRef,
      batches: newBatches,
      totalQty: totalQty - qty,
      lineQty: qty,
      medicineId: line.medicineId,
      medicineName: medData.name,
      unitPrice,
    })
  }

  const totalAmount = saleLines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0)
  const saleId = nanoidLike()
  const now = new Date().toISOString()
  const ymd = now.slice(0, 10).replace(/-/g, '')
  const invoiceNumber = `INV-${ymd}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
  const saleData: Record<string, unknown> = {
    invoiceNumber,
    hospitalId,
    branchId,
    patientName,
    lines: saleLines,
    totalAmount,
    paymentMode: validPaymentMode,
    dispensedAt: now,
    dispensedBy: auth.user.uid,
    status: 'completed',
    saleType,
  }
  if (appointmentIdFinal != null) saleData.appointmentId = appointmentIdFinal
  if (patientId != null) saleData.patientId = patientId
  if (customerPhoneFinal != null) saleData.customerPhone = customerPhoneFinal
  if (doctorId != null) saleData.doctorId = doctorId
  if (doctorName != null) saleData.doctorName = doctorName
  if (validPaymentMode === 'cash' && tenderNotes != null) saleData.tenderNotes = tenderNotes
  if (validPaymentMode === 'cash' && changeNotes != null) saleData.changeNotes = changeNotes
  if (validPaymentMode === 'cash' && changeGiven != null) saleData.changeGiven = Number(changeGiven) || 0

  const salesPath = getPharmacyCollectionPath(hospitalId, 'sales')
  const saleRef = db.collection(salesPath).doc(saleId)
  const idempotencyKey = sanitizeIdempotencyKey(
    request.headers.get('x-idempotency-key') || (body as { idempotencyKey?: unknown })?.idempotencyKey
  )

  if (idempotencyKey) {
    const lock = await acquireIdempotencyKey({
      db,
      hospitalId,
      scope: 'dispense',
      key: idempotencyKey,
      userId: auth.user.uid,
    })
    if (lock.kind === 'completed') {
      return NextResponse.json(lock.response, { status: lock.statusCode })
    }
    if (lock.kind === 'in_progress') {
      return NextResponse.json(
        { success: false, error: 'This dispense request is already being processed. Please retry shortly.' },
        { status: 409 }
      )
    }
  }

  try {
    await db.runTransaction(async (tx) => {
      tx.set(saleRef, { id: saleId, ...saleData })
      for (const d of deductions) {
        if (d.batches.length === 0) {
          tx.delete(d.stockRef)
        } else {
          tx.update(d.stockRef, {
            batches: d.batches,
            totalQuantity: d.totalQty,
            updatedAt: now,
          })
        }
      }
    })

    if (validPaymentMode === 'cash' && (Number(changeGiven) || 0) >= 0) {
      const sessionsPath = getPharmacyCollectionPath(hospitalId, 'cashSessions')
      const branchIdForSession = ctxResult.context.branchId || branchId
      const sessionSnap = await db
        .collection(sessionsPath)
        .where('cashierId', '==', auth.user.uid)
        .where('branchId', '==', branchIdForSession)
        .where('status', '==', 'open')
        .limit(1)
        .get()
      if (!sessionSnap.empty) {
        const sessionRef = sessionSnap.docs[0].ref
        const sessionData = sessionSnap.docs[0].data() as {
          runningNotes?: Record<string, number>
          changeNotesTotal?: Record<string, number>
          cashSales?: number
          changeGiven?: number
        }
        const denoms = ['500', '200', '100', '50', '20', '10', '5', '2', '1']
        const running = { ...(sessionData.runningNotes || {}) }
        const tender = tenderNotes || {}
        const change = changeNotes || {}
        denoms.forEach((d) => {
          const t = Number(tender[d]) || 0
          const c = Number(change[d]) || 0
          running[d] = Math.max(0, (Number(running[d]) || 0) + t - c)
        })
        const changeNotesTotal = { ...(sessionData.changeNotesTotal || {}) }
        denoms.forEach((d) => {
          const c = Number(change[d]) || 0
          if (c > 0) changeNotesTotal[d] = (Number(changeNotesTotal[d]) || 0) + c
        })
        await sessionRef.update({
          runningNotes: running,
          changeNotesTotal,
          cashSales: admin.firestore.FieldValue.increment(totalAmount),
          changeGiven: admin.firestore.FieldValue.increment(Number(changeGiven) || 0),
        })
      }
    }

    const responseBody = { success: true, sale: { id: saleId, ...saleData } as PharmacySale }
    if (idempotencyKey) {
      await completeIdempotencyKey({
        db,
        hospitalId,
        scope: 'dispense',
        key: idempotencyKey,
        statusCode: 200,
        response: responseBody,
      })
    }
    await writePharmacyAuditEvent({
      db,
      hospitalId,
      action: 'dispense_completed',
      actorUserId: auth.user.uid,
      branchId,
      entityType: 'sale',
      entityId: saleId,
      summary: `Dispensed ${saleLines.length} line item(s) via ${saleType === 'walk_in' ? 'walk-in' : 'prescription'} flow.`,
      details: {
        totalAmount,
        paymentMode: validPaymentMode,
        saleType,
        invoiceNumber,
      },
    }).catch(() => {})
    return NextResponse.json(responseBody)
  } catch (err) {
    if (idempotencyKey) {
      await clearIdempotencyKey({ db, hospitalId, scope: 'dispense', key: idempotencyKey }).catch(() => {})
    }
    const message = err instanceof Error ? err.message : 'Dispense failed'
    return pharmacyError(message, 500, 'DISPENSE_FAILED')
  }
}
