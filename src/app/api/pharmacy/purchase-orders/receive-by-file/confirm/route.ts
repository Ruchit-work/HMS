/**
 * POST: Confirm receive from supplier file.
 * Body: { orderId, rows: ParsedMedicineRow[], supplierInvoiceNumber? }
 * For each row: find medicine by name+manufacturer or create new; add stock to order's branch; then mark order received.
 */

import { NextRequest, NextResponse } from 'next/server'
import { admin, initFirebaseAdmin } from '@/server/firebaseAdmin'
import { authenticateRequest, createAuthErrorResponse } from '@/utils/firebase/apiAuth'
import { getPharmacyAuthContext, getPharmacyCollectionPath, nanoidLike } from '@/utils/pharmacy/serverPharmacy'
import { acquireIdempotencyKey, clearIdempotencyKey, completeIdempotencyKey, sanitizeIdempotencyKey } from '@/utils/pharmacy/idempotency'
import { writePharmacyAuditEvent } from '@/utils/pharmacy/audit'
import { pharmacyError } from '@/utils/pharmacy/apiResponse'
import type { MedicineBatch } from '@/types/pharmacy'
import type { ParsedMedicineRow } from '@/utils/pharmacy/parseMedicineFile'

function getStockDocId(branchId: string, medicineId: string): string {
  return `${branchId}_${medicineId}`
}

function norm(s: string | undefined): string {
  return (s || '').trim().toLowerCase()
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

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.success || !auth.user) return createAuthErrorResponse(auth)

  const init = initFirebaseAdmin('pharmacy/purchase-orders/receive-by-file/confirm')
  if (!init.ok) return pharmacyError('Server not configured', 500, 'SERVER_NOT_CONFIGURED')

  const ctxResult = await getPharmacyAuthContext(auth.user, {})
  if (!ctxResult.success) return pharmacyError(ctxResult.error, 403, 'PHARMACY_AUTH_FORBIDDEN')

  let body: { orderId?: string; rows?: ParsedMedicineRow[]; supplierInvoiceNumber?: string; idempotencyKey?: string }
  try {
    body = await request.json()
  } catch {
    return pharmacyError('Invalid JSON body', 400, 'INVALID_JSON_BODY')
  }

  const orderId = typeof body.orderId === 'string' ? body.orderId.trim() : ''
  const rows = Array.isArray(body.rows) ? body.rows : []
  const supplierInvoiceNumber = typeof body.supplierInvoiceNumber === 'string' && body.supplierInvoiceNumber.trim()
    ? body.supplierInvoiceNumber.trim()
    : null

  const validRows = rows.filter((r) => (r.name || '').trim().length > 0)
  if (validRows.length === 0) {
    return pharmacyError('At least one row with medicine name is required', 400, 'ROWS_REQUIRED')
  }

  const db = admin.firestore()
  const hospitalId = ctxResult.context.hospitalId
  const medicinesPath = getPharmacyCollectionPath(hospitalId, 'medicines')
  const stockPath = getPharmacyCollectionPath(hospitalId, 'stock')
  const idempotencyKey = sanitizeIdempotencyKey(
    request.headers.get('x-idempotency-key') || body.idempotencyKey
  )

  // If no orderId is provided, behave like a generic bulk upload:
  // create/update medicines and (if possible) stock, but do not touch any purchase order.
  if (!orderId) {
    const scopedIdempotencyKey = idempotencyKey ? `generic_import_${idempotencyKey}` : null
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
          { success: false, error: 'This import request is already being processed. Please retry shortly.' },
          { status: 409 }
        )
      }
    }

    const nowStr = new Date().toISOString()
    const nowIso = nowStr
    try {
      await db.runTransaction(async (tx) => {
        const medicinesSnap = await tx.get(db.collection(medicinesPath).limit(500))
        const medicinesList = medicinesSnap.docs.map((d) => {
          const data = d.data()
          return {
            id: d.id,
            name: (data.name || '').trim(),
            manufacturer: (data.manufacturer || '').trim(),
            nameKey: norm(data.name),
            manufacturerKey: norm(data.manufacturer),
          }
        })

        type RowOp = {
          row: (typeof validRows)[number]
          quantity: number
          medicineId: string
          medicineName: string
          isNewMedicine: boolean
        }
        const rowOps: RowOp[] = []
        for (const row of validRows) {
          const name = (row.name || '').trim()
          const manufacturer = (row.manufacturer || '').trim()
          const nameKey = norm(row.name)
          const manufacturerKey = norm(row.manufacturer)
          const quantity = Math.floor(Number(row.quantity) || 0)
          if (quantity <= 0) continue

          const existing = medicinesList.find(
            (m) => m.nameKey === nameKey && m.manufacturerKey === manufacturerKey
          )
          if (existing) {
            rowOps.push({ row, quantity, medicineId: existing.id, medicineName: existing.name, isNewMedicine: false })
          } else {
            const medicineId = nanoidLike()
            medicinesList.push({
              id: medicineId,
              name,
              manufacturer,
              nameKey,
              manufacturerKey,
            })
            rowOps.push({ row, quantity, medicineId, medicineName: name, isNewMedicine: true })
          }
        }

        for (const op of rowOps) {
          if (op.isNewMedicine) {
            const row = op.row
            const name = (row.name || '').trim()
            const manufacturer = (row.manufacturer || '').trim()
            const genericName = typeof row.genericName === 'string' ? row.genericName.trim() : ''
            const category = typeof row.category === 'string' ? row.category.trim() : ''
            const strength = typeof row.strength === 'string' && row.strength.trim() ? row.strength.trim() : null
            const barcode = typeof row.barcode === 'string' && row.barcode.trim() ? row.barcode.trim() : null
            const sellingPrice = Number(row.sellingPrice) || 0
            const minStockLevel = Math.max(0, Number(row.minStockLevel) || 0)
            const medRef = db.collection(medicinesPath).doc(op.medicineId)
            tx.set(medRef, {
              hospitalId,
              medicineId: op.medicineId,
              name,
              genericName: genericName || null,
              category: category || null,
              manufacturer: manufacturer || null,
              purchasePrice: Number(row.purchasePrice) || 0,
              sellingPrice,
              minStockLevel,
              supplierId: null,
              unit: 'tablets',
              strength,
              packSize: null,
              schedule: null,
              barcode,
              hsnCode: null,
              reorderQuantity: null,
              leadTimeDays: null,
              manufacturingDate: normalizeDate(row.manufacturingDate) || null,
              expiryDate: normalizeDate(row.expiryDate) || null,
              createdAt: nowIso,
              updatedAt: nowIso,
            })
          }
        }
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
      const message = err instanceof Error ? err.message : 'Failed to import medicines'
      return pharmacyError(message, 500, 'GENERIC_IMPORT_FAILED')
    }

    const responseBody = {
      success: true,
      message: 'Medicines imported from file. No purchase order was updated.',
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
    return NextResponse.json(responseBody)
  }

  const ordersPath = getPharmacyCollectionPath(hospitalId, 'purchase_orders')

  const orderRef = db.collection(ordersPath).doc(orderId)
  const orderSnap = await orderRef.get()
  if (!orderSnap.exists) {
    return pharmacyError('Order not found', 404, 'PURCHASE_ORDER_NOT_FOUND')
  }

  const scopedIdempotencyKey = idempotencyKey ? `${orderId}_receive_file_confirm_${idempotencyKey}` : null
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
        { success: false, error: 'This confirm request is already being processed. Please retry shortly.' },
        { status: 409 }
      )
    }
  }

  const orderData = orderSnap.data()!
  const status = orderData.status as string
  if (status !== 'pending') {
    return pharmacyError('Order is not pending (only sent orders can be received)', 400, 'PURCHASE_ORDER_RECEIVE_INVALID_STATUS')
  }

  const branchId = orderData.branchId as string
  const supplierId = (orderData.supplierId as string) || ''
  const nowStr = new Date().toISOString()
  const nowIso = nowStr

  try {
    await db.runTransaction(async (tx) => {
      // ——— All reads first (Firestore requires reads before writes) ———
      const medicinesSnap = await tx.get(db.collection(medicinesPath).limit(500))
      const medicinesList = medicinesSnap.docs.map((d) => {
        const data = d.data()
        return {
          id: d.id,
          name: (data.name || '').trim(),
          manufacturer: (data.manufacturer || '').trim(),
          nameKey: norm(data.name),
          manufacturerKey: norm(data.manufacturer),
        }
      })

      type RowOp = {
        row: (typeof validRows)[number]
        quantity: number
        medicineId: string
        medicineName: string
        isNewMedicine: boolean
      }
      const rowOps: RowOp[] = []
      for (const row of validRows) {
        const name = (row.name || '').trim()
        const manufacturer = (row.manufacturer || '').trim()
        const nameKey = norm(row.name)
        const manufacturerKey = norm(row.manufacturer)
        const quantity = Math.floor(Number(row.quantity) || 0)
        if (quantity <= 0) continue

        const existing = medicinesList.find(
          (m) => m.nameKey === nameKey && m.manufacturerKey === manufacturerKey
        )
        if (existing) {
          rowOps.push({ row, quantity, medicineId: existing.id, medicineName: existing.name, isNewMedicine: false })
        } else {
          const medicineId = nanoidLike()
          medicinesList.push({
            id: medicineId,
            name,
            manufacturer,
            nameKey,
            manufacturerKey,
          })
          rowOps.push({ row, quantity, medicineId, medicineName: name, isNewMedicine: true })
        }
      }

      const stockKeyToOps = new Map<string, { medicineId: string; medicineName: string; batches: MedicineBatch[]; totalQty: number }>()
      for (const op of rowOps) {
        const key = getStockDocId(branchId, op.medicineId)
        const expiryDate = normalizeDate(op.row.expiryDate) || ''
        const batchNumber = (op.row.batchNumber && String(op.row.batchNumber).trim()) || nanoidLike()
        const manufacturingDate = normalizeDate(op.row.manufacturingDate)
        const batch: MedicineBatch = {
          id: nanoidLike(),
          batchNumber,
          expiryDate: expiryDate || '2099-12-31',
          quantity: op.quantity,
          receivedAt: nowStr,
          ...(manufacturingDate && { manufacturingDate }),
        }
        const existing = stockKeyToOps.get(key)
        if (existing) {
          existing.batches.push(batch)
          existing.totalQty += op.quantity
        } else {
          stockKeyToOps.set(key, {
            medicineId: op.medicineId,
            medicineName: op.medicineName,
            batches: [batch],
            totalQty: op.quantity,
          })
        }
      }
      const uniqueStockRefs = Array.from(stockKeyToOps.keys()).map((key) =>
        db.collection(stockPath).doc(key)
      )
      const stockSnaps = await Promise.all(uniqueStockRefs.map((ref) => tx.get(ref)))
      const stockSnapByKey = new Map<string, FirebaseFirestore.DocumentSnapshot>()
      uniqueStockRefs.forEach((ref, i) => {
        stockSnapByKey.set(ref.id, stockSnaps[i])
      })

      // ——— All writes after reads ———
      for (const op of rowOps) {
        if (op.isNewMedicine) {
          const row = op.row
          const name = (row.name || '').trim()
          const manufacturer = (row.manufacturer || '').trim()
          const genericName = typeof row.genericName === 'string' ? row.genericName.trim() : ''
          const category = typeof row.category === 'string' ? row.category.trim() : ''
          const strength = typeof row.strength === 'string' && row.strength.trim() ? row.strength.trim() : null
          const barcode = typeof row.barcode === 'string' && row.barcode.trim() ? row.barcode.trim() : null
          const sellingPrice = Number(row.sellingPrice) || 0
          const minStockLevel = Math.max(0, Number(row.minStockLevel) || 0)
          const medRef = db.collection(medicinesPath).doc(op.medicineId)
          tx.set(medRef, {
            hospitalId,
            medicineId: op.medicineId,
            name,
            genericName: genericName || null,
            category: category || null,
            manufacturer: manufacturer || null,
            purchasePrice: Number(row.purchasePrice) || 0,
            sellingPrice,
            minStockLevel,
            supplierId: supplierId || null,
            unit: 'tablets',
            strength,
            packSize: null,
            schedule: null,
            barcode,
            hsnCode: null,
            reorderQuantity: null,
            leadTimeDays: null,
            manufacturingDate: normalizeDate(row.manufacturingDate) || null,
            expiryDate: normalizeDate(row.expiryDate) || null,
            createdAt: nowIso,
            updatedAt: nowIso,
          })
        }
      }

      for (const [stockKey, agg] of stockKeyToOps) {
        const stockRef = db.collection(stockPath).doc(stockKey)
        const stockSnap = stockSnapByKey.get(stockKey)!
        if (!stockSnap.exists) {
          tx.set(stockRef, {
            hospitalId,
            branchId,
            medicineId: agg.medicineId,
            medicineName: agg.medicineName,
            batches: agg.batches,
            totalQuantity: agg.totalQty,
            updatedAt: nowStr,
          })
        } else {
          const data = stockSnap.data()!
          const batches = Array.isArray(data.batches) ? [...data.batches, ...agg.batches] : agg.batches
          const totalQuantity = (Number(data.totalQuantity) || 0) + agg.totalQty
          tx.update(stockRef, {
            batches,
            totalQuantity,
            medicineName: agg.medicineName,
            updatedAt: nowStr,
          })
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
    const message = err instanceof Error ? err.message : 'Failed to confirm receive'
    return pharmacyError(message, 500, 'PURCHASE_ORDER_RECEIVE_CONFIRM_FAILED')
  }

  const updated = await orderRef.get()
  const responseBody = {
    success: true,
    order: { id: orderId, ...updated.data() },
    message: 'Order marked as delivered. Stock updated.',
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
    action: 'purchase_order_received_by_file_confirmed',
    actorUserId: auth.user.uid,
    branchId,
    entityType: 'purchase_order',
    entityId: orderId,
    summary: 'Purchase order receive confirmed from parsed supplier rows.',
    details: {
      supplierInvoiceNumber: supplierInvoiceNumber || null,
      validRowCount: validRows.length,
    },
  }).catch(() => {})

  return NextResponse.json(responseBody)
}
