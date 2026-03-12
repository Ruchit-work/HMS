import { NextRequest, NextResponse } from 'next/server'
import { admin, initFirebaseAdmin } from '@/server/firebaseAdmin'
import { authenticateRequest, createAuthErrorResponse } from '@/utils/firebase/apiAuth'
import { getPharmacyAuthContext, getPharmacyCollectionPath } from '@/utils/pharmacy/serverPharmacy'
import type { PharmacyExpense } from '@/types/pharmacy'

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.success || !auth.user) return createAuthErrorResponse(auth)

  const init = initFirebaseAdmin('pharmacy/expenses')
  if (!init.ok) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

  const { searchParams } = new URL(request.url)
  const hospitalIdParam = searchParams.get('hospitalId') || undefined
  const branchIdParam = searchParams.get('branchId') || undefined
  const categoryIdParam = searchParams.get('categoryId') || undefined
  const paymentMethodParam = searchParams.get('paymentMethod') || undefined
  const dateFromParam = searchParams.get('dateFrom') || undefined
  const dateToParam = searchParams.get('dateTo') || undefined

  const ctxResult = await getPharmacyAuthContext(auth.user, {
    hospitalId: hospitalIdParam,
    branchId: branchIdParam,
  })
  if (!ctxResult.success) {
    return NextResponse.json({ success: false, error: ctxResult.error }, { status: 403 })
  }

  const { hospitalId, branchId } = ctxResult.context
  const db = admin.firestore()
  const expPath = getPharmacyCollectionPath(hospitalId, 'expenses')
  let q: FirebaseFirestore.Query = db.collection(expPath)

  if (branchId) q = q.where('branchId', '==', branchId)
  if (categoryIdParam) q = q.where('categoryId', '==', categoryIdParam)
  if (paymentMethodParam) q = q.where('paymentMethod', '==', paymentMethodParam)

  // Do not add date range in Firestore query (avoids composite index). Filter by date in memory.
  const snap = await q.limit(500).get()
  let expenses = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as PharmacyExpense[]

  if (dateFromParam || dateToParam) {
    expenses = expenses.filter((e) => {
      const d = typeof e.date === 'string' ? e.date.slice(0, 10) : (e.date as { toDate?: () => Date })?.toDate?.()?.toISOString?.()?.slice(0, 10) ?? ''
      if (dateFromParam && d < dateFromParam) return false
      if (dateToParam && d > dateToParam) return false
      return true
    })
  }

  expenses.sort((a, b) => {
    const ad = typeof a.date === 'string' ? a.date.slice(0, 10) : (a.date as { toDate?: () => Date })?.toDate?.()?.toISOString?.()?.slice(0, 10) ?? ''
    const bd = typeof b.date === 'string' ? b.date.slice(0, 10) : (b.date as { toDate?: () => Date })?.toDate?.()?.toISOString?.()?.slice(0, 10) ?? ''
    return bd.localeCompare(ad)
  })

  return NextResponse.json({ success: true, expenses })
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.success || !auth.user) return createAuthErrorResponse(auth)

  const init = initFirebaseAdmin('pharmacy/expenses')
  if (!init.ok) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

  const body = await request.json().catch(() => ({}))
  const amount = Number(body?.amount) || 0
  const paymentMethodRaw = (body?.paymentMethod as string | undefined)?.toLowerCase()
  const paymentMethod = ['cash', 'upi', 'card', 'bank', 'other'].includes(paymentMethodRaw ?? '')
    ? (paymentMethodRaw as 'cash' | 'upi' | 'card' | 'bank' | 'other')
    : 'other'

  if (!amount || amount <= 0) {
    return NextResponse.json({ success: false, error: 'Amount must be greater than 0' }, { status: 400 })
  }

  const note = typeof body?.note === 'string' ? body.note.trim() : (typeof body?.description === 'string' ? body.description.trim() : '')
  if (!note) {
    return NextResponse.json({ success: false, error: 'Note is required (describe the expense)' }, { status: 400 })
  }

  const dateStr = (body?.date as string | undefined)?.slice(0, 10)
  if (!dateStr) {
    return NextResponse.json({ success: false, error: 'Date is required' }, { status: 400 })
  }

  const ctxResult = await getPharmacyAuthContext(auth.user, {
    hospitalId: body.hospitalId,
    branchId: body.branchId,
  })
  if (!ctxResult.success) {
    return NextResponse.json({ success: false, error: ctxResult.error }, { status: 403 })
  }

  const { hospitalId, branchId } = ctxResult.context
  if (!branchId) {
    return NextResponse.json({ success: false, error: 'Branch is required for expenses' }, { status: 400 })
  }

  const db = admin.firestore()
  const expPath = getPharmacyCollectionPath(hospitalId, 'expenses')
  const categoryId = body.categoryId as string | undefined
  let categoryName: string | undefined
  if (categoryId) {
    const catPath = getPharmacyCollectionPath(hospitalId, 'expenseCategories')
    const categorySnap = await db.collection(catPath).doc(categoryId).get()
    if (categorySnap.exists) {
      categoryName = (categorySnap.data() as { name?: string })?.name || undefined
    }
  }

  const ref = db.collection(expPath).doc()
  const now = new Date().toISOString()

  const expense: PharmacyExpense = {
    id: ref.id,
    hospitalId,
    branchId,
    date: dateStr,
    amount,
    paymentMethod: paymentMethod as PharmacyExpense['paymentMethod'],
    description: note,
    addedBy: auth.user.uid,
    receiptUrl: (body.receiptUrl as string | undefined) || null,
    createdAt: now,
  }
  if (categoryId) expense.categoryId = categoryId
  if (categoryName) expense.categoryName = categoryName

  const expenseNotes = body?.expenseNotes && typeof body.expenseNotes === 'object' ? body.expenseNotes as Record<string, number> : undefined

  // If paid by cash, update active session: deduct notes from drawer and increment cashExpenses
  if (paymentMethod === 'cash') {
    const sessionsPath = getPharmacyCollectionPath(hospitalId, 'cashSessions')
    const sessionSnap = await db
      .collection(sessionsPath)
      .where('cashierId', '==', auth.user.uid)
      .where('branchId', '==', branchId)
      .where('status', '==', 'open')
      .limit(1)
      .get()
    if (sessionSnap.empty) {
      return NextResponse.json({ success: false, error: 'No open cash session. Start a shift first to record cash expense.' }, { status: 400 })
    }
    if (!expenseNotes || typeof expenseNotes !== 'object') {
      return NextResponse.json({ success: false, error: 'For cash expense, enter notes/coins given from the drawer.' }, { status: 400 })
    }
    const sessionRef = sessionSnap.docs[0].ref
    const sessionData = sessionSnap.docs[0].data() as { runningNotes?: Record<string, number>; cashExpenses?: number }
    const denoms = ['500', '200', '100', '50', '20', '10', '5', '2', '1']
    const running = { ...(sessionData.runningNotes || {}) }
    if (expenseNotes) {
      denoms.forEach((d) => {
        const out = Number(expenseNotes[d]) || 0
        running[d] = Math.max(0, (Number(running[d]) || 0) - out)
      })
    }
    await db.runTransaction(async (tx) => {
      tx.set(ref, expense)
      tx.update(sessionRef, {
        runningNotes: running,
        cashExpenses: admin.firestore.FieldValue.increment(amount),
      })
    })
    return NextResponse.json({ success: true, expense })
  }

  await ref.set(expense)
  return NextResponse.json({ success: true, expense })
}

