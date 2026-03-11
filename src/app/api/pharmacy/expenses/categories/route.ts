import { NextRequest, NextResponse } from 'next/server'
import { admin, initFirebaseAdmin } from '@/server/firebaseAdmin'
import { authenticateRequest, createAuthErrorResponse } from '@/utils/firebase/apiAuth'
import { getPharmacyAuthContext, getPharmacyCollectionPath } from '@/utils/pharmacy/serverPharmacy'
import type { PharmacyExpenseCategory } from '@/types/pharmacy'

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.success || !auth.user) return createAuthErrorResponse(auth)

  const init = initFirebaseAdmin('pharmacy/expenses/categories')
  if (!init.ok) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

  const { searchParams } = new URL(request.url)
  const hospitalIdParam = searchParams.get('hospitalId') || undefined

  const ctxResult = await getPharmacyAuthContext(auth.user, {
    hospitalId: hospitalIdParam,
    branchId: undefined,
  })
  if (!ctxResult.success) {
    return NextResponse.json({ success: false, error: ctxResult.error }, { status: 403 })
  }

  const { hospitalId } = ctxResult.context
  const db = admin.firestore()
  const catPath = getPharmacyCollectionPath(hospitalId, 'expenseCategories')
  const snap = await db.collection(catPath).where('active', '==', true).get()
  const categories = (snap.docs.map((d) => ({ id: d.id, ...d.data() })) as PharmacyExpenseCategory[])
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  return NextResponse.json({ success: true, categories })
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.success || !auth.user) return createAuthErrorResponse(auth)

  // Only admins can create categories
  if ((auth.user as any)?.role !== 'admin') {
    return NextResponse.json({ success: false, error: 'Only admin can create categories' }, { status: 403 })
  }

  const init = initFirebaseAdmin('pharmacy/expenses/categories')
  if (!init.ok) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

  const body = await request.json().catch(() => ({}))
  const name = (body?.name as string | undefined)?.trim()
  if (!name) {
    return NextResponse.json({ success: false, error: 'Category name is required' }, { status: 400 })
  }

  const ctxResult = await getPharmacyAuthContext(auth.user, {
    hospitalId: body.hospitalId,
    branchId: undefined,
  })
  if (!ctxResult.success) {
    return NextResponse.json({ success: false, error: ctxResult.error }, { status: 403 })
  }

  const { hospitalId } = ctxResult.context
  const db = admin.firestore()
  const catPath = getPharmacyCollectionPath(hospitalId, 'expenseCategories')
  const ref = db.collection(catPath).doc()
  const now = new Date().toISOString()
  const category: PharmacyExpenseCategory = {
    id: ref.id,
    hospitalId,
    name,
    active: true,
    createdAt: now,
    createdBy: auth.user.uid,
  }
  await ref.set(category)
  return NextResponse.json({ success: true, category })
}

