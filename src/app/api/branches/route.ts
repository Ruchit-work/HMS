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
import { applyRateLimit } from '@/utils/shared/rateLimit'

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
    const rateLimitResult = await applyRateLimit(request, 'GENERAL')
    if (rateLimitResult instanceof Response) {
      return rateLimitResult
    }

    const { searchParams } = new URL(request.url)
    const hospitalId = searchParams.get('hospitalId')
    const enforceHospitalAuth = process.env.ENFORCE_BRANCH_HOSPITAL_AUTH === 'true'
    const auth = await authenticateRequest(request)
    const authWarningHeaders: Record<string, string> = {}

    let targetHospitalId = hospitalId

    // If no hospitalId provided, fall back to authenticated user's active hospital
    if (!targetHospitalId) {
      if (!auth.success || !auth.user) {
        return NextResponse.json(
          { success: false, error: auth.error || 'Unauthorized' },
          { status: auth.statusCode || 401 }
        )
      }
      targetHospitalId = await getUserActiveHospitalId(auth.user.uid)
    } else {
      if (!auth.success || !auth.user) {
        if (enforceHospitalAuth) {
          return NextResponse.json(
            { success: false, error: auth.error || 'Unauthorized' },
            { status: auth.statusCode || 401 }
          )
        }
        authWarningHeaders['X-Branch-Auth-Warning'] = 'Unauthenticated hospitalId query allowed in compatibility mode'
      } else {
        const userHospitalId = await getUserActiveHospitalId(auth.user.uid)
        if (userHospitalId && userHospitalId !== targetHospitalId.trim()) {
          if (enforceHospitalAuth) {
            return NextResponse.json(
              { success: false, error: 'Forbidden: hospital access mismatch' },
              { status: 403 }
            )
          }
          authWarningHeaders['X-Branch-Auth-Warning'] = 'Cross-hospital access allowed in compatibility mode'
        }
      }
    }

    if (!targetHospitalId) {
      return NextResponse.json(
        { success: false, error: 'Hospital ID is required' },
        { status: 400 }
      )
    }

    // Basic guard to avoid malformed values hitting Firestore queries.
    const normalizedHospitalId = targetHospitalId.trim()
    if (!normalizedHospitalId || normalizedHospitalId.length > 128) {
      return NextResponse.json(
        { success: false, error: 'Invalid hospital ID' },
        { status: 400 }
      )
    }

    // Fetch all active branches for the hospital
    const branchesSnapshot = await db
      .collection('branches')
      .where('hospitalId', '==', normalizedHospitalId)
      .where('status', '==', 'active')
      .get()

    const branches: Branch[] = branchesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Branch))

    return NextResponse.json({
      success: true,
      branches
    }, { headers: authWarningHeaders })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch branches' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResult = await applyRateLimit(request, 'ADMIN')
    if (rateLimitResult instanceof Response) {
      return rateLimitResult
    }

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
    const normalizedName = typeof name === 'string' ? name.trim() : ''
    const normalizedLocation = typeof location === 'string' ? location.trim() : ''
    const normalizedHospitalId = typeof hospitalId === 'string' ? hospitalId.trim() : ''

    if (!normalizedName || !normalizedLocation || !timings || !normalizedHospitalId) {
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
    const hospitalDoc = await db.collection('hospitals').doc(normalizedHospitalId).get()
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
      name: normalizedName,
      location: normalizedLocation,
      hospitalId: normalizedHospitalId,
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

