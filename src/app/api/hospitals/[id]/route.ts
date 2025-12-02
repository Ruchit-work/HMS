/**
 * API Route: Update/Delete Hospital
 * Updates or deletes a hospital (Super Admin only)
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
    const { name, code, address, phone, email, status } = body

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
    console.error('[PUT /api/hospitals/[id]] Error:', error)
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

    // Set status to inactive instead of deleting
    await hospitalRef.update({
      status: 'inactive',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    })

    return NextResponse.json({
      success: true,
      message: 'Hospital deactivated successfully'
    })
  } catch (error: any) {
    console.error('[DELETE /api/hospitals/[id]] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete hospital' },
      { status: 500 }
    )
  }
}

