/**
 * Pharmacy medicines (master catalog) – GET list, POST create
 *
 * Barcode scan workflow:
 * 1. Frontend scans barcode (camera via html5-qrcode or physical scanner as keyboard input).
 * 2. Frontend sends: GET /api/pharmacy/medicines?hospitalId=...&barcode=...&branchId=... (branchId optional).
 * 3. Backend queries: medicines.where('barcode', '==', barcode).limit(1).
 * 4. If found: return { success: true, medicine, product: { medicine_name, company_name, price, stock_quantity } }.
 * 5. If not found: return 404 { success: false, error: 'Product not found' }.
 */

import { NextRequest, NextResponse } from 'next/server'
import { admin, initFirebaseAdmin } from '@/server/firebaseAdmin'
import { authenticateRequest, createAuthErrorResponse } from '@/utils/firebase/apiAuth'
import { getPharmacyAuthContext, getPharmacyCollectionPath, nanoidLike, PHARMACY_COLLECTIONS } from '@/utils/pharmacy/serverPharmacy'
import type { PharmacyMedicine } from '@/types/pharmacy'

/** Normalize to YYYY-MM-DD or null. Accepts YYYY-MM-DD or DD/MM/YYYY. */
function normalizeDate(v: unknown): string | null {
  if (v == null || typeof v !== 'string') return null
  const s = v.trim()
  if (!s) return null
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(s)
  if (iso) return s
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`
  return null
}

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.success || !auth.user) return createAuthErrorResponse(auth)

  const init = initFirebaseAdmin('pharmacy/medicines')
  if (!init.ok) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

  const { searchParams } = new URL(request.url)
  const hospitalIdParam = searchParams.get('hospitalId') || undefined
  const barcodeParam = searchParams.get('barcode')?.trim() || undefined
  const branchIdParam = searchParams.get('branchId')?.trim() || undefined

  const ctxResult = await getPharmacyAuthContext(auth.user, { hospitalId: hospitalIdParam })
  if (!ctxResult.success) return NextResponse.json({ success: false, error: ctxResult.error }, { status: 403 })

  const db = admin.firestore()
  const hospitalId = ctxResult.context.hospitalId
  const path = getPharmacyCollectionPath(hospitalId, 'medicines')

  // Lookup by barcode: return medicine details; optionally include stock_quantity when branchId provided
  if (barcodeParam && barcodeParam.length > 0) {
    const byBarcode = await db.collection(path).where('barcode', '==', barcodeParam).limit(1).get()
    if (byBarcode.empty) {
      return NextResponse.json({
        success: false,
        error: 'Product not found',
        message: 'Product not found',
        medicine: null,
        product: null,
      }, { status: 404 })
    }
    const doc = byBarcode.docs[0]
    const data = doc.data()
    const medicine: PharmacyMedicine = { id: doc.id, ...data } as PharmacyMedicine
    const medicineId = doc.id

    // Optional: include stock quantity for a branch (for pharmacy/inventory UI)
    let stockQuantity: number | null = null
    if (branchIdParam && branchIdParam.length > 0) {
      const stockPath = getPharmacyCollectionPath(hospitalId, 'stock')
      const stockDocId = `${branchIdParam}_${medicineId}`
      const stockSnap = await db.collection(stockPath).doc(stockDocId).get()
      if (stockSnap.exists) {
        const stockData = stockSnap.data()
        stockQuantity = typeof stockData?.totalQuantity === 'number' ? stockData.totalQuantity : 0
      } else {
        stockQuantity = 0
      }
    }

    // Response shape for barcode scan: product = { name, company, price, stock_quantity }
    const product = {
      medicine_id: medicineId,
      medicine_name: (data?.name as string) || '',
      company_name: (data?.manufacturer as string) || '',
      price: typeof data?.sellingPrice === 'number' ? data.sellingPrice : 0,
      stock_quantity: stockQuantity,
      barcode: (data?.barcode as string) || barcodeParam,
    }

    return NextResponse.json({
      success: true,
      medicine,
      medicines: [medicine],
      product,
      ...(stockQuantity !== null && { stock_quantity: stockQuantity }),
    })
  }

  const snap = await db.collection(path).orderBy('name').get()
  const medicines: PharmacyMedicine[] = snap.docs.map(d => ({
    id: d.id,
    ...d.data(),
  })) as PharmacyMedicine[]

  return NextResponse.json({ success: true, medicines })
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.success || !auth.user) return createAuthErrorResponse(auth)

  const init = initFirebaseAdmin('pharmacy/medicines')
  if (!init.ok) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

  const ctxResult = await getPharmacyAuthContext(auth.user, {})
  if (!ctxResult.success) return NextResponse.json({ success: false, error: ctxResult.error }, { status: 403 })

  const body = await request.json()
  const {
    name,
    genericName,
    category,
    manufacturer,
    purchasePrice,
    sellingPrice,
    minStockLevel,
    supplierId,
    unit,
    strength,
    packSize,
    schedule,
    barcode,
    hsnCode,
    reorderQuantity,
    leadTimeDays,
    manufacturingDate,
    expiryDate,
  } = body

  if (!name || typeof name !== 'string' || name.trim() === '') {
    return NextResponse.json({ success: false, error: 'Medicine name is required' }, { status: 400 })
  }

  const db = admin.firestore()
  const now = new Date().toISOString()
  const medicineId = nanoidLike()
  const docRef = db.collection(getPharmacyCollectionPath(ctxResult.context.hospitalId, 'medicines')).doc(medicineId)

  const scheduleVal = schedule === 'Rx' || schedule === 'OTC' ? schedule : null
  const data: Omit<PharmacyMedicine, 'id'> & { id?: string } = {
    hospitalId: ctxResult.context.hospitalId,
    medicineId,
    name: name.trim(),
    genericName: typeof genericName === 'string' ? genericName.trim() : '',
    category: typeof category === 'string' ? category.trim() : '',
    manufacturer: typeof manufacturer === 'string' ? manufacturer.trim() : '',
    purchasePrice: Number(purchasePrice) || 0,
    sellingPrice: Number(sellingPrice) || 0,
    minStockLevel: Math.max(0, Number(minStockLevel) || 0),
    supplierId: supplierId && typeof supplierId === 'string' ? supplierId : null,
    unit: typeof unit === 'string' ? unit : 'tablets',
    strength: typeof strength === 'string' ? strength.trim() || null : null,
    packSize: typeof packSize === 'string' ? packSize.trim() || null : null,
    schedule: scheduleVal,
    barcode: typeof barcode === 'string' ? barcode.trim() || null : null,
    hsnCode: typeof hsnCode === 'string' ? hsnCode.trim() || null : null,
    reorderQuantity: reorderQuantity != null ? Math.max(0, Number(reorderQuantity) || 0) : null,
    leadTimeDays: leadTimeDays != null ? Math.max(0, Number(leadTimeDays) || 0) : null,
    manufacturingDate: normalizeDate(manufacturingDate),
    expiryDate: normalizeDate(expiryDate),
    createdAt: now,
    updatedAt: now,
  }

  await docRef.set(data)

  return NextResponse.json({
    success: true,
    medicine: { id: docRef.id, ...data },
  })
}

/** PATCH: update minimum stock level (e.g. for season/conditions) */
export async function PATCH(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.success || !auth.user) return createAuthErrorResponse(auth)

  const init = initFirebaseAdmin('pharmacy/medicines')
  if (!init.ok) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

  const ctxResult = await getPharmacyAuthContext(auth.user, {})
  if (!ctxResult.success) return NextResponse.json({ success: false, error: ctxResult.error }, { status: 403 })

  const body = await request.json()
  const { medicineId, minStockLevel } = body

  if (!medicineId || typeof medicineId !== 'string' || medicineId.trim() === '') {
    return NextResponse.json({ success: false, error: 'medicineId is required' }, { status: 400 })
  }

  const db = admin.firestore()
  const path = getPharmacyCollectionPath(ctxResult.context.hospitalId, 'medicines')
  const docRef = db.collection(path).doc(medicineId.trim())
  const doc = await docRef.get()

  if (!doc.exists) {
    const byMedicineId = await db.collection(path).where('medicineId', '==', medicineId.trim()).limit(1).get()
    if (byMedicineId.empty) {
      return NextResponse.json({ success: false, error: 'Medicine not found' }, { status: 404 })
    }
    const targetDoc = byMedicineId.docs[0]
    const now = new Date().toISOString()
    const newMin = Math.max(0, Number(minStockLevel) ?? 0)
    await targetDoc.ref.update({ minStockLevel: newMin, updatedAt: now })
    return NextResponse.json({
      success: true,
      medicine: { id: targetDoc.id, minStockLevel: newMin, updatedAt: now },
    })
  }

  const now = new Date().toISOString()
  const newMin = Math.max(0, Number(minStockLevel) ?? 0)
  await docRef.update({ minStockLevel: newMin, updatedAt: now })

  return NextResponse.json({
    success: true,
    medicine: { id: docRef.id, minStockLevel: newMin, updatedAt: now },
  })
}
