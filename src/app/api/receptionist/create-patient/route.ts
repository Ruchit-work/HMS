import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { sendWhatsAppNotification } from "@/server/whatsapp"
import { authenticateRequest, createAuthErrorResponse } from "@/utils/apiAuth"
import { applyRateLimit } from "@/utils/rateLimit"

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
  if (auth.user && auth.user.role !== "receptionist" && auth.user.role !== "admin") {
    return Response.json(
      { error: "Access denied. This endpoint requires receptionist or admin role." },
      { status: 403 }
    )
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
    } catch (_e) {
      const created = await admin.auth().createUser({
        email: String(email).trim().toLowerCase(),
        emailVerified: false,
        disabled: false,
        password
      })
      authUid = created.uid
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
      patientId
    }

    // Store patient doc with ID = authUid (so patient dashboard can load by user.uid)
    await db.collection("patients").doc(authUid).set(docData, { merge: true })

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
        if (result.success) {
          console.log("[create-patient] ✅ WhatsApp message sent successfully to:", phoneCandidates[0])
        } else {
          console.error("[create-patient] ❌ WhatsApp notification failed:", {
            phone: phoneCandidates[0],
            error: result.error,
            errorCode: result.errorCode,
          })
          // Try fallback recipients if primary failed
          if (phoneCandidates.length > 1 && result.errorCode !== 4) { // Don't retry on rate limit
            for (let i = 1; i < phoneCandidates.length; i++) {
              const fallbackResult = await sendWhatsAppNotification({
                to: phoneCandidates[i],
                message: buildWelcomeMessage(docData.firstName, docData.lastName, patientId, docData.email),
              })
              if (fallbackResult.success) {
                console.log("[create-patient] ✅ WhatsApp message sent successfully to fallback number:", phoneCandidates[i])
                break
              }
            }
          }
        }
      } catch (error) {
        console.error("[create-patient] ❌ Error sending WhatsApp notification:", error)
      }
    } else {
      console.warn("[create-patient] ⚠️ No phone number found, WhatsApp message not sent. Patient:", docData.firstName, docData.lastName, "Phone fields checked:", {
        phone: patientData.phone,
        phoneNumber: patientData.phoneNumber,
        phoneCountryCode: patientData.phoneCountryCode,
        docDataPhone: docData.phone,
      })
    }

    return Response.json({ success: true, id: authUid, authUid, patientId })
  } catch (error: any) {
    console.error("receptionist create-patient error:", error)
    return Response.json({ error: error?.message || "Failed to create patient" }, { status: 500 })
  }
}


