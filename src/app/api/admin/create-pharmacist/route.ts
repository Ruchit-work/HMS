/**
 * API Route: Create Pharmacy User (Pharmacist)
 * Creates a new pharmacist and assigns them to the admin's hospital.
 * Admin only (regular admin or super admin).
 */

import { NextRequest, NextResponse } from 'next/server'
import admin from 'firebase-admin'
import { authenticateRequest } from '@/utils/firebase/apiAuth'
import { getUserActiveHospitalId } from '@/utils/firebase/serverHospitalQueries'
if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY || ''
  const privateKey = rawPrivateKey.replace(/^"|"$/g, '').replace(/\\n/g, '\n')
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  })
}

const db = admin.firestore()

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request, 'admin')
    if (!auth.success || !auth.user) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: auth.statusCode || 401 }
      )
    }

    const body = await request.json()
    const { email, password, firstName, lastName, branchId, phone } = body

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 6 characters' },
        { status: 400 }
      )
    }

    const adminHospitalId = await getUserActiveHospitalId(auth.user.uid)
    if (!adminHospitalId) {
      return NextResponse.json(
        { success: false, error: 'Hospital not found. Ensure you are assigned to a hospital.' },
        { status: 400 }
      )
    }

    const hospitalDoc = await db.collection('hospitals').doc(adminHospitalId).get()
    if (!hospitalDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'Hospital not found' },
        { status: 404 }
      )
    }

    const hospitalData = hospitalDoc.data()
    if (hospitalData?.status !== 'active') {
      return NextResponse.json(
        { success: false, error: 'Hospital is not active' },
        { status: 400 }
      )
    }

    let branchIdToUse = branchId || ''
    let branchName = ''

    if (branchIdToUse) {
      const branchDoc = await db.collection('branches').doc(branchIdToUse).get()
      if (!branchDoc.exists) {
        return NextResponse.json({ success: false, error: 'Branch not found' }, { status: 404 })
      }
      const b = branchDoc.data()!
      if (b.hospitalId !== adminHospitalId) {
        return NextResponse.json({ success: false, error: 'Branch does not belong to this hospital' }, { status: 400 })
      }
      branchName = b.name || ''
    } else {
      const branchesSnap = await db
        .collection('branches')
        .where('hospitalId', '==', adminHospitalId)
        .where('status', '==', 'active')
        .limit(1)
        .get()
      if (!branchesSnap.empty) {
        const d = branchesSnap.docs[0]
        branchIdToUse = d.id
        branchName = d.data().name || ''
      }
    }

    const emailNorm = email.trim().toLowerCase()
    let userRecord
    try {
      userRecord = await admin.auth().getUserByEmail(emailNorm)
      const existing = await db.collection('pharmacists').doc(userRecord.uid).get()
      if (existing.exists) {
        return NextResponse.json(
          { success: false, error: 'This email is already registered as a pharmacist' },
          { status: 400 }
        )
      }
    } catch (err: any) {
      if (err.code !== 'auth/user-not-found') throw err
      userRecord = await admin.auth().createUser({
        email: emailNorm,
        password,
        displayName: [firstName, lastName].filter(Boolean).join(' ') || emailNorm,
        disabled: false,
      })
    }

    const uid = userRecord.uid
    const now = new Date()

    await db.collection('pharmacists').doc(uid).set({
      email: emailNorm,
      firstName: firstName?.trim() || '',
      lastName: lastName?.trim() || '',
      hospitalId: adminHospitalId,
      branchId: branchIdToUse || null,
      branchName: branchName || null,
      phone: typeof phone === 'string' && phone.trim() ? phone.trim() : null,
      phoneNumber: typeof phone === 'string' && phone.trim() ? phone.trim() : null,
      createdAt: now,
      updatedAt: now,
      createdBy: auth.user.uid,
    })

    await db.collection('users').doc(uid).set(
      {
        uid,
        email: emailNorm,
        role: 'pharmacy',
        hospitals: [adminHospitalId],
        activeHospital: adminHospitalId,
        firstName: firstName?.trim() || '',
        lastName: lastName?.trim() || '',
        updatedAt: now,
      },
      { merge: true }
    )

    return NextResponse.json({
      success: true,
      message: 'Pharmacy user created successfully',
      pharmacistId: uid,
      email: emailNorm,
      /** Only returned on create; do not expose in production logs. */
      passwordSet: true,
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create pharmacy user' },
      { status: 500 }
    )
  }
}
