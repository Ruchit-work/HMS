import { NextRequest, NextResponse } from 'next/server'
import { admin, initFirebaseAdmin } from '@/server/firebaseAdmin'
import { authenticateRequest, createAuthErrorResponse } from '@/utils/firebase/apiAuth'
import { getPharmacyAuthContext, getPharmacyCollectionPath } from '@/utils/pharmacy/serverPharmacy'
import type { PharmacyCounter } from '@/types/pharmacy'

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.success || !auth.user) return createAuthErrorResponse(auth)

  const init = initFirebaseAdmin('pharmacy/counters')
  if (!init.ok) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

  const { searchParams } = new URL(request.url)
  const hospitalIdParam = searchParams.get('hospitalId') || undefined
  const branchIdParam = searchParams.get('branchId') || undefined

  const ctxResult = await getPharmacyAuthContext(auth.user, {
    hospitalId: hospitalIdParam,
    branchId: branchIdParam || undefined,
  })
  if (!ctxResult.success) {
    return NextResponse.json({ success: false, error: ctxResult.error }, { status: 403 })
  }

  const { hospitalId, branchId } = ctxResult.context
  const db = admin.firestore()
  const path = getPharmacyCollectionPath(hospitalId, 'counters')

  const base = db.collection(path).where('active', '==', true)
  let counters: PharmacyCounter[] = []
  if (branchId) {
    const [branchSnap, allSnap] = await Promise.all([
      base.where('branchId', '==', branchId).get(),
      base.where('branchId', '==', 'all').get(),
    ])
    const docs = [...branchSnap.docs, ...allSnap.docs]
    counters = docs
      .map((d) => ({ id: d.id, ...d.data() } as PharmacyCounter))
      .sort((a, b) => a.name.localeCompare(b.name))
  } else {
    const snap = await base.orderBy('name').get()
    counters = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as PharmacyCounter[]
  }

  return NextResponse.json({ success: true, counters })
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.success || !auth.user) return createAuthErrorResponse(auth)

  const init = initFirebaseAdmin('pharmacy/counters')
  if (!init.ok) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

  const body = await request.json().catch(() => ({}))
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const branchIdRaw = typeof body?.branchId === 'string' ? body.branchId.trim() : 'all'

  if (!name) {
    return NextResponse.json({ success: false, error: 'Counter name is required' }, { status: 400 })
  }

  const ctxResult = await getPharmacyAuthContext(auth.user, {})
  if (!ctxResult.success) {
    return NextResponse.json({ success: false, error: ctxResult.error }, { status: 403 })
  }

  const { hospitalId, branchId: userBranchId } = ctxResult.context
  const branchId = branchIdRaw || userBranchId || 'all'

  const db = admin.firestore()
  const path = getPharmacyCollectionPath(hospitalId, 'counters')
  const ref = db.collection(path).doc()
  const now = new Date().toISOString()

  const data: Omit<PharmacyCounter, 'id'> = {
    hospitalId,
    branchId,
    name,
    active: true,
    createdAt: now,
  }

  await ref.set(data)

  return NextResponse.json({ success: true, counter: { id: ref.id, ...data } })
}

