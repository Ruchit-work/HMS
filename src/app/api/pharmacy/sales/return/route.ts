import { NextRequest, NextResponse } from 'next/server'
import { admin, initFirebaseAdmin } from '@/server/firebaseAdmin'
import { authenticateRequest, createAuthErrorResponse } from '@/utils/firebase/apiAuth'
import { getPharmacyAuthContext, getPharmacyCollectionPath } from '@/utils/pharmacy/serverPharmacy'
import type { PharmacySale, PharmacySaleLine } from '@/types/pharmacy'

interface ReturnLineInput {
  medicineId: string
  quantity: number
}

function getStockDocId(branchId: string, medicineId: string): string {
  return `${branchId}_${medicineId}`
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.success || !auth.user) return createAuthErrorResponse(auth)

  const init = initFirebaseAdmin('pharmacy/sales-return')
  if (!init.ok) return NextResponse.json({ success: false, error: 'Server not configured' }, { status: 500 })

  const body = await request.json().catch(() => null) as {
    saleId?: string
    lines?: ReturnLineInput[]
    note?: string
    refundPaymentMode?: 'cash' | 'upi' | 'card' | 'other'
    refundNotes?: Record<string, number>
  }
  if (!body || !body.saleId || !Array.isArray(body.lines) || body.lines.length === 0) {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 })
  }

  const ctxResult = await getPharmacyAuthContext(auth.user, {})
  if (!ctxResult.success) return NextResponse.json({ success: false, error: ctxResult.error }, { status: 403 })

  const db = admin.firestore()
  const hospitalId = ctxResult.context.hospitalId
  const salesPath = getPharmacyCollectionPath(hospitalId, 'sales')
  const stockPath = getPharmacyCollectionPath(hospitalId, 'stock')

  const saleRef = db.collection(salesPath).doc(body.saleId)
  const saleSnap = await saleRef.get()
  if (!saleSnap.exists) {
    return NextResponse.json({ success: false, error: 'Sale not found' }, { status: 404 })
  }

  const sale = saleSnap.data() as PharmacySale
  if (sale.hospitalId !== hospitalId) {
    return NextResponse.json({ success: false, error: 'Sale does not belong to this hospital' }, { status: 403 })
  }

  const branchId = sale.branchId
  if (!branchId) {
    return NextResponse.json({ success: false, error: 'Sale branch missing' }, { status: 400 })
  }

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
      { success: false, error: 'Please start a cash session first to process returns.' },
      { status: 403 }
    )
  }

  const existingReturns = Array.isArray(sale.returns) ? sale.returns : []
  const alreadyReturnedMap = new Map<string, number>()
  for (const r of existingReturns) {
    for (const rl of r.lines || []) {
      if (!rl.medicineId) continue
      alreadyReturnedMap.set(rl.medicineId, (alreadyReturnedMap.get(rl.medicineId) || 0) + (rl.quantity || 0))
    }
  }

  const saleLines = sale.lines || []
  const lineByMed = new Map<string, PharmacySaleLine>()
  saleLines.forEach((l) => {
    if (l.medicineId) lineByMed.set(l.medicineId, l)
  })

  const validLines: ReturnLineInput[] = []
  for (const input of body.lines) {
    const qty = Math.floor(Number(input.quantity) || 0)
    if (!input.medicineId || qty <= 0) continue
    const line = lineByMed.get(input.medicineId)
    if (!line) {
      return NextResponse.json({ success: false, error: `Medicine not found on sale: ${input.medicineId}` }, { status: 400 })
    }
    const already = alreadyReturnedMap.get(input.medicineId) || 0
    if (qty + already > line.quantity) {
      return NextResponse.json(
        { success: false, error: `Return quantity for ${line.medicineName} exceeds sold quantity` },
        { status: 400 },
      )
    }
    validLines.push({ medicineId: input.medicineId, quantity: qty })
  }

  if (validLines.length === 0) {
    return NextResponse.json({ success: false, error: 'No valid lines to return' }, { status: 400 })
  }

  const now = new Date().toISOString()

  // Prepare stock updates and refund amount
  type StockUpdate = {
    stockRef: FirebaseFirestore.DocumentReference
    newBatches: any[]
    newTotal: number
  }
  const stockUpdates: StockUpdate[] = []
  let refundAmount = 0

  for (const rl of validLines) {
    const line = lineByMed.get(rl.medicineId)!
    const stockRef = db.collection(stockPath).doc(getStockDocId(branchId, rl.medicineId))
    const stockSnap = await stockRef.get()
    const stockData = stockSnap.data() || {}
    const batches: any[] = Array.isArray(stockData.batches) ? [...stockData.batches] : []
    const batchNumber = line.batchNumber
    const expiryDate = line.expiryDate

    let found = false
    const updatedBatches = batches.map((b) => {
      if (batchNumber && b.batchNumber === batchNumber) {
        found = true
        const newQty = (Number(b.quantity) || 0) + rl.quantity
        return { ...b, quantity: newQty }
      }
      return b
    })

    if (!found) {
      updatedBatches.push({
        batchNumber: batchNumber || `RET-${now.slice(0, 10)}`,
        expiryDate: expiryDate || null,
        quantity: rl.quantity,
      })
    }

    const currentTotal = Number(stockData.totalQuantity) || 0
    const newTotal = currentTotal + rl.quantity

    stockUpdates.push({
      stockRef,
      newBatches: updatedBatches,
      newTotal,
    })

    const unitPrice = Number(line.unitPrice) || 0
    refundAmount += unitPrice * rl.quantity
  }

  const saleTotal = Number(sale.totalAmount) || 0
  const existingRefunded = Number(sale.refundedAmount) || 0
  const newRefunded = existingRefunded + refundAmount
  const netAmount = Math.max(0, saleTotal - newRefunded)

  const returnId = `RET-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
  const refundPaymentModeForRecord = (body.refundPaymentMode === 'cash' || body.refundPaymentMode === 'upi' || body.refundPaymentMode === 'card' || body.refundPaymentMode === 'other')
    ? body.refundPaymentMode
    : null

  try {
    await db.runTransaction(async (tx) => {
      // Update sale with returns info and refund totals
      const newReturn = {
        id: returnId,
        createdAt: now,
        lines: validLines,
        note: body.note || null,
        amount: refundAmount,
        ...(refundPaymentModeForRecord && { refundPaymentMode: refundPaymentModeForRecord }),
      }
      tx.update(saleRef, {
        refundedAmount: newRefunded,
        netAmount,
        returns: admin.firestore.FieldValue.arrayUnion(newReturn),
        updatedAt: now,
      })

      // Update stock
      for (const u of stockUpdates) {
        tx.set(
          u.stockRef,
          {
            batches: u.newBatches,
            totalQuantity: u.newTotal,
            updatedAt: now,
          },
          { merge: true },
        )
      }
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sales return failed'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }

  const refundPaymentMode = (body.refundPaymentMode === 'cash' || body.refundPaymentMode === 'upi' || body.refundPaymentMode === 'card' || body.refundPaymentMode === 'other')
    ? body.refundPaymentMode
    : undefined
  const refundNotes = body.refundNotes && typeof body.refundNotes === 'object' ? body.refundNotes : undefined

  if (refundPaymentMode === 'cash' && refundNotes && branchId) {
    const sessionsPath = getPharmacyCollectionPath(hospitalId, 'cashSessions')
    const sessionSnap = await db
      .collection(sessionsPath)
      .where('cashierId', '==', auth.user.uid)
      .where('branchId', '==', branchId)
      .where('status', '==', 'open')
      .limit(1)
      .get()
    if (!sessionSnap.empty) {
      const sessionRef = sessionSnap.docs[0].ref
      const sessionData = sessionSnap.docs[0].data() as { runningNotes?: Record<string, number> }
      const denoms = ['500', '200', '100', '50', '20', '10', '5', '2', '1']
      const running = { ...(sessionData.runningNotes || {}) }
      denoms.forEach((d) => {
        const out = Number(refundNotes[d]) || 0
        running[d] = Math.max(0, (Number(running[d]) || 0) - out)
      })
      await sessionRef.update({ runningNotes: running })
    }
  }

  return NextResponse.json({
    success: true,
    refundAmount,
    netAmount,
  })
}

