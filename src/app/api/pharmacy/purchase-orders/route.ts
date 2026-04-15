/**
 * Pharmacy purchase orders – GET list, POST create/receive
 */

import { NextRequest, NextResponse } from 'next/server'
import { admin, initFirebaseAdmin } from '@/server/firebaseAdmin'
import { authenticateRequest, createAuthErrorResponse } from '@/utils/firebase/apiAuth'
import { getPharmacyAuthContext, getPharmacyCollectionPath, nanoidLike } from '@/utils/pharmacy/serverPharmacy'
import { acquireIdempotencyKey, clearIdempotencyKey, completeIdempotencyKey, sanitizeIdempotencyKey } from '@/utils/pharmacy/idempotency'
import { writePharmacyAuditEvent } from '@/utils/pharmacy/audit'
import { pharmacyError } from '@/utils/pharmacy/apiResponse'
import type { MedicineBatch, PharmacyPurchaseOrder, PurchaseOrderLine } from '@/types/pharmacy'

function getStockDocId(branchId: string, medicineId: string): string {
  return `${branchId}_${medicineId}`
}

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.success || !auth.user) return createAuthErrorResponse(auth)

  const init = initFirebaseAdmin('pharmacy/purchase-orders')
  if (!init.ok) return pharmacyError('Server not configured', 500, 'SERVER_NOT_CONFIGURED')

  const { searchParams } = new URL(request.url)
  const hospitalIdParam = searchParams.get('hospitalId') || undefined
  const branchIdParam = searchParams.get('branchId') || undefined
  const orderIdParam = searchParams.get('orderId') || undefined

  const ctxResult = await getPharmacyAuthContext(auth.user, {
    hospitalId: hospitalIdParam,
    branchId: branchIdParam,
  })
  if (!ctxResult.success) return pharmacyError(ctxResult.error, 403, 'PHARMACY_AUTH_FORBIDDEN')

  const db = admin.firestore()
  const path = getPharmacyCollectionPath(ctxResult.context.hospitalId, 'purchase_orders')

  if (orderIdParam) {
    const doc = await db.collection(path).doc(orderIdParam).get()
    if (!doc.exists) return pharmacyError('Order not found', 404, 'PURCHASE_ORDER_NOT_FOUND')
    const order = { id: doc.id, ...doc.data() } as PharmacyPurchaseOrder
    return NextResponse.json({ success: true, order })
  }

  let orders: PharmacyPurchaseOrder[]
  if (ctxResult.context.branchId) {
    const snap = await db.collection(path)
      .where('branchId', '==', ctxResult.context.branchId)
      .limit(100)
      .get()
    orders = snap.docs.map(d => ({ id: d.id, ...d.data() })) as PharmacyPurchaseOrder[]
    orders.sort((a, b) => {
      const aVal = typeof a.createdAt === 'string' ? a.createdAt : (a.createdAt as { toDate?: () => Date })?.toDate?.()?.toISOString?.() ?? ''
      const bVal = typeof b.createdAt === 'string' ? b.createdAt : (b.createdAt as { toDate?: () => Date })?.toDate?.()?.toISOString?.() ?? ''
      return bVal.localeCompare(aVal)
    })
  } else {
    const snap = await db.collection(path).orderBy('createdAt', 'desc').limit(100).get()
    orders = snap.docs.map(d => ({ id: d.id, ...d.data() })) as PharmacyPurchaseOrder[]
  }

  return NextResponse.json({ success: true, orders })
}

export async function POST(request: NextRequest) {
  try {
  const auth = await authenticateRequest(request)
  if (!auth.success || !auth.user) return createAuthErrorResponse(auth)

  const init = initFirebaseAdmin('pharmacy/purchase-orders')
  if (!init.ok) return pharmacyError('Server not configured', 500, 'SERVER_NOT_CONFIGURED')

  const ctxResult = await getPharmacyAuthContext(auth.user, {})
  if (!ctxResult.success) return pharmacyError(ctxResult.error, 403, 'PHARMACY_AUTH_FORBIDDEN')

  const body = await request.json().catch(() => ({}))
  const { branchId, supplierId, items, receive, expectedDeliveryDate, status: bodyStatus, notes } = (body || {}) as {
    branchId: string
    supplierId: string
    items: PurchaseOrderLine[]
    receive?: boolean
    expectedDeliveryDate?: string
    status?: 'draft' | 'pending'
    notes?: string
  }

  if (!branchId || !supplierId || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json(
      { success: false, error: 'branchId, supplierId, and items (array) are required' },
      { status: 400 }
    )
  }

  const db = admin.firestore()
  const hospitalId = ctxResult.context.hospitalId
  const medicinesPath = getPharmacyCollectionPath(hospitalId, 'medicines')
  const stockPath = getPharmacyCollectionPath(hospitalId, 'stock')

  const rawItems = items
    .map((it: any) => {
      const newMed = it.newMedicine && typeof it.newMedicine === 'object' ? it.newMedicine : undefined
      const manufacturer =
        typeof it.manufacturer === 'string'
          ? it.manufacturer.trim()
          : typeof newMed?.manufacturer === 'string'
            ? newMed.manufacturer.trim()
            : ''
      return {
        medicineId: typeof it.medicineId === 'string' ? it.medicineId.trim() : '',
        medicineName: typeof it.medicineName === 'string' ? it.medicineName.trim() : '',
        quantity: Math.floor(Number(it.quantity) || 0),
        unitCost: Number(it.unitCost) || 0,
        batchNumber: typeof it.batchNumber === 'string' ? it.batchNumber : nanoidLike(),
        expiryDate: typeof it.expiryDate === 'string' ? it.expiryDate : '',
        manufacturer,
        newMedicine: newMed,
      }
    })
    .filter((it: { quantity: number }) => it.quantity > 0)

  if (rawItems.length === 0) {
    return pharmacyError('At least one item with positive quantity is required', 400, 'INVALID_PURCHASE_ORDER_ITEMS')
  }

  // For items with no medicineId but with medicineName, create a new medicine in the catalog
  const normalizedItems: PurchaseOrderLine[] = []
  const nowIso = new Date().toISOString()
  for (const it of rawItems) {
    let medicineId = it.medicineId
    let medicineName = it.medicineName
    if (!medicineId && medicineName) {
      const newId = nanoidLike()
      const nm = it.newMedicine as Record<string, unknown> | undefined
      const genericName = typeof nm?.genericName === 'string' ? nm.genericName.trim() : ''
      const category = typeof nm?.category === 'string' ? nm.category.trim() : ''
      const manufacturer = typeof nm?.manufacturer === 'string' ? nm.manufacturer.trim() : ''
      // Unit cost varies per order/supplier – do not save as catalog purchase price; set in Add/Edit medicine later
      const sellingPrice = Number(nm?.sellingPrice) || 0
      const minStockLevel = Math.max(0, Number(nm?.minStockLevel) || 0)
      const strength = typeof nm?.strength === 'string' && nm.strength.trim() ? nm.strength.trim() : null
      const packSize = typeof nm?.packSize === 'string' && nm.packSize.trim() ? nm.packSize.trim() : null
      const schedule = nm?.schedule === 'Rx' || nm?.schedule === 'OTC' ? nm.schedule : null
      const barcode = typeof nm?.barcode === 'string' && nm.barcode.trim() ? nm.barcode.trim() : null
      const hsnCode = typeof nm?.hsnCode === 'string' && nm.hsnCode.trim() ? nm.hsnCode.trim() : null
      const reorderQuantity = nm?.reorderQuantity != null ? Math.max(0, Number(nm.reorderQuantity) || 0) : null
      const leadTimeDays = nm?.leadTimeDays != null ? Math.max(0, Number(nm.leadTimeDays) || 0) : null
      const manufacturingDate = typeof nm?.manufacturingDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(nm.manufacturingDate.trim()) ? nm.manufacturingDate.trim() : null
      const expiryDateCatalog = typeof nm?.expiryDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(nm.expiryDate.trim()) ? nm.expiryDate.trim() : null
      const medRef = db.collection(medicinesPath).doc(newId)
      await medRef.set({
        hospitalId,
        medicineId: newId,
        name: medicineName,
        genericName,
        category,
        manufacturer,
        purchasePrice: 0,
        sellingPrice,
        minStockLevel,
        supplierId: supplierId || null,
        unit: 'tablets',
        strength,
        packSize,
        schedule,
        barcode,
        hsnCode,
        reorderQuantity,
        leadTimeDays,
        manufacturingDate,
        expiryDate: expiryDateCatalog,
        createdAt: nowIso,
        updatedAt: nowIso,
      })
      medicineId = newId
    } else if (medicineId && !medicineName) {
      const medDoc = await db.collection(medicinesPath).doc(medicineId).get()
      const medData = medDoc.exists ? (medDoc.data() as { name?: string; manufacturer?: string }) : null
      medicineName = medData?.name || ''
    }
    if (!medicineId || !medicineName) {
      return NextResponse.json(
        { success: false, error: 'Each item must have a medicine (select from catalog or provide new medicine name)' },
        { status: 400 }
      )
    }
    let manufacturer = typeof it.manufacturer === 'string' ? it.manufacturer.trim() : ''
    if (!manufacturer && medicineId) {
      const medDoc = await db.collection(medicinesPath).doc(medicineId).get()
      manufacturer = medDoc.exists ? (medDoc.data() as { manufacturer?: string }).manufacturer || '' : ''
    }
    normalizedItems.push({
      medicineId,
      medicineName,
      ...(manufacturer ? { manufacturer } : {}),
      quantity: it.quantity,
      unitCost: it.unitCost,
      batchNumber: it.batchNumber,
      expiryDate: it.expiryDate,
    })
  }

  const totalCost = normalizedItems.reduce((s, it) => s + it.quantity * it.unitCost, 0)
  const nowStr = new Date().toISOString()
  const orderId = nanoidLike()
  const ordersPath = getPharmacyCollectionPath(hospitalId, 'purchase_orders')
  const ymd = nowStr.slice(0, 10).replace(/-/g, '')
  const orderNumber = `PO-${ymd}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
  const expectedDate = typeof expectedDeliveryDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(expectedDeliveryDate.trim()) ? expectedDeliveryDate.trim() : null

  if (receive) {
    await db.runTransaction(async (tx) => {
      const orderRef = db.collection(ordersPath).doc(orderId)
      tx.set(orderRef, {
        id: orderId,
        orderNumber,
        hospitalId,
        branchId,
        supplierId,
        status: 'received',
        items: normalizedItems,
        totalCost,
        expectedDeliveryDate: expectedDate,
        receivedAt: nowStr,
        createdAt: nowStr,
        createdBy: auth.user!.uid,
        updatedAt: nowStr,
      })

      for (const it of normalizedItems) {
        const medDoc = await tx.get(db.collection(medicinesPath).doc(it.medicineId))
        const medicineName = medDoc.exists ? (medDoc.data() as { name: string }).name : it.medicineName
        const stockRef = db.collection(stockPath).doc(getStockDocId(branchId, it.medicineId))
        const stockSnap = await tx.get(stockRef)
        const batch: MedicineBatch = {
          id: nanoidLike(),
          batchNumber: it.batchNumber,
          expiryDate: it.expiryDate,
          quantity: it.quantity,
          receivedAt: nowStr,
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
    })
  } else {
    const orderStatus = bodyStatus === 'draft' ? 'draft' : 'pending'
    await db.collection(ordersPath).doc(orderId).set({
      id: orderId,
      orderNumber,
      hospitalId,
      branchId,
      supplierId,
      status: orderStatus,
      items: normalizedItems,
      totalCost,
      expectedDeliveryDate: expectedDate,
      notes: typeof notes === 'string' ? notes.trim() || null : null,
      createdAt: nowStr,
      createdBy: auth.user!.uid,
      updatedAt: nowStr,
    })
  }

  const orderDoc = await db.collection(ordersPath).doc(orderId).get()
  const orderData = orderDoc.data()
  return NextResponse.json({
    success: true,
    order: { id: orderId, ...orderData },
  })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create order'
    return pharmacyError(message, 500, 'PURCHASE_ORDER_CREATE_FAILED')
  }
}

/** PATCH: Mark an existing pending order as received and add stock to branch */
export async function PATCH(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.success || !auth.user) return createAuthErrorResponse(auth)

  const init = initFirebaseAdmin('pharmacy/purchase-orders')
  if (!init.ok) return pharmacyError('Server not configured', 500, 'SERVER_NOT_CONFIGURED')

  const ctxResult = await getPharmacyAuthContext(auth.user, {})
  if (!ctxResult.success) return pharmacyError(ctxResult.error, 403, 'PHARMACY_AUTH_FORBIDDEN')

  const { searchParams } = new URL(request.url)
  const orderId = searchParams.get('orderId')
  if (!orderId) {
    return pharmacyError('orderId is required', 400, 'ORDER_ID_REQUIRED')
  }

  let supplierInvoiceNumber: string | null = null
  /** Per-line batch/expiry/mfg entered at receive time (from physical goods) */
  let receiveDetails: Array<{ batchNumber?: string; expiryDate?: string; manufacturingDate?: string }> = []
  let cancelOrder = false
  let idempotencyKey: string | null = null
  try {
    const body = await request.json().catch(() => ({}))
    if (body && typeof body.supplierInvoiceNumber === 'string' && body.supplierInvoiceNumber.trim()) {
      supplierInvoiceNumber = body.supplierInvoiceNumber.trim()
    }
    if (body && Array.isArray(body.receiveDetails)) {
      receiveDetails = body.receiveDetails.map((d: any) => ({
        batchNumber: typeof d.batchNumber === 'string' ? d.batchNumber.trim() : undefined,
        expiryDate: typeof d.expiryDate === 'string' ? d.expiryDate.trim() : undefined,
        manufacturingDate: typeof d.manufacturingDate === 'string' ? d.manufacturingDate.trim() : undefined,
      }))
    }
    if (body && body.cancel === true) cancelOrder = true
    idempotencyKey = sanitizeIdempotencyKey(
      request.headers.get('x-idempotency-key') || (body as { idempotencyKey?: unknown }).idempotencyKey
    )
  } catch {
    // no body
  }

  const db = admin.firestore()
  const hospitalId = ctxResult.context.hospitalId
  const ordersPath = getPharmacyCollectionPath(hospitalId, 'purchase_orders')
  const medicinesPath = getPharmacyCollectionPath(hospitalId, 'medicines')
  const stockPath = getPharmacyCollectionPath(hospitalId, 'stock')

  const orderRef = db.collection(ordersPath).doc(orderId)
  const orderSnap = await orderRef.get()
  if (!orderSnap.exists) {
    return pharmacyError('Order not found', 404, 'PURCHASE_ORDER_NOT_FOUND')
  }

  const orderData = orderSnap.data()!
  const status = orderData.status as string

  if (cancelOrder) {
    if (status !== 'draft' && status !== 'pending') {
      return pharmacyError('Only draft or sent orders can be cancelled', 400, 'PURCHASE_ORDER_CANCEL_INVALID_STATUS')
    }
    if (idempotencyKey) {
      const lock = await acquireIdempotencyKey({
        db,
        hospitalId,
        scope: 'purchase_order_receive',
        key: `${orderId}_cancel_${idempotencyKey}`,
        userId: auth.user.uid,
      })
      if (lock.kind === 'completed') {
        return NextResponse.json(lock.response, { status: lock.statusCode })
      }
      if (lock.kind === 'in_progress') {
        return NextResponse.json(
          { success: false, error: 'This cancel request is already being processed. Please retry shortly.' },
          { status: 409 }
        )
      }
    }

    const nowStr = new Date().toISOString()
    try {
      await orderRef.update({ status: 'cancelled', updatedAt: nowStr })
      const updated = await orderRef.get()
      const responseBody = { success: true, order: { id: orderId, ...updated.data() } }
      if (idempotencyKey) {
        await completeIdempotencyKey({
          db,
          hospitalId,
          scope: 'purchase_order_receive',
          key: `${orderId}_cancel_${idempotencyKey}`,
          statusCode: 200,
          response: responseBody,
        })
      }
      await writePharmacyAuditEvent({
        db,
        hospitalId,
        action: 'purchase_order_cancelled',
        actorUserId: auth.user.uid,
        branchId: (updated.data()?.branchId as string | undefined) || null,
        entityType: 'purchase_order',
        entityId: orderId,
        summary: 'Purchase order cancelled.',
        details: {
          previousStatus: status,
        },
      }).catch(() => {})
      return NextResponse.json(responseBody)
    } catch (err) {
      if (idempotencyKey) {
        await clearIdempotencyKey({
          db,
          hospitalId,
          scope: 'purchase_order_receive',
          key: `${orderId}_cancel_${idempotencyKey}`,
        }).catch(() => {})
      }
      const message = err instanceof Error ? err.message : 'Failed to cancel order'
      return pharmacyError(message, 500, 'PURCHASE_ORDER_CANCEL_FAILED')
    }
  }

  if (status !== 'pending') {
    return pharmacyError('Order is not pending (only sent orders can be received)', 400, 'PURCHASE_ORDER_RECEIVE_INVALID_STATUS')
  }

  const branchId = orderData.branchId
  const items: PurchaseOrderLine[] = Array.isArray(orderData.items) ? orderData.items : []
  if (items.length === 0) {
    return pharmacyError('Order has no items', 400, 'PURCHASE_ORDER_ITEMS_MISSING')
  }

  if (idempotencyKey) {
    const lock = await acquireIdempotencyKey({
      db,
      hospitalId,
      scope: 'purchase_order_receive',
      key: `${orderId}_receive_${idempotencyKey}`,
      userId: auth.user.uid,
    })
    if (lock.kind === 'completed') {
      return NextResponse.json(lock.response, { status: lock.statusCode })
    }
    if (lock.kind === 'in_progress') {
      return NextResponse.json(
        { success: false, error: 'This receive request is already being processed. Please retry shortly.' },
        { status: 409 }
      )
    }
  }

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

    const updated = await orderRef.get()
    const responseBody = {
      success: true,
      order: { id: orderId, ...updated.data() },
    }
    if (idempotencyKey) {
      await completeIdempotencyKey({
        db,
        hospitalId,
        scope: 'purchase_order_receive',
        key: `${orderId}_receive_${idempotencyKey}`,
        statusCode: 200,
        response: responseBody,
      })
    }
    await writePharmacyAuditEvent({
      db,
      hospitalId,
      action: 'purchase_order_received',
      actorUserId: auth.user.uid,
      branchId,
      entityType: 'purchase_order',
      entityId: orderId,
      summary: 'Purchase order received and stock updated.',
      details: {
        itemCount: items.length,
        supplierInvoiceNumber: supplierInvoiceNumber || null,
      },
    }).catch(() => {})
    return NextResponse.json(responseBody)
  } catch (err) {
    if (idempotencyKey) {
      await clearIdempotencyKey({
        db,
        hospitalId,
        scope: 'purchase_order_receive',
        key: `${orderId}_receive_${idempotencyKey}`,
      }).catch(() => {})
    }
    const message = err instanceof Error ? err.message : 'Failed to receive order'
    return pharmacyError(message, 500, 'PURCHASE_ORDER_RECEIVE_FAILED')
  }
}
