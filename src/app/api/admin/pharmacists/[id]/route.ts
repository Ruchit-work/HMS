import { NextRequest, NextResponse } from 'next/server'
import { admin, initFirebaseAdmin } from '@/server/firebaseAdmin'
import { authenticateRequest } from '@/utils/firebase/apiAuth'
import { getUserActiveHospitalId } from '@/utils/firebase/serverHospitalQueries'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const init = initFirebaseAdmin('api/admin/pharmacists/[id]/PATCH')
  if (!init.ok) {
    return NextResponse.json(
      { success: false, error: init.error || 'Server not configured' },
      { status: 500 },
    )
  }

  const auth = await authenticateRequest(request, 'admin')
  if (!auth.success || !auth.user) {
    return NextResponse.json(
      { success: false, error: auth.error || 'Unauthorized' },
      { status: auth.statusCode || 401 },
    )
  }

  const hospitalId = await getUserActiveHospitalId(auth.user.uid)
  if (!hospitalId) {
    return NextResponse.json(
      { success: false, error: 'Hospital not found' },
      { status: 400 },
    )
  }

  const { id } = await params
  const db = admin.firestore()
  const pharmaRef = db.collection('pharmacists').doc(id)
  const snap = await pharmaRef.get()
  if (!snap.exists) {
    return NextResponse.json(
      { success: false, error: 'Pharmacist not found' },
      { status: 404 },
    )
  }

  const data = snap.data() as { hospitalId?: string }
  if (data.hospitalId !== hospitalId) {
    return NextResponse.json(
      { success: false, error: 'Pharmacist does not belong to this hospital' },
      { status: 403 },
    )
  }

  const body = await request.json().catch(() => ({}))
  const { firstName, lastName, phone, branchId } = body as {
    firstName?: string
    lastName?: string
    phone?: string
    branchId?: string
  }

  const update: Record<string, unknown> = {}
  if (typeof firstName === 'string') update.firstName = firstName.trim()
  if (typeof lastName === 'string') update.lastName = lastName.trim()
  if (typeof phone === 'string') {
    const trimmed = phone.trim()
    update.phone = trimmed || null
    update.phoneNumber = trimmed || null
  }

  if (typeof branchId === 'string' && branchId.trim()) {
    const branchRef = db.collection('branches').doc(branchId.trim())
    const branchSnap = await branchRef.get()
    if (!branchSnap.exists) {
      return NextResponse.json(
        { success: false, error: 'Branch not found' },
        { status: 404 },
      )
    }
    const b = branchSnap.data() as { hospitalId?: string; name?: string }
    if (b.hospitalId !== hospitalId) {
      return NextResponse.json(
        { success: false, error: 'Branch does not belong to this hospital' },
        { status: 400 },
      )
    }
    update.branchId = branchRef.id
    update.branchName = b.name || ''
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json(
      { success: false, error: 'Nothing to update' },
      { status: 400 },
    )
  }

  update.updatedAt = new Date()
  await pharmaRef.update(update)

  // Also update basic name fields in users collection if present
  const userRef = db.collection('users').doc(id)
  const userSnap = await userRef.get()
  if (userSnap.exists) {
    const userUpdate: Record<string, unknown> = {}
    if (typeof firstName === 'string') userUpdate.firstName = firstName.trim()
    if (typeof lastName === 'string') userUpdate.lastName = lastName.trim()
    if (Object.keys(userUpdate).length > 0) {
      userUpdate.updatedAt = new Date()
      await userRef.update(userUpdate)
    }
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const init = initFirebaseAdmin('api/admin/pharmacists/[id]/DELETE')
  if (!init.ok) {
    return NextResponse.json(
      { success: false, error: init.error || 'Server not configured' },
      { status: 500 },
    )
  }

  const auth = await authenticateRequest(request, 'admin')
  if (!auth.success || !auth.user) {
    return NextResponse.json(
      { success: false, error: auth.error || 'Unauthorized' },
      { status: auth.statusCode || 401 },
    )
  }

  const hospitalId = await getUserActiveHospitalId(auth.user.uid)
  if (!hospitalId) {
    return NextResponse.json(
      { success: false, error: 'Hospital not found' },
      { status: 400 },
    )
  }

  const { id } = await params
  const db = admin.firestore()
  const pharmaRef = db.collection('pharmacists').doc(id)
  const snap = await pharmaRef.get()
  if (!snap.exists) {
    return NextResponse.json(
      { success: false, error: 'Pharmacist not found' },
      { status: 404 },
    )
  }

  const data = snap.data() as { hospitalId?: string }
  if (data.hospitalId !== hospitalId) {
    return NextResponse.json(
      { success: false, error: 'Pharmacist does not belong to this hospital' },
      { status: 403 },
    )
  }

  // Delete documents and auth user
  try {
    await pharmaRef.delete()
  } catch {
    // ignore, we'll still try to clean other data
  }

  try {
    await db.collection('users').doc(id).delete()
  } catch {
    // ignore if not present
  }

  try {
    await admin.auth().deleteUser(id)
  } catch {
    // user might already be deleted; ignore
  }

  return NextResponse.json({ success: true })
}

