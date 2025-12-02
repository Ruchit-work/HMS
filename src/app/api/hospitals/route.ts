/**
 * Hospital Management API Routes
 * Handles CRUD operations for hospitals
 */

import { NextRequest, NextResponse } from 'next/server'
import admin from 'firebase-admin'
import { verifyAuthToken } from '@/utils/apiAuth'

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
 * GET /api/hospitals
 * Get all active hospitals (public) or all hospitals (admin)
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    
    let includeInactive = false
    
    // If authenticated, check if user is super admin
    if (token) {
      const authData = await verifyAuthToken(token)
      if (authData) {
        const userDoc = await db.collection('users').doc(authData.uid).get()
        if (userDoc.exists) {
          const userData = userDoc.data()
          includeInactive = userData?.role === 'super_admin'
        }
      }
    }

    const hospitalsRef = db.collection('hospitals')
    const snapshot = includeInactive 
      ? await hospitalsRef.get()
      : await hospitalsRef.where('status', '==', 'active').get()

    const hospitals = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))

    return NextResponse.json({ success: true, hospitals })
  } catch (error: any) {
    console.error('[GET /api/hospitals] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch hospitals' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/hospitals
 * Create a new hospital (Super Admin only)
 */
export async function POST(request: NextRequest) {
  try {
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
    const { name, code, address, phone, email } = body

    // Validate required fields
    if (!name || !code || !address || !phone || !email) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Check if hospital code already exists
    const existingCode = await db.collection('hospitals')
      .where('code', '==', code)
      .get()
    
    if (!existingCode.empty) {
      return NextResponse.json(
        { success: false, error: 'Hospital code already exists' },
        { status: 400 }
      )
    }

    // Create hospital
    const hospitalRef = db.collection('hospitals').doc()
    await hospitalRef.set({
      name,
      code,
      address,
      phone,
      email,
      status: 'active',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    })

    return NextResponse.json({
      success: true,
      hospital: {
        id: hospitalRef.id,
        name,
        code,
        address,
        phone,
        email,
        status: 'active'
      }
    })
  } catch (error: any) {
    console.error('[POST /api/hospitals] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create hospital' },
      { status: 500 }
    )
  }
}

