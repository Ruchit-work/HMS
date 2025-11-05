import admin from "firebase-admin"

function initAdmin() {
  if (!admin.apps.length) {
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
      console.warn("Firebase Admin env vars missing for delete-user API.")
      return false
    }

    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey })
    })
  }
  return true
}

export async function POST(request: Request) {
  try {
    const ok = initAdmin()
    if (!ok) {
      return Response.json({ error: "Server not configured for admin" }, { status: 500 })
    }

    const body = await request.json().catch(() => ({}))
    const { uid, userType } = body

    if (!uid) {
      return Response.json({ error: "User ID (uid) is required" }, { status: 400 })
    }

    // Delete user from Firebase Auth
    try {
      await admin.auth().deleteUser(uid)
      return Response.json({ 
        success: true, 
        message: `${userType || 'User'} deleted successfully from authentication` 
      })
    } catch (error: any) {
      // If user doesn't exist in auth, that's okay (might have been deleted already)
      if (error.code === 'auth/user-not-found') {
        return Response.json({ 
          success: true, 
          message: `${userType || 'User'} not found in authentication (already deleted or never existed)` 
        })
      }
      throw error
    }
  } catch (error: any) {
    console.error("delete-user error:", error)
    return Response.json({ 
      error: error?.message || "Failed to delete user from authentication" 
    }, { status: 500 })
  }
}

// Force this route to run in Node.js runtime
export const runtime = 'nodejs'

