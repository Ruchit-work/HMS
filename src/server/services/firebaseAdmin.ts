import admin from "firebase-admin"

let initialized = false

export const ensureFirebaseAdmin = () => {
  if (initialized) return

  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  let privateKey = process.env.FIREBASE_PRIVATE_KEY

  if (privateKey && privateKey.startsWith("\"") && privateKey.endsWith("\"")) {
    privateKey = privateKey.slice(1, -1)
  }
  if (privateKey) {
    privateKey = privateKey.replace(/\\n/g, "\n")
  }

  if (!projectId || !clientEmail || !privateKey) {
    console.warn("Firebase admin credentials are missing. Server-side Firestore access will fail.")
    return
  }

  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    })
  }

  initialized = true
}

export const getAdminFirestore = () => {
  ensureFirebaseAdmin()
  return admin.firestore()
}


