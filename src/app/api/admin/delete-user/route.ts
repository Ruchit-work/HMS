import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { authenticateRequest, createAuthErrorResponse } from "@/utils/apiAuth"

export async function POST(request: Request) {
  // Authenticate request - requires admin role
  const auth = await authenticateRequest(request, "admin")
  if (!auth.success) {
    return createAuthErrorResponse(auth)
  }

  try {
    const initResult = initFirebaseAdmin("delete-user API")
    if (!initResult.ok) {
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

