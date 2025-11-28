import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { authenticateRequest, createAuthErrorResponse } from "@/utils/apiAuth"
import { applyRateLimit } from "@/utils/rateLimit"

export async function POST(request: Request) {
  // Apply rate limiting first
  const rateLimitResult = await applyRateLimit(request, "ADMIN")
  if (rateLimitResult instanceof Response) {
    return rateLimitResult // Rate limited
  }

  // Authenticate request - requires admin role
  const auth = await authenticateRequest(request, "admin")
  if (!auth.success) {
    return createAuthErrorResponse(auth)
  }

  // Re-apply rate limit with user ID for better tracking
  const rateLimitWithUser = await applyRateLimit(request, "ADMIN", auth.user?.uid)
  if (rateLimitWithUser instanceof Response) {
    return rateLimitWithUser // Rate limited
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

    // Determine user role by checking Firestore collections
    const firestore = admin.firestore()
    let detectedUserType = userType || "user"
    try {
      const patientDoc = await firestore.collection("patients").doc(uid).get()
      if (patientDoc.exists) {
        detectedUserType = "patient"
      } else {
        const doctorDoc = await firestore.collection("doctors").doc(uid).get()
        if (doctorDoc.exists) {
          detectedUserType = "doctor"
        } else {
          const receptionistDoc = await firestore.collection("receptionists").doc(uid).get()
          if (receptionistDoc.exists) {
            detectedUserType = "receptionist"
          }
        }
      }
    } catch (error) {
      console.error("Error determining user type:", error)
    }

    // Delete user from Firebase Auth
    try {
      await admin.auth().deleteUser(uid)


      return Response.json({ 
        success: true, 
        message: `${detectedUserType || 'User'} deleted successfully from authentication` 
      })
    } catch (error: any) {
      // If user doesn't exist in auth, that's okay (might have been deleted already)
      if (error.code === 'auth/user-not-found') {

        return Response.json({ 
          success: true, 
          message: `${detectedUserType || 'User'} not found in authentication (already deleted or never existed)` 
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

