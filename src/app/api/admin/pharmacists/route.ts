/**
 * GET: List pharmacy users (pharmacists) for the admin's hospital
 * Admin only.
 */

import { NextRequest, NextResponse } from 'next/server'
import { admin, initFirebaseAdmin } from '@/server/firebaseAdmin'
import { authenticateRequest } from '@/utils/firebase/apiAuth'
import { getUserActiveHospitalId } from '@/utils/firebase/serverHospitalQueries'

export async function GET(request: NextRequest) {
  try {
    const init = initFirebaseAdmin('api/admin/pharmacists')
    if (!init.ok) {
      return NextResponse.json(
        { success: false, error: init.error || 'Server not configured' },
        { status: 500 }
      )
    }

    const auth = await authenticateRequest(request, 'admin')
    if (!auth.success || !auth.user) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: auth.statusCode || 401 }
      )
    }

    const hospitalId = await getUserActiveHospitalId(auth.user.uid)
    if (!hospitalId) {
      return NextResponse.json(
        { success: false, error: 'Hospital not found' },
        { status: 400 }
      )
    }

    const db = admin.firestore()
    const snap = await db
      .collection('pharmacists')
      .where('hospitalId', '==', hospitalId)
      .get()

    const pharmacists = snap.docs.map((d) => {
      const data = d.data()
      return {
        id: d.id,
        email: data?.email ?? '',
        firstName: data?.firstName ?? '',
        lastName: data?.lastName ?? '',
        branchId: data?.branchId ?? null,
        branchName: data?.branchName ?? '',
        createdAt: data?.createdAt?.toDate?.()?.toISOString?.() ?? data?.createdAt ?? null,
      }
    })

    return NextResponse.json({ success: true, pharmacists })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to list pharmacists'
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
