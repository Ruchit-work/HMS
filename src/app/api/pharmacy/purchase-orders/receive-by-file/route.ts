/**
 * POST: Receive a purchase order by uploading supplier's PDF or Excel.
 * FormData: orderId (required), file (required), supplierInvoiceNumber (optional).
 * Parses file for medicine name, quantity, batch, expiry, mfg; matches to PO lines; updates stock and marks order received.
 */

import { NextRequest, NextResponse } from 'next/server'
import { admin, initFirebaseAdmin } from '@/server/firebaseAdmin'
import { authenticateRequest, createAuthErrorResponse } from '@/utils/firebase/apiAuth'
import { getPharmacyAuthContext, getPharmacyCollectionPath, nanoidLike } from '@/utils/pharmacy/serverPharmacy'
import { acquireIdempotencyKey, clearIdempotencyKey, completeIdempotencyKey, sanitizeIdempotencyKey } from '@/utils/pharmacy/idempotency'
import { writePharmacyAuditEvent } from '@/utils/pharmacy/audit'
import { pharmacyError } from '@/utils/pharmacy/apiResponse'
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
  if (!init.ok) return pharmacyError('Server not configured', 500, 'SERVER_NOT_CONFIGURED')

  const ctxResult = await getPharmacyAuthContext(auth.user, {})
  if (!ctxResult.success) return pharmacyError(ctxResult.error, 403, 'PHARMACY_AUTH_FORBIDDEN')

  let orderId: string | null = null
  let file: File
  let supplierInvoiceNumber: string | null = null
  let parseOnly = false
  let idempotencyKey: string | null = sanitizeIdempotencyKey(request.headers.get('x-idempotency-key'))
  try {
    const formData = await request.formData()
    const orderIdVal = formData.get('orderId')
    file = formData.get('file') as File
    const inv = formData.get('supplierInvoiceNumber')
    const parseOnlyVal = formData.get('parseOnly')
    const idempotencyVal = formData.get('idempotencyKey')
    parseOnly = parseOnlyVal === '1' || parseOnlyVal === 'true'
    if (!idempotencyKey && typeof idempotencyVal === 'string') {
      idempotencyKey = sanitizeIdempotencyKey(idempotencyVal)
    }
    if (typeof orderIdVal === 'string' && orderIdVal.trim()) {
      orderId = orderIdVal.trim()
    }
    if (typeof inv === 'string' && inv.trim()) supplierInvoiceNumber = inv.trim()
  } catch {
    return pharmacyError('Invalid form data', 400, 'INVALID_FORM_DATA')
  }

  if (!file || !(file instanceof File) || file.size === 0) {
    return pharmacyError('No file or empty file', 400, 'FILE_MISSING')
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
      return pharmacyError('Failed to parse Excel. Ensure it has a header row (e.g. name, quantity, batch, expiry).', 400, 'EXCEL_PARSE_FAILED')
    }
  } else {
    try {
      const text = await extractPdfText(buffer)
      rows = parsePdfText(text)
    } catch {
      return pharmacyError('Failed to parse PDF. Try an Excel file for best results.', 400, 'PDF_PARSE_FAILED')
    }
  }

  // If no orderId was provided, support a generic "preview only" mode for simple uploads
  if (!orderId) {
    return NextResponse.json({
      success: true,
      rows: rows.filter((r) => (r.name || '').trim().length > 0),
    })
  }

  const db = admin.firestore()
  const hospitalId = ctxResult.context.hospitalId
  const ordersPath = getPharmacyCollectionPath(hospitalId, 'purchase_orders')
  const medicinesPath = getPharmacyCollectionPath(hospitalId, 'medicines')
  const stockPath = getPharmacyCollectionPath(hospitalId, 'stock')

  const orderRef = db.collection(ordersPath).doc(orderId)
  const orderSnap = await orderRef.get()
  if (!orderSnap.exists) {
    return pharmacyError('Order not found. Check the order number.', 404, 'PURCHASE_ORDER_NOT_FOUND')
  }

  const scopedIdempotencyKey = idempotencyKey && !parseOnly ? `${orderId}_receive_file_${idempotencyKey}` : null
  if (scopedIdempotencyKey) {
    const lock = await acquireIdempotencyKey({
      db,
      hospitalId,
      scope: 'purchase_order_receive',
      key: scopedIdempotencyKey,
      userId: auth.user.uid,
    })
    if (lock.kind === 'completed') {
      return NextResponse.json(lock.response, { status: lock.statusCode })
    }
    if (lock.kind === 'in_progress') {
      return NextResponse.json(
        { success: false, error: 'This receive-by-file request is already being processed. Please retry shortly.' },
        { status: 409 }
      )
    }
  }

  const orderData = orderSnap.data()!
  const status = orderData.status as string
  if (status !== 'pending') {
    return pharmacyError('Order is not pending (only sent orders can be received).', 400, 'PURCHASE_ORDER_RECEIVE_INVALID_STATUS')
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
    return pharmacyError('Order has no items.', 400, 'PURCHASE_ORDER_ITEMS_MISSING')
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
    if (scopedIdempotencyKey) {
      await clearIdempotencyKey({
        db,
        hospitalId,
        scope: 'purchase_order_receive',
        key: scopedIdempotencyKey,
      }).catch(() => {})
    }
    const message = err instanceof Error ? err.message : 'Failed to receive order'
    return pharmacyError(message, 500, 'PURCHASE_ORDER_RECEIVE_BY_FILE_FAILED')
  }

  const updated = await orderRef.get()
  const responseBody = {
    success: true,
    order: { id: orderId, ...updated.data() },
    message: `Order received. Stock updated from ${rows.length} row(s) in file.`,
  }
  if (scopedIdempotencyKey) {
    await completeIdempotencyKey({
      db,
      hospitalId,
      scope: 'purchase_order_receive',
      key: scopedIdempotencyKey,
      statusCode: 200,
      response: responseBody,
    })
  }
  await writePharmacyAuditEvent({
    db,
    hospitalId,
    action: 'purchase_order_received_by_file',
    actorUserId: auth.user.uid,
    branchId,
    entityType: 'purchase_order',
    entityId: orderId,
    summary: 'Purchase order received using supplier upload file.',
    details: {
      supplierInvoiceNumber: supplierInvoiceNumber || null,
      parsedRowCount: rows.length,
    },
  }).catch(() => {})

  return NextResponse.json(responseBody)
}
