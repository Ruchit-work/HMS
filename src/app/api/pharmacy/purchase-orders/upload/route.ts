/**
 * POST: Create a purchase order from uploaded file (Excel, PDF).
 * FormData: file (required), branchId (required), supplierId (required).
 * Parses file and matches rows to catalog medicines by name; creates one pending order.
 */

import { NextRequest, NextResponse } from 'next/server'
import { admin, initFirebaseAdmin } from '@/server/firebaseAdmin'
import { authenticateRequest, createAuthErrorResponse } from '@/utils/firebase/apiAuth'
import { getPharmacyAuthContext, getPharmacyCollectionPath, nanoidLike } from '@/utils/pharmacy/serverPharmacy'
import { getFileKind, parseExcelBuffer, parsePdfText, type ParsedMedicineRow } from '@/utils/pharmacy/parseMedicineFile'
import type { PurchaseOrderLine } from '@/types/pharmacy'

async function extractPdfText(buffer: Buffer): Promise<string> {
  const pdfParseMod = await import('pdf-parse')
  const pdfParse = (pdfParseMod as any).default ?? (pdfParseMod as any)
  const data = typeof pdfParse === 'function' ? await pdfParse(buffer) : await (pdfParse.parse ?? pdfParse)(buffer)
  return (data?.text || '').trim()
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.success || !auth.user) return createAuthErrorResponse(auth)

  const init = initFirebaseAdmin('pharmacy/purchase-orders/upload')
  if (!init.ok) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

  const ctxResult = await getPharmacyAuthContext(auth.user, {})
  if (!ctxResult.success) return NextResponse.json({ success: false, error: ctxResult.error }, { status: 403 })

  let file: File
  let branchId: string
  let supplierId: string
  let parseOnly = false
  try {
    const formData = await request.formData()
    file = formData.get('file') as File
    const branchIdVal = formData.get('branchId')
    const supplierIdVal = formData.get('supplierId')
    const parseOnlyVal = formData.get('parseOnly')
    parseOnly = parseOnlyVal === 'true'
    if (typeof branchIdVal !== 'string' || !branchIdVal.trim()) {
      return NextResponse.json({ success: false, error: 'branchId is required' }, { status: 400 })
    }
    if (typeof supplierIdVal !== 'string' || !supplierIdVal.trim()) {
      return NextResponse.json({ success: false, error: 'supplierId is required' }, { status: 400 })
    }
    branchId = branchIdVal.trim()
    supplierId = supplierIdVal.trim()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid form data' }, { status: 400 })
  }

  if (!file || !(file instanceof File) || file.size === 0) {
    return NextResponse.json({ success: false, error: 'No file or empty file' }, { status: 400 })
  }

  const filename = file.name || ''
  const mime = file.type || ''
  const kind = getFileKind(mime, filename)

  if (kind === 'unknown') {
    return NextResponse.json({
      success: false,
      error: 'Unsupported file type. Use Excel (.xlsx, .xls) or PDF.',
    }, { status: 400 })
  }

  if (kind === 'image') {
    return NextResponse.json({
      success: false,
      error: 'Image upload is not parsed for orders. Please use an Excel (.xlsx, .xls) or PDF file with medicine names and quantities.',
    }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  let rows: ParsedMedicineRow[] = []

  if (kind === 'excel') {
    try {
      rows = await parseExcelBuffer(buffer)
    } catch (e) {
      return NextResponse.json({
        success: false,
        error: 'Failed to parse Excel. Ensure .xlsx/.xls with a header row (e.g. name, quantity).',
      }, { status: 400 })
    }
  } else {
    try {
      const text = await extractPdfText(buffer)
      rows = parsePdfText(text)
    } catch (e) {
      return NextResponse.json({
        success: false,
        error: 'Failed to parse PDF. Try an Excel file for best results.',
      }, { status: 400 })
    }
  }

  if (rows.length === 0) {
    return NextResponse.json({
      success: false,
      error: 'No rows found in file. Use columns like: name, quantity (and optionally purchase/cost for unit price).',
    }, { status: 400 })
  }

  const db = admin.firestore()
  const hospitalId = ctxResult.context.hospitalId
  const medicinesPath = getPharmacyCollectionPath(hospitalId, 'medicines')
  const ordersPath = getPharmacyCollectionPath(hospitalId, 'purchase_orders')

  const medicinesSnap = await db.collection(medicinesPath).get()
  const nameToMedicine = new Map<string, { id: string; name: string; purchasePrice: number }>()
  medicinesSnap.docs.forEach((d) => {
    const data = d.data()
    const name = (data?.name as string)?.trim?.()
    if (name) {
      nameToMedicine.set(name.toLowerCase(), {
        id: d.id,
        name: name,
        purchasePrice: Number(data?.purchasePrice) || 0,
      })
    }
  })

  const items: PurchaseOrderLine[] = []
  const skipped: string[] = []

  for (const row of rows) {
    const name = row.name?.trim()
    if (!name) continue
    const qty = Math.floor(Number(row.quantity) ?? 0)
    if (qty <= 0) continue

    const med = nameToMedicine.get(name.toLowerCase())
    if (!med) {
      skipped.push(name)
      continue
    }
    const unitCost = Number(row.purchasePrice) || med.purchasePrice || 0
    items.push({
      medicineId: med.id,
      medicineName: med.name,
      quantity: qty,
      unitCost,
      batchNumber: row.batchNumber?.trim() || '',
      expiryDate: row.expiryDate?.trim() || '',
    })
  }

  const normalizedItems: PurchaseOrderLine[] = items.map((it) => ({
    ...it,
    batchNumber: it.batchNumber || nanoidLike(),
    expiryDate: it.expiryDate || '',
  }))

  if (parseOnly) {
    return NextResponse.json({
      success: true,
      items: normalizedItems,
      itemsCount: normalizedItems.length,
      skipped: skipped.length,
      skippedNames: skipped.slice(0, 20),
      message: normalizedItems.length === 0
        ? (skipped.length > 0 ? `No medicines matched. Unmatched: ${skipped.slice(0, 5).join(', ')}. Add to catalog or use exact names.` : 'No valid rows (name + quantity).')
        : `Parsed ${normalizedItems.length} item(s).${skipped.length > 0 ? ` ${skipped.length} row(s) skipped (not in catalog).` : ''}`,
    })
  }

  if (items.length === 0) {
    return NextResponse.json({
      success: false,
      error: skipped.length > 0
        ? `No medicines matched your catalog. Unmatched: ${skipped.slice(0, 5).join(', ')}${skipped.length > 5 ? '…' : ''}. Add them to the medicine catalog first or use exact names.`
        : 'No valid rows (name + quantity). Ensure file has name and quantity columns.',
    }, { status: 400 })
  }

  const totalCost = items.reduce((s, it) => s + it.quantity * it.unitCost, 0)
  const nowStr = new Date().toISOString()
  const orderId = nanoidLike()
  const ymd = nowStr.slice(0, 10).replace(/-/g, '')
  const orderNumber = `PO-${ymd}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`

  await db.collection(ordersPath).doc(orderId).set({
    id: orderId,
    orderNumber,
    hospitalId,
    branchId,
    supplierId,
    status: 'pending',
    items: normalizedItems,
    totalCost,
    createdAt: nowStr,
    createdBy: auth.user!.uid,
    updatedAt: nowStr,
  })

  const message = skipped.length > 0
    ? `Order created with ${items.length} item(s). ${skipped.length} row(s) skipped (not in catalog): ${skipped.slice(0, 3).join(', ')}${skipped.length > 3 ? '…' : ''}.`
    : `Order created with ${items.length} item(s).`

  return NextResponse.json({
    success: true,
    orderId,
    itemsCount: items.length,
    skipped: skipped.length,
    message,
  })
}
