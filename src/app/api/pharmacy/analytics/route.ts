/**
 * Pharmacy dashboard analytics: totals, low stock count, expiring count, daily sales, most prescribed
 */

import { NextRequest, NextResponse } from 'next/server'
import { admin, initFirebaseAdmin } from '@/server/firebaseAdmin'
import { authenticateRequest, createAuthErrorResponse } from '@/utils/firebase/apiAuth'
import { getPharmacyAuthContext, getPharmacyCollectionPath } from '@/utils/pharmacy/serverPharmacy'

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

  const init = initFirebaseAdmin('pharmacy/analytics')
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
  const branchId = ctxResult.context.branchId

  const medicinesPath = getPharmacyCollectionPath(hospitalId, 'medicines')
  const stockPath = getPharmacyCollectionPath(hospitalId, 'stock')
  const salesPath = getPharmacyCollectionPath(hospitalId, 'sales')

  const [medicinesSnap, stockSnap, salesSnap] = await Promise.all([
    db.collection(medicinesPath).get(),
    branchId
      ? db.collection(stockPath).where('branchId', '==', branchId).get()
      : db.collection(stockPath).get(),
    db.collection(salesPath).get(),
  ])

  const medicineMinStock = new Map(medicinesSnap.docs.map(d => [d.id, Number(d.data().minStockLevel) || 0]))
  const totalMedicines = medicinesSnap.size

  let totalStockItems = 0
  let lowStockCount = 0
  let expiringCount = 0
  const branchTotals: Record<string, number> = {}

  stockSnap.docs.forEach(doc => {
    const d = doc.data()
    const bid = d.branchId
    const totalQty = Number(d.totalQuantity) || 0
    totalStockItems += 1
    branchTotals[bid] = (branchTotals[bid] || 0) + 1
    const minLevel = medicineMinStock.get(d.medicineId) ?? 0
    if (minLevel > 0 && totalQty < minLevel) lowStockCount += 1
    const batches = Array.isArray(d.batches) ? d.batches : []
    for (const b of batches) {
      if ((b.quantity || 0) <= 0) continue
      if (daysUntilExpiry(b.expiryDate || '') <= 30) expiringCount += 1
    }
  })

  const today = new Date().toISOString().slice(0, 10)
  let dailySalesTotal = 0
  const medicineSaleCount: Record<string, number> = {}

  salesSnap.docs.forEach(doc => {
    const d = doc.data()
    if (branchId && d.branchId !== branchId) return
    const dispensedAt = d.dispensedAt
    const dateStr = dispensedAt?.toDate ? dispensedAt.toDate().toISOString().slice(0, 10) : (typeof dispensedAt === 'string' ? dispensedAt.slice(0, 10) : '')
    if (dateStr === today) {
      dailySalesTotal += Number(d.totalAmount) || 0
    }
    const lines = d.lines || []
    for (const line of lines) {
      const name = line.medicineName || line.medicineId || 'Unknown'
      medicineSaleCount[name] = (medicineSaleCount[name] || 0) + (line.quantity || 0)
    }
  })

  const mostPrescribed = Object.entries(medicineSaleCount)
    .map(([name, count]) => ({ medicineName: name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  return NextResponse.json({
    success: true,
    analytics: {
      totalMedicines,
      totalStockItems,
      lowStockCount,
      expiringCount,
      dailySalesTotal,
      branchTotals,
      mostPrescribed,
    },
  })
}
