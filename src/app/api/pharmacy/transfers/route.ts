/**
 * Stock transfers between branches – GET list, POST create (Super Admin)
 */

import { NextRequest, NextResponse } from 'next/server'
import { admin, initFirebaseAdmin } from '@/server/firebaseAdmin'
import { authenticateRequest, createAuthErrorResponse } from '@/utils/firebase/apiAuth'
import { getPharmacyAuthContext, getPharmacyCollectionPath, nanoidLike } from '@/utils/pharmacy/serverPharmacy'
import type { MedicineBatch, StockTransfer } from '@/types/pharmacy'

function getStockDocId(branchId: string, medicineId: string): string {
  return `${branchId}_${medicineId}`
}

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.success || !auth.user) return createAuthErrorResponse(auth)

  const init = initFirebaseAdmin('pharmacy/transfers')
  if (!init.ok) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

  const { searchParams } = new URL(request.url)
  const hospitalIdParam = searchParams.get('hospitalId') || undefined

  const ctxResult = await getPharmacyAuthContext(auth.user, { hospitalId: hospitalIdParam })
  if (!ctxResult.success) return NextResponse.json({ success: false, error: ctxResult.error }, { status: 403 })

  const db = admin.firestore()
  const path = getPharmacyCollectionPath(ctxResult.context.hospitalId, 'transfers')
  const snap = await db.collection(path).orderBy('createdAt', 'desc').limit(100).get()

  const transfers: StockTransfer[] = snap.docs.map(d => ({
    id: d.id,
    ...d.data(),
  })) as StockTransfer[]

  return NextResponse.json({ success: true, transfers })
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.success || !auth.user) return createAuthErrorResponse(auth)

  const init = initFirebaseAdmin('pharmacy/transfers')
  if (!init.ok) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

  const ctxResult = await getPharmacyAuthContext(auth.user, {})
  if (!ctxResult.success) return NextResponse.json({ success: false, error: ctxResult.error }, { status: 403 })
  if (!ctxResult.context.isSuperAdmin) {
    return NextResponse.json(
      { success: false, error: 'Only Super Admin can transfer stock between branches' },
      { status: 403 }
    )
  }

  const body = await request.json()
  const { fromBranchId, toBranchId, medicineId, quantity } = body

  if (!fromBranchId || !toBranchId || !medicineId || quantity == null || quantity < 1) {
    return NextResponse.json(
      { success: false, error: 'fromBranchId, toBranchId, medicineId, and positive quantity are required' },
      { status: 400 }
    )
  }
  if (fromBranchId === toBranchId) {
    return NextResponse.json({ success: false, error: 'Source and destination branch must differ' }, { status: 400 })
  }

  const db = admin.firestore()
  const hospitalId = ctxResult.context.hospitalId
  const stockPath = getPharmacyCollectionPath(hospitalId, 'stock')
  const medicinesPath = getPharmacyCollectionPath(hospitalId, 'medicines')

  const medicineDoc = await db.collection(medicinesPath).doc(medicineId).get()
  if (!medicineDoc.exists) {
    return NextResponse.json({ success: false, error: 'Medicine not found' }, { status: 404 })
  }
  const medicineName = (medicineDoc.data() as { name: string }).name || medicineId

  const fromRef = db.collection(stockPath).doc(getStockDocId(fromBranchId, medicineId))
  const fromSnap = await fromRef.get()
  if (!fromSnap.exists) {
    return NextResponse.json({ success: false, error: 'No stock at source branch' }, { status: 400 })
  }

  const fromData = fromSnap.data()!
  let batches: MedicineBatch[] = Array.isArray(fromData.batches) ? [...fromData.batches] : []
  batches = batches.filter(b => b.quantity > 0).sort((a, b) => (a.expiryDate || '').localeCompare(b.expiryDate || ''))
  const totalAvail = batches.reduce((s, b) => s + b.quantity, 0)
  const qty = Math.min(Math.floor(Number(quantity)), totalAvail)
  if (qty < 1) {
    return NextResponse.json({ success: false, error: 'Insufficient stock at source branch' }, { status: 400 })
  }

  let remaining = qty
  const newFromBatches: MedicineBatch[] = []
  const batchesToTransfer: MedicineBatch[] = []
  for (const b of batches) {
    if (remaining <= 0) {
      newFromBatches.push(b)
      continue
    }
    const take = Math.min(remaining, b.quantity)
    remaining -= take
    if (b.quantity - take > 0) {
      newFromBatches.push({ ...b, quantity: b.quantity - take })
    }
    if (take > 0) {
      batchesToTransfer.push({ ...b, quantity: take })
    }
  }

  const toRef = db.collection(stockPath).doc(getStockDocId(toBranchId, medicineId))
  const toSnap = await toRef.get()
  const now = new Date()
  const transferId = nanoidLike()

  await db.runTransaction(async (tx) => {
    if (newFromBatches.length === 0) {
      tx.delete(fromRef)
    } else {
      tx.update(fromRef, {
        batches: newFromBatches,
        totalQuantity: (Number(fromData.totalQuantity) || 0) - qty,
        updatedAt: now,
      })
    }

    if (!toSnap.exists) {
      tx.set(toRef, {
        hospitalId,
        branchId: toBranchId,
        medicineId,
        medicineName,
        batches: batchesToTransfer,
        totalQuantity: qty,
        updatedAt: now,
      })
    } else {
      const toData = toSnap.data()!
      const toBatches: MedicineBatch[] = Array.isArray(toData.batches) ? [...toData.batches] : []
      for (const b of batchesToTransfer) {
        const existing = toBatches.find(x => x.batchNumber === b.batchNumber && x.expiryDate === b.expiryDate)
        if (existing) {
          existing.quantity += b.quantity
        } else {
          toBatches.push({ ...b })
        }
      }
      tx.update(toRef, {
        batches: toBatches,
        totalQuantity: (Number(toData.totalQuantity) || 0) + qty,
        updatedAt: now,
      })
    }

    const transfersPath = getPharmacyCollectionPath(hospitalId, 'transfers')
    tx.set(db.collection(transfersPath).doc(transferId), {
      id: transferId,
      hospitalId,
      fromBranchId,
      toBranchId,
      medicineId,
      medicineName,
      quantity: qty,
      batchNumber: batchesToTransfer[0]?.batchNumber,
      status: 'completed',
      createdAt: now,
      createdBy: auth.user!.uid,
      completedAt: now,
    })
  })

  return NextResponse.json({
    success: true,
    transfer: {
      id: transferId,
      fromBranchId,
      toBranchId,
      medicineId,
      medicineName,
      quantity: qty,
      status: 'completed',
    },
  })
}
