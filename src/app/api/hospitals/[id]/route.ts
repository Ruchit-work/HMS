/**
 * API Route: Update/Delete Hospital
 * Updates or deletes a hospital (Super Admin only)
 */

import { NextRequest, NextResponse } from 'next/server'
import admin from 'firebase-admin'
import { verifyAuthToken } from '@/shared/utils/firebase/apiAuth'

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY || ''
  const privateKey = rawPrivateKey
    .replace(/^"|"$/g, '')
    .replace(/\\n/g, '\n')

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    })
  })
}

const db = admin.firestore()

/**
 * PUT /api/hospitals/[id]
 * Update a hospital
 */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: hospitalId } = await context.params
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const authData = await verifyAuthToken(token)
    
    if (!authData) {
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 401 }
      )
    }

    // Verify user is super admin
    const userDoc = await db.collection('users').doc(authData.uid).get()
    if (!userDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    const userData = userDoc.data()
    if (userData?.role !== 'super_admin') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Super Admin access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { name, code, address, phone, email, status, multipleBranchesEnabled, enableAnalytics, enablePharmacy } = body

    // Verify hospital exists
    const hospitalRef = db.collection('hospitals').doc(hospitalId)
    const hospitalDoc = await hospitalRef.get()
    
    if (!hospitalDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'Hospital not found' },
        { status: 404 }
      )
    }

    // Check if code is being changed and if new code already exists
    if (code && code !== hospitalDoc.data()?.code) {
      const existingCode = await db.collection('hospitals')
        .where('code', '==', code)
        .get()
      
      if (!existingCode.empty) {
        return NextResponse.json(
          { success: false, error: 'Hospital code already exists' },
          { status: 400 }
        )
      }
    }

    // Update hospital
    const updateData: any = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }

    if (name) updateData.name = name
    if (code) updateData.code = code
    if (address) updateData.address = address
    if (phone) updateData.phone = phone
    if (email) updateData.email = email
    if (status) updateData.status = status
    if (typeof multipleBranchesEnabled === 'boolean') updateData.multipleBranchesEnabled = multipleBranchesEnabled
    if (typeof enableAnalytics === 'boolean') updateData.enableAnalytics = enableAnalytics
    if (typeof enablePharmacy === 'boolean') updateData.enablePharmacy = enablePharmacy

    await hospitalRef.update(updateData)

    // Get updated hospital data
    const updatedDoc = await hospitalRef.get()

    return NextResponse.json({
      success: true,
      hospital: {
        id: updatedDoc.id,
        ...updatedDoc.data()
      }
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update hospital' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/hospitals/[id]
 * Delete a hospital (sets status to inactive)
 */
async function deleteQueryBatch(query: admin.firestore.Query): Promise<number> {
  const snapshot = await query.limit(500).get()
  if (snapshot.size === 0) return 0

  const batch = db.batch()
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref)
  })
  await batch.commit()

  if (snapshot.size === 500) {
    const nextCount = await deleteQueryBatch(query)
    return snapshot.size + nextCount
  }
  return snapshot.size
}

/**
 * DELETE /api/hospitals/[id]
 * Permanently delete a hospital and all associated data, users, and subcollections (Super Admin only)
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: hospitalId } = await context.params
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const authData = await verifyAuthToken(token)

    if (!authData) {
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 401 }
      )
    }

    // Verify user is super admin
    const userDoc = await db.collection('users').doc(authData.uid).get()
    if (!userDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    const userData = userDoc.data()
    if (userData?.role !== 'super_admin') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Super Admin access required' },
        { status: 403 }
      )
    }

    // Verify hospital exists
    const hospitalRef = db.collection('hospitals').doc(hospitalId)
    const hospitalDoc = await hospitalRef.get()

    if (!hospitalDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'Hospital not found' },
        { status: 404 }
      )
    }

    const hospitalData = hospitalDoc.data() || {}
    const hospitalName = hospitalData.name || 'Hospital'
    const hospitalCode = hospitalData.code || hospitalId

    // 1. Collect all users associated with this hospital
    const [usersByHospId, usersByActiveHospId, usersByHospIds] = await Promise.all([
      db.collection('users').where('hospitalId', '==', hospitalId).get().catch(() => ({ docs: [] })),
      db.collection('users').where('activeHospitalId', '==', hospitalId).get().catch(() => ({ docs: [] })),
      db.collection('users').where('hospitalIds', 'array-contains', hospitalId).get().catch(() => ({ docs: [] })),
    ])

    const userMap = new Map<string, admin.firestore.QueryDocumentSnapshot>()
    usersByHospId.docs.forEach((doc) => userMap.set(doc.id, doc))
    usersByActiveHospId.docs.forEach((doc) => userMap.set(doc.id, doc))
    usersByHospIds.docs.forEach((doc) => userMap.set(doc.id, doc))

    let deletedAuthUsersCount = 0
    let deletedFirestoreUsersCount = 0

    // 2. Delete Firebase Auth users & Firestore user docs
    for (const [uid, uDoc] of userMap.entries()) {
      const uData = uDoc.data() || {}
      // Skip super admins from deletion
      if (uData.role === 'super_admin' || uData.isSuperAdmin === true) {
        continue
      }

      const otherHospitals = (uData.hospitalIds || []).filter((hId: string) => hId !== hospitalId)
      if (otherHospitals.length > 0) {
        await uDoc.ref.update({
          hospitalIds: admin.firestore.FieldValue.arrayRemove(hospitalId),
          activeHospitalId: uData.activeHospitalId === hospitalId ? (otherHospitals[0] || null) : uData.activeHospitalId,
          hospitalId: uData.hospitalId === hospitalId ? (otherHospitals[0] || null) : uData.hospitalId,
        }).catch(() => {})
      } else {
        try {
          await admin.auth().deleteUser(uid)
          deletedAuthUsersCount++
        } catch (authErr: any) {
          console.warn(`[Delete Hospital] Auth user ${uid} delete warning:`, authErr.message)
        }

        await uDoc.ref.delete().catch(() => {})
        deletedFirestoreUsersCount++
      }
    }

    // 3. Delete root level collections referencing this hospitalId
    const rootCollectionsToDelete = [
      'patients',
      'appointments',
      'admissions',
      'billing',
      'invoices',
      'rooms',
      'beds',
      'doctors',
      'receptionists',
      'admins',
      'nurses',
      'pharmacists',
      'lab_staff',
      'staff',
      'audit_logs',
      'auditLogs',
      'whatsapp_bookings',
      'campaigns',
      'expenses',
      'prescriptions',
      'medical_records',
      'lab_records',
      'pharmacy',
      'inventory',
      'branches',
      'departments',
      'notifications',
      'bhash_outbound_recent',
      'bhash_inbound_recent',
      'bhash_booking_recent',
    ]

    const rootDeletionCounts: Record<string, number> = {}
    for (const collName of rootCollectionsToDelete) {
      try {
        const q = db.collection(collName).where('hospitalId', '==', hospitalId)
        const count = await deleteQueryBatch(q)
        if (count > 0) {
          rootDeletionCounts[collName] = count
        }
      } catch (err: any) {
        console.warn(`[Delete Hospital] Root collection ${collName} cleanup warning:`, err.message)
      }
    }

    // 4. Delete hospital document AND all nested subcollections recursively
    try {
      await db.recursiveDelete(hospitalRef)
    } catch (recErr: any) {
      console.warn(`[Delete Hospital] Recursive delete fallback:`, recErr.message)
      await hospitalRef.delete().catch(() => {})
    }

    return NextResponse.json({
      success: true,
      message: `Hospital ${hospitalName} (${hospitalCode}) and all associated data deleted permanently.`,
      summary: {
        hospitalId,
        hospitalName,
        hospitalCode,
        deletedAuthUsersCount,
        deletedFirestoreUsersCount,
        rootDeletionCounts,
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete hospital' },
      { status: 500 }
    )
  }
}

