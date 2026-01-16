/**
 * API Route: Seed Initial Branches
 * Creates the 3 initial branches: Surat City Light, Navsari, Bardoli
 * Admin only
 */

import { NextRequest, NextResponse } from 'next/server'
import admin from 'firebase-admin'
import { authenticateRequest } from '@/utils/firebase/apiAuth'
import { getUserActiveHospitalId } from '@/utils/firebase/serverHospitalQueries'
import { BranchTimings } from '@/types/branch'

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

    // Get hospital ID
    const hospitalId = await getUserActiveHospitalId(auth.user.uid)
    if (!hospitalId) {
      return NextResponse.json(
        { success: false, error: 'Hospital not found. Please ensure you are assigned to a hospital.' },
        { status: 400 }
      )
    }

    // Define the 3 branches with their timings
    const branches = [
      {
        name: 'Surat City Light',
        location: 'Surat, City Light',
        timings: {
          monday: { start: '18:00', end: '21:00' },
          tuesday: { start: '18:00', end: '21:00' },
          wednesday: { start: '18:00', end: '21:00' },
          thursday: { start: '18:00', end: '21:00' },
          friday: { start: '18:00', end: '21:00' },
          saturday: { start: '18:00', end: '21:00' },
          sunday: null
        } as BranchTimings
      },
      {
        name: 'Navsari',
        location: 'Navsari',
        timings: {
          monday: { start: '10:00', end: '16:00' },
          tuesday: { start: '10:00', end: '16:00' },
          wednesday: { start: '10:00', end: '16:00' },
          thursday: { start: '10:00', end: '16:00' },
          friday: { start: '10:00', end: '16:00' },
          saturday: { start: '10:00', end: '16:00' },
          sunday: null
        } as BranchTimings
      },
      {
        name: 'Bardoli',
        location: 'Bardoli',
        timings: {
          monday: { start: '10:00', end: '16:00' },
          tuesday: { start: '10:00', end: '16:00' },
          wednesday: { start: '10:00', end: '16:00' },
          thursday: { start: '10:00', end: '16:00' },
          friday: { start: '10:00', end: '16:00' },
          saturday: { start: '10:00', end: '16:00' },
          sunday: null
        } as BranchTimings
      }
    ]

    const createdBranches = []

    // Check if branches already exist
    const existingBranchesSnapshot = await db
      .collection('branches')
      .where('hospitalId', '==', hospitalId)
      .get()

    const existingBranchNames = new Set(
      existingBranchesSnapshot.docs.map(doc => doc.data().name)
    )

    // Create branches that don't exist
    for (const branch of branches) {
      if (existingBranchNames.has(branch.name)) {
        continue
      }

      const branchRef = db.collection('branches').doc()
      await branchRef.set({
        name: branch.name,
        location: branch.location,
        hospitalId,
        timings: branch.timings,
        status: 'active',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      })

      createdBranches.push({
        id: branchRef.id,
        name: branch.name,
        location: branch.location
      })
    }

    return NextResponse.json({
      success: true,
      message: `Successfully created ${createdBranches.length} branch(es)`,
      branches: createdBranches,
      totalBranches: existingBranchesSnapshot.size + createdBranches.length
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to seed branches' },
      { status: 500 }
    )
  }
}

