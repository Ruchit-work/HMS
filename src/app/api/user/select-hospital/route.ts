/**
 * API Route: Select Hospital
 * Updates user's activeHospital field and creates session
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

/**
 * POST /api/user/select-hospital
 * Set active hospital for the authenticated user
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate request
    const auth = await authenticateRequest(request)
    if (!auth.success || !auth.user) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: auth.statusCode || 401 }
      )
    }

    const { hospitalId } = await request.json()

    if (!hospitalId) {
      return NextResponse.json(
        { success: false, error: 'hospitalId is required' },
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

    // Get user document
    const userDocRef = db.collection('users').doc(auth.user.uid)
    const userDoc = await userDocRef.get()

    let hospitals: string[] = []
    let isSuperAdmin = false
    let userRole: string | null = null

    if (userDoc.exists) {
      const userData = userDoc.data()
      hospitals = userData?.hospitals || []
      userRole = userData?.role || null
      isSuperAdmin = userData?.role === 'super_admin'
    } else {
      // Fallback: Check role-specific collections
      const roleCollections = ['admins', 'doctors', 'receptionists', 'patients']
      for (const roleColl of roleCollections) {
        const roleDoc = await db.collection(roleColl).doc(auth.user.uid).get()
        if (roleDoc.exists) {
          const data = roleDoc.data()
          if (data?.hospitalId) {
            hospitals = [data.hospitalId]
          } else if (data?.hospitals) {
            hospitals = data.hospitals
          }
          isSuperAdmin = data?.role === 'super_admin' || data?.isSuperAdmin === true
          // Determine role based on collection name or data
          userRole = data?.role || (roleColl === 'admins' ? 'admin' : roleColl.slice(0, -1)) // Remove 's' from end
          break
        }
      }
    }

    // Verify user has access to this hospital
    if (!isSuperAdmin && !hospitals.includes(hospitalId)) {
      return NextResponse.json(
        { success: false, error: 'You do not have access to this hospital' },
        { status: 403 }
      )
    }

    // Update user document
    if (userDoc.exists) {
      await userDocRef.update({
        activeHospital: hospitalId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      })
    } else {
      // Create user document if it doesn't exist
      await userDocRef.set({
        uid: auth.user.uid,
        email: auth.user.email || null,
        role: userRole || auth.user.role || 'patient',
        hospitals: hospitals.length > 0 ? hospitals : [hospitalId],
        activeHospital: hospitalId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Hospital selected successfully',
      hospitalId
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to select hospital' },
      { status: 500 }
    )
  }
}

