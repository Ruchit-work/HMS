import { NextRequest, NextResponse } from 'next/server'
import { admin, initFirebaseAdmin } from '@/server/firebaseAdmin'
import { authenticateRequest, createAuthErrorResponse } from '@/utils/firebase/apiAuth'
import { getPharmacyAuthContext, getPharmacyCollectionPath } from '@/utils/pharmacy/serverPharmacy'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ shiftId: string }> }
) {
  const auth = await authenticateRequest(request)
  if (!auth.success || !auth.user) return createAuthErrorResponse(auth)

  const init = initFirebaseAdmin('pharmacy/shifts')
  if (!init.ok) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

  const { shiftId } = await params
  if (!shiftId) {
    return NextResponse.json({ success: false, error: 'Shift ID required' }, { status: 400 })
  }

  const body = await request.json().catch(() => ({}))
  const name = (body?.name as string)?.trim()
  const startTime = (body?.startTime as string)?.trim()
  const endTime = (body?.endTime as string)?.trim()

  const timeRe = /^([01]?\d|2[0-3]):([0-5]\d)$/
  if (startTime !== undefined && !timeRe.test(startTime)) {
    return NextResponse.json({ success: false, error: 'startTime must be HH:mm (24h)' }, { status: 400 })
  }
  if (endTime !== undefined && !timeRe.test(endTime)) {
    return NextResponse.json({ success: false, error: 'endTime must be HH:mm (24h)' }, { status: 400 })
  }

  const ctxResult = await getPharmacyAuthContext(auth.user, { hospitalId: body.hospitalId })
  if (!ctxResult.success) {
    return NextResponse.json({ success: false, error: ctxResult.error }, { status: 403 })
  }

  const { hospitalId } = ctxResult.context
  const db = admin.firestore()
  const path = getPharmacyCollectionPath(hospitalId, 'shifts')
  const ref = db.collection(path).doc(shiftId)
  const doc = await ref.get()
  if (!doc.exists) {
    return NextResponse.json({ success: false, error: 'Shift not found' }, { status: 404 })
  }

  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() }
  if (name !== undefined) updates.name = name
  if (startTime !== undefined) updates.startTime = startTime
  if (endTime !== undefined) updates.endTime = endTime

  await ref.update(updates)
  const updated = (await ref.get()).data()
  return NextResponse.json({ success: true, shift: { id: shiftId, ...updated } })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ shiftId: string }> }
) {
  const auth = await authenticateRequest(request)
  if (!auth.success || !auth.user) return createAuthErrorResponse(auth)

  const init = initFirebaseAdmin('pharmacy/shifts')
  if (!init.ok) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

  const { shiftId } = await params
  if (!shiftId) {
    return NextResponse.json({ success: false, error: 'Shift ID required' }, { status: 400 })
  }

  const { searchParams } = new URL(request.url)
  const hospitalIdParam = searchParams.get('hospitalId') || undefined

  const ctxResult = await getPharmacyAuthContext(auth.user, { hospitalId: hospitalIdParam })
  if (!ctxResult.success) {
    return NextResponse.json({ success: false, error: ctxResult.error }, { status: 403 })
  }

  const { hospitalId } = ctxResult.context
  const db = admin.firestore()
  const path = getPharmacyCollectionPath(hospitalId, 'shifts')
  const ref = db.collection(path).doc(shiftId)
  const doc = await ref.get()
  if (!doc.exists) {
    return NextResponse.json({ success: false, error: 'Shift not found' }, { status: 404 })
  }

  await ref.delete()
  return NextResponse.json({ success: true })
}
