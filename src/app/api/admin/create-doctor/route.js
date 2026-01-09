import admin from 'firebase-admin'
import { authenticateRequest, createAuthErrorResponse } from "@/utils/apiAuth"
import { getUserActiveHospitalId, getHospitalCollectionPath } from "@/utils/serverHospitalQueries"

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  // Normalize private key: remove surrounding quotes and convert escaped newlines
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

export async function POST(request) {
  // Apply rate limiting first
  const { applyRateLimit } = await import("@/utils/rateLimit")
  const rateLimitResult = await applyRateLimit(request, "USER_CREATION")
  if (rateLimitResult instanceof Response) {
    return rateLimitResult // Rate limited
  }

  // Authenticate request - requires admin role
  const auth = await authenticateRequest(request, "admin")
  if (!auth.success) {
    return createAuthErrorResponse(auth)
  }

  // Block super admins from creating doctors
  // Check if user is super admin by checking users collection
  try {
    const db = admin.firestore()
    const userDoc = await db.collection('users').doc(auth.user.uid).get()
    if (userDoc.exists) {
      const userData = userDoc.data()
      if (userData?.role === 'super_admin') {
        return Response.json(
          { error: "Super admins cannot create doctors. Please use a regular admin account." },
          { status: 403 }
        )
      }
    } else {
      // Fallback: Check admins collection
      const adminDoc = await db.collection('admins').doc(auth.user.uid).get()
      if (adminDoc.exists) {
        const adminData = adminDoc.data()
        if (adminData?.isSuperAdmin === true) {
          return Response.json(
            { error: "Super admins cannot create doctors. Please use a regular admin account." },
            { status: 403 }
          )
        }
      }
    }
  } catch {
    // Continue if check fails
  }

  // Re-apply rate limit with user ID for better tracking
  const rateLimitWithUser = await applyRateLimit(request, "USER_CREATION", auth.user?.uid)
  if (rateLimitWithUser instanceof Response) {
    return rateLimitWithUser // Rate limited
  }

  try {
    // Check if Firebase Admin SDK is properly initialized
    if (!process.env.FIREBASE_PROJECT_ID || 
        !process.env.FIREBASE_CLIENT_EMAIL || 
        !process.env.FIREBASE_PRIVATE_KEY) {
      return Response.json({ 
        error: 'Firebase Admin SDK not configured. Please add the following to your .env.local file:\n\nFIREBASE_PROJECT_ID=your-project-id\nFIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com\nFIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\nYour-Private-Key-Here\\n-----END PRIVATE KEY-----"\n\nNote: Keep these server-only (no NEXT_PUBLIC_). Get them from Firebase Console > Project Settings > Service Accounts > Generate New Private Key.' 
      }, { status: 500 })
    }

    const { doctorData, password } = await request.json()
    
    // Validate required fields
    if (!doctorData.email || !password) {
      return Response.json({ error: 'Email and password are required' }, { status: 400 })
    }
    if (!doctorData.phoneNumber || !String(doctorData.phoneNumber).trim()) {
      return Response.json({ error: 'Phone number is required for MFA' }, { status: 400 })
    }

    const normalizedPhone = String(doctorData.phoneNumber).trim()
    
    if (password.length < 6) {
      return Response.json({ error: 'Password must be at least 6 characters long' }, { status: 400 })
    }
    
    // Create user using Firebase Admin SDK (no automatic sign-in!)
    const userRecord = await admin.auth().createUser({
      email: doctorData.email,
      password: password,
      displayName: `${doctorData.firstName} ${doctorData.lastName}`,
      disabled: false
    })
    
    // Get admin's hospital ID - doctor belongs to admin's hospital
    const adminHospitalId = await getUserActiveHospitalId(auth.user.uid)
    if (!adminHospitalId) {
      return Response.json({ error: 'Admin hospital not found. Please ensure you are assigned to a hospital.' }, { status: 400 })
    }
    
    // Prepare doctor data for Firestore
    const firestoreData = {
      ...doctorData,
      phoneNumber: normalizedPhone,
      mfaPhone: normalizedPhone,
      uid: userRecord.uid,
      hospitalId: adminHospitalId, // Store hospital association
      // Include branchIds and branchTimings if provided
      branchIds: doctorData.branchIds || [],
      visitingHours: doctorData.visitingHours || null,
      branchTimings: doctorData.branchTimings || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: "admin"
    }
    
    const db = admin.firestore()
    
    // Save to hospital-scoped subcollection
    await db.collection(getHospitalCollectionPath(adminHospitalId, 'doctors')).doc(userRecord.uid).set(firestoreData)
    
    // Also save to legacy collection for backward compatibility
    await db.collection('doctors').doc(userRecord.uid).set(firestoreData)
    
    // Create/update user document in users collection for multi-hospital support
    const userDocRef = db.collection('users').doc(userRecord.uid)
    await userDocRef.set({
      uid: userRecord.uid,
      email: doctorData.email,
      role: 'doctor',
      hospitals: [adminHospitalId],
      activeHospital: adminHospitalId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, { merge: true })
    
    // Audit logging disabled
    
    return Response.json({ 
      success: true, 
      uid: userRecord.uid,
      message: 'Doctor created successfully'
    })
    
  } catch (error) {
    // Handle specific Firebase Auth errors
    if (error.code === 'auth/email-already-exists') {
      return Response.json({ error: 'A doctor with this email already exists' }, { status: 400 })
    } else if (error.code === 'auth/invalid-email') {
      return Response.json({ error: 'Please enter a valid email address' }, { status: 400 })
    } else if (error.code === 'auth/weak-password') {
      return Response.json({ error: 'Password is too weak. Please use at least 6 characters' }, { status: 400 })
    } else {
      return Response.json({ error: `Failed to create doctor: ${error.message}` }, { status: 500 })
    }
  }
}

// Force this route to run in Node.js runtime
export const runtime = 'nodejs'
