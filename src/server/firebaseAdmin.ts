import admin from "firebase-admin"
export interface InitAdminResult {
  ok: boolean
  error?: string
  context?: string
}

export function initFirebaseAdmin(context?: string): InitAdminResult {
  // Check if Firebase Admin is already initialized
  if (admin.apps.length > 0) {
    return { ok: true }
  }

  // Get environment variables
  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  let privateKey = process.env.FIREBASE_PRIVATE_KEY
  let storageBucket = process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
  
  // Remove gs:// prefix if present
  if (storageBucket?.startsWith("gs://")) {
    storageBucket = storageBucket.replace("gs://", "")
  }
  
  // If no bucket specified, use the default bucket name
  if (!storageBucket) {
    storageBucket = "hospital-management-sys-eabb2.appspot.com"
  }

  // Normalize private key (remove surrounding quotes and replace escaped newlines)
  if (privateKey) {
    // Remove surrounding quotes if present
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
      privateKey = privateKey.slice(1, -1)
    }
    // Replace escaped newlines with actual newlines
    privateKey = privateKey.replace(/\\n/g, "\n")
  }

  // Validate required environment variables
  if (!projectId || !clientEmail || !privateKey) {
    const errorMsg = context
      ? `Firebase Admin env vars missing for ${context}.`
      : "Firebase Admin credentials are missing. Please set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY environment variables."
    
    return {
      ok: false,
      error: errorMsg,
      context: context || "Firebase Admin initialization",
    }
  }

  // Initialize Firebase Admin
  try {
    const appOptions: admin.AppOptions = {
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    }
    
    // Add storage bucket if available
    if (storageBucket) {
      appOptions.storageBucket = storageBucket
    }
    
    admin.initializeApp(appOptions)
    return { ok: true }
  } catch (error: any) {
    const errorMsg = error?.message || "Failed to initialize Firebase Admin"
    return {
      ok: false,
      error: errorMsg,
      context: context || "Firebase Admin initialization",
    }
  }
}

export function initFirebaseAdminSimple(context?: string): boolean {
  return initFirebaseAdmin(context).ok
}


export function getFirestore(context?: string) {
  const initResult = initFirebaseAdmin(context)
  if (!initResult.ok) {
    throw new Error(initResult.error || "Failed to initialize Firebase Admin")
  }
  return admin.firestore()
}


export function getAuth(context?: string) {
  const initResult = initFirebaseAdmin(context)
  if (!initResult.ok) {
    throw new Error(initResult.error || "Failed to initialize Firebase Admin")
  }
  return admin.auth()
}

export { admin }

