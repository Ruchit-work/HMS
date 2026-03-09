/**
 * POST: Add sample stock for existing medicines (from database catalog).
 * Body: { branchId?: string }. Uses first active branch if branchId not provided.
 * Stock is written to pharmacy_stock and will appear when inventory is loaded from DB.
 */

import { NextRequest, NextResponse } from 'next/server'
import { admin, initFirebaseAdmin } from '@/server/firebaseAdmin'
import { authenticateRequest, createAuthErrorResponse } from '@/utils/firebase/apiAuth'
import { getPharmacyAuthContext, getPharmacyCollectionPath, nanoidLike } from '@/utils/pharmacy/serverPharmacy'
import type { MedicineBatch } from '@/types/pharmacy'

function getStockDocId(branchId: string, medicineId: string): string {
  return `${branchId}_${medicineId}`
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.success || !auth.user) return createAuthErrorResponse(auth)

  const init = initFirebaseAdmin('pharmacy/seed-stock')
  if (!init.ok) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

  const ctxResult = await getPharmacyAuthContext(auth.user, {})
  if (!ctxResult.success) return NextResponse.json({ success: false, error: ctxResult.error }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  let branchId: string | null = body?.branchId && typeof body.branchId === 'string' ? body.branchId.trim() || null : null

  const db = admin.firestore()
  const hospitalId = ctxResult.context.hospitalId
  const medicinesPath = getPharmacyCollectionPath(hospitalId, 'medicines')
  const stockPath = getPharmacyCollectionPath(hospitalId, 'stock')
  const now = new Date().toISOString()

  const medicinesSnap = await db.collection(medicinesPath).orderBy('name').limit(50).get()
  if (medicinesSnap.empty) {
    return NextResponse.json({
      success: false,
      error: 'No medicines in catalog. Add medicines or use "Load sample medicines" first.',
    }, { status: 400 })
  }

  if (!branchId) {
    const branchesSnap = await db.collection('branches').where('hospitalId', '==', hospitalId).where('status', '==', 'active').limit(1).get()
    if (branchesSnap.empty) {
      return NextResponse.json({
        success: false,
        error: 'No active branch. Create a branch or pass branchId.',
      }, { status: 400 })
    }
    branchId = branchesSnap.docs[0].id
  }

  const added: string[] = []
  const sampleQuantities = [150, 80, 120, 90, 100, 60, 70, 200, 110, 95]

  for (let i = 0; i < medicinesSnap.docs.length; i++) {
    const doc = medicinesSnap.docs[i]
    const medicineId = doc.id
    const data = doc.data()
    const medicineName = (data?.name as string) || 'Medicine'
    const minStock = Math.max(0, Number(data?.minStockLevel) || 50)
    const qty = sampleQuantities[i % sampleQuantities.length] ?? minStock + 50

    const batch: MedicineBatch = {
      id: nanoidLike(),
      batchNumber: `BATCH-${medicineId.slice(0, 6)}-${Date.now().toString(36).slice(-4)}`,
      expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      quantity: qty,
      receivedAt: now,
    }

    const stockId = getStockDocId(branchId, medicineId)
    const stockRef = db.collection(stockPath).doc(stockId)
    const stockSnap = await stockRef.get()

    if (!stockSnap.exists) {
      await stockRef.set({
        hospitalId,
        branchId,
        medicineId,
        medicineName,
        batches: [batch],
        totalQuantity: batch.quantity,
        updatedAt: now,
      })
      added.push(medicineName)
    } else {
      const existing = stockSnap.data()!
      const batches: MedicineBatch[] = Array.isArray(existing.batches) ? [...existing.batches, batch] : [batch]
      const totalQuantity = (Number(existing.totalQuantity) || 0) + batch.quantity
      await stockRef.update({
        batches,
        totalQuantity,
        medicineName,
        updatedAt: now,
      })
      added.push(medicineName)
    }
  }

  return NextResponse.json({
    success: true,
    message: `Added stock for ${added.length} medicine(s) for branch. Data saved to database.`,
    branchId,
    count: added.length,
    medicines: added,
  })
}
