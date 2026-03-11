import { NextRequest, NextResponse } from 'next/server'
import { admin, initFirebaseAdmin } from '@/server/firebaseAdmin'
import { authenticateRequest, createAuthErrorResponse } from '@/utils/firebase/apiAuth'
import { getPharmacyAuthContext, getPharmacyCollectionPath } from '@/utils/pharmacy/serverPharmacy'
import type { PharmacyCashSession } from '@/types/pharmacy'

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.success || !auth.user) return createAuthErrorResponse(auth)

  const init = initFirebaseAdmin('pharmacy/cash-session')
  if (!init.ok) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

  const { searchParams } = new URL(request.url)
  const hospitalIdParam = searchParams.get('hospitalId') || undefined
  const branchIdParam = searchParams.get('branchId') || undefined

  const ctxResult = await getPharmacyAuthContext(auth.user, {
    hospitalId: hospitalIdParam,
    branchId: branchIdParam,
  })
  if (!ctxResult.success) {
    return NextResponse.json({ success: false, error: ctxResult.error }, { status: 403 })
  }

  const { hospitalId, branchId } = ctxResult.context
  const db = admin.firestore()
  const sessionsPath = getPharmacyCollectionPath(hospitalId, 'cashSessions')
  let q = db.collection(sessionsPath).where('cashierId', '==', auth.user.uid)
  if (branchId) q = q.where('branchId', '==', branchId)

  const snap = await q.limit(50).get()
  const sessions = (snap.docs.map((d) => ({ id: d.id, ...d.data() })) as PharmacyCashSession[])
    .sort((a, b) => {
      const at = typeof a.openedAt === 'string' ? new Date(a.openedAt).getTime() : (a.openedAt as { toDate?: () => Date })?.toDate?.()?.getTime() ?? 0
      const bt = typeof b.openedAt === 'string' ? new Date(b.openedAt).getTime() : (b.openedAt as { toDate?: () => Date })?.toDate?.()?.getTime() ?? 0
      return bt - at
    })
    .slice(0, 20)
  const active = sessions.find((s) => s.status === 'open')

  return NextResponse.json({ success: true, activeSession: active ?? null, recentSessions: sessions })
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.success || !auth.user) return createAuthErrorResponse(auth)

  const init = initFirebaseAdmin('pharmacy/cash-session')
  if (!init.ok) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

  const body = await request.json().catch(() => ({}))
  const action = body?.action as 'open' | 'close' | undefined
  if (!action) {
    return NextResponse.json({ success: false, error: 'Missing action' }, { status: 400 })
  }

  const ctxResult = await getPharmacyAuthContext(auth.user, {
    hospitalId: body.hospitalId,
    branchId: body.branchId,
  })
  if (!ctxResult.success) {
    return NextResponse.json({ success: false, error: ctxResult.error }, { status: 403 })
  }

  const { hospitalId, branchId } = ctxResult.context
  const db = admin.firestore()
  const sessionsPath = getPharmacyCollectionPath(hospitalId, 'cashSessions')

  if (action === 'open') {
    const openingNotes = (body.openingNotes || {}) as Record<string, number>
    const openingCashTotal = Number(body.openingCashTotal) || 0
    const openedByName = typeof body.openedByName === 'string' ? body.openedByName.trim() || undefined : undefined
    const now = new Date().toISOString()
    const ref = db.collection(sessionsPath).doc()
    const session: PharmacyCashSession = {
      id: ref.id,
      hospitalId,
      branchId: branchId || 'all',
      cashierId: auth.user.uid,
      openedAt: now,
      openingCashTotal,
      openingNotes,
      status: 'open',
      runningNotes: { ...openingNotes },
      cashSales: 0,
      upiSales: 0,
      cardSales: 0,
      refunds: 0,
      changeGiven: 0,
    }
    if (openedByName) session.openedByName = openedByName
    await ref.set(session)
    return NextResponse.json({ success: true, session })
  }

  if (action === 'close') {
    const sessionId = body.sessionId as string | undefined
    if (!sessionId) {
      return NextResponse.json({ success: false, error: 'Missing sessionId' }, { status: 400 })
    }
    const ref = db.collection(sessionsPath).doc(sessionId)
    const snap = await ref.get()
    if (!snap.exists) {
      return NextResponse.json({ success: false, error: 'Session not found' }, { status: 404 })
    }
    const data = snap.data() as PharmacyCashSession
    if (data.cashierId !== auth.user.uid) {
      return NextResponse.json({ success: false, error: 'Cannot close session opened by another user' }, { status: 403 })
    }

    const closingNotes = (body.closingNotes || {}) as Record<string, number>
    const closingCashTotal = Number(body.closingCashTotal) || 0
    const closedByName = typeof body.closedByName === 'string' ? body.closedByName.trim() || undefined : undefined
    const metrics = {
      cashSales: Number(body.cashSales) || 0,
      upiSales: Number(body.upiSales) || 0,
      cardSales: Number(body.cardSales) || 0,
      refunds: Number(body.refunds) || 0,
      changeGiven: Number(data.changeGiven) ?? Number(body.changeGiven) ?? 0,
    }
    const cashRefunds = body.cashRefunds !== undefined ? Number(body.cashRefunds) : metrics.refunds
    const cashExpenses = Number(data.cashExpenses) || 0
    const expectedCash =
      (data.openingCashTotal || 0) +
      metrics.cashSales -
      cashRefunds -
      metrics.changeGiven -
      cashExpenses
    const difference = closingCashTotal - expectedCash
    let status: PharmacyCashSession['status'] = 'balanced'
    if (Math.abs(difference) >= 0.01) {
      status = difference < 0 ? 'short' : 'extra'
    }
    const now = new Date().toISOString()

    await ref.update({
      ...metrics,
      cashExpenses,
      closingNotes,
      closingCashTotal,
      expectedCash,
      difference,
      status,
      closedAt: now,
      ...(closedByName != null && { closedByName }),
    })

    return NextResponse.json({
      success: true,
      session: {
        ...data,
        ...metrics,
        cashExpenses,
        closingNotes,
        closingCashTotal,
        expectedCash,
        difference,
        status,
        closedAt: now,
        ...(closedByName != null && { closedByName }),
      } as PharmacyCashSession,
    })
  }

  return NextResponse.json({ success: false, error: 'Unsupported action' }, { status: 400 })
}

