import { NextRequest, NextResponse } from 'next/server'
import { admin, initFirebaseAdmin } from '@/server/firebaseAdmin'
import { authenticateRequest, createAuthErrorResponse } from '@/utils/firebase/apiAuth'
import { getPharmacyAuthContext, getPharmacyCollectionPath } from '@/utils/pharmacy/serverPharmacy'
import type { PharmacyShift } from '@/types/pharmacy'

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.success || !auth.user) return createAuthErrorResponse(auth)

  const init = initFirebaseAdmin('pharmacy/shifts')
  if (!init.ok) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

  const { searchParams } = new URL(request.url)
  const hospitalIdParam = searchParams.get('hospitalId') || undefined

  const ctxResult = await getPharmacyAuthContext(auth.user, { hospitalId: hospitalIdParam })
  if (!ctxResult.success) {
    return NextResponse.json({ success: false, error: ctxResult.error }, { status: 403 })
  }

  const { hospitalId } = ctxResult.context
  const db = admin.firestore()
  const path = getPharmacyCollectionPath(hospitalId, 'shifts')
  const snap = await db.collection(path).get()
  const shifts = (snap.docs.map((d) => ({ id: d.id, ...d.data() })) as PharmacyShift[])
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

  return NextResponse.json({ success: true, shifts })
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.success || !auth.user) return createAuthErrorResponse(auth)

  const init = initFirebaseAdmin('pharmacy/shifts')
  if (!init.ok) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

  const body = await request.json().catch(() => ({}))
  const name = (body?.name as string)?.trim()
  const startTime = (body?.startTime as string)?.trim() || '09:00'
  const endTime = (body?.endTime as string)?.trim() || '17:00'

  if (!name) {
    return NextResponse.json({ success: false, error: 'Shift name is required' }, { status: 400 })
  }

  // Validate HH:mm
  const timeRe = /^([01]?\d|2[0-3]):([0-5]\d)$/
  if (!timeRe.test(startTime) || !timeRe.test(endTime)) {
    return NextResponse.json({ success: false, error: 'Times must be HH:mm (24h)' }, { status: 400 })
  }

  const ctxResult = await getPharmacyAuthContext(auth.user, { hospitalId: body.hospitalId })
  if (!ctxResult.success) {
    return NextResponse.json({ success: false, error: ctxResult.error }, { status: 403 })
  }

  const { hospitalId } = ctxResult.context
  const db = admin.firestore()
  const path = getPharmacyCollectionPath(hospitalId, 'shifts')
  const snap = await db.collection(path).get()
  const nextOrder = snap.size

  const ref = db.collection(path).doc()
  const now = new Date().toISOString()
  const shift: PharmacyShift = {
    id: ref.id,
    hospitalId,
    name,
    startTime,
    endTime,
    order: nextOrder,
    createdAt: now,
    updatedAt: now,
  }

  await ref.set(shift)
  return NextResponse.json({ success: true, shift })
}
