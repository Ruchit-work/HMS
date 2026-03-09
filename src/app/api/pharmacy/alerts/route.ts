/**
 * Pharmacy alerts: low stock and expiring medicines (within 30 days)
 */

import { NextRequest, NextResponse } from 'next/server'
import { admin, initFirebaseAdmin } from '@/server/firebaseAdmin'
import { authenticateRequest, createAuthErrorResponse } from '@/utils/firebase/apiAuth'
import { getPharmacyAuthContext, getPharmacyCollectionPath } from '@/utils/pharmacy/serverPharmacy'
import type { LowStockAlert, ExpiryAlert } from '@/types/pharmacy'

function daysUntilExpiry(expiryDate: string): number {
  const exp = new Date(expiryDate)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  exp.setHours(0, 0, 0, 0)
  return Math.ceil((exp.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
}

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.success || !auth.user) return createAuthErrorResponse(auth)

  const init = initFirebaseAdmin('pharmacy/alerts')
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

  const branchesSnap = await db.collection('branches').where('hospitalId', '==', hospitalId).get()
  const branchMap = new Map(branchesSnap.docs.map(d => [d.id, d.data().name || d.id]))

  const medicinesPath = getPharmacyCollectionPath(hospitalId, 'medicines')
  const medicinesSnap = await db.collection(medicinesPath).get()
  const medicineMinStock = new Map<string, number>()
  medicinesSnap.docs.forEach(d => {
    const minLevel = Number(d.data().minStockLevel) || 0
    medicineMinStock.set(d.id, minLevel)
    const dataMedicineId = d.data().medicineId
    if (dataMedicineId && dataMedicineId !== d.id) medicineMinStock.set(dataMedicineId, minLevel)
  })

  const stockPath = getPharmacyCollectionPath(hospitalId, 'stock')
  let stockQuery = db.collection(stockPath)
  if (ctxResult.context.branchId) {
    stockQuery = stockQuery.where('branchId', '==', ctxResult.context.branchId) as typeof stockQuery
  }
  const stockSnap = await stockQuery.get()

  const lowStock: LowStockAlert[] = []
  const expiring: ExpiryAlert[] = []
  const today = new Date().toISOString().slice(0, 10)

  for (const doc of stockSnap.docs) {
    const data = doc.data()
    const branchId = data.branchId
    const branchName = branchMap.get(branchId) || branchId
    const medicineId = data.medicineId
    const medicineName = data.medicineName || medicineId
    const totalQuantity = Number(data.totalQuantity) || 0
    const minLevel = medicineMinStock.get(medicineId) ?? 0

    if (minLevel > 0 && totalQuantity < minLevel) {
      lowStock.push({
        branchId,
        branchName,
        medicineId,
        medicineName,
        currentStock: totalQuantity,
        minStockLevel: minLevel,
      })
    }

    const batches = Array.isArray(data.batches) ? data.batches : []
    for (const b of batches) {
      const qty = Number(b.quantity) || 0
      if (qty <= 0) continue
      const exp = (b.expiryDate || '').slice(0, 10)
      if (!exp) continue
      const days = daysUntilExpiry(exp)
      if (days <= 30) {
        expiring.push({
          branchId,
          branchName,
          medicineId,
          medicineName,
          batchNumber: b.batchNumber || '-',
          expiryDate: exp,
          quantity: qty,
          daysUntilExpiry: days,
        })
      }
    }
  }

  expiring.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry)

  return NextResponse.json({
    success: true,
    lowStock,
    expiring,
  })
}
