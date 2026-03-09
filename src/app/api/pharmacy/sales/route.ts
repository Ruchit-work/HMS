/**
 * GET: List pharmacy sales (dispensation records) – date, patient/customer name, medicines
 */

import { NextRequest, NextResponse } from 'next/server'
import { admin, initFirebaseAdmin } from '@/server/firebaseAdmin'
import { authenticateRequest, createAuthErrorResponse } from '@/utils/firebase/apiAuth'
import { getPharmacyAuthContext, getPharmacyCollectionPath } from '@/utils/pharmacy/serverPharmacy'
import type { PharmacySale } from '@/types/pharmacy'

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.success || !auth.user) return createAuthErrorResponse(auth)

  const init = initFirebaseAdmin('pharmacy/sales')
  if (!init.ok) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

  const { searchParams } = new URL(request.url)
  const hospitalIdParam = searchParams.get('hospitalId') || undefined
  const branchIdParam = searchParams.get('branchId') || undefined
  const limit = Math.min(500, Math.max(1, parseInt(searchParams.get('limit') || '100', 10)))

  const ctxResult = await getPharmacyAuthContext(auth.user, {
    hospitalId: hospitalIdParam,
    branchId: branchIdParam,
  })
  if (!ctxResult.success) return NextResponse.json({ success: false, error: ctxResult.error }, { status: 403 })

  const db = admin.firestore()
  const salesPath = getPharmacyCollectionPath(ctxResult.context.hospitalId, 'sales')
  let snap
  if (ctxResult.context.branchId) {
    snap = await db.collection(salesPath).where('branchId', '==', ctxResult.context.branchId).limit(limit).get()
  } else {
    snap = await db.collection(salesPath).orderBy('dispensedAt', 'desc').limit(limit).get()
  }
  let sales: PharmacySale[] = snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as PharmacySale[]
  if (ctxResult.context.branchId) {
    sales = sales.sort((a, b) => {
      const aVal = typeof a.dispensedAt === 'string' ? a.dispensedAt : (a.dispensedAt as { toDate?: () => Date })?.toDate?.()?.toISOString?.() ?? ''
      const bVal = typeof b.dispensedAt === 'string' ? b.dispensedAt : (b.dispensedAt as { toDate?: () => Date })?.toDate?.()?.toISOString?.() ?? ''
      return bVal.localeCompare(aVal)
    })
  }
  return NextResponse.json({ success: true, sales })
}
