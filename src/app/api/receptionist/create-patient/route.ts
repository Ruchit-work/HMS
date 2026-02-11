import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { sendWhatsAppNotification } from "@/server/whatsapp"
import { authenticateRequest, createAuthErrorResponse } from "@/utils/firebase/apiAuth"
import { applyRateLimit } from "@/utils/shared/rateLimit"
import { getUserActiveHospitalId, getHospitalCollectionPath } from "@/utils/firebase/serverHospitalQueries"

const buildWelcomeMessage = (firstName?: string, lastName?: string, patientId?: string, email?: string) => {
  const friendlyName = firstName?.trim() || "there"
  const fullName = `${firstName || ""} ${lastName || ""}`.trim() || "Patient"
  const idCopy = patientId ? `• Patient ID: ${patientId}` : ""
  const emailCopy = email ? `• Email: ${email}` : ""
  
  return `🎉 *Account Successfully Created!*

Hi ${friendlyName},

Welcome to Harmony Medical Services! Your patient account has been successfully created by our receptionist.

📋 *Account Details:*
${idCopy}
• Name: ${fullName}
${emailCopy}

✅ You can now:
• Book appointments with our doctors
• View your medical history
• Access your patient dashboard
• Receive appointment updates and reminders via WhatsApp

If you need any assistance, reply here or call us at +91-XXXXXXXXXX.

Thank you for choosing Harmony Medical Services! 🏥`
}

export async function POST(request: Request) {
  // Apply rate limiting first
  const rateLimitResult = await applyRateLimit(request, "USER_CREATION")
  if (rateLimitResult instanceof Response) {
    return rateLimitResult // Rate limited
  }

  // Authenticate request - requires receptionist or admin role
  const auth = await authenticateRequest(request)
  if (!auth.success) {
    return createAuthErrorResponse(auth)
  }
  
  // Allow receptionists, admins, and doctors (e.g. when doctor books for new patient)
  if (!auth.user || (auth.user.role !== "receptionist" && auth.user.role !== "admin" && auth.user.role !== "doctor")) {
    return Response.json(
      { error: "Access denied. Only receptionists, admins, and doctors can create patients." },
      { status: 403 }
    )
  }

  // Check if user is super admin and block them
  let isSuperAdmin = false
  try {
    const userDoc = await admin.firestore().collection('users').doc(auth.user.uid).get()
    if (userDoc.exists) {
      const userData = userDoc.data()
      isSuperAdmin = userData?.role === 'super_admin'
    } else {
      // Fallback: Check admins collection
      const adminDoc = await admin.firestore().collection('admins').doc(auth.user.uid).get()
      if (adminDoc.exists) {
        const adminData = adminDoc.data()
        isSuperAdmin = adminData?.isSuperAdmin === true
      }
    }
    
    if (isSuperAdmin) {
      return Response.json(
        { error: "Super admins cannot create patients. Please use a regular admin or receptionist account." },
        { status: 403 }
      )
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
    const initResult = initFirebaseAdmin("create-patient API")
    if (!initResult.ok) {
      return Response.json({ error: "Server not configured for admin" }, { status: 500 })
    }

    const body = await request.json().catch(() => ({}))
    const patientData = body?.patientData
    const password: string | undefined = body?.password
    if (!patientData) {
      return Response.json({ error: "Missing patientData" }, { status: 400 })
    }

    const { firstName, lastName, email } = patientData
    if (!firstName || !lastName || !email) {
      return Response.json({ error: "firstName, lastName, and email are required" }, { status: 400 })
    }
    if (!password || password.length < 6) {
      return Response.json({ error: "Password must be at least 6 characters" }, { status: 400 })
    }

    // Create Auth user with provided password
    let authUid: string
    try {
      const existing = await admin.auth().getUserByEmail(String(email).trim().toLowerCase())
      // If exists, update password
      authUid = existing.uid
      await admin.auth().updateUser(authUid, { password })
    } catch {
      const created = await admin.auth().createUser({
        email: String(email).trim().toLowerCase(),
        emailVerified: false,
        disabled: false,
        password
      })
      authUid = created.uid
    }

    // Get user's active hospital ID (works for both receptionists and admins)
    const userHospitalId = await getUserActiveHospitalId(auth.user!.uid)
    if (!userHospitalId) {
      return Response.json({ error: "User's hospital not found. Please ensure you have an active hospital selected." }, { status: 400 })
    }

    // Get receptionist's branch ID (if user is a receptionist)
    let defaultBranchId: string | null = null
    let defaultBranchName: string | null = null
    if (auth.user!.role === "receptionist") {
      const receptionistDoc = await admin.firestore().collection("receptionists").doc(auth.user!.uid).get()
      if (receptionistDoc.exists) {
        const receptionistData = receptionistDoc.data()
        defaultBranchId = receptionistData?.branchId || null
        defaultBranchName = receptionistData?.branchName || null
      }
    }

    const db = admin.firestore()
    const START_NUMBER = 12906
    const patientId = await db.runTransaction(async (transaction) => {
      const counterRef = db.collection("meta").doc("patientIdCounter")
      const counterSnap = await transaction.get(counterRef)

      let lastNumber = START_NUMBER - 1
      if (counterSnap.exists) {
        const data = counterSnap.data()
        const stored = typeof data?.lastNumber === "number" ? data.lastNumber : undefined
        if (stored && stored >= START_NUMBER - 1) {
          lastNumber = stored
        }
      }

      const nextNumber = lastNumber + 1
      transaction.set(
        counterRef,
        {
          lastNumber: nextNumber,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        },
        { merge: true }
      )

      return nextNumber.toString().padStart(6, "0")
    })

    const nowIso = new Date().toISOString()
    const docData = {
      status: patientData.status || "active",
      firstName: String(firstName).trim(),
      lastName: String(lastName).trim(),
      email: String(email).trim().toLowerCase(),
      phone: patientData.phone || "",
      gender: patientData.gender || "",
      bloodGroup: patientData.bloodGroup || "",
      address: patientData.address || "",
      dateOfBirth: patientData.dateOfBirth || "",
      createdAt: patientData.createdAt || nowIso,
      updatedAt: nowIso,
      createdBy: patientData.createdBy || "receptionist",
      patientId,
      hospitalId: userHospitalId, // Store hospital association
      defaultBranchId: defaultBranchId || null, // Store default branch (where patient was registered)
      defaultBranchName: defaultBranchName || null,
    }

    // Store patient doc in hospital-scoped subcollection
    await db.collection(getHospitalCollectionPath(userHospitalId, "patients")).doc(authUid).set(docData, { merge: true })
    
    // Also store in legacy collection for backward compatibility (patient dashboard uses user.uid)
    await db.collection("patients").doc(authUid).set(docData, { merge: true })

    // Create/update user document in users collection for multi-hospital support
    const userDocRef = db.collection("users").doc(authUid)
    const existingUserDoc = await userDocRef.get()
    
    if (existingUserDoc.exists) {
      // User exists - add hospital to hospitals array if not already present
      const userData = existingUserDoc.data()
      const hospitals = userData?.hospitals || []
      if (!hospitals.includes(userHospitalId)) {
        hospitals.push(userHospitalId)
      }
      await userDocRef.update({
        hospitals,
        activeHospital: userHospitalId, // Set as active if not set
        updatedAt: nowIso,
      })
    } else {
      // Create new user document
      await userDocRef.set({
        uid: authUid,
        email: String(email).trim().toLowerCase(),
        role: "patient",
        hospitals: [userHospitalId],
        activeHospital: userHospitalId,
        createdAt: nowIso,
        updatedAt: nowIso,
      })
    }

    // Try multiple phone number fields and formats
    const phoneCandidates = [
      patientData.phone,
      patientData.phoneNumber,
      `${patientData.phoneCountryCode || ""}${patientData.phoneNumber || ""}`,
      docData.phone, // Also check stored phone in docData
    ].filter((phone) => phone && typeof phone === "string" && phone.trim() !== "")

    // Send WhatsApp notification only if we have a phone number (don't block on this)
    if (phoneCandidates.length > 0) {
      try {
        const result = await sendWhatsAppNotification({
          to: phoneCandidates[0],
          fallbackRecipients: phoneCandidates.slice(1),
          message: buildWelcomeMessage(docData.firstName, docData.lastName, patientId, docData.email),
        })
        if (!result.success) {
          // Try fallback recipients if primary failed
          if (phoneCandidates.length > 1 && result.errorCode !== 4) { // Don't retry on rate limit
            for (let i = 1; i < phoneCandidates.length; i++) {
              const fallbackResult = await sendWhatsAppNotification({
                to: phoneCandidates[i],
                message: buildWelcomeMessage(docData.firstName, docData.lastName, patientId, docData.email),
              })
              if (fallbackResult.success) {
                break
              }
            }
          }
        }
      } catch {
      }
    } else {
    }

    return Response.json({ success: true, id: authUid, authUid, patientId })
  } catch (error: any) {
    return Response.json({ error: error?.message || "Failed to create patient" }, { status: 500 })
  }
}


