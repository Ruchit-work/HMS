/**
 * POST: Add sample medicines to the pharmacy catalog (and optional stock for a branch)
 * Admin/pharmacy only.
 */

import { NextRequest, NextResponse } from 'next/server'
import { admin, initFirebaseAdmin } from '@/server/firebaseAdmin'
import { authenticateRequest, createAuthErrorResponse } from '@/utils/firebase/apiAuth'
import { getPharmacyAuthContext, getPharmacyCollectionPath, nanoidLike } from '@/utils/pharmacy/serverPharmacy'
import type { MedicineBatch } from '@/types/pharmacy'

const SAMPLE_MEDICINES = [
  { name: 'Paracetamol', genericName: 'Acetaminophen', category: 'Analgesic', manufacturer: 'Generic', purchasePrice: 2, sellingPrice: 5, minStockLevel: 100, unit: 'tablets' },
  { name: 'Amoxicillin', genericName: 'Amoxicillin', category: 'Antibiotic', manufacturer: 'Generic', purchasePrice: 15, sellingPrice: 35, minStockLevel: 50, unit: 'capsules' },
  { name: 'Cetirizine', genericName: 'Cetirizine HCl', category: 'Antihistamine', manufacturer: 'Generic', purchasePrice: 3, sellingPrice: 10, minStockLevel: 80, unit: 'tablets' },
  { name: 'Omeprazole', genericName: 'Omeprazole', category: 'Antacid', manufacturer: 'Generic', purchasePrice: 5, sellingPrice: 15, minStockLevel: 60, unit: 'capsules' },
  { name: 'Ibuprofen', genericName: 'Ibuprofen', category: 'NSAID', manufacturer: 'Generic', purchasePrice: 4, sellingPrice: 12, minStockLevel: 70, unit: 'tablets' },
  { name: 'Metformin', genericName: 'Metformin HCl', category: 'Antidiabetic', manufacturer: 'Generic', purchasePrice: 8, sellingPrice: 25, minStockLevel: 40, unit: 'tablets' },
  { name: 'Amlodipine', genericName: 'Amlodipine Besylate', category: 'Antihypertensive', manufacturer: 'Generic', purchasePrice: 6, sellingPrice: 18, minStockLevel: 50, unit: 'tablets' },
  { name: 'Dolo 650', genericName: 'Paracetamol', category: 'Analgesic', manufacturer: 'Micro Labs', purchasePrice: 3, sellingPrice: 8, minStockLevel: 120, unit: 'tablets' },
]

function getStockDocId(branchId: string, medicineId: string): string {
  return `${branchId}_${medicineId}`
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.success || !auth.user) return createAuthErrorResponse(auth)

  const init = initFirebaseAdmin('pharmacy/seed-medicines')
  if (!init.ok) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

  const ctxResult = await getPharmacyAuthContext(auth.user, {})
  if (!ctxResult.success) return NextResponse.json({ success: false, error: ctxResult.error }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const branchId = body?.branchId || null as string | null

  const db = admin.firestore()
  const hospitalId = ctxResult.context.hospitalId
  const medicinesPath = getPharmacyCollectionPath(hospitalId, 'medicines')
  const stockPath = getPharmacyCollectionPath(hospitalId, 'stock')
  const now = new Date().toISOString()

  const created: string[] = []
  let firstBranchId: string | null = branchId

  if (!firstBranchId) {
    const branchesSnap = await db.collection('branches').where('hospitalId', '==', hospitalId).where('status', '==', 'active').limit(1).get()
    if (!branchesSnap.empty) firstBranchId = branchesSnap.docs[0].id
  }

  for (const med of SAMPLE_MEDICINES) {
    const medicineId = nanoidLike()
    const docRef = db.collection(medicinesPath).doc(medicineId)
    await docRef.set({
      hospitalId,
      medicineId,
      name: med.name,
      genericName: med.genericName,
      category: med.category,
      manufacturer: med.manufacturer,
      purchasePrice: med.purchasePrice,
      sellingPrice: med.sellingPrice,
      minStockLevel: med.minStockLevel,
      supplierId: null,
      unit: med.unit,
      createdAt: now,
      updatedAt: now,
    })
    created.push(med.name)

    if (firstBranchId) {
      const batch: MedicineBatch = {
        id: nanoidLike(),
        batchNumber: `BATCH-${medicineId.slice(0, 6)}`,
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        quantity: med.minStockLevel + 50,
        receivedAt: now,
      }
      const stockId = getStockDocId(firstBranchId, medicineId)
      const stockRef = db.collection(stockPath).doc(stockId)
      await stockRef.set({
        hospitalId,
        branchId: firstBranchId,
        medicineId,
        medicineName: med.name,
        batches: [batch],
        totalQuantity: batch.quantity,
        updatedAt: now,
      })
    }
  }

  return NextResponse.json({
    success: true,
    message: `Added ${created.length} sample medicines${firstBranchId ? ` and stock for branch` : ''}.`,
    medicines: created,
  })
}
