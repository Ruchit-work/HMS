/**
 * Diagnostic endpoint to check if auto-campaigns system is properly configured
 * This endpoint checks environment variables and Firebase Admin setup
 */

import { NextResponse } from "next/server"
import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { authenticateRequest, createAuthErrorResponse } from "@/utils/apiAuth"

/**
 * GET /api/auto-campaigns/check
 * Returns diagnostic information about the auto-campaigns system configuration
 */
export async function GET(request: Request) {
  // Authenticate request - requires admin role
  const auth = await authenticateRequest(request, "admin")
  if (!auth.success) {
    return createAuthErrorResponse(auth)
  }

  try {
    const diagnostics: {
      groqApiKey: boolean
      firebaseAdmin: boolean
      firebaseAdminError?: string
      firestoreAccess: boolean
      firestoreError?: string
      healthAwarenessDays: boolean
      healthAwarenessDaysError?: string
      whatsappConfigured: boolean
      whatsappError?: string
      allOk: boolean
    } = {
      groqApiKey: false,
      firebaseAdmin: false,
      firestoreAccess: false,
      healthAwarenessDays: false,
      whatsappConfigured: false,
      allOk: false,
    }

    // Check GROQ_API_KEY
    diagnostics.groqApiKey = !!process.env.GROQ_API_KEY

    // Check WhatsApp configuration
    const metaAccessToken = process.env.META_WHATSAPP_ACCESS_TOKEN
    const metaPhoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID
    diagnostics.whatsappConfigured = !!(metaAccessToken && metaPhoneNumberId)
    if (!diagnostics.whatsappConfigured) {
      const missing = []
      if (!metaAccessToken) missing.push("META_WHATSAPP_ACCESS_TOKEN")
      if (!metaPhoneNumberId) missing.push("META_WHATSAPP_PHONE_NUMBER_ID")
      diagnostics.whatsappError = `Missing: ${missing.join(", ")}`
    }

    // Check Firebase Admin
    const adminResult = initFirebaseAdmin("auto-campaigns-check API")
    diagnostics.firebaseAdmin = adminResult.ok
    if (!adminResult.ok) {
      diagnostics.firebaseAdminError = adminResult.error
    }

    // Check Firestore access
    if (diagnostics.firebaseAdmin) {
      try {
        const db = admin.firestore()
        // Try to read from campaigns collection (just to test access)
        await db.collection("campaigns").limit(1).get()
        diagnostics.firestoreAccess = true
      } catch (error: any) {
        diagnostics.firestoreAccess = false
        diagnostics.firestoreError = error?.message || "Failed to access Firestore"
      }
    }

    // Check health awareness days import
    try {
      const { HEALTH_AWARENESS_DAYS } = await import("@/server/healthAwarenessDays")
      diagnostics.healthAwarenessDays = Array.isArray(HEALTH_AWARENESS_DAYS) && HEALTH_AWARENESS_DAYS.length > 0
      if (!diagnostics.healthAwarenessDays) {
        diagnostics.healthAwarenessDaysError = "Health awareness days array is empty or invalid"
      }
    } catch (error: any) {
      diagnostics.healthAwarenessDays = false
      diagnostics.healthAwarenessDaysError = error?.message || "Failed to import health awareness days"
    }

    // Check if all prerequisites are met
    diagnostics.allOk =
      diagnostics.groqApiKey &&
      diagnostics.firebaseAdmin &&
      diagnostics.firestoreAccess &&
      diagnostics.healthAwarenessDays &&
      diagnostics.whatsappConfigured

    return NextResponse.json({
      success: true,
      diagnostics,
      message: diagnostics.allOk
        ? "All systems are ready! You can generate campaigns."
        : "Some configuration is missing. Please check the diagnostics below.",
      hints: {
        groqApiKey: diagnostics.groqApiKey
           ? "✓ GROQ_API_KEY is set"
          : "✗ GROQ_API_KEY is missing. Set it in your .env.local file",
        firebaseAdmin: diagnostics.firebaseAdmin
          ? "✓ Firebase Admin is initialized"
          : `✗ Firebase Admin failed: ${diagnostics.firebaseAdminError}. Check FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY in .env.local`,
        firestoreAccess: diagnostics.firestoreAccess
          ? "✓ Firestore access is working"
          : `✗ Firestore access failed: ${diagnostics.firestoreError}. Check Firebase permissions`,
        healthAwarenessDays: diagnostics.healthAwarenessDays
          ? "✓ Health awareness days are loaded"
          : `✗ Health awareness days failed: ${diagnostics.healthAwarenessDaysError}`,
        whatsappConfigured: diagnostics.whatsappConfigured
          ? "✓ WhatsApp (Meta) is configured"
          : `✗ WhatsApp not configured: ${diagnostics.whatsappError}. Set META_WHATSAPP_ACCESS_TOKEN and META_WHATSAPP_PHONE_NUMBER_ID in Vercel environment variables`,
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to check configuration",
        details: error?.stack,
      },
      { status: 500 }
    )
  }
}

