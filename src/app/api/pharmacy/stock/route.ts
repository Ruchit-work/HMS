/**
 * Pharmacy stock per branch – GET list, POST add/receive stock (batch)
 */

import { NextRequest, NextResponse } from 'next/server'
import { admin, initFirebaseAdmin } from '@/server/firebaseAdmin'
import { authenticateRequest, createAuthErrorResponse } from '@/utils/firebase/apiAuth'
import { getPharmacyAuthContext, getPharmacyCollectionPath, nanoidLike } from '@/utils/pharmacy/serverPharmacy'
import type { BranchMedicineStock, MedicineBatch } from '@/types/pharmacy'

function getStockDocId(branchId: string, medicineId: string): string {
  return `${branchId}_${medicineId}`
}

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.success || !auth.user) return createAuthErrorResponse(auth)

  const init = initFirebaseAdmin('pharmacy/stock')
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
  const stockPath = getPharmacyCollectionPath(ctxResult.context.hospitalId, 'stock')
  let snap

  if (ctxResult.context.branchId) {
    snap = await db.collection(stockPath).where('branchId', '==', ctxResult.context.branchId).get()
  } else {
    snap = await db.collection(stockPath).get()
  }

  const stock: BranchMedicineStock[] = snap.docs.map(d => ({
    id: d.id,
    ...d.data(),
  })) as BranchMedicineStock[]

  return NextResponse.json({ success: true, stock })
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.success || !auth.user) return createAuthErrorResponse(auth)

  const init = initFirebaseAdmin('pharmacy/stock')
  if (!init.ok) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

  const ctxResult = await getPharmacyAuthContext(auth.user, {})
  if (!ctxResult.success) return NextResponse.json({ success: false, error: ctxResult.error }, { status: 403 })

  const body = await request.json()
  const { branchId, medicineId, batchNumber, expiryDate, quantity } = body

  if (!branchId || !medicineId || quantity == null || quantity < 1) {
    return NextResponse.json(
      { success: false, error: 'branchId, medicineId, and positive quantity are required' },
      { status: 400 }
    )
  }

  const db = admin.firestore()
  const hospitalId = ctxResult.context.hospitalId
  const medicinesPath = getPharmacyCollectionPath(hospitalId, 'medicines')
  const medicineDoc = await db.collection(medicinesPath).doc(medicineId).get()
  if (!medicineDoc.exists) {
    return NextResponse.json({ success: false, error: 'Medicine not found' }, { status: 404 })
  }
  const medicine = medicineDoc.data() as { name: string }
  const medicineName = medicine?.name || medicineId

  const stockPath = getPharmacyCollectionPath(hospitalId, 'stock')
  const docId = getStockDocId(branchId, medicineId)
  const stockRef = db.collection(stockPath).doc(docId)

  const batchId = nanoidLike()
  const batch: MedicineBatch = {
    id: batchId,
    batchNumber: typeof batchNumber === 'string' ? batchNumber : batchId,
    expiryDate: typeof expiryDate === 'string' ? expiryDate : '',
    quantity: Number(quantity) || 0,
    receivedAt: new Date().toISOString(),
  }

  await db.runTransaction(async (tx) => {
    const stockSnap = await tx.get(stockRef)
    const now = new Date().toISOString()

    if (!stockSnap.exists) {
      tx.set(stockRef, {
        hospitalId,
        branchId,
        medicineId,
        medicineName,
        batches: [batch],
        totalQuantity: batch.quantity,
        updatedAt: now,
      })
    } else {
      const data = stockSnap.data()!
      const batches: MedicineBatch[] = Array.isArray(data.batches) ? [...data.batches] : []
      batches.push(batch)
      const totalQuantity = (Number(data.totalQuantity) || 0) + batch.quantity
      tx.update(stockRef, {
        batches,
        totalQuantity,
        medicineName,
        updatedAt: now,
      })
    }
  })

  const updated = await stockRef.get()
  const result = updated.exists ? { id: updated.id, ...updated.data() } : null

  return NextResponse.json({ success: true, stock: result })
}

export async function DELETE(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.success || !auth.user) return createAuthErrorResponse(auth)

  const init = initFirebaseAdmin('pharmacy/stock')
  if (!init.ok) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

  const ctxResult = await getPharmacyAuthContext(auth.user, {})
  if (!ctxResult.success) return NextResponse.json({ success: false, error: ctxResult.error }, { status: 403 })

  let stockId: string | undefined
  try {
    const body = await request.json()
    if (body && typeof body.stockId === 'string') {
      stockId = body.stockId.trim() || undefined
    }
  } catch {
    // fall through to validation error below
  }

  if (!stockId) {
    return NextResponse.json(
      { success: false, error: 'stockId is required' },
      { status: 400 }
    )
  }

  const db = admin.firestore()
  const stockPath = getPharmacyCollectionPath(ctxResult.context.hospitalId, 'stock')
  const stockRef = db.collection(stockPath).doc(stockId)
  const snap = await stockRef.get()
  if (!snap.exists) {
    return NextResponse.json(
      { success: false, error: 'Stock record not found' },
      { status: 404 }
    )
  }

  // Optionally enforce branch restriction if context has a specific branchId
  const data = snap.data() as { branchId?: string }
  if (ctxResult.context.branchId && data.branchId && data.branchId !== ctxResult.context.branchId) {
    return NextResponse.json(
      { success: false, error: 'Not allowed to delete stock from another branch' },
      { status: 403 }
    )
  }

  await stockRef.delete()

  return NextResponse.json({ success: true })
}
