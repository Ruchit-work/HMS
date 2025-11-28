/**
 * API Authentication Utilities
 * Verifies Firebase Auth tokens and checks user roles for API route authorization
 */

import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"

export type UserRole = "admin" | "doctor" | "patient" | "receptionist"

export interface AuthenticatedUser {
  uid: string
  email: string | null
  role: UserRole
  data?: any
}

export interface AuthResult {
  success: boolean
  user?: AuthenticatedUser
  error?: string
  statusCode?: number
}

/**
 * Extract Firebase Auth token from Authorization header
 * Expected format: "Bearer <token>"
 */
function extractAuthToken(request: Request): string | null {
  const authHeader = request.headers.get("authorization")
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null
  }
  return authHeader.substring(7).trim() || null
}

/**
 * Verify Firebase Auth token and get user info
 */
interface VerifiedTokenData {
  uid: string
  email: string | null
  authTime: string | null
}

async function verifyAuthToken(token: string): Promise<VerifiedTokenData | null> {
  try {
    const initResult = initFirebaseAdmin("api-auth")
    if (!initResult.ok) {
      return null
    }

    const decodedToken = await admin.auth().verifyIdToken(token)
    return {
      uid: decodedToken.uid,
      email: decodedToken.email || null,
      authTime: decodedToken.auth_time ? String(decodedToken.auth_time) : null,
    }
  } catch (error) {
    console.error("[api-auth] Token verification failed:", error)
    return null
  }
}

/**
 * Get user role from Firestore collections
 */
async function getUserRole(uid: string, requiredRole?: UserRole): Promise<{ role: UserRole; data?: any } | null> {
  try {
    const db = admin.firestore()

    // If specific role required, check only that collection
    if (requiredRole === "admin") {
      const adminDoc = await db.collection("admins").doc(uid).get()
      if (adminDoc.exists) {
        return { role: "admin", data: adminDoc.data() }
      }
      return null
    }

    if (requiredRole === "doctor") {
      const doctorDoc = await db.collection("doctors").doc(uid).get()
      if (doctorDoc.exists) {
        return { role: "doctor", data: doctorDoc.data() }
      }
      return null
    }

    if (requiredRole === "patient") {
      const patientDoc = await db.collection("patients").doc(uid).get()
      if (patientDoc.exists) {
        return { role: "patient", data: patientDoc.data() }
      }
      return null
    }

    if (requiredRole === "receptionist") {
      const receptionistDoc = await db.collection("receptionists").doc(uid).get()
      if (receptionistDoc.exists) {
        return { role: "receptionist", data: receptionistDoc.data() }
      }
      return null
    }

    // No specific role required, check all collections
    const [adminDoc, doctorDoc, patientDoc, receptionistDoc] = await Promise.all([
      db.collection("admins").doc(uid).get(),
      db.collection("doctors").doc(uid).get(),
      db.collection("patients").doc(uid).get(),
      db.collection("receptionists").doc(uid).get(),
    ])

    if (adminDoc.exists) {
      return { role: "admin", data: adminDoc.data() }
    }
    if (doctorDoc.exists) {
      return { role: "doctor", data: doctorDoc.data() }
    }
    if (patientDoc.exists) {
      return { role: "patient", data: patientDoc.data() }
    }
    if (receptionistDoc.exists) {
      return { role: "receptionist", data: receptionistDoc.data() }
    }

    return null
  } catch (error) {
    console.error("[api-auth] Error getting user role:", error)
    return null
  }
}

/**
 * Authenticate API request and verify user role
 * 
 * @param request - The incoming Request object
 * @param requiredRole - Optional role requirement. If provided, only users with this role can access
 * @returns AuthResult with success status, user info, and error details
 * 
 * @example
 * // Require any authenticated user
 * const auth = await authenticateRequest(request)
 * if (!auth.success) {
 *   return Response.json({ error: auth.error }, { status: auth.statusCode })
 * }
 * 
 * @example
 * // Require admin role
 * const auth = await authenticateRequest(request, "admin")
 * if (!auth.success) {
 *   return Response.json({ error: auth.error }, { status: auth.statusCode })
 * }
 * const adminUser = auth.user
 */
interface AuthenticateOptions {
  skipMfaCheck?: boolean
}

const MFA_REQUIRED_ROLES: UserRole[] = ["admin", "doctor", "receptionist"]

export async function authenticateRequest(
  request: Request,
  requiredRole?: UserRole,
  options?: AuthenticateOptions
): Promise<AuthResult> {
  // Extract token from Authorization header
  const token = extractAuthToken(request)
  if (!token) {
    return {
      success: false,
      error: "Authorization token missing. Please include 'Authorization: Bearer <token>' header.",
      statusCode: 401,
    }
  }

  // Verify token
  const tokenData = await verifyAuthToken(token)
  if (!tokenData) {
    return {
      success: false,
      error: "Invalid or expired authentication token.",
      statusCode: 401,
    }
  }

  // Get user role
  const roleData = await getUserRole(tokenData.uid, requiredRole)
  if (!roleData) {
    return {
      success: false,
      error: requiredRole
        ? `User not found or doesn't have ${requiredRole} role.`
        : "User not found in system.",
      statusCode: 403,
    }
  }

  // Check if required role matches
  if (requiredRole && roleData.role !== requiredRole) {
    return {
      success: false,
      error: `Access denied. This endpoint requires ${requiredRole} role.`,
      statusCode: 403,
    }
  }

  // Check if doctor account is approved (if status exists)
  if (roleData.role === "doctor" && roleData.data?.status === "pending") {
    return {
      success: false,
      error: "Your doctor account is pending approval. Please wait for admin approval.",
      statusCode: 403,
    }
  }

  // ⚠️ TEMPORARILY DISABLED: MFA enforcement for staff roles (for testing with trial Twilio account)
  // TODO: Uncomment this section when ready for production 2FA
  // Enforce MFA for staff roles unless explicitly skipped (e.g., during MFA verification flow)
  // const shouldCheckMfa = !options?.skipMfaCheck && MFA_REQUIRED_ROLES.includes(roleData.role)
  // if (shouldCheckMfa) {
  //   const tokenAuthTime = tokenData.authTime
  //   const db = admin.firestore()
  //   const mfaDoc = await db.collection("mfaSessions").doc(tokenData.uid).get()
  //   const storedAuthTime = mfaDoc.exists ? String(mfaDoc.data()?.authTime || "") : ""

  //   if (!tokenAuthTime || !storedAuthTime || storedAuthTime !== tokenAuthTime) {
  //     const { logAuthzEvent } = await import("@/utils/auditLog")
  //     await logAuthzEvent(
  //       "permission_denied",
  //       request,
  //       tokenData.uid,
  //       tokenData.email || undefined,
  //       roleData.role,
  //       undefined,
  //       undefined,
  //       "Multi-factor authentication required or expired"
  //     )
  //     return {
  //       success: false,
  //       error: "Additional verification required. Please sign in again and complete OTP verification.",
  //       statusCode: 401,
  //     }
  //   }
  // }


  return {
    success: true,
    user: {
      uid: tokenData.uid,
      email: tokenData.email,
      role: roleData.role,
      data: roleData.data,
    },
  }
}

/**
 * Helper to create error response for authentication failures
 */
export function createAuthErrorResponse(authResult: AuthResult) {
  return Response.json(
    { error: authResult.error || "Authentication failed" },
    { status: authResult.statusCode || 401 }
  )
}

