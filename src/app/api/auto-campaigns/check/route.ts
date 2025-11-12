/**
 * Diagnostic endpoint to check if auto-campaigns system is properly configured
 * This endpoint checks environment variables and Firebase Admin setup
 */

import { NextResponse } from "next/server"
import admin from "firebase-admin"

function initAdmin() {
  if (!admin.apps.length) {
    const projectId = process.env.FIREBASE_PROJECT_ID
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
    let privateKey = process.env.FIREBASE_PRIVATE_KEY

    if (privateKey && privateKey.startsWith('"') && privateKey.endsWith('"')) {
      privateKey = privateKey.slice(1, -1)
    }
    if (privateKey) {
      privateKey = privateKey.replace(/\\n/g, "\n")
    }

    if (!projectId || !clientEmail || !privateKey) {
      return { ok: false, error: "Missing Firebase Admin credentials" }
    }

    try {
      admin.initializeApp({
        credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
      })
      return { ok: true }
    } catch (error: any) {
      return { ok: false, error: error?.message || "Failed to initialize Firebase Admin" }
    }
  }
  return { ok: true }
}

/**
 * GET /api/auto-campaigns/check
 * Returns diagnostic information about the auto-campaigns system configuration
 */
export async function GET() {
  try {
    const diagnostics: {
      groqApiKey: boolean
      firebaseAdmin: boolean
      firebaseAdminError?: string
      firestoreAccess: boolean
      firestoreError?: string
      healthAwarenessDays: boolean
      healthAwarenessDaysError?: string
      allOk: boolean
    } = {
      groqApiKey: false,
      firebaseAdmin: false,
      firestoreAccess: false,
      healthAwarenessDays: false,
      allOk: false,
    }

    // Check GROQ_API_KEY
    diagnostics.groqApiKey = !!process.env.GROQ_API_KEY

    // Check Firebase Admin
    const adminResult = initAdmin()
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
      diagnostics.healthAwarenessDays

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
      },
    })
  } catch (error: any) {
    console.error("check endpoint error:", error)
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

