/**
 * Pharmacy suppliers – GET list, POST create
 */

import { NextRequest, NextResponse } from 'next/server'
import { admin, initFirebaseAdmin } from '@/server/firebaseAdmin'
import { authenticateRequest, createAuthErrorResponse } from '@/utils/firebase/apiAuth'
import { getPharmacyAuthContext, getPharmacyCollectionPath, nanoidLike } from '@/utils/pharmacy/serverPharmacy'
import type { PharmacySupplier } from '@/types/pharmacy'

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.success || !auth.user) return createAuthErrorResponse(auth)

  const init = initFirebaseAdmin('pharmacy/suppliers')
  if (!init.ok) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

  const { searchParams } = new URL(request.url)
  const hospitalIdParam = searchParams.get('hospitalId') || undefined

  const ctxResult = await getPharmacyAuthContext(auth.user, { hospitalId: hospitalIdParam })
  if (!ctxResult.success) return NextResponse.json({ success: false, error: ctxResult.error }, { status: 403 })

  const db = admin.firestore()
  const path = getPharmacyCollectionPath(ctxResult.context.hospitalId, 'suppliers')
  const snap = await db.collection(path).orderBy('name').get()

  const suppliers: PharmacySupplier[] = snap.docs.map(d => ({
    id: d.id,
    ...d.data(),
  })) as PharmacySupplier[]

  return NextResponse.json({ success: true, suppliers })
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.success || !auth.user) return createAuthErrorResponse(auth)

  const init = initFirebaseAdmin('pharmacy/suppliers')
  if (!init.ok) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

  const ctxResult = await getPharmacyAuthContext(auth.user, {})
  if (!ctxResult.success) return NextResponse.json({ success: false, error: ctxResult.error }, { status: 403 })

  const body = await request.json()
  const { name, contactPerson, email, phone, address, paymentTerms, leadTimeDays, minOrderValue } = body

  if (!name || typeof name !== 'string' || name.trim() === '') {
    return NextResponse.json({ success: false, error: 'Supplier name is required' }, { status: 400 })
  }

  const db = admin.firestore()
  const now = new Date()
  const id = nanoidLike()
  const path = getPharmacyCollectionPath(ctxResult.context.hospitalId, 'suppliers')
  const docRef = db.collection(path).doc(id)

  await docRef.set({
    id,
    hospitalId: ctxResult.context.hospitalId,
    name: name.trim(),
    contactPerson: contactPerson?.trim() || '',
    email: email?.trim() || '',
    phone: phone?.trim() || '',
    address: address?.trim() || '',
    paymentTerms: typeof paymentTerms === 'string' ? paymentTerms.trim() || null : null,
    leadTimeDays: leadTimeDays != null ? Math.max(0, Number(leadTimeDays) || 0) : null,
    minOrderValue: minOrderValue != null ? Math.max(0, Number(minOrderValue) || 0) : null,
    createdAt: now,
    updatedAt: now,
  })

  const created = (await docRef.get()).data()
  return NextResponse.json({ success: true, supplier: { id: docRef.id, ...created } })
}
