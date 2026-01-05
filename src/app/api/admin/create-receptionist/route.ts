/**
 * API Route: Create Receptionist
 * Creates a new receptionist user and assigns them to the admin's hospital
 * Regular Admin only (not super admin)
 */

import { NextRequest, NextResponse } from 'next/server'
import admin from 'firebase-admin'
import { authenticateRequest } from '@/utils/apiAuth'
import { getUserActiveHospitalId } from '@/utils/serverHospitalQueries'

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

export async function POST(request: NextRequest) {
  try {
    // Authenticate request - requires admin role
    const auth = await authenticateRequest(request)
    if (!auth.success || !auth.user) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: auth.statusCode || 401 }
      )
    }

    // Verify user is a regular admin (not super admin)
    const userDoc = await db.collection('users').doc(auth.user.uid).get()
    if (!userDoc.exists) {
      // Fallback: Check admins collection
      const adminDoc = await db.collection('admins').doc(auth.user.uid).get()
      if (!adminDoc.exists) {
        return NextResponse.json(
          { success: false, error: 'User not found' },
          { status: 404 }
        )
      }
      const adminData = adminDoc.data()
      if (adminData?.isSuperAdmin === true || adminData?.role === 'super_admin') {
        return NextResponse.json(
          { success: false, error: 'Forbidden: Super admins cannot create receptionists. Please use a regular admin account.' },
          { status: 403 }
        )
      }
    } else {
      const userData = userDoc.data()
      if (userData?.role === 'super_admin') {
        return NextResponse.json(
          { success: false, error: 'Forbidden: Super admins cannot create receptionists. Please use a regular admin account.' },
          { status: 403 }
        )
      }
      if (userData?.role !== 'admin') {
        return NextResponse.json(
          { success: false, error: 'Forbidden: Admin access required' },
          { status: 403 }
        )
      }
    }

    const body = await request.json()
    const { receptionistData, password } = body

    // Validate required fields
    if (!receptionistData?.email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required' },
        { status: 400 }
      )
    }

    if (!receptionistData?.firstName || !receptionistData?.lastName) {
      return NextResponse.json(
        { success: false, error: 'First name and last name are required' },
        { status: 400 }
      )
    }

    if (!receptionistData?.phone) {
      return NextResponse.json(
        { success: false, error: 'Phone number is required' },
        { status: 400 }
      )
    }

    if (!receptionistData?.branchId) {
      return NextResponse.json(
        { success: false, error: 'Branch assignment is required' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 6 characters' },
        { status: 400 }
      )
    }

    // Get admin's hospital ID - receptionist belongs to admin's hospital
    const adminHospitalId = await getUserActiveHospitalId(auth.user.uid)
    if (!adminHospitalId) {
      return NextResponse.json(
        { success: false, error: 'Admin hospital not found. Please ensure you are assigned to a hospital.' },
        { status: 400 }
      )
    }

    // Verify hospital exists and is active
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

    // Verify branch exists and belongs to the hospital
    const branchDoc = await db.collection('branches').doc(receptionistData.branchId).get()
    if (!branchDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'Branch not found' },
        { status: 404 }
      )
    }

    const branchData = branchDoc.data()
    if (branchData?.hospitalId !== adminHospitalId) {
      return NextResponse.json(
        { success: false, error: 'Branch does not belong to this hospital' },
        { status: 400 }
      )
    }

    if (branchData?.status !== 'active') {
      return NextResponse.json(
        { success: false, error: 'Branch is not active' },
        { status: 400 }
      )
    }

    // Check if user already exists
    let userRecord
    try {
      userRecord = await admin.auth().getUserByEmail(receptionistData.email.trim().toLowerCase())
      // User exists, check if already a receptionist
      const existingReceptionistDoc = await db.collection('receptionists').doc(userRecord.uid).get()
      if (existingReceptionistDoc.exists) {
        return NextResponse.json(
          { success: false, error: 'This email is already registered as a receptionist' },
          { status: 400 }
        )
      }
    } catch (error: any) {
      if (error.code !== 'auth/user-not-found') {
        throw error
      }
      // User doesn't exist, create new one
      userRecord = await admin.auth().createUser({
        email: receptionistData.email.trim().toLowerCase(),
        password: password,
        displayName: `${receptionistData.firstName} ${receptionistData.lastName}`,
        disabled: false
      })
    }

    const receptionistUid = userRecord.uid

    // Create receptionist document in receptionists collection
    await db.collection('receptionists').doc(receptionistUid).set({
      email: receptionistData.email.trim().toLowerCase(),
      firstName: receptionistData.firstName,
      lastName: receptionistData.lastName,
      phone: receptionistData.phone,
      hospitalId: adminHospitalId,
      branchId: receptionistData.branchId,
      branchName: branchData?.name || '',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: auth.user.uid
    })

    // Create or update user document in users collection
    await db.collection('users').doc(receptionistUid).set({
      uid: receptionistUid,
      email: receptionistData.email.trim().toLowerCase(),
      role: 'receptionist',
      hospitals: [adminHospitalId],
      activeHospital: adminHospitalId,
      firstName: receptionistData.firstName,
      lastName: receptionistData.lastName,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true })

    return NextResponse.json({
      success: true,
      message: 'Receptionist created successfully',
      receptionistId: receptionistUid
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create receptionist' },
      { status: 500 }
    )
  }
}

