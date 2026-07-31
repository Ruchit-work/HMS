import { NextResponse } from "next/server"
import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { authenticateRequest, createAuthErrorResponse } from "@/shared/utils/firebase/apiAuth"
import { getRoleCollection } from "@/shared/utils/auth/roleRouting"
import type { UserRole } from "@/shared/utils/auth/roleRouting"

/**
 * GET /api/user/profile
 * Returns profile details for currently authenticated user
 */
export async function GET(request: Request) {
  const auth = await authenticateRequest(request)
  if (!auth.success) return createAuthErrorResponse(auth)
  if (!auth.user) return NextResponse.json({ error: "User context missing" }, { status: 403 })

  const initResult = initFirebaseAdmin("user profile GET")
  if (!initResult.ok) {
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }

  try {
    const db = admin.firestore()
    const authUser = await admin.auth().getUser(auth.user.uid)

    const role = (auth.user.role || "admin") as UserRole
    const collectionName = role && role !== "super_admin" ? getRoleCollection(role) : "admins"
    const roleDocSnap = await db.collection(collectionName).doc(auth.user.uid).get()
    const roleData = roleDocSnap.exists ? roleDocSnap.data() || {} : {}

    const userDocSnap = await db.collection("users").doc(auth.user.uid).get()
    const userData = userDocSnap.exists ? userDocSnap.data() || {} : {}

    const hospitalId =
      (roleData.hospitalId as string) ||
      (userData.activeHospital as string) ||
      (Array.isArray(userData.hospitals) ? userData.hospitals[0] : null) ||
      null

    let hospitalName = "System Platform"
    if (hospitalId) {
      const hSnap = await db.collection("hospitals").doc(hospitalId).get()
      if (hSnap.exists) {
        hospitalName = hSnap.data()?.name || hospitalId
      }
    }

    const branchId = (roleData.branchId as string) || null
    let branchName = (roleData.branchName as string) || "Main Branch"
    if (branchId && !roleData.branchName) {
      const bSnap = await db.collection("branches").doc(branchId).get()
      if (bSnap.exists) {
        branchName = bSnap.data()?.name || branchId
      }
    }

    const firstName =
      (roleData.firstName as string) ||
      (userData.firstName as string) ||
      authUser.displayName?.split(" ")[0] ||
      ""
    const lastName =
      (roleData.lastName as string) ||
      (userData.lastName as string) ||
      authUser.displayName?.split(" ").slice(1).join(" ") ||
      ""
    const phone = (roleData.phone as string) || (userData.phone as string) || authUser.phoneNumber || ""
    const photoURL = authUser.photoURL || (roleData.photoURL as string) || (userData.photoURL as string) || ""

    return NextResponse.json({
      uid: auth.user.uid,
      email: authUser.email || auth.user.email,
      firstName,
      lastName,
      displayName: authUser.displayName || `${firstName} ${lastName}`.trim() || authUser.email || "",
      phone,
      photoURL,
      role: auth.user.role,
      hospitalId,
      hospitalName,
      branchId,
      branchName,
      createdAt: authUser.metadata.creationTime || roleData.createdAt || userData.createdAt || null,
      lastLogin: authUser.metadata.lastSignInTime || roleData.updatedAt || userData.updatedAt || null,
      permissions: role === "super_admin" ? ["all_access"] : role === "admin" ? ["hospital_admin"] : ["staff_access"],
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load user profile"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * PUT /api/user/profile
 * Updates editable user profile fields: firstName, lastName, phone, photoURL.
 * Rejects any attempts to modify role, hospital, branch, or permissions.
 */
export async function PUT(request: Request) {
  const auth = await authenticateRequest(request)
  if (!auth.success) return createAuthErrorResponse(auth)
  if (!auth.user) return NextResponse.json({ error: "User context missing" }, { status: 403 })

  const initResult = initFirebaseAdmin("user profile PUT")
  if (!initResult.ok) {
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }

  try {
    const body = await request.json().catch(() => ({}))

    // Reject attempt to modify forbidden fields
    if ("role" in body || "hospitalId" in body || "branchId" in body || "permissions" in body) {
      return NextResponse.json(
        { error: "Security restriction: Role, Hospital, Branch, and Permissions cannot be modified." },
        { status: 400 }
      )
    }

    const { firstName, lastName, phone, photoURL } = body

    const cleanFirstName = typeof firstName === "string" ? firstName.trim() : undefined
    const cleanLastName = typeof lastName === "string" ? lastName.trim() : undefined
    const cleanPhone = typeof phone === "string" ? phone.trim() : undefined
    const cleanPhotoURL = typeof photoURL === "string" ? photoURL.trim() : undefined

    const displayName = [cleanFirstName, cleanLastName].filter(Boolean).join(" ").trim()

    // 1. Update Auth user
    const authUpdatePayload: Record<string, string> = {}
    if (displayName) authUpdatePayload.displayName = displayName
    if (cleanPhotoURL !== undefined) authUpdatePayload.photoURL = cleanPhotoURL

    if (Object.keys(authUpdatePayload).length > 0) {
      await admin.auth().updateUser(auth.user.uid, authUpdatePayload)
    }

    const db = admin.firestore()
    const nowIso = new Date().toISOString()

    const firestoreUpdate: Record<string, unknown> = {
      updatedAt: nowIso,
    }
    if (cleanFirstName !== undefined) firestoreUpdate.firstName = cleanFirstName
    if (cleanLastName !== undefined) firestoreUpdate.lastName = cleanLastName
    if (cleanPhone !== undefined) firestoreUpdate.phone = cleanPhone
    if (cleanPhotoURL !== undefined) firestoreUpdate.photoURL = cleanPhotoURL

    // 2. Update role collection document
    const role = (auth.user.role || "admin") as UserRole
    const collectionName = role && role !== "super_admin" ? getRoleCollection(role) : "admins"
    const roleDocRef = db.collection(collectionName).doc(auth.user.uid)
    const roleDocSnap = await roleDocRef.get()
    if (roleDocSnap.exists) {
      await roleDocRef.update(firestoreUpdate)
    }

    // 3. Update users collection document
    const userDocRef = db.collection("users").doc(auth.user.uid)
    const userDocSnap = await userDocRef.get()
    if (userDocSnap.exists) {
      await userDocRef.update(firestoreUpdate)
    }

    return NextResponse.json({
      success: true,
      message: "Profile updated successfully",
      profile: {
        firstName: cleanFirstName,
        lastName: cleanLastName,
        displayName,
        phone: cleanPhone,
        photoURL: cleanPhotoURL,
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update profile"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
