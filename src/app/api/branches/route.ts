/**
 * API Route: Branches Management
 * GET: Fetch all branches for a hospital
 * POST: Create a new branch (admin only)
 */

import { NextRequest, NextResponse } from 'next/server'
import admin from 'firebase-admin'
import { authenticateRequest } from '@/utils/firebase/apiAuth'
import { getUserActiveHospitalId } from '@/utils/firebase/serverHospitalQueries'
import { Branch, BranchTimings } from '@/types/branch'

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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const hospitalId = searchParams.get('hospitalId')

    let targetHospitalId = hospitalId

    // If no hospitalId provided, fall back to authenticated user's active hospital
    if (!targetHospitalId) {
      const auth = await authenticateRequest(request)
      if (!auth.success || !auth.user) {
        return NextResponse.json(
          { success: false, error: auth.error || 'Unauthorized' },
          { status: auth.statusCode || 401 }
        )
      }
      targetHospitalId = await getUserActiveHospitalId(auth.user.uid)
    }

    if (!targetHospitalId) {
      return NextResponse.json(
        { success: false, error: 'Hospital ID is required' },
        { status: 400 }
      )
    }

    // Fetch all active branches for the hospital
    const branchesSnapshot = await db
      .collection('branches')
      .where('hospitalId', '==', targetHospitalId)
      .where('status', '==', 'active')
      .get()

    const branches: Branch[] = branchesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Branch))

    return NextResponse.json({
      success: true,
      branches
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch branches' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.success || !auth.user) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: auth.statusCode || 401 }
      )
    }

    // Verify user is admin
    const userDoc = await db.collection('users').doc(auth.user.uid).get()
    if (!userDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    const userData = userDoc.data()
    if (userData?.role !== 'admin' && userData?.role !== 'super_admin') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Admin access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { name, location, timings, hospitalId } = body

    if (!name || !location || !timings || !hospitalId) {
      return NextResponse.json(
        { success: false, error: 'Name, location, timings, and hospitalId are required' },
        { status: 400 }
      )
    }

    // Validate timings structure
    const requiredDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    for (const day of requiredDays) {
      if (!(day in timings)) {
        return NextResponse.json(
          { success: false, error: `Missing timing for ${day}` },
          { status: 400 }
        )
      }
    }

    // Verify hospital exists and allows multiple branches
    const hospitalDoc = await db.collection('hospitals').doc(hospitalId).get()
    if (!hospitalDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'Hospital not found' },
        { status: 404 }
      )
    }
    const hospitalData = hospitalDoc.data()
    if (hospitalData?.multipleBranchesEnabled === false) {
      return NextResponse.json(
        { success: false, error: 'This hospital has single-branch mode. Contact Super Admin to enable multiple branches.' },
        { status: 403 }
      )
    }

    // Create branch document
    const branchRef = db.collection('branches').doc()
    const branchData: Omit<Branch, 'id' | 'createdAt' | 'updatedAt'> & {
      createdAt: any
      updatedAt: any
    } = {
      name,
      location,
      hospitalId,
      timings: timings as BranchTimings,
      status: 'active',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }

    await branchRef.set(branchData)

    return NextResponse.json({
      success: true,
      message: 'Branch created successfully',
      branchId: branchRef.id,
      branch: {
        id: branchRef.id,
        ...branchData
      }
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create branch' },
      { status: 500 }
    )
  }
}

