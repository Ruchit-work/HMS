import { NextRequest, NextResponse } from 'next/server'
import { admin, initFirebaseAdmin } from '@/server/firebaseAdmin'
import { authenticateRequest, createAuthErrorResponse } from '@/utils/firebase/apiAuth'
import { getPharmacyAuthContext, getPharmacyCollectionPath } from '@/utils/pharmacy/serverPharmacy'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticateRequest(request)
  if (!auth.success || !auth.user) return createAuthErrorResponse(auth)

  const init = initFirebaseAdmin('pharmacy/cashiers/[id]/PATCH')
  if (!init.ok) {
    return NextResponse.json({ success: false, error: init.error || 'Server not configured' }, { status: 500 })
  }

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const name = typeof body?.name === 'string' ? body.name.trim() : undefined
  const phone = typeof body?.phone === 'string' ? body.phone.trim() : undefined
  const active = typeof body?.active === 'boolean' ? body.active : undefined

  const ctxResult = await getPharmacyAuthContext(auth.user, {})
  if (!ctxResult.success) {
    return NextResponse.json({ success: false, error: ctxResult.error }, { status: 403 })
  }

  const { hospitalId } = ctxResult.context
  const db = admin.firestore()
  const path = getPharmacyCollectionPath(hospitalId, 'cashiers')
  const ref = db.collection(path).doc(id)
  const snap = await ref.get()
  if (!snap.exists) {
    return NextResponse.json({ success: false, error: 'Cashier not found' }, { status: 404 })
  }

  const update: Record<string, unknown> = {}
  if (name !== undefined) update.name = name
  if (phone !== undefined) update.phone = phone || undefined
  if (active !== undefined) update.active = active
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ success: false, error: 'Nothing to update' }, { status: 400 })
  }
  update.updatedAt = new Date().toISOString()

  await ref.update(update)

  const updated = (await ref.get()).data() || {}
  return NextResponse.json({ success: true, cashier: { id, ...updated } })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticateRequest(request)
  if (!auth.success || !auth.user) return createAuthErrorResponse(auth)

  const init = initFirebaseAdmin('pharmacy/cashiers/[id]/DELETE')
  if (!init.ok) {
    return NextResponse.json({ success: false, error: init.error || 'Server not configured' }, { status: 500 })
  }

  const { id } = await params
  const ctxResult = await getPharmacyAuthContext(auth.user, {})
  if (!ctxResult.success) {
    return NextResponse.json({ success: false, error: ctxResult.error }, { status: 403 })
  }

  const { hospitalId } = ctxResult.context
  const db = admin.firestore()
  const path = getPharmacyCollectionPath(hospitalId, 'cashiers')
  const ref = db.collection(path).doc(id)
  const snap = await ref.get()
  if (!snap.exists) {
    return NextResponse.json({ success: false, error: 'Cashier not found' }, { status: 404 })
  }

  // Soft delete: mark inactive
  await ref.update({ active: false, updatedAt: new Date().toISOString() })

  return NextResponse.json({ success: true })
}

