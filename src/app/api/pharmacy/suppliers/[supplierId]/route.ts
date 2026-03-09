/**
 * Pharmacy supplier – PATCH update, DELETE
 */

import { NextRequest, NextResponse } from 'next/server'
import { admin, initFirebaseAdmin } from '@/server/firebaseAdmin'
import { authenticateRequest, createAuthErrorResponse } from '@/utils/firebase/apiAuth'
import { getPharmacyAuthContext, getPharmacyCollectionPath } from '@/utils/pharmacy/serverPharmacy'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ supplierId: string }> }
) {
  const auth = await authenticateRequest(request)
  if (!auth.success || !auth.user) return createAuthErrorResponse(auth)

  const init = initFirebaseAdmin('pharmacy/suppliers')
  if (!init.ok) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

  const ctxResult = await getPharmacyAuthContext(auth.user, {})
  if (!ctxResult.success) return NextResponse.json({ success: false, error: ctxResult.error }, { status: 403 })

  const { supplierId } = await params
  if (!supplierId) return NextResponse.json({ success: false, error: 'Supplier ID required' }, { status: 400 })

  const body = await request.json()
  const {
    name,
    contactPerson,
    email,
    phone,
    address,
    paymentTerms,
    leadTimeDays,
    minOrderValue,
  } = body

  const db = admin.firestore()
  const path = getPharmacyCollectionPath(ctxResult.context.hospitalId, 'suppliers')
  const docRef = db.collection(path).doc(supplierId)
  const doc = await docRef.get()
  if (!doc.exists) {
    return NextResponse.json({ success: false, error: 'Supplier not found' }, { status: 404 })
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() }
  if (name !== undefined && typeof name === 'string') updates.name = name.trim()
  if (contactPerson !== undefined) updates.contactPerson = typeof contactPerson === 'string' ? contactPerson.trim() : ''
  if (email !== undefined) updates.email = typeof email === 'string' ? email.trim() : ''
  if (phone !== undefined) updates.phone = typeof phone === 'string' ? phone.trim() : ''
  if (address !== undefined) updates.address = typeof address === 'string' ? address.trim() : ''
  if (paymentTerms !== undefined) updates.paymentTerms = typeof paymentTerms === 'string' ? paymentTerms.trim() || null : null
  if (leadTimeDays !== undefined) updates.leadTimeDays = leadTimeDays != null ? Math.max(0, Number(leadTimeDays) || 0) : null
  if (minOrderValue !== undefined) updates.minOrderValue = minOrderValue != null ? Math.max(0, Number(minOrderValue) || 0) : null

  await docRef.update(updates)
  const updated = (await docRef.get()).data()
  return NextResponse.json({ success: true, supplier: { id: docRef.id, ...updated } })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ supplierId: string }> }
) {
  const auth = await authenticateRequest(_request)
  if (!auth.success || !auth.user) return createAuthErrorResponse(auth)

  const init = initFirebaseAdmin('pharmacy/suppliers')
  if (!init.ok) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

  const ctxResult = await getPharmacyAuthContext(auth.user, {})
  if (!ctxResult.success) return NextResponse.json({ success: false, error: ctxResult.error }, { status: 403 })

  const { supplierId } = await params
  if (!supplierId) return NextResponse.json({ success: false, error: 'Supplier ID required' }, { status: 400 })

  const db = admin.firestore()
  const path = getPharmacyCollectionPath(ctxResult.context.hospitalId, 'suppliers')
  const docRef = db.collection(path).doc(supplierId)
  const doc = await docRef.get()
  if (!doc.exists) {
    return NextResponse.json({ success: false, error: 'Supplier not found' }, { status: 404 })
  }

  await docRef.delete()
  return NextResponse.json({ success: true })
}
