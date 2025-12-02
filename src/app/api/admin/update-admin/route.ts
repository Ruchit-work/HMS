/**
 * API Route: Update Admin
 * Updates an existing admin user's details
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

export async function PUT(request: NextRequest) {
  try {
    // Authenticate request - requires super admin
    const auth = await authenticateRequest(request)
    if (!auth.success || !auth.user) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: auth.statusCode || 401 }
      )
    }

    // Verify user is super admin
    const userDoc = await db.collection('users').doc(auth.user.uid).get()
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
    const { adminId, adminData, hospitalId } = body

    if (!adminId) {
      return NextResponse.json(
        { success: false, error: 'Admin ID is required' },
        { status: 400 }
      )
    }

    // Check if admin exists
    const adminDoc = await db.collection('admins').doc(adminId).get()
    if (!adminDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'Admin not found' },
        { status: 404 }
      )
    }

    const existingAdminData = adminDoc.data()

    // Prevent editing super admin
    if (existingAdminData?.isSuperAdmin) {
      return NextResponse.json(
        { success: false, error: 'Cannot edit super admin account' },
        { status: 403 }
      )
    }

    // Prepare update data
    const updateData: any = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }

    if (adminData) {
      if (adminData.firstName !== undefined) {
        updateData.firstName = adminData.firstName
      }
      if (adminData.lastName !== undefined) {
        updateData.lastName = adminData.lastName
      }
      if (adminData.phone !== undefined) {
        updateData.phone = adminData.phone || null
      }
      if (adminData.email !== undefined && adminData.email !== existingAdminData?.email) {
        // Check if email is already in use
        try {
          const existingUser = await admin.auth().getUserByEmail(adminData.email.trim().toLowerCase())
          if (existingUser.uid !== adminId) {
            return NextResponse.json(
              { success: false, error: 'Email is already in use by another user' },
              { status: 400 }
            )
          }
        } catch (error: any) {
          if (error.code !== 'auth/user-not-found') {
            throw error
          }
        }

        // Update email in Firebase Auth
        await admin.auth().updateUser(adminId, {
          email: adminData.email.trim().toLowerCase(),
          displayName: `${adminData.firstName || existingAdminData.firstName} ${adminData.lastName || existingAdminData.lastName}`
        })
        updateData.email = adminData.email.trim().toLowerCase()
      }
    }

    if (hospitalId && hospitalId !== existingAdminData?.hospitalId) {
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

      updateData.hospitalId = hospitalId

      // Update users collection
      const userDocRef = db.collection('users').doc(adminId)
      await userDocRef.update({
        hospitals: [hospitalId],
        activeHospital: hospitalId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      })
    }

    // Update admin document
    await db.collection('admins').doc(adminId).update(updateData)

    // Update users collection if name changed
    if (adminData && (adminData.firstName !== undefined || adminData.lastName !== undefined)) {
      const userDocRef = db.collection('users').doc(adminId)
      const userUpdateData: any = {
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }
      if (adminData.firstName !== undefined) {
        userUpdateData.firstName = adminData.firstName
      }
      if (adminData.lastName !== undefined) {
        userUpdateData.lastName = adminData.lastName
      }
      await userDocRef.update(userUpdateData)
    }

    return NextResponse.json({
      success: true,
      message: 'Admin updated successfully'
    })
  } catch (error: any) {
    console.error('[PUT /api/admin/update-admin] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update admin' },
      { status: 500 }
    )
  }
}

