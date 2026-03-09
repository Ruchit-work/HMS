/**
 * Dispense prescription: create sale and deduct stock (FIFO by expiry)
 */

import { NextRequest, NextResponse } from 'next/server'
import { admin, initFirebaseAdmin } from '@/server/firebaseAdmin'
import { authenticateRequest, createAuthErrorResponse } from '@/utils/firebase/apiAuth'
import { getPharmacyAuthContext, getPharmacyCollectionPath, nanoidLike } from '@/utils/pharmacy/serverPharmacy'
import { getHospitalCollectionPath } from '@/utils/firebase/serverHospitalQueries'
import type { MedicineBatch, PharmacySale, PharmacySaleLine } from '@/types/pharmacy'

function getStockDocId(branchId: string, medicineId: string): string {
  return `${branchId}_${medicineId}`
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.success || !auth.user) return createAuthErrorResponse(auth)

  const init = initFirebaseAdmin('pharmacy/dispense')
  if (!init.ok) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

  const ctxResult = await getPharmacyAuthContext(auth.user, {})
  if (!ctxResult.success) return NextResponse.json({ success: false, error: ctxResult.error }, { status: 403 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }
  const { appointmentId, branchId, lines, customerName, customerPhone, paymentMode } = body as {
    appointmentId?: string
    branchId: string
    lines: Array<{ medicineId: string; quantity: number; batchId?: string }>
    customerName?: string
    customerPhone?: string
    paymentMode?: string
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

  const db = admin.firestore()
  const hospitalId = ctxResult.context.hospitalId

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
      return NextResponse.json({ success: false, error: 'Appointment not found' }, { status: 404 })
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
      return NextResponse.json({ success: false, error: `Medicine ${line.medicineId} not found` }, { status: 400 })
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

  const salesPath = getPharmacyCollectionPath(hospitalId, 'sales')
  const saleRef = db.collection(salesPath).doc(saleId)

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
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Dispense failed'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }

  return NextResponse.json({ success: true, sale: { id: saleId, ...saleData } as PharmacySale })
}
