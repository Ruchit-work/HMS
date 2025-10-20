import admin from 'firebase-admin'

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.NEXT_PUBLIC_FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.NEXT_PUBLIC_FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    })
  })
}

export async function POST(request) {
  try {
    // Check if Firebase Admin SDK is properly initialized
    if (!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 
        !process.env.NEXT_PUBLIC_FIREBASE_CLIENT_EMAIL || 
        !process.env.NEXT_PUBLIC_FIREBASE_PRIVATE_KEY) {
      return Response.json({ 
        error: 'Firebase Admin SDK not configured. Please add the following to your .env.local file:\n\nNEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id\nNEXT_PUBLIC_FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com\nNEXT_PUBLIC_FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\nYour-Private-Key-Here\\n-----END PRIVATE KEY-----"\n\nGet these values from Firebase Console > Project Settings > Service Accounts > Generate New Private Key' 
      }, { status: 500 })
    }

    const { doctorData, password } = await request.json()
    
    // Validate required fields
    if (!doctorData.email || !password) {
      return Response.json({ error: 'Email and password are required' }, { status: 400 })
    }
    
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
    
    // Prepare doctor data for Firestore
    const firestoreData = {
      ...doctorData,
      uid: userRecord.uid,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: "admin"
    }
    
    // Save to Firestore using Admin SDK
    await admin.firestore().collection('doctors').doc(userRecord.uid).set(firestoreData)
    
    return Response.json({ 
      success: true, 
      uid: userRecord.uid,
      message: 'Doctor created successfully'
    })
    
  } catch (error) {
    console.error('Error creating doctor:', error)
    
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
