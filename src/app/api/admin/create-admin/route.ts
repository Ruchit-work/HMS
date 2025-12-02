/**
 * API Route: Create Admin
 * Creates a new admin user and assigns them to a hospital
 * Super Admin only
 */

import { NextRequest, NextResponse } from 'next/server'
import admin from 'firebase-admin'
import { authenticateRequest } from '@/utils/apiAuth'

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
    // Authenticate request - requires super admin
    const auth = await authenticateRequest(request)
    if (!auth.success || !auth.user) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: auth.statusCode || 401 }
      )
    }

    // Verify user is super admin - check users collection first, then admins collection
    const userDoc = await db.collection('users').doc(auth.user.uid).get()
    let isSuperAdmin = false

    if (userDoc.exists) {
      const userData = userDoc.data()
      isSuperAdmin = userData?.role === 'super_admin'
    }

    // Fallback: Check admins collection
    if (!isSuperAdmin) {
      const adminDoc = await db.collection('admins').doc(auth.user.uid).get()
      if (adminDoc.exists) {
        const adminData = adminDoc.data()
        isSuperAdmin = adminData?.isSuperAdmin === true
      }
    }

    if (!isSuperAdmin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Super Admin access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { adminData, password, hospitalId } = body

    // Validate required fields
    if (!adminData?.email || !password || !hospitalId) {
      return NextResponse.json(
        { success: false, error: 'Email, password, and hospitalId are required' },
        { status: 400 }
      )
    }

    if (!adminData?.firstName || !adminData?.lastName) {
      return NextResponse.json(
        { success: false, error: 'First name and last name are required' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 6 characters' },
        { status: 400 }
      )
    }

    // Verify hospital exists
    const hospitalDoc = await db.collection('hospitals').doc(hospitalId).get()
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

    // Check if user already exists
    let userRecord
    try {
      userRecord = await admin.auth().getUserByEmail(adminData.email.trim().toLowerCase())
      // User exists, check if already an admin
      const existingAdminDoc = await db.collection('admins').doc(userRecord.uid).get()
      if (existingAdminDoc.exists) {
        return NextResponse.json(
          { success: false, error: 'This email is already registered as an admin' },
          { status: 400 }
        )
      }
    } catch (error: any) {
      if (error.code !== 'auth/user-not-found') {
        throw error
      }
      // User doesn't exist, create new one
      userRecord = await admin.auth().createUser({
        email: adminData.email.trim().toLowerCase(),
        password: password,
        displayName: `${adminData.firstName} ${adminData.lastName}`,
        disabled: false
      })
    }

    const adminUid = userRecord.uid

    // Create admin document in admins collection
    await db.collection('admins').doc(adminUid).set({
      email: adminData.email.trim().toLowerCase(),
      firstName: adminData.firstName,
      lastName: adminData.lastName,
      phone: adminData.phone || null,
      hospitalId: hospitalId,
      isSuperAdmin: false, // Regular admin
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: auth.user.uid
    })

    // Create or update user document in users collection
    await db.collection('users').doc(adminUid).set({
      uid: adminUid,
      email: adminData.email.trim().toLowerCase(),
      role: 'admin',
      hospitals: [hospitalId],
      activeHospital: hospitalId,
      firstName: adminData.firstName,
      lastName: adminData.lastName,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true })

    return NextResponse.json({
      success: true,
      message: 'Admin created and assigned to hospital successfully',
      adminId: adminUid
    })
  } catch (error: any) {
    console.error('[POST /api/admin/create-admin] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create admin' },
      { status: 500 }
    )
  }
}

