/**
 * POST: Receive a purchase order by uploading supplier's PDF or Excel.
 * FormData: orderId (required), file (required), supplierInvoiceNumber (optional).
 * Parses file for medicine name, quantity, batch, expiry, mfg; matches to PO lines; updates stock and marks order received.
 */

import { NextRequest, NextResponse } from 'next/server'
import { admin, initFirebaseAdmin } from '@/server/firebaseAdmin'
import { authenticateRequest, createAuthErrorResponse } from '@/utils/firebase/apiAuth'
import { getPharmacyAuthContext, getPharmacyCollectionPath, nanoidLike } from '@/utils/pharmacy/serverPharmacy'
import { getFileKind, parseExcelBuffer, parsePdfText, type ParsedMedicineRow } from '@/utils/pharmacy/parseMedicineFile'
import type { MedicineBatch, PurchaseOrderLine } from '@/types/pharmacy'

function getStockDocId(branchId: string, medicineId: string): string {
  return `${branchId}_${medicineId}`
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const pdfParseMod = await import('pdf-parse')
  const pdfParse = (pdfParseMod as any).default ?? (pdfParseMod as any)
  const data = typeof pdfParse === 'function' ? await pdfParse(buffer) : await (pdfParse.parse ?? pdfParse)(buffer)
  return (data?.text || '').trim()
}

/** Normalize to YYYY-MM-DD if possible */
function normalizeDate(s: string | undefined): string | null {
  if (!s || typeof s !== 'string') return null
  const t = s.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t
  const d = new Date(t)
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  return null
}

/** For each PO line, find best matching parsed row by medicine name and build receive details */
function matchReceiveDetails(
  orderItems: PurchaseOrderLine[],
  parsedRows: ParsedMedicineRow[]
): Array<{ batchNumber?: string; expiryDate?: string; manufacturingDate?: string }> {
  const normalized = parsedRows.map((r) => ({
    row: r,
    nameKey: (r.name || '').trim().toLowerCase(),
  }))
  return orderItems.map((it) => {
    const nameKey = (it.medicineName || '').trim().toLowerCase()
    const match = normalized.find((n) => n.nameKey === nameKey || n.nameKey.includes(nameKey) || nameKey.includes(n.nameKey))
    const row = match?.row
    if (!row) {
      return {}
    }
    const expiry = normalizeDate(row.expiryDate)
    const mfg = normalizeDate(row.manufacturingDate)
    return {
      batchNumber: row.batchNumber?.trim() || undefined,
      expiryDate: expiry || undefined,
      manufacturingDate: mfg || undefined,
    }
  })
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.success || !auth.user) return createAuthErrorResponse(auth)

  const init = initFirebaseAdmin('pharmacy/purchase-orders/receive-by-file')
  if (!init.ok) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

  const ctxResult = await getPharmacyAuthContext(auth.user, {})
  if (!ctxResult.success) return NextResponse.json({ success: false, error: ctxResult.error }, { status: 403 })

  let orderId: string
  let file: File
  let supplierInvoiceNumber: string | null = null
  let parseOnly = false
  try {
    const formData = await request.formData()
    const orderIdVal = formData.get('orderId')
    file = formData.get('file') as File
    const inv = formData.get('supplierInvoiceNumber')
    const parseOnlyVal = formData.get('parseOnly')
    parseOnly = parseOnlyVal === '1' || parseOnlyVal === 'true'
    if (typeof orderIdVal !== 'string' || !orderIdVal.trim()) {
      return NextResponse.json({ success: false, error: 'orderId is required' }, { status: 400 })
    }
    orderId = orderIdVal.trim()
    if (typeof inv === 'string' && inv.trim()) supplierInvoiceNumber = inv.trim()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid form data' }, { status: 400 })
  }

  if (!file || !(file instanceof File) || file.size === 0) {
    return NextResponse.json({ success: false, error: 'No file or empty file' }, { status: 400 })
  }

  const filename = file.name || ''
  const mime = file.type || ''
  const kind = getFileKind(mime, filename)
  if (kind !== 'excel' && kind !== 'pdf') {
    return NextResponse.json({
      success: false,
      error: 'Use an Excel (.xlsx, .xls) or PDF file from the supplier.',
    }, { status: 400 })
  }

  let rows: ParsedMedicineRow[] = []
  const buffer = Buffer.from(await file.arrayBuffer())
  if (kind === 'excel') {
    try {
      rows = await parseExcelBuffer(buffer)
    } catch {
      return NextResponse.json({ success: false, error: 'Failed to parse Excel. Ensure it has a header row (e.g. name, quantity, batch, expiry).' }, { status: 400 })
    }
  } else {
    try {
      const text = await extractPdfText(buffer)
      rows = parsePdfText(text)
    } catch {
      return NextResponse.json({ success: false, error: 'Failed to parse PDF. Try an Excel file for best results.' }, { status: 400 })
    }
  }

  const db = admin.firestore()
  const hospitalId = ctxResult.context.hospitalId
  const ordersPath = getPharmacyCollectionPath(hospitalId, 'purchase_orders')
  const medicinesPath = getPharmacyCollectionPath(hospitalId, 'medicines')
  const stockPath = getPharmacyCollectionPath(hospitalId, 'stock')

  const orderRef = db.collection(ordersPath).doc(orderId)
  const orderSnap = await orderRef.get()
  if (!orderSnap.exists) {
    return NextResponse.json({ success: false, error: 'Order not found. Check the order number.' }, { status: 404 })
  }

  const orderData = orderSnap.data()!
  const status = orderData.status as string
  if (status !== 'pending') {
    return NextResponse.json({ success: false, error: 'Order is not pending (only sent orders can be received).' }, { status: 400 })
  }

  const branchId = orderData.branchId
  const supplierId = (orderData.supplierId as string) || ''
  const orderNumber = (orderData.orderNumber as string) || orderId

  if (parseOnly) {
    const order = {
      id: orderId,
      orderNumber,
      branchId,
      supplierId,
      status: orderData.status,
      items: orderData.items,
    }
    return NextResponse.json({
      success: true,
      order,
      rows: rows.filter((r) => (r.name || '').trim().length > 0),
    })
  }

  const items: PurchaseOrderLine[] = Array.isArray(orderData.items) ? orderData.items : []
  if (items.length === 0) {
    return NextResponse.json({ success: false, error: 'Order has no items.' }, { status: 400 })
  }

  const receiveDetails = matchReceiveDetails(items, rows)
  const nowStr = new Date().toISOString()

  try {
    await db.runTransaction(async (tx) => {
      for (let i = 0; i < items.length; i++) {
        const it = items[i]
        const rd = receiveDetails[i]
        const batchNumber = (rd?.batchNumber && rd.batchNumber.length > 0) ? rd.batchNumber : (it.batchNumber || nanoidLike())
        const expiryDate = (rd?.expiryDate && /^\d{4}-\d{2}-\d{2}$/.test(rd.expiryDate)) ? rd.expiryDate : (it.expiryDate || '')
        const manufacturingDate = (rd?.manufacturingDate && /^\d{4}-\d{2}-\d{2}$/.test(rd.manufacturingDate)) ? rd.manufacturingDate : null

        const medDoc = await tx.get(db.collection(medicinesPath).doc(it.medicineId))
        const medicineName = medDoc.exists ? (medDoc.data() as { name: string }).name : (it.medicineName || '')
        const stockRef = db.collection(stockPath).doc(getStockDocId(branchId, it.medicineId))
        const stockSnap = await tx.get(stockRef)
        const batch: MedicineBatch = {
          id: nanoidLike(),
          batchNumber,
          expiryDate,
          quantity: it.quantity,
          receivedAt: nowStr,
          ...(manufacturingDate && { manufacturingDate }),
        }

        if (!stockSnap.exists) {
          tx.set(stockRef, {
            hospitalId,
            branchId,
            medicineId: it.medicineId,
            medicineName,
            batches: [batch],
            totalQuantity: it.quantity,
            updatedAt: nowStr,
          })
        } else {
          const data = stockSnap.data()!
          const batches = Array.isArray(data.batches) ? [...data.batches, batch] : [batch]
          const totalQuantity = (Number(data.totalQuantity) || 0) + it.quantity
          tx.update(stockRef, { batches, totalQuantity, medicineName, updatedAt: nowStr })
        }
      }
      const updateData: Record<string, unknown> = { status: 'received', receivedAt: nowStr, updatedAt: nowStr }
      if (supplierInvoiceNumber) updateData.supplierInvoiceNumber = supplierInvoiceNumber
      tx.update(orderRef, updateData)
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to receive order'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }

  const updated = await orderRef.get()
  return NextResponse.json({
    success: true,
    order: { id: orderId, ...updated.data() },
    message: `Order received. Stock updated from ${rows.length} row(s) in file.`,
  })
}
